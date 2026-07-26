import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createAuthClient } from '@/lib/auth/server'
import { dropLiveLink } from '@/lib/auth/link-cache'
import { getSql } from '@/lib/db'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

/*
 * Verificación del magic link por POST desde /entrar/confirmar: los
 * prefetchers de los clientes de correo hacen GET y no ejecutan JS, así que
 * el token de un solo uso ya no se quema antes del click real (el bug que
 * mandaba al dueño de vuelta a la landing).
 */

const verifySchema = z
  .object({
    token_hash: z.string().min(10).max(500),
    type: z.enum(['magiclink', 'signup', 'recovery']),
    bs: z.uuid().optional(),
  })
  .strict()

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`verify:${clientIp(req)}`, 20, 600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof verifySchema>
  try {
    body = verifySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const supabase = await createAuthClient()
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: body.token_hash,
    type: body.type,
  })
  if (error || !data.user) {
    return NextResponse.json({ error: 'expired' }, { status: 401 })
  }

  /* enlace canjeado: el token ya murió, que un reenvío no lo recicle */
  if (data.user.email) dropLiveLink(data.user.email.trim().toLowerCase())

  /* claim: liga los bots de la sesión del constructor al usuario */
  const sql = getSql()
  if (body.bs && sql) {
    try {
      await sql`select abi.claim_tenant(${body.bs}::uuid, ${data.user.id}::uuid)`
    } catch {}
  }

  /* con un solo bot, directo a su panel; si no, a la lista */
  let redirect = '/inicio'
  if (sql) {
    try {
      const rows = await sql`select abi.user_tenants(${data.user.id}::uuid) as t`
      const tenants = (rows[0]?.t as { slug: string }[]) ?? []
      if (tenants.length === 1) redirect = `/panel/${tenants[0].slug}`
    } catch {}
  }
  return NextResponse.json({ ok: true, redirect })
}
