import Link from 'next/link'

import { AbiWordmark } from '@/components/brand/AbiMark'

export function Footer() {
  return (
    <footer className="border-t bg-surface/50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="space-y-3">
            <AbiWordmark />
            <p className="max-w-xs text-sm text-text-muted">
              La colmena de asistentes para tu negocio. Tú traes lo que sabes;
              las obreras lo vuelven trabajo hecho.
            </p>
          </div>

          <div className="text-sm">
            <p className="t-eyebrow mb-3">Producto</p>
            <ul className="space-y-2 text-text-muted">
              <li><a href="#abi" className="hover:text-text">Abi, la abejita constructora</a></li>
              <li><a href="#capacidades" className="hover:text-text">Capacidades</a></li>
              <li><a href="#crm" className="hover:text-text">CRM incluido</a></li>
              <li><a href="#planes" className="hover:text-text">Planes</a></li>
            </ul>
          </div>

          <div className="text-sm">
            <p className="t-eyebrow mb-3">Contacto</p>
            <ul className="space-y-2 text-text-muted">
              <li>
                <a href="mailto:hola@agavesysmx.com" className="hover:text-text">
                  hola@agavesysmx.com
                </a>
              </li>
              <li><Link href="/privacidad" className="hover:text-text">Aviso de privacidad</Link></li>
              <li><Link href="/terminos" className="hover:text-text">Términos de servicio</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t pt-6 text-xs text-text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Agave Systems. Todos los derechos reservados.</p>
          <p>
            Abi es un producto de <span className="text-accent">Agave Systems</span>.
          </p>
        </div>
      </div>
    </footer>
  )
}
