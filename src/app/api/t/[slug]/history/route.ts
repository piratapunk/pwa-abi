import { NextRequest, NextResponse } from 'next/server'

import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* historial de UNA sesión: el uuid (generado por el navegador) es el portador */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  /* el widget hace polling (~5 s) cuando la pestaña está visible */
  if (!rateLimit(`thist:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const sessionId = req.nextUrl.searchParams.get('sessionId') ?? ''
  if (!SLUG_RE.test(slug) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ messages: [] })
  }
  const sql = getSql()
  if (!sql) return NextResponse.json({ messages: [] })
  try {
    const rows = await sql`
      select abi.tenant_session_messages(${slug}, ${sessionId}::uuid) as r
    `
    const r = rows[0]?.r as {
      ok: boolean
      messages: { id: number; role: string; content: string }[]
      mode?: string
    }
    /* la función ya regresa los últimos 40 en orden cronológico */
    const msgs = r?.ok ? (r.messages ?? []) : []
    return NextResponse.json({ messages: msgs, mode: r?.mode ?? 'bot' })
  } catch {
    return NextResponse.json({ messages: [] })
  }
}
