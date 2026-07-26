import type { Metadata } from 'next'

import { CatalogView } from '@/components/catalog/CatalogView'
import { getCatalog } from '@/lib/catalog'

export const metadata: Metadata = {
  title: 'Arma tu suite',
  description:
    'Elige todo lo que quieres que tu asistente haga por tu negocio. Nosotros lo armamos contigo.',
}

export const dynamic = 'force-dynamic'

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  const { s } = await searchParams
  const catalog = await getCatalog()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Arma tu suite
        </h1>
        <p className="mt-3 text-text-muted">
          Ya viste a tu asistente en acción. Ahora elige todo lo que quieres que
          haga por tu negocio — agrégalo a tu lista y nosotros lo armamos contigo.
          Sin cobros aquí: te contactamos para agendar el arranque.
        </p>
      </header>

      <div className="mt-8">
        <CatalogView catalog={catalog} builderSessionId={s} />
      </div>
    </div>
  )
}
