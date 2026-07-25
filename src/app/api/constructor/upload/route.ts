import { NextRequest, NextResponse } from 'next/server'

import { getSql } from '@/lib/db'
import { signPayload } from '@/lib/factory/hmac'
import { sanitizeExtracted } from '@/lib/factory/sanitize'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'
import { HUMAN_COOKIE, isHumanCookieValid } from '@/lib/turnstile'

/*
 * Ingesta de documentos del Constructor (SECURITY.md): el archivo entra a
 * CUARENTENA (abi.kb_sources), se extrae SOLO texto en el servicio del
 * Constructor, se sanitiza aquí, y nada se materializa hasta que el dueño
 * revisa y aprueba (y provision_tenant solo lee status='approved').
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ALLOWED_EXT = new Set(['pdf', 'txt', 'md', 'csv', 'docx'])

type PlanLimits = { files_max: number; file_max_mb: number; extracted_max_chars: number }
const FALLBACK_LIMITS: PlanLimits = { files_max: 1, file_max_mb: 2, extracted_max_chars: 20000 }

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const ip = clientIp(req)
  if (
    !rateLimit(`ctorup-ip:${ip}`, 10, 600_000) ||
    !rateLimit(`ctorup-hr:${ip}`, 30, 3_600_000)
  ) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  /* misma verificación humana que el chat del Constructor */
  if (!isHumanCookieValid(req.cookies.get(HUMAN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'turnstile_required' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const sessionId = String(form.get('sessionId') ?? '')
  const file = form.get('file')
  if (!UUID_RE.test(sessionId) || !(file instanceof File)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (!rateLimit(`ctorup-sid:${sessionId}`, 6, 600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const filename = (file.name || 'archivo').slice(0, 180)
  const ext = (filename.includes('.') ? filename.split('.').pop()! : '').toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: 'tipo_no_permitido' }, { status: 415 })
  }

  const sql = getSql()
  if (!sql) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  let limits = FALLBACK_LIMITS
  try {
    const rows = await sql`
      select files_max, file_max_mb, extracted_max_chars
      from abi.plan_limits where plan = 'free'
    `
    if (rows[0]) limits = rows[0] as PlanLimits
  } catch {}

  if (file.size > limits.file_max_mb * 1024 * 1024) {
    return NextResponse.json(
      { error: 'demasiado_grande', max_mb: limits.file_max_mb },
      { status: 413 }
    )
  }

  /* candado del plan: máximo files_max archivos aprobados por sesión; un
     archivo en revisión nuevo reemplaza al anterior no aprobado */
  const counts = await sql`
    select
      count(*) filter (where status = 'approved')::int as approved,
      count(*) filter (where status = 'sanitized')::int as pending
    from abi.kb_sources where builder_session_id = ${sessionId}::uuid
  `
  if ((counts[0]?.approved ?? 0) >= limits.files_max) {
    return NextResponse.json(
      { error: 'limite_archivos', files_max: limits.files_max },
      { status: 409 }
    )
  }
  if ((counts[0]?.pending ?? 0) > 0) {
    await sql`
      update abi.kb_sources
      set status = 'rejected', reject_reason = 'reemplazado', updated_at = now()
      where builder_session_id = ${sessionId}::uuid and status = 'sanitized'
    `
  }

  const serviceUrl = process.env.ABI_CONSTRUCTOR_URL
  const secret = process.env.ABI_FACTORY_HMAC_SECRET
  if (!serviceUrl || !secret) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const data = Buffer.from(await file.arrayBuffer())
  const payload = JSON.stringify({
    filename,
    data_b64: data.toString('base64'),
  })
  const { header } = signPayload(payload, secret)

  let rawText = ''
  try {
    const res = await fetch(`${serviceUrl}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-abi-signature': header },
      signal: AbortSignal.timeout(60_000),
      body: payload,
    })
    if (!res.ok) throw new Error(String(res.status))
    const out = (await res.json()) as { ok: boolean; text?: string; error?: string }
    if (!out.ok) {
      return NextResponse.json({ error: out.error ?? 'no_se_pudo_leer' }, { status: 422 })
    }
    rawText = out.text ?? ''
  } catch {
    return NextResponse.json({ error: 'extraccion_fallo' }, { status: 502 })
  }

  const { text, droppedLines } = sanitizeExtracted(rawText, limits.extracted_max_chars)
  if (text.length < 20) {
    await sql`
      insert into abi.kb_sources
        (builder_session_id, filename, mime, bytes, status, reject_reason, extracted_chars)
      values
        (${sessionId}::uuid, ${filename}, ${file.type || 'application/octet-stream'},
         ${file.size}, 'rejected', 'sin_texto', 0)
    `
    return NextResponse.json({ error: 'sin_texto' }, { status: 422 })
  }

  const rows = await sql`
    insert into abi.kb_sources
      (builder_session_id, filename, mime, bytes, status, extracted_text,
       extracted_chars, injection_lines_dropped)
    values
      (${sessionId}::uuid, ${filename}, ${file.type || 'application/octet-stream'},
       ${file.size}, 'sanitized', ${text}, ${text.length}, ${droppedLines})
    returning id
  `
  return NextResponse.json({
    ok: true,
    id: rows[0].id,
    filename,
    chars: text.length,
    text,
  })
}
