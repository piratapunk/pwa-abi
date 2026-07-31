import { NextRequest, NextResponse } from 'next/server'

import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/*
 * Resumen de las conversaciones que ESTE navegador conoce.
 *
 * Los uuids los manda el cliente porque él los guardó al rotarlos: no hay forma
 * de enumerar conversaciones ajenas por aquí, igual que en /history el uuid es
 * el portador. Sin lista, respuesta vacía.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`tconv:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const ids = (req.nextUrl.searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
    .slice(0, 40)

  if (!SLUG_RE.test(slug) || ids.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  const sql = getSql()
  if (!sql) return NextResponse.json({ conversations: [] })

  try {
    const rows = await sql`
      select abi.tenant_conversations_summary(${slug}, ${ids}::uuid[]) as r
    `
    const r = rows[0]?.r as {
      ok: boolean
      conversations: {
        session_id: string
        created_at: string
        last_message_at: string
        messages: number
        title: string | null
      }[]
    }
    return NextResponse.json({ conversations: r?.ok ? (r.conversations ?? []) : [] })
  } catch {
    return NextResponse.json({ conversations: [] })
  }
}
