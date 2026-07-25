import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getSql } from '@/lib/db'
import { sanitizeExtracted } from '@/lib/factory/sanitize'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'
import { HUMAN_COOKIE, isHumanCookieValid } from '@/lib/turnstile'

/* revisión del dueño sobre un documento en cuarentena: aprobar (con posibles
   ediciones — el texto editado se re-sanitiza) o descartar */

const bodySchema = z
  .object({
    sessionId: z.uuid(),
    id: z.uuid(),
    action: z.enum(['approve', 'reject']),
    text: z.string().max(250_000).optional(),
  })
  .strict()

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`ctorkb:${clientIp(req)}`, 30, 600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  if (!isHumanCookieValid(req.cookies.get(HUMAN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'turnstile_required' }, { status: 403 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  if (!sql) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  if (body.action === 'reject') {
    const rows = await sql`
      update abi.kb_sources
      set status = 'rejected', reject_reason = 'descartado', updated_at = now()
      where id = ${body.id}::uuid
        and builder_session_id = ${body.sessionId}::uuid
        and status = 'sanitized'
      returning id
    `
    if (!rows[0]) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  let maxChars = 20000
  try {
    const lim = await sql`
      select extracted_max_chars from abi.plan_limits where plan = 'free'
    `
    if (lim[0]) maxChars = lim[0].extracted_max_chars as number
  } catch {}

  if (body.text !== undefined) {
    const { text } = sanitizeExtracted(body.text, maxChars)
    if (text.length < 20) {
      return NextResponse.json({ error: 'sin_texto' }, { status: 422 })
    }
    const rows = await sql`
      update abi.kb_sources
      set status = 'approved', extracted_text = ${text},
          extracted_chars = ${text.length}, updated_at = now()
      where id = ${body.id}::uuid
        and builder_session_id = ${body.sessionId}::uuid
        and status = 'sanitized'
      returning id, extracted_chars
    `
    if (!rows[0]) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, chars: rows[0].extracted_chars })
  }

  const rows = await sql`
    update abi.kb_sources
    set status = 'approved', updated_at = now()
    where id = ${body.id}::uuid
      and builder_session_id = ${body.sessionId}::uuid
      and status = 'sanitized'
    returning id, extracted_chars
  `
  if (!rows[0]) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true, chars: rows[0].extracted_chars })
}
