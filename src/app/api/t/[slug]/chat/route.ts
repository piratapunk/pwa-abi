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
 * Chat del bot de un tenant.
 *
 * Con ABI_BRAIN_CHAT_URL configurada, el turno va a serv-abi-brain (el grafo:
 * guardrail, herramientas por plan, checkpointer, memoria por contacto) por el
 * mismo canal firmado. El historial NO viaja: la memoria de la conversación es
 * el checkpointer del cerebro, con thread_id = sessionId. Sin la env, cae al
 * workflow n8n anterior — que sigue siendo el ingreso de los canales externos.
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

  const brainUrl = process.env.ABI_BRAIN_CHAT_URL
  const webhookUrl = process.env.ABI_TENANT_CHAT_N8N_WEBHOOK_URL
  const secret = process.env.ABI_FACTORY_HMAC_SECRET
  if ((!brainUrl && !webhookUrl) || !secret) {
    return NextResponse.json({ output: FALLBACK })
  }

  const payload = JSON.stringify(
    brainUrl
      ? {
          slug,
          conversation_id: body.sessionId,
          message: body.message,
          channel: 'web',
        }
      : {
          slug,
          message: body.message,
          sessionId: body.sessionId,
          conversationHistory: history,
        }
  )
  const { header } = signPayload(payload, secret)

  try {
    const res = await fetch(brainUrl ?? webhookUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-abi-signature': header,
      },
      // El grafo puede dar más de una vuelta (herramientas); 25s se quedaba corto
      signal: AbortSignal.timeout(45_000),
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
