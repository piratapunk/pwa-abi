import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aviso de privacidad',
}

export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">Aviso de privacidad</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-text-muted">
        <p>
          Agave Systems recaba únicamente los datos que nos compartes para operar el
          servicio: tu nombre, medio de contacto y la información de tu negocio
          que decidas darle a tu asistente.
        </p>
        <p>
          Tus datos y los de tus clientes se usan exclusivamente para que tu
          asistente funcione y para darte seguimiento cuando tú lo pides. No los
          vendemos ni los compartimos con terceros ajenos a la operación del
          servicio.
        </p>
        <p>
          Puedes pedir la corrección o eliminación de tus datos en cualquier
          momento escribiendo a{' '}
          <a href="mailto:hola@agavesysmx.com" className="text-accent">
            hola@agavesysmx.com
          </a>
          .
        </p>
        <p className="text-xs">
          Versión inicial. Este aviso se ampliará con el detalle legal completo
          antes del lanzamiento comercial.
        </p>
      </div>
    </div>
  )
}
