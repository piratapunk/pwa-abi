import { NextRequest, NextResponse } from 'next/server'

const SLUG_RE = /^[a-z][a-z0-9-]{2,29}$/

/*
 * Routing multi-tenant estilo Netlify: `<slug>-abi-chat.agavesysmx.com` sirve
 * el bot del tenant reescribiendo internamente a /t/<slug>.
 *
 * El sufijo `-abi-chat` es deliberado, por dos razones. Primero, separa el
 * espacio de nombres de la fábrica del de Agave Systems: un tenant llamado
 * "www" o "blog" no puede secuestrar un subdominio nuestro porque su host
 * termina en `-abi-chat`. Segundo, mantiene los tenants en PRIMER nivel de
 * subdominio — `*.agavesysmx.com` lo cubre el certificado Universal de
 * Cloudflare; un segundo nivel (`<slug>.abi.`) exigiría el certificado
 * avanzado de paga.
 *
 * `nectacore.com` se retira: los 3 tenants que había eran demos y nada se
 * vendió. El patrón viejo NO se conserva — mantenerlo "por si acaso" es dejar
 * viva la marca que se está apagando.
 */
const HOST_TENANT = /^([a-z0-9-]+)-abi-chat\.agavesysmx\.com$/

// `abi.factory_slugify` ya los reserva al crear el tenant. Se repiten aquí a
// propósito: si algún día se provisiona un tenant por otra vía, el borde no
// debe ser el eslabón que confíe.
const RESERVADOS = new Set(['www', 'api', 'admin', 'app', 'mcp', 'panel', 'chat'])

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.[\w]+$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()

  // El retiro de nectacore.com: 301 permanente al dominio nuevo. La marca se
  // apaga redirigiendo, no conviviendo — el DNS viejo se elimina después, pero
  // mientras exista, cada visita ya aterriza en Agave.
  if (host === 'nectacore.com' || host === 'www.nectacore.com') {
    return NextResponse.redirect(`https://abi.agavesysmx.com${pathname}`, 301)
  }
  const viejo = /^([a-z0-9-]+)\.nectacore\.com$/.exec(host)
  if (viejo && viejo[1] !== 'www') {
    return NextResponse.redirect(`https://${viejo[1]}-abi-chat.agavesysmx.com${pathname}`, 301)
  }

  // La superficie Necta se DEPRECA entera: el constructor canónico vive en el
  // portal de Agave. Este host solo conserva sus APIs (el matcher excluye /api)
  // y los hosts de tenant siguen sirviendo bots más abajo.
  if (host === 'abi.agavesysmx.com' || host === 'www.abi.agavesysmx.com') {
    return NextResponse.redirect('https://agavesysmx.com/producto/abi', 301)
  }

  const m = HOST_TENANT.exec(host)
  if (m && SLUG_RE.test(m[1]) && !RESERVADOS.has(m[1])) {
    const url = request.nextUrl.clone()
    url.pathname = `/t/${m[1]}${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  // El comodín *.agavesysmx.com apunta a esta app por los tenants de arriba.
  // Cualquier otro subdominio que caiga aquí (sonar., loquesea.) NO debe ver
  // la landing deprecada: al portal. Solo hosts de dev (localhost) pasan.
  if (host.endsWith('.agavesysmx.com')) {
    return NextResponse.redirect(`https://agavesysmx.com${pathname}`, 301)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
