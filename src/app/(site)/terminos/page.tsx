import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos de servicio',
}

export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">Términos de servicio</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-text-muted">
        <p>
          Al usar Abi aceptas usar el servicio para atender a tu negocio y
          a tus clientes, sin fines ilícitos ni envío de mensajes no solicitados.
        </p>
        <p>
          El plan gratis funciona en un canal de prueba y con límites de uso; los
          planes de pago se cotizan con números reales antes de cobrarte nada.
        </p>
        <p>
          El contenido que subes sigue siendo tuyo. Nos autorizas a procesarlo
          únicamente para que tu asistente responda por ti.
        </p>
        <p className="text-xs">
          Versión inicial. Estos términos se ampliarán con el detalle legal
          completo antes del lanzamiento comercial.
        </p>
      </div>
    </div>
  )
}
