import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getSql } from '@/lib/db'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

const leadSchema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(200).optional(),
    phone: z.string().min(7).max(30).optional(),
    business: z.string().max(200).optional(),
    message: z.string().max(1000).optional(),
    sessionId: z.uuid().optional(),
    _h: z.string().max(0),
  })
  .strict()
  .refine((v) => v.email || v.phone, { message: 'email o teléfono requerido' })

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`lead:${clientIp(req)}`, 15, 3_600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof leadSchema>
  try {
    body = leadSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  if (!sql) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  try {
    await sql`
      insert into necta.leads (name, email, phone, business, message, session_id, source)
      values (
        ${body.name},
        ${body.email ?? null},
        ${body.phone ?? null},
        ${body.business ?? null},
        ${body.message ?? null},
        ${body.sessionId ?? null},
        'abi.agavesysmx.com'
      )
    `
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
