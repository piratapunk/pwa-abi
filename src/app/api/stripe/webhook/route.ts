import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { getSql } from '@/lib/db'
import { getStripe } from '@/lib/stripe'

/*
 * Webhook de Stripe (LIVE). Idempotente por event.id; el upgrade/downgrade
 * pasa por el contrato abi.upgrade_tenant (capabilities/limits desde
 * plan_limits). El downgrade nunca borra el bot.
 */

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const secret = process.env.ABI_STRIPE_WEBHOOK_SECRET
  const sql = getSql()
  if (!stripe || !secret || !sql) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }

  const payload = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret)
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  /* idempotencia: si ya lo vimos, 200 y fuera */
  const seen = await sql`
    insert into abi.stripe_webhook_events (id, type)
    values (${event.id}, ${event.type})
    on conflict (id) do nothing
    returning id
  `
  if (seen.length === 0) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const tenantIdOf = (meta: Stripe.Metadata | null | undefined) => {
    const t = meta?.tenant_id
    return t && /^[0-9a-f-]{36}$/i.test(t) ? t : null
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const tenantId = tenantIdOf(session.metadata)
        if (!tenantId) break
        const interval =
          session.mode === 'subscription' ? null : null
        await sql`
          update abi.tenants set
            stripe_customer_id = ${typeof session.customer === 'string' ? session.customer : null},
            stripe_subscription_id = ${typeof session.subscription === 'string' ? session.subscription : null},
            subscription_status = 'active'
          where id = ${tenantId}::uuid
        `
        await sql`select abi.upgrade_tenant(${tenantId}::uuid, 'premium')`
        void interval
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const tenantId = tenantIdOf(sub.metadata)
        if (!tenantId) break
        const status =
          sub.status === 'active' || sub.status === 'trialing'
            ? 'active'
            : sub.status === 'past_due' || sub.status === 'unpaid'
              ? 'past_due'
              : sub.status === 'canceled'
                ? 'canceled'
                : null
        if (status) {
          await sql`
            update abi.tenants set
              subscription_status = ${status},
              premium_interval = ${sub.items?.data?.[0]?.price?.recurring?.interval ?? null}
            where id = ${tenantId}::uuid
          `
          if (status === 'active') {
            await sql`select abi.upgrade_tenant(${tenantId}::uuid, 'premium')`
          }
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const tenantId = tenantIdOf(sub.metadata)
        if (!tenantId) break
        await sql`
          update abi.tenants set
            subscription_status = 'canceled',
            stripe_subscription_id = null
          where id = ${tenantId}::uuid
        `
        await sql`select abi.upgrade_tenant(${tenantId}::uuid, 'free')`
        break
      }
      case 'invoice.payment_failed':
      case 'invoice.payment_succeeded': {
        /* la forma del campo subscription cambió entre versiones de API — leer laxo */
        const invoice = event.data.object as unknown as {
          subscription?: string | { id?: string } | null
          parent?: { subscription_details?: { subscription?: string } }
        }
        const raw =
          invoice.subscription ??
          invoice.parent?.subscription_details?.subscription
        const subId =
          typeof raw === 'string' ? raw : (raw?.id ?? null)
        if (subId) {
          const status =
            event.type === 'invoice.payment_failed' ? 'past_due' : 'active'
          await sql`
            update abi.tenants set subscription_status = ${status}
            where stripe_subscription_id = ${subId}
          `
        }
        break
      }
    }
  } catch {
    /* 500 para que Stripe reintente; liberar el id para permitir el retry */
    try {
      await sql`delete from abi.stripe_webhook_events where id = ${event.id}`
    } catch {}
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
