import { Sparkles } from 'lucide-react'

import { FeatureRequestForm } from './FeatureRequestForm'

export default async function PanelFunciones({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div className="mx-auto max-w-2xl">
      <p className="t-eyebrow">Funciones a la medida</p>
      <h1 className="mt-1 text-2xl font-bold">¿Tu negocio necesita algo especial?</h1>
      <p className="mt-2 text-sm text-text-muted">
        Además de lo que ves en el panel, construimos funciones a la medida:
        conectar tu bot a tus sistemas (cobros, inventario, agenda, facturación),
        reportes especiales, flujos únicos de tu operación. Pídelo aquí y te
        contactamos con una propuesta real — sin compromiso.
      </p>

      <div className="mt-6 rounded-xl border bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          <p className="text-sm font-semibold">Solicitar una función</p>
        </div>
        <FeatureRequestForm slug={slug} />
      </div>
    </div>
  )
}
