import { NextRequest, NextResponse } from 'next/server'

import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* hilo de una conversación para el inbox del panel (soporta polling ligero) */
export async function GET(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`crmthread:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const slug = req.nextUrl.searchParams.get('slug') ?? ''
  const session = req.nextUrl.searchParams.get('session') ?? ''
  if (!SLUG_RE.test(slug) || !UUID_RE.test(session)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const sql = getSql()
  if (!sql) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  try {
    const rows = await sql`
      select necta.tenant_conversation_messages(
        ${userId}::uuid, ${slug}, ${session}::uuid
      ) as r
    `
    const r = rows[0]?.r as { ok: boolean }
    if (!r?.ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(r)
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}
