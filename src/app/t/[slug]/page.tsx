import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TenantChat } from '@/components/chat/TenantChat'
import { TenantStage } from '@/components/chat/TenantStage'
import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { suggestionsFor } from '@/lib/suggestions'

export const dynamic = 'force-dynamic'

type TenantContext = {
  ok: boolean
  slug: string
  name: string
  config: {
    persona: {
      bot_name: string
      business_name: string
      greeting: string
      vertical?: string
    }
  }
}

async function loadTenant(slug: string): Promise<TenantContext | null> {
  if (!SLUG_RE.test(slug)) return null
  const sql = getSql()
  if (!sql) return null
  try {
    const rows = await sql`select abi.tenant_chat_context(${slug}) as ctx`
    const ctx = rows[0]?.ctx as TenantContext
    return ctx?.ok ? ctx : null
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tenant = await loadTenant(slug)
  return {
    title: tenant ? `${tenant.name} · Asistente` : 'Asistente',
    robots: { index: false },
  }
}

export default async function TenantBotPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tenant = await loadTenant(slug)
  if (!tenant) notFound()

  const persona = tenant.config.persona

  return (
    <TenantStage>
      {/* Proporción horizontal (referencia assistant-ui): ancho generoso y
          altura acotada — en desktop el chat es un escenario apaisado centrado,
          no una columna que llena la pantalla. En móvil sí ocupa todo. */}
      <div className="mx-auto flex h-[100dvh] w-full max-w-5xl flex-col justify-center px-4 pb-4 pt-5 sm:px-8 sm:pb-6 sm:pt-8 lg:h-auto lg:min-h-[100dvh] lg:py-10">
        {/* Placas oscuras sobre el grano (patrón "EL PECOREO" del portal):
            el texto nunca pelea con el gradiente. Alineado a la izquierda. */}
        <div className="mb-4 shrink-0 sm:mb-6">
          <p className="inline-block bg-[#0a0a0a] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.3em] text-white/85">
            Asistente de
          </p>
          <h1 className="mt-px block">
            <span className="inline-block bg-[#0a0a0a] px-3 py-2 text-3xl font-bold text-white sm:text-4xl">
              {tenant.name}
            </span>
          </h1>
        </div>
        <TenantChat
          slug={tenant.slug}
          botName={persona.bot_name}
          greeting={persona.greeting}
          suggestions={suggestionsFor(persona.vertical)}
        />
        <p className="mt-3 shrink-0 sm:mt-4">
          <span className="inline-block bg-[#0a0a0a] px-3 py-1.5 text-xs text-white/85">
            Creado con{' '}
            <a href="https://agavesysmx.com" className="font-semibold text-white hover:underline">
              Abi
            </a>{' '}
            de Agave Systems
          </span>
        </p>
      </div>
    </TenantStage>
  )
}
