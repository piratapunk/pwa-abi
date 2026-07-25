import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

const bodySchema = z
  .object({
    slug: z.string().regex(SLUG_RE),
    session: z.uuid(),
    mode: z.enum(['bot', 'human']),
  })
  .strict()

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`crmmode:${clientIp(req)}`, 30, 60_000)) {
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
    select t.plan from abi.tenants t
    where t.id = abi.user_owns_tenant(${userId}::uuid, ${body.slug})
  `
  if (!plan[0]) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (plan[0].plan === 'free') {
    return NextResponse.json({ error: 'premium_required' }, { status: 402 })
  }

  try {
    const rows = await sql`
      select abi.tenant_conversation_set_mode(
        ${userId}::uuid, ${body.slug}, ${body.session}::uuid, ${body.mode}
      ) as r
    `
    const r = rows[0]?.r as { ok: boolean; error?: string }
    if (!r?.ok) return NextResponse.json({ error: r?.error ?? 'invalid' }, { status: 400 })
    return NextResponse.json({ ok: true, mode: body.mode })
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
