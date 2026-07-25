import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'
import { sendInboxMessage } from '@/lib/zernio'

const bodySchema = z
  .object({
    slug: z.string().regex(SLUG_RE),
    session: z.uuid(),
    message: z.string().min(1).max(4000),
  })
  .strict()

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`crmreply:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  if (!sql) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const plan = await sql`
    select t.plan from necta.tenants t
    where t.id = necta.user_owns_tenant(${userId}::uuid, ${body.slug})
  `
  if (!plan[0]) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (plan[0].plan === 'free') {
    return NextResponse.json({ error: 'premium_required' }, { status: 402 })
  }

  try {
    const rows = await sql`
      select necta.tenant_owner_reply(
        ${userId}::uuid, ${body.slug}, ${body.session}::uuid, ${body.message}
      ) as r
    `
    const r = rows[0]?.r as {
      ok: boolean
      channel?: string
      external_id?: string | null
      error?: string
    }
    if (!r?.ok) return NextResponse.json({ error: r?.error ?? 'invalid' }, { status: 400 })

    /* WhatsApp: además del registro, el mensaje sale por el canal real */
    let delivered = true
    if (r.channel === 'whatsapp') {
      delivered = r.external_id ? await sendInboxMessage(r.external_id, body.message) : false
    }
    return NextResponse.json({ ok: true, channel: r.channel, delivered })
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
