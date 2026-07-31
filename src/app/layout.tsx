import type { Metadata, Viewport } from 'next'
import { Baloo_2, Gabarito, Inter } from 'next/font/google'
import Script from 'next/script'

import './globals.css'

/* Display: Gabarito — cálida pero seria (la voz premium). Baloo 2 queda
   reservada al wordmark/logo, donde vive la equity de marca. */
const display = Gabarito({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
})

const logo = Baloo_2({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-logo',
})

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://abi.agavesysmx.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Abi — Arma el asistente de tu negocio',
    template: '%s · Abi',
  },
  description:
    'Arma tu asistente con Abi en minutos: contesta WhatsApp y redes, agenda citas, hace campañas y deja cada logro en tu CRM. Gratis para armar y probar.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/brand/abi-mark.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: siteUrl,
    siteName: 'Abi · Agave Systems',
    title: 'Abi — Arma el asistente de tu negocio',
    description:
      'Armas tu asistente en minutos y lo sueltas a trabajar: WhatsApp, redes, teléfono, campañas y CRM.',
  },
}

export const viewport: Viewport = {
  themeColor: '#171310',
  width: 'device-width',
  initialScale: 1,
}

const themeBootstrap = `document.documentElement.classList.add('js');try{var t=localStorage.getItem('abi-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}`

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${display.variable} ${logo.variable} ${body.variable} font-sans`}>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
        {children}
      </body>
    </html>
  )
}
