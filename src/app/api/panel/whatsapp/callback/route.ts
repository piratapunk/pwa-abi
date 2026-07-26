import { NextRequest, NextResponse } from 'next/server'

import { getAppOrigin } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { moveAccountToProfile, verifyConnectState } from '@/lib/zernio'

/*
 * Regreso del Embedded Signup de Meta:
 * ?connected=whatsapp&profileId=&accountId=&username=+E164&state=<firmado>
 */
export async function GET(req: NextRequest) {
  const origin = await getAppOrigin()
  const p = req.nextUrl.searchParams
  const slug = verifyConnectState(p.get('state') ?? '')
  if (!slug) {
    return NextResponse.redirect(`${origin}/mis-bots`)
  }

  const dest = `${origin}/panel/${slug}/conexiones`
  const accountId = p.get('accountId')
  const number = p.get('username')

  const sql = getSql()
  if (!sql) return NextResponse.redirect(`${dest}?connected=0`)

  const rows = await sql`
    select id, channel_profile_id from abi.tenants where slug = ${slug}
  `
  const tenantId = rows[0]?.id as string | undefined
  const tenantProfileId = rows[0]?.channel_profile_id as string | null | undefined
  if (!tenantId) return NextResponse.redirect(`${origin}/mis-bots`)

  if (p.get('connected') === 'whatsapp' && accountId) {
    await sql`
      select abi.set_tenant_channel(
        ${tenantId}::uuid, 'connected', null, ${accountId}, ${number})
    `
    /* la coexistencia deja la cuenta en el perfil default del canal:
       moverla al perfil propio del tenant (best-effort, no bloquea) */
    if (tenantProfileId) {
      await moveAccountToProfile(accountId, tenantProfileId)
    }
    return NextResponse.redirect(`${dest}?connected=1`)
  }

  await sql`select abi.set_tenant_channel(${tenantId}::uuid, 'error', null, null, null)`
  return NextResponse.redirect(`${dest}?connected=0`)
}
