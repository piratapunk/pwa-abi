import { NextRequest, NextResponse } from 'next/server'

import { getSql } from '@/lib/db'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* ¿esta sesión del constructor ya construyó su bot? (para restaurar la
   tarjeta de éxito al recargar) */
export async function GET(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`ctorstatus:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ built: false })
  }
  const bs = req.nextUrl.searchParams.get('bs') ?? ''
  if (!UUID_RE.test(bs)) return NextResponse.json({ built: false })

  const sql = getSql()
  if (!sql) return NextResponse.json({ built: false })
  try {
    const rows = await sql`
      select result->>'subdomain' as subdomain
      from abi.factory_jobs
      where builder_session_id = ${bs}::uuid and kind = 'provision' and status = 'done'
    `
    const subdomain = rows[0]?.subdomain as string | undefined
    return NextResponse.json(
      subdomain ? { built: true, subdomain } : { built: false }
    )
  } catch {
    return NextResponse.json({ built: false })
  }
}
