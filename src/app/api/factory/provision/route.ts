import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { botSpecSchema } from '@/lib/factory/spec'
import { sendWelcomeEmail } from '@/lib/factory/welcome'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'
import { HUMAN_COOKIE, isHumanCookieValid, verifyTurnstile } from '@/lib/turnstile'

/*
 * Materializa un bot_spec: schema propio + rol propio + subdominio, vía el
 * contrato abi.provision_tenant (SECURITY DEFINER, idempotente por sesión).
 * La master key solo existe en el entorno del servidor; jamás sale en la
 * respuesta ni se persiste en claro.
 */

const provisionSchema = z
  .object({
    builderSessionId: z.uuid(),
    spec: botSpecSchema,
    turnstileToken: z.string().max(3000).optional(),
    _h: z.string().max(0),
  })
  .strict()

export async function POST(req: NextRequest) {
  /* El portal de Agave provisiona server-to-server con token compartido: sin
     navegador no hay Origin ni cookie humana — el token es su equivalente. */
  const portalToken = process.env.ABI_PORTAL_TOKEN
  const esPortal = Boolean(
    portalToken && req.headers.get('authorization') === `Bearer ${portalToken}`,
  )
  if (!esPortal && !hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const ip = clientIp(req)
  if (!rateLimit(`provision:${ip}`, 12, 3_600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof provisionSchema>
  try {
    body = provisionSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  /* humano verificado: cookie firmada del constructor, o token propio.
     El portal ya corrió su propia conversación con el dueño — se le cree. */
  if (!esPortal && !isHumanCookieValid(req.cookies.get(HUMAN_COOKIE)?.value)) {
    const ok = body.turnstileToken
      ? await verifyTurnstile(body.turnstileToken, ip)
      : false
    if (!ok) {
      return NextResponse.json({ error: 'turnstile_required' }, { status: 403 })
    }
  }

  const sql = getSql()
  const masterKey = process.env.ABI_FACTORY_MASTER_KEY
  if (!sql || !masterKey) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  try {
    const rows = await sql`
      select abi.provision_tenant(
        ${body.builderSessionId}::uuid,
        ${sql.json(body.spec)},
        ${masterKey}
      ) as result
    `
    const result = rows[0]?.result as {
      ok: boolean
      slug: string
      subdomain: string
    }
    if (!result?.ok) {
      return NextResponse.json({ error: 'provision_failed' }, { status: 500 })
    }
    /* con sesión iniciada, el bot queda ligado al dueño sin pedir correo */
    let claimed = false
    try {
      const userId = await getAuthUserId()
      if (userId) {
        await sql`select abi.claim_tenant(${body.builderSessionId}::uuid, ${userId}::uuid)`
        claimed = true
      }
    } catch {}
    /* ecosistema: el correo de la ficha es el dueño → Coa gratis desde el día
       uno; varios bots con el mismo correo caen solos en la misma cuenta */
    const ownerEmail = body.spec.contact?.email?.trim().toLowerCase()
    if (ownerEmail) {
      try {
        await sql`
          update abi.tenants set owner_email = coalesce(owner_email, ${ownerEmail})
           where slug = ${result.slug} and status = 'active'`
        await sendWelcomeEmail({
          email: ownerEmail,
          botName: body.spec.persona?.bot_name || body.spec.business_name || 'Tu asistente',
          botUrl: `https://${result.subdomain}`,
        })
      } catch (e) {
        console.error('[provision] owner_email:', e instanceof Error ? e.message : e)
      }
    }
    return NextResponse.json({
      ok: true,
      slug: result.slug,
      subdomain: result.subdomain,
      url: `https://${result.subdomain}`,
      claimed,
    })
  } catch (err) {
    try {
      await sql`select abi.factory_log_failure(
        ${body.builderSessionId}::uuid,
        ${err instanceof Error ? err.message : 'error desconocido'}
      )`
    } catch {}
    return NextResponse.json({ error: 'provision_failed' }, { status: 500 })
  }
}
