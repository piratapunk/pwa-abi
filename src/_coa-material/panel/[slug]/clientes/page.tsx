import Link from 'next/link'
import { UsersRound } from 'lucide-react'

import { CrmLocked } from '@/components/crm/CrmLocked'
import { NewContactForm } from '@/components/crm/NewContactForm'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { getAuthUserId } from '@/lib/auth/server'
import { STAGES, stageLabel, type CrmContact } from '@/lib/crm'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function PanelClientes({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string; etapa?: string; tag?: string }>
}) {
  const { slug } = await params
  const { q = '', etapa = '', tag = '' } = await searchParams
  const userId = await getAuthUserId()
  const sql = getSql()

  const overviewRows = await sql!`select necta.tenant_overview(${userId}::uuid, ${slug}) as o`
  const o = overviewRows[0]?.o as { ok: boolean; plan: string }
  if (!o?.ok) return null

  if (o.plan === 'free') {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="t-eyebrow">Clientes</p>
        <h1 className="mt-1 text-2xl font-semibold">Tu CRM, llenado por tu asistente</h1>
        <CrmLocked slug={slug} feature="Clientes y CRM" />
      </div>
    )
  }

  const rows = await sql!`
    select necta.tenant_contacts_list(
      ${userId}::uuid, ${slug},
      ${q || null}, ${etapa || null}, ${tag || null}, 200
    ) as r
  `
  const r = rows[0]?.r as { ok: boolean; contacts: CrmContact[]; tags: string[] }
  const contacts = r?.ok ? r.contacts : []
  const tags = r?.ok ? r.tags : []

  const filterHref = (next: { etapa?: string; tag?: string }) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    const e = next.etapa ?? etapa
    const t = next.tag ?? tag
    if (e) sp.set('etapa', e)
    if (t) sp.set('tag', t)
    const qs = sp.toString()
    return `/panel/${slug}/clientes${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="t-eyebrow">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold">Tu CRM, llenado por tu asistente</h1>
        </div>
        <NewContactForm slug={slug} />
      </div>

      <form className="mt-6 flex flex-wrap items-center gap-2" action={`/panel/${slug}/clientes`}>
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, teléfono o email…"
          className="max-w-xs"
        />
        {etapa && <input type="hidden" name="etapa" value={etapa} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={filterHref({ etapa: '' })}
          className={!etapa ? 'rounded-full bg-accent px-3 py-1 text-on-accent' : 'rounded-full border px-3 py-1 text-text-muted hover:text-text'}
        >
          Todas
        </Link>
        {STAGES.map((s) => (
          <Link
            key={s.key}
            href={filterHref({ etapa: s.key })}
            className={etapa === s.key ? 'rounded-full bg-accent px-3 py-1 text-on-accent' : 'rounded-full border px-3 py-1 text-text-muted hover:text-text'}
          >
            {s.label}
          </Link>
        ))}
        {tags.length > 0 && <span className="mx-1 text-text-muted">·</span>}
        {tags.map((t) => (
          <Link
            key={t}
            href={filterHref({ tag: tag === t ? '' : t })}
            className={tag === t ? 'rounded-full bg-accent-soft px-3 py-1 text-accent' : 'rounded-full border border-dashed px-3 py-1 text-text-muted hover:text-text'}
          >
            #{t}
          </Link>
        ))}
      </div>

      {contacts.length === 0 ? (
        <div className="mt-10 rounded-xl border bg-surface p-10 text-center">
          <UsersRound className="mx-auto size-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            {q || etapa || tag
              ? 'Sin resultados con esos filtros.'
              : 'Aún no hay clientes. Cuando alguien deje su teléfono o correo en el chat, aparece aquí solo.'}
          </p>
        </div>
      ) : (
        <ul className="mt-5 divide-y rounded-xl border bg-surface">
          {contacts.map((c) => (
            <li key={c.id}>
              <Link
                href={`/panel/${slug}/clientes/${c.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-raised"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {c.name ?? c.phone ?? c.email ?? '(sin nombre)'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {[c.phone, c.email].filter(Boolean).join(' · ') || c.channel}
                    {c.conversations ? ` · ${c.conversations} plática${c.conversations === 1 ? '' : 's'}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.tags.slice(0, 2).map((t) => (
                    <Badge key={t} variant="outline" className="hidden sm:inline-flex">
                      #{t}
                    </Badge>
                  ))}
                  <Badge variant={c.stage === 'cliente' ? 'default' : 'soft'}>
                    {stageLabel(c.stage)}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
