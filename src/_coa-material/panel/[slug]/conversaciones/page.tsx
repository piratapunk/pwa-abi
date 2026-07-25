import Link from 'next/link'
import { Globe, MessageCircle, MessageSquare } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { getAuthUserId } from '@/lib/auth/server'
import { stageLabel, type CrmConversation } from '@/lib/crm'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function PanelConversaciones({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const userId = await getAuthUserId()
  const sql = getSql()
  const rows = await sql!`
    select necta.tenant_conversations_list(${userId}::uuid, ${slug}, 50) as r
  `
  const r = rows[0]?.r as { ok: boolean; conversations: CrmConversation[] }
  const convs = r?.ok ? r.conversations : []

  return (
    <div className="mx-auto max-w-4xl">
      <p className="t-eyebrow">Conversaciones</p>
      <h1 className="mt-1 text-2xl font-semibold">Lo que tu asistente ha atendido</h1>

      {convs.length === 0 ? (
        <div className="mt-10 rounded-xl border bg-surface p-10 text-center">
          <MessageSquare className="mx-auto size-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-muted">
            Aún no hay conversaciones. Comparte tu asistente y aquí verás cada plática.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border bg-surface">
          {convs.map((c) => (
            <li key={c.session_id}>
              <Link
                href={`/panel/${slug}/conversaciones/${c.session_id}`}
                className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-raised"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                    {c.channel === 'whatsapp' ? (
                      <MessageCircle className="size-4 text-accent" />
                    ) : (
                      <Globe className="size-4 text-accent" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {c.contact?.name ? (
                        <span className="font-medium">{c.contact.name}: </span>
                      ) : null}
                      {c.last_user_msg ?? '(sin mensajes del cliente)'}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {c.channel === 'whatsapp' ? 'WhatsApp' : 'Chat web'} · {c.messages} mensajes
                      {c.contact ? ` · ${stageLabel(c.contact.stage)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {c.mode === 'human' && <Badge variant="soft">tú atiendes</Badge>}
                  <p className="text-xs text-text-muted">
                    {new Date(c.last_at).toLocaleString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
