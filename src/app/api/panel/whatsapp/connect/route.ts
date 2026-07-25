import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId, getAppOrigin } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { FEATURES } from '@/lib/flags'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'
import {
  createChannelProfile,
  getWhatsAppConnectUrl,
  signConnectState,
} from '@/lib/zernio'

const connectSchema = z
  .object({ slug: z.string().regex(SLUG_RE), _h: z.string().max(0) })
  .strict()

export async function POST(req: NextRequest) {
  if (!FEATURES.selfServe || !FEATURES.whatsappSelfConnect) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`wa-connect:${clientIp(req)}`, 10, 3_600_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const userId = await getAuthUserId()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof connectSchema>
  try {
    body = connectSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  if (!sql) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const owns = await sql`select necta.user_owns_tenant(${userId}::uuid, ${body.slug}) as id`
  const tenantId = owns[0]?.id as string | null
  if (!tenantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const rows = await sql`
    select name, plan, channel_profile_id, channel_status
    from necta.tenants where id = ${tenantId}::uuid
  `
  const t = rows[0] as {
    name: string
    plan: string
    channel_profile_id: string | null
    channel_status: string
  }
  /* candado del plan: conectar el número real es Premium */
  if (t.plan === 'free') {
    return NextResponse.json({ error: 'premium_required' }, { status: 402 })
  }
  if (t.channel_status === 'connected') {
    return NextResponse.json({ error: 'already_connected' }, { status: 409 })
  }

  let profileId = t.channel_profile_id
  if (!profileId) {
    profileId = await createChannelProfile(t.name)
    if (!profileId) {
      return NextResponse.json({ error: 'channel_error' }, { status: 502 })
    }
    /* persistir de inmediato: un fallo posterior no debe huerfanear el perfil */
    await sql`
      select necta.set_tenant_channel(${tenantId}::uuid, 'connecting', ${profileId}, null, null)
    `
  }

  const origin = await getAppOrigin()
  const state = signConnectState(body.slug)
  const redirectUrl = `${origin}/api/panel/whatsapp/callback?state=${encodeURIComponent(state)}`
  const authUrl = await getWhatsAppConnectUrl(profileId, redirectUrl)
  if (!authUrl) {
    return NextResponse.json({ error: 'channel_error' }, { status: 502 })
  }

  await sql`
    select necta.set_tenant_channel(${tenantId}::uuid, 'connecting', ${profileId}, null, null)
  `
  return NextResponse.json({ url: authUrl })
}
