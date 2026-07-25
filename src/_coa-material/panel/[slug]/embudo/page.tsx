import Link from 'next/link'

import { CrmLocked } from '@/components/crm/CrmLocked'
import { StageSelect } from '@/components/crm/StageSelect'
import { getAuthUserId } from '@/lib/auth/server'
import { STAGES } from '@/lib/crm'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

type PipelineContact = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  tags: string[]
  last_seen_at: string
}

export default async function PanelEmbudo({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const userId = await getAuthUserId()
  const sql = getSql()

  const overviewRows = await sql!`select necta.tenant_overview(${userId}::uuid, ${slug}) as o`
  const o = overviewRows[0]?.o as { ok: boolean; plan: string }
  if (!o?.ok) return null

  if (o.plan === 'free') {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="t-eyebrow">Embudo</p>
        <h1 className="mt-1 text-2xl font-semibold">De curioso a cliente</h1>
        <CrmLocked slug={slug} feature="Embudo de ventas" />
      </div>
    )
  }

  const rows = await sql!`select necta.tenant_pipeline(${userId}::uuid, ${slug}) as r`
  const r = rows[0]?.r as {
    ok: boolean
    pipeline: Record<string, { count: number; contacts: PipelineContact[] }>
  }
  const pipeline = r?.ok ? r.pipeline : {}

  return (
    <div className="mx-auto max-w-6xl">
      <p className="t-eyebrow">Embudo</p>
      <h1 className="mt-1 text-2xl font-semibold">De curioso a cliente</h1>
      <p className="mt-1 text-sm text-text-muted">
        Mueve a cada persona de etapa conforme avanza la plática.
      </p>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="grid min-w-[900px] grid-cols-5 gap-3">
          {STAGES.map((s) => {
            const col = pipeline[s.key] ?? { count: 0, contacts: [] }
            return (
              <div key={s.key} className="rounded-xl border bg-surface/60 p-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {s.label}
                  </p>
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-text-muted">
                    {col.count}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {col.contacts.map((c) => (
                    <div key={c.id} className="rounded-lg border bg-surface p-3">
                      <Link
                        href={`/panel/${slug}/clientes/${c.id}`}
                        className="block truncate text-sm font-medium hover:text-accent"
                      >
                        {c.name ?? c.phone ?? c.email ?? '(sin nombre)'}
                      </Link>
                      {(c.phone || c.email) && (
                        <p className="mt-0.5 truncate text-xs text-text-muted">
                          {c.phone ?? c.email}
                        </p>
                      )}
                      <StageSelect
                        slug={slug}
                        contactId={c.id}
                        stage={s.key}
                        className="mt-2 w-full"
                      />
                    </div>
                  ))}
                  {col.contacts.length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-text-muted/70">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
