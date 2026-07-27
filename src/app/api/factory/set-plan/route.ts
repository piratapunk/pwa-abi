import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'

/*
 * Marca el plan de un tenant, server-to-server desde el portal (mismo token
 * compartido que /api/factory/provision). Lo llama el webhook de Stripe del
 * portal cuando se confirma la suscripción: el portal vive en otra base
 * (agavesysmx en vps-ops) y NO puede tocar abi.tenants — esta es su puerta.
 */

const schema = z
  .object({
    slug: z.string().regex(SLUG_RE),
    plan: z.enum(['free', 'premium', 'enterprise']),
    // Quien paga la suscripción queda como dueño del bot — es el vínculo del
    // ecosistema con Coa (que lista los bots del cliente por este email).
    ownerEmail: z.string().email().max(200).optional(),
  })
  .strict()

export async function POST(req: NextRequest) {
  const token = process.env.ABI_PORTAL_TOKEN
  if (!token || req.headers.get('authorization') !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  if (!sql) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  try {
    const rows = await sql`
      update abi.tenants set
        plan = ${body.plan},
        owner_email = coalesce(nullif(${body.ownerEmail ?? ''}, ''), owner_email)
       where slug = ${body.slug} and status = 'active'
       returning slug, plan`
    if (rows.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, slug: rows[0].slug, plan: rows[0].plan })
  } catch (e) {
    console.error('[set-plan] error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }
}
