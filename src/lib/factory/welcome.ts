/*
 * Bienvenida del ecosistema: cada bot nuevo con correo del dueño viene con
 * acceso gratis a Coa (el CRM, keado por ese mismo correo). El pago no compra
 * Coa — desbloquea conectar el bot a WhatsApp Business y las funciones extra.
 */

export async function sendWelcomeEmail(opts: {
  email: string
  botName: string
  botUrl: string
}): Promise<boolean> {
  const apiKey = process.env.ABI_RESEND_API_KEY
  const from = process.env.ABI_EMAIL_FROM ?? 'Abi de Agave Systems <hola@agavesysmx.com>'
  if (!apiKey) return false

  const html = `
  <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #171310;">
    <div style="text-align: center; font-size: 40px;">🐝</div>
    <h1 style="font-size: 22px; text-align: center;">${opts.botName} ya está en línea</h1>
    <p style="color: #4a4238; font-size: 15px; line-height: 1.6;">
      Tu asistente quedó ligado a este correo y ya atiende en su página:
    </p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${opts.botUrl}" style="background: #EFB63A; color: #171310; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; display: inline-block;">
        Ver mi asistente
      </a>
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
    <h2 style="font-size: 16px;">Tu CRM va incluido, gratis</h2>
    <p style="color: #4a4238; font-size: 14px; line-height: 1.6;">
      Cada bot de Agave viene con acceso a <strong>Coa</strong>: ahí ves las
      conversaciones, contactos y oportunidades que tu asistente va juntando.
      Entra con este mismo correo — sin contraseña.
    </p>
    <p style="text-align: center; margin: 20px 0;">
      <a href="https://coa.agavesysmx.com" style="background: #c6f25c; color: #0d1206; text-decoration: none; padding: 10px 24px; font-weight: 600; display: inline-block;">
        Entrar a Coa
      </a>
    </p>
    <p style="color: #4a4238; font-size: 14px; line-height: 1.6;">
      ¿Quieres que tu asistente conteste en <strong>WhatsApp Business</strong> y
      desbloquear más funciones? Actívalo desde la página de tu asistente.
    </p>
    <p style="color: #8a7f70; font-size: 11px; text-align: center; margin-top: 24px;">Abi y Coa son productos de Agave Systems · agavesysmx.com</p>
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
        to: [opts.email],
        subject: `${opts.botName} ya está en línea — y tu CRM va incluido`,
        html,
      }),
    })
    if (!res.ok) console.error('[welcome] resend', res.status, (await res.text()).slice(0, 200))
    return res.ok
  } catch (e) {
    console.error('[welcome] error:', e instanceof Error ? e.message : e)
    return false
  }
}
