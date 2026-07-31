/*
 * Magic links con marca propia (patrón bjj): generate_link vía la API admin de
 * GoTrue (service role), y el correo lo mandamos nosotros por SMTP OCI desde
 * agavesysmx.com — nunca el template genérico de GoTrue ni dominios de necta.
 * El link apunta a NUESTRO callback.
 */

import nodemailer from 'nodemailer'

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
  const host = process.env.ABI_SMTP_ENDPOINT
  const user = process.env.ABI_SMTP_USERNAME
  const pass = process.env.ABI_SMTP_PASSWORD
  const from = process.env.ABI_EMAIL_FROM ?? 'Abi de Agave Systems <notifications@agavesysmx.com>'
  if (!host || !user || !pass) return false

  /* Guía de estilo de correos (pwa-agave-systems/docs/guia-estilo-correos.md):
     Abi = grain amarillo estático + tarjeta tinta + botón #f2ed5c, blindado
     contra el dark-mode de los clientes. */
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
    :root { color-scheme: dark; }
    body { margin: 0; }
    .x-apple-data-detectors, a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  </style>
</head>
<body style="margin:0;background:#262304;">
  <div style="background-color:#8a840f;background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22180%22 height=%22180%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%221.1%22 numOctaves=%223%22/><feColorMatrix type=%22saturate%22 values=%220%22/><feComponentTransfer><feFuncA type=%22linear%22 slope=%220.34%22/></feComponentTransfer></filter><rect width=%22180%22 height=%22180%22 filter=%22url(%23n)%22/></svg>'), radial-gradient(130% 100% at 10% 8%, #f2ed5c 0%, rgba(242,237,92,0.8) 38%, rgba(178,168,30,0.55) 60%, rgba(40,37,5,0.95) 100%), linear-gradient(150deg, #cfc832 0%, #8d8611 50%, #2e2b05 100%);padding:30px 14px;">
    <div style="max-width:520px;margin:0 auto;">
      <p style="margin:0 0 14px;">
        <span style="font-family:'Outfit',-apple-system,sans-serif;font-size:18px;line-height:1;color:#0d1206;font-weight:700;">&#10059;</span>
        <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#0d1206;font-weight:500;padding-left:10px;">Abi &middot; Agave Systems</span>
      </p>
      <div bgcolor="#0a0a0a" style="background-color:#0a0a0a !important;background-image:linear-gradient(#0a0a0a,#0a0a0a);border:1px solid #262626;padding:26px;">
        <p style="margin:0;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#f2ed5c !important;">Tu acceso</p>
        <h1 style="margin:12px 0 8px;font-family:'Outfit',-apple-system,sans-serif;font-size:24px;font-weight:600;line-height:1.2;color:#f4f4f0 !important;">Entra a tu cuenta de Abi</h1>
        <p style="margin:0 0 18px;font-family:'Outfit',-apple-system,sans-serif;font-size:14px;line-height:1.65;color:#a3a396 !important;">
          Con este enlace tu asistente queda ligado a ti y lo administras cuando quieras:
        </p>
        <p style="margin:0;text-align:center;">
          <a href="${link}" style="display:inline-block;min-width:56%;text-align:center;padding:13px 28px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;background-color:#f2ed5c !important;background-image:linear-gradient(#f2ed5c,#f2ed5c);color:#0d1206 !important;">Entrar a mi cuenta &#8594;</a>
        </p>
        <p style="margin:14px 0 0;font-family:'Outfit',-apple-system,sans-serif;font-size:12px;line-height:1.6;color:#6b6b60 !important;">
          El enlace caduca pronto y solo sirve una vez. Si no pediste esto, ignora este correo.
        </p>
      </div>
      <p style="margin:16px 0 0;text-align:center;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#0d1206;">
        Abi es un producto de Agave Systems &middot; <a href="https://agavesysmx.com" style="color:#0d1206;text-decoration:none;font-weight:500;">agavesysmx.com</a>
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.ABI_SMTP_PORT ?? 587),
      secure: false, // STARTTLS en 587
      auth: { user, pass },
    })
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Tu acceso a Abi',
      text: `Entra a tu cuenta con este enlace (caduca pronto y solo sirve una vez): ${link}`,
      html,
    })
    return true
  } catch (e) {
    console.error('[abi-mail] error:', e instanceof Error ? e.message : e)
    return false
  }
}
