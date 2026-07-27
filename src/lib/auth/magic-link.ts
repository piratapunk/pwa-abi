/*
 * Magic links con marca propia (patrón bjj): generate_link vía la API admin de
 * GoTrue (service role), y el correo lo mandamos nosotros con Resend — nunca
 * el template genérico de GoTrue. El link apunta a NUESTRO callback.
 */

type GeneratedLink = {
  token_hash: string
  type: 'magiclink' | 'signup'
}

export async function generateMagicLink(
  email: string
): Promise<GeneratedLink | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.ABI_SUPABASE_SERVICE_ROLE_KEY
  if (!base || !serviceKey) return null

  const call = async (type: 'magiclink' | 'signup') => {
    const res = await fetch(`${base}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify(
        type === 'signup'
          ? { type, email, password: crypto.randomUUID() }
          : { type, email }
      ),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      hashed_token?: string
      verification_type?: string
      properties?: { hashed_token?: string; verification_type?: string }
    }
    const token = data.hashed_token ?? data.properties?.hashed_token
    if (!token) return null
    /* GoTrue auto-crea al usuario nuevo y el token resultante se canjea como
       'signup' aunque se haya pedido 'magiclink' — el tipo real viene en
       verification_type, y canjear con el tipo pedido da "expired" */
    const vt = data.verification_type ?? data.properties?.verification_type
    const realType = vt === 'signup' ? 'signup' : vt === 'magiclink' ? 'magiclink' : type
    return { token_hash: token, type: realType } satisfies GeneratedLink
  }

  /* usuario existente → magiclink; nuevo → signup (auto-registra) */
  return (await call('magiclink')) ?? (await call('signup'))
}

export async function sendMagicLinkEmail(
  email: string,
  link: string
): Promise<boolean> {
  const apiKey = process.env.ABI_RESEND_API_KEY
  const from = process.env.ABI_EMAIL_FROM ?? 'Abi de Agave Systems <hola@agavesysmx.com>'
  if (!apiKey) return false

  const html = `
  <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; font-size: 40px;">🐝</div>
    <h1 style="font-size: 22px; text-align: center; color: #171310;">Tu acceso a Abi</h1>
    <p style="color: #4a4238; font-size: 15px; line-height: 1.6;">
      Soy Abi. Con este enlace entras a tu cuenta y tu asistente queda ligado a ti —
      así lo administras cuando quieras.
    </p>
    <p style="text-align: center; margin: 28px 0;">
      <a href="${link}" style="background: #EFB63A; color: #171310; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; display: inline-block;">
        Entrar a mi cuenta
      </a>
    </p>
    <p style="color: #8a7f70; font-size: 12px;">
      El enlace caduca pronto y solo sirve una vez. Si no pediste esto, ignora este correo.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
    <p style="color: #8a7f70; font-size: 11px; text-align: center;">Abi es un producto de Agave Systems · agavesysmx.com</p>
  </div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Tu acceso a Abi',
        html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
