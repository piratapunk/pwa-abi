import { createHmac, timingSafeEqual } from 'node:crypto'

/*
 * Contrato de canal firmado (estilo Stripe): el secreto NUNCA viaja — solo la
 * firma HMAC-SHA256 de `<timestamp>.<body>` con ventana anti-replay. Verifica
 * el otro extremo (n8n) con el mismo secreto leído de abi.factory_secrets.
 */

export const REPLAY_WINDOW_S = 300

export function signPayload(body: string, secret: string, ts?: number) {
  const t = ts ?? Math.floor(Date.now() / 1000)
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  return { header: `t=${t},v1=${v1}`, t, v1 }
}

export function verifySignature(
  body: string,
  header: string | null,
  secret: string
): boolean {
  if (!header) return false
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header.trim())
  if (!m) return false
  const t = Number(m[1])
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - t) > REPLAY_WINDOW_S) return false
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest()
  const got = Buffer.from(m[2], 'hex')
  return expected.length === got.length && timingSafeEqual(expected, got)
}
