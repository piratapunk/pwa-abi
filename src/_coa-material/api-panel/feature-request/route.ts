import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

const featureRequestSchema = z
  .object({
    slug: z.string().regex(SLUG_RE),
    title: z.string().min(4).max(160),
    detail: z.string().max(4000),
    _h: z.string().max(0),
  })
  .strict()

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`featreq:${clientIp(req)}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof featureRequestSchema>
  try {
    body = featureRequestSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  if (!sql) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  try {
    const rows = await sql`
      select abi.create_feature_request(
        ${userId}::uuid, ${body.slug}, ${body.title}, ${body.detail}
      ) as r
    `
    const r = rows[0]?.r as { ok: boolean }
    if (!r?.ok) return NextResponse.json({ error: 'invalid' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
