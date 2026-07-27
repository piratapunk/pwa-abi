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
      <div className="mx-auto flex h-[100dvh] max-w-2xl flex-col px-4 pb-4 pt-5 sm:px-6 sm:pb-6 sm:pt-8">
        <div
          className="mb-4 shrink-0 text-center sm:mb-6"
          style={{ textShadow: '0 1px 20px rgba(0,0,0,0.6)' }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/80">
            Asistente de
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{tenant.name}</h1>
        </div>
        <TenantChat
          slug={tenant.slug}
          botName={persona.bot_name}
          greeting={persona.greeting}
          suggestions={suggestionsFor(persona.vertical)}
        />
        <p
          className="mt-3 shrink-0 text-center text-xs text-white/80 sm:mt-4"
          style={{ textShadow: '0 1px 14px rgba(0,0,0,0.6)' }}
        >
          Creado con{' '}
          <a href="https://agavesysmx.com" className="font-semibold text-white hover:underline">
            Abi
          </a>{' '}
          de Agave Systems
        </p>
      </div>
    </TenantStage>
  )
}
