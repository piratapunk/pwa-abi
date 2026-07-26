import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId, getAppOrigin } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'
import { getStripe } from '@/lib/stripe'

const portalSchema = z
  .object({ slug: z.string().regex(SLUG_RE), _h: z.string().max(0) })
  .strict()

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`portal:${clientIp(req)}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof portalSchema>
  try {
    body = portalSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  const stripe = getStripe()
  if (!sql || !stripe) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const owns = await sql`select abi.user_owns_tenant(${userId}::uuid, ${body.slug}) as id`
  const tenantId = owns[0]?.id as string | null
  if (!tenantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const rows = await sql`
    select stripe_customer_id from abi.tenants where id = ${tenantId}::uuid
  `
  const customer = rows[0]?.stripe_customer_id as string | null
  if (!customer) {
    return NextResponse.json({ error: 'no_customer' }, { status: 404 })
  }

  const origin = await getAppOrigin()
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/panel/${body.slug}/plan`,
    })
    return NextResponse.json({ url: session.url })
  } catch {
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 })
  }
}
