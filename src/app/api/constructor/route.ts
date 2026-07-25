import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { signPayload } from '@/lib/factory/hmac'
import {
  clientIp,
  hasAllowedOrigin,
  looksLikeInjection,
  rateLimit,
} from '@/lib/security'
import {
  HUMAN_COOKIE,
  HUMAN_COOKIE_OPTS,
  isHumanCookieValid,
  makeHumanCookie,
  verifyTurnstile,
} from '@/lib/turnstile'

/*
 * Proxy al agente del Constructor (serv-necta-constructor, Strands).
 * El agente mantiene la conversación por builder_session_id; aquí solo
 * viven los guardrails y la firma del canal.
 */

const constructorSchema = z
  .object({
    builderSessionId: z.uuid(),
    message: z.string().min(1).max(2000),
    turnstileToken: z.string().max(3000).optional(),
    _h: z.string().max(0),
  })
  .strict()

const FALLBACK = 'Se me atoró algo aquí adentro. ¿Me lo repites?'

export async function POST(req: NextRequest) {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const ip = clientIp(req)
  if (
    !rateLimit(`ctor-ip:${ip}`, 30, 60_000) ||
    !rateLimit(`ctor-hr:${ip}`, 240, 3_600_000)
  ) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof constructorSchema>
  try {
    body = constructorSchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (!rateLimit(`ctor-sid:${body.builderSessionId}`, 10, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  /* verificación humana por cookie firmada (24 h, sobrevive deploys) */
  let setHumanCookie = false
  if (!isHumanCookieValid(req.cookies.get(HUMAN_COOKIE)?.value)) {
    if (!body.turnstileToken) {
      return NextResponse.json({ error: 'turnstile_required' }, { status: 403 })
    }
    const ok = await verifyTurnstile(body.turnstileToken, ip)
    if (!ok) {
      return NextResponse.json({ error: 'turnstile_failed' }, { status: 403 })
    }
    setHumanCookie = true
  }

  if (looksLikeInjection(body.message)) {
    return NextResponse.json({
      output:
        'Yo solo sé de una cosa: armar asistentes para negocios 🐝 Sigamos con el tuyo, ¿va?',
    })
  }

  const serviceUrl = process.env.ABI_CONSTRUCTOR_URL
  const secret = process.env.ABI_FACTORY_HMAC_SECRET
  if (!serviceUrl || !secret) {
    return NextResponse.json({ output: FALLBACK })
  }

  const payload = JSON.stringify({
    builderSessionId: body.builderSessionId,
    message: body.message,
  })
  const { header } = signPayload(payload, secret)

  try {
    const res = await fetch(`${serviceUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-abi-signature': header,
      },
      signal: AbortSignal.timeout(90_000),
      body: payload,
    })
    if (!res.ok) return NextResponse.json({ output: FALLBACK })
    const data = (await res.json()) as {
      output?: string
      provisioned?: { subdomain?: string } | null
      stage?: string
      turns?: number
    }
    /* si el dueño ya tiene sesión, el bot recién construido queda ligado
       a su cuenta sin pedirle el correo otra vez */
    let claimed = false
    if (data.provisioned?.subdomain) {
      try {
        const userId = await getAuthUserId()
        const sql = getSql()
        if (userId && sql) {
          await sql`select abi.claim_tenant(${body.builderSessionId}::uuid, ${userId}::uuid)`
          claimed = true
        }
      } catch {}
    }
    const out = NextResponse.json({
      output: (typeof data.output === 'string' && data.output) || FALLBACK,
      provisioned: data.provisioned ?? null,
      stage: data.stage ?? 'conversando',
      turns: data.turns ?? 0,
      claimed,
    })
    if (setHumanCookie) out.cookies.set(HUMAN_COOKIE, makeHumanCookie(), HUMAN_COOKIE_OPTS)
    return out
  } catch {
    return NextResponse.json({ output: FALLBACK })
  }
}
