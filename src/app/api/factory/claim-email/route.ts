import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getSql } from '@/lib/db'

/*
 * Claim por correo (lazy registration): el portal liga el bot recién creado al
 * correo del dueño. La llave es el builderSessionId — un UUID secreto que solo
 * tiene el navegador que creó el bot — nunca el slug, que es público y
 * adivinable (regla IDOR). Primer claim gana: owner_email jamás se pisa.
 */

const schema = z
  .object({
    builderSessionId: z.uuid(),
    email: z.string().email().max(200),
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

  const email = body.email.trim().toLowerCase()
  try {
    const rows = await sql`
      update abi.tenants t
         set owner_email = coalesce(t.owner_email, ${email})
        from abi.bot_specs bs
       where bs.builder_session_id = ${body.builderSessionId}::uuid
         and bs.tenant_id = t.id
         and t.status = 'active'
       returning t.slug, t.name, t.subdomain, t.owner_email`
    if (rows.length === 0) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    const r = rows[0]
    if ((r.owner_email as string) !== email) {
      /* ya estaba ligado a otro correo — no se pisa, y no se revela cuál */
      return NextResponse.json({ error: 'already_claimed' }, { status: 409 })
    }
    return NextResponse.json({ ok: true, slug: r.slug, name: r.name, subdomain: r.subdomain })
  } catch (e) {
    console.error('[claim-email] error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }
}
