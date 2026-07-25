import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId, getAppOrigin } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'
import { getStripe, priceIdFor } from '@/lib/stripe'

const checkoutSchema = z
  .object({
    slug: z.string().regex(SLUG_RE),
    interval: z.enum(['month', 'year']),
    _h: z.string().max(0),
  })
  .strict()

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`checkout:${clientIp(req)}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof checkoutSchema>
  try {
    body = checkoutSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  const stripe = getStripe()
  const priceId = priceIdFor(body.interval)
  if (!sql || !stripe || !priceId) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const owns = await sql`select abi.user_owns_tenant(${userId}::uuid, ${body.slug}) as id`
  const tenantId = owns[0]?.id as string | null
  if (!tenantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const rows = await sql`
    select subscription_status, stripe_customer_id from abi.tenants where id = ${tenantId}::uuid
  `
  const tenant = rows[0] as {
    subscription_status: string
    stripe_customer_id: string | null
  }
  if (tenant.subscription_status === 'active' || tenant.subscription_status === 'past_due') {
    return NextResponse.json({ error: 'already_subscribed' }, { status: 409 })
  }

  const origin = await getAppOrigin()
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        ...(tenant.stripe_customer_id
          ? { customer: tenant.stripe_customer_id }
          : {}),
        metadata: { tenant_id: tenantId, slug: body.slug },
        subscription_data: {
          metadata: { tenant_id: tenantId, slug: body.slug },
        },
        success_url: `${origin}/panel/${body.slug}/plan?upgraded=1`,
        cancel_url: `${origin}/panel/${body.slug}/plan`,
        locale: 'es',
      },
      /* bucket de 5 min: doble click no crea sesiones duplicadas */
      { idempotencyKey: `co-${tenantId}-${body.interval}-${Math.floor(Date.now() / 300_000)}` }
    )
    return NextResponse.json({ url: session.url })
  } catch {
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 })
  }
}
