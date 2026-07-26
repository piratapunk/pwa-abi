import { NextRequest, NextResponse } from 'next/server'

const SLUG_RE = /^[a-z][a-z0-9-]{2,29}$/

/*
 * Routing multi-tenant estilo Netlify: `<slug>.abi.agavesysmx.com` sirve el bot
 * del tenant reescribiendo internamente a /t/<slug>.
 *
 * El nivel extra (`.abi.`) es deliberado. `<slug>.agavesysmx.com` chocaría con
 * los subdominios propios de la empresa: un tenant llamado "www", "blog" o "app"
 * secuestraría uno nuestro. Con `.abi.` el espacio de nombres de la fábrica
 * queda separado del de Agave Systems, y el wildcard de DNS es acotado.
 *
 * `nectacore.com` se retira: los 3 tenants que había eran demos y nada se
 * vendió. El patrón viejo NO se conserva — mantenerlo "por si acaso" es dejar
 * viva la marca que se está apagando.
 */
const HOST_TENANT = /^([a-z0-9-]+)\.abi\.agavesysmx\.com$/

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
  const m = HOST_TENANT.exec(host)
  if (m && SLUG_RE.test(m[1]) && !RESERVADOS.has(m[1])) {
    const url = request.nextUrl.clone()
    url.pathname = `/t/${m[1]}${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
