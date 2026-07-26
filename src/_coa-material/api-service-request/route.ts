import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCatalog } from '@/lib/catalog'
import { getSql } from '@/lib/db'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

const schema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(200).optional(),
    phone: z.string().min(7).max(30).optional(),
    business: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
    vertical: z.string().max(80).optional(),
    builderSessionId: z.uuid().optional(),
    services: z.array(z.string().min(1).max(80)).min(1).max(40),
    _h: z.string().max(0),
  })
  .strict()
  .refine((v) => v.email || v.phone, { message: 'email o teléfono requerido' })

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`service-request:${clientIp(req)}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  if (!sql) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  // Valida los slugs contra el catálogo y toma el nombre real (snapshot).
  const catalog = await getCatalog()
  const bySlug = new Map(
    catalog.flatMap((g) => g.services).map((s) => [s.slug, s.name])
  )
  const items = [...new Set(body.services)]
    .filter((slug) => bySlug.has(slug))
    .map((slug) => ({ service_slug: slug, service_name: bySlug.get(slug)! }))

  if (items.length === 0) {
    return NextResponse.json({ error: 'no_valid_services' }, { status: 400 })
  }

  try {
    await sql.begin(async (sql) => {
      const [lead] = await sql`
        insert into abi.leads (name, email, phone, business, message, session_id, source)
        values (
          ${body.name}, ${body.email ?? null}, ${body.phone ?? null},
          ${body.business ?? null}, ${body.notes ?? null},
          ${body.builderSessionId ?? null}, 'nectacore.com/servicios'
        )
        returning id
      `
      const [reqRow] = await sql`
        insert into abi.service_requests
          (builder_session_id, lead_id, contact_name, contact_email, contact_phone,
           business, vertical, notes, source)
        values (
          ${body.builderSessionId ?? null}, ${lead.id}, ${body.name},
          ${body.email ?? null}, ${body.phone ?? null}, ${body.business ?? null},
          ${body.vertical ?? null}, ${body.notes ?? null}, 'nectacore.com/servicios'
        )
        returning id
      `
      const rows = items.map((it) => ({
        request_id: reqRow.id,
        service_slug: it.service_slug,
        service_name: it.service_name,
      }))
      await sql`
        insert into abi.service_request_items ${sql(
          rows,
          'request_id',
          'service_slug',
          'service_name'
        )}
      `
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
