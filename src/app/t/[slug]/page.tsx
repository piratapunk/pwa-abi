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
        {/* Texto directo sobre el grano, en tinta (como el correo): sin placas. */}
        <div className="mb-4 shrink-0 text-center sm:mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#0d1206]/80">
            Asistente de
          </p>
          <h1 className="mt-1 text-xl font-bold text-[#0d1206] sm:text-2xl">{tenant.name}</h1>
        </div>
        <TenantChat
          slug={tenant.slug}
          botName={persona.bot_name}
          greeting={persona.greeting}
          suggestions={suggestionsFor(persona.vertical)}
        />
        <p className="mt-3 shrink-0 text-center text-[11px] text-[#0d1206]/80 sm:mt-4">
          Creado con{' '}
          <a href="https://agavesysmx.com" className="font-semibold text-[#0d1206] hover:underline">
            Abi
          </a>{' '}
          de Agave Systems
        </p>
      </div>
    </TenantStage>
  )
}
