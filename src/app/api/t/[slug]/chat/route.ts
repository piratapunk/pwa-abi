import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { signPayload } from '@/lib/factory/hmac'
import { SLUG_RE } from '@/lib/factory/spec'
import {
  clientIp,
  hasAllowedOrigin,
  looksLikeInjection,
  rateLimit,
} from '@/lib/security'

/*
 * Chat del bot de un tenant. El brain (n8n) carga la config y la KB del
 * schema PROPIO del tenant vía abi.tenant_chat_context — el mensaje del
 * cliente final viaja como dato por canal firmado.
 */

const tenantChatSchema = z
  .object({
    message: z.string().min(1).max(2000),
    sessionId: z.uuid(),
    conversationHistory: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().max(4000),
        })
      )
      .max(10),
    _h: z.string().max(0),
  })
  .strict()

const FALLBACK = 'Se me atoró algo. ¿Lo intentamos de nuevo en un momento?'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const ip = clientIp(req)
  if (
    !rateLimit(`tchat-ip:${ip}`, 60, 60_000) ||
    !rateLimit(`tchat-hr:${ip}`, 600, 3_600_000)
  ) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof tenantChatSchema>
  try {
    body = tenantChatSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (!rateLimit(`tchat-sid:${body.sessionId}`, 12, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  if (looksLikeInjection(body.message)) {
    return NextResponse.json({
      output: 'Solo puedo ayudarte con temas de este negocio. ¿En qué te ayudo?',
    })
  }
  const history = body.conversationHistory.filter(
    (t) => !looksLikeInjection(t.content)
  )

  const webhookUrl = process.env.ABI_TENANT_CHAT_N8N_WEBHOOK_URL
  const secret = process.env.ABI_FACTORY_HMAC_SECRET
  if (!webhookUrl || !secret) {
    return NextResponse.json({ output: FALLBACK })
  }

  const payload = JSON.stringify({
    slug,
    message: body.message,
    sessionId: body.sessionId,
    conversationHistory: history,
  })
  const { header } = signPayload(payload, secret)

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-abi-signature': header,
      },
      signal: AbortSignal.timeout(25_000),
      body: payload,
    })
    if (!res.ok) return NextResponse.json({ output: FALLBACK })
    const data = (await res.json()) as Record<string, unknown>
    /* modo humano: el bot calla — el dueño responde desde su panel */
    if (data.queued === true) {
      return NextResponse.json({ output: null, queued: true })
    }
    const output =
      (typeof data.output === 'string' && data.output) || FALLBACK
    return NextResponse.json({ output })
  } catch {
    return NextResponse.json({ output: FALLBACK })
  }
}
