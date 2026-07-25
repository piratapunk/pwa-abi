import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, UserRound } from 'lucide-react'

import { StageSelect } from '@/components/crm/StageSelect'
import { ThreadView } from '@/components/crm/ThreadView'
import { Badge } from '@/components/ui/badge'
import { getAuthUserId } from '@/lib/auth/server'
import { type CrmMessage } from '@/lib/crm'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ThreadConversation = {
  session_id: string
  channel: string
  mode: 'bot' | 'human'
  started_at: string
  contact: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
    stage: string
    tags: string[]
    notes: string | null
  } | null
}

export default async function PanelConversacion({
  params,
}: {
  params: Promise<{ slug: string; session: string }>
}) {
  const { slug, session } = await params
  if (!UUID_RE.test(session)) notFound()
  const userId = await getAuthUserId()
  const sql = getSql()

  const overviewRows = await sql!`select necta.tenant_overview(${userId}::uuid, ${slug}) as o`
  const o = overviewRows[0]?.o as { ok: boolean; plan: string }
  if (!o?.ok) notFound()

  const rows = await sql!`
    select necta.tenant_conversation_messages(${userId}::uuid, ${slug}, ${session}::uuid) as r
  `
  const r = rows[0]?.r as {
    ok: boolean
    conversation: ThreadConversation
    messages: CrmMessage[]
  }
  if (!r?.ok) notFound()

  const conv = r.conversation
  const isPremium = o.plan !== 'free'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 lg:flex-row">
      <div className="min-w-0 flex-1">
        <Link
          href={`/panel/${slug}/conversaciones`}
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text"
        >
          <ArrowLeft className="size-3.5" /> Conversaciones
        </Link>
        <h1 className="mt-2 text-xl font-semibold">
          {conv.contact?.name ?? (conv.channel === 'whatsapp' ? 'Cliente de WhatsApp' : 'Visitante del chat web')}
        </h1>
        <div className="mt-4 flex min-h-0 flex-col">
          <ThreadView
            slug={slug}
            session={session}
            initialMessages={r.messages}
            initialMode={conv.mode}
            canReply={isPremium}
          />
        </div>
      </div>

      <aside className="w-full shrink-0 lg:w-64">
        <div className="rounded-xl border bg-surface p-4 lg:mt-14">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <UserRound className="size-4 text-accent" /> Cliente
          </p>
          {conv.contact ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-medium">{conv.contact.name ?? '(sin nombre)'}</p>
              {conv.contact.phone && <p className="text-xs text-text-muted">{conv.contact.phone}</p>}
              {conv.contact.email && <p className="text-xs text-text-muted">{conv.contact.email}</p>}
              {isPremium ? (
                <StageSelect
                  slug={slug}
                  contactId={conv.contact.id}
                  stage={conv.contact.stage}
                  className="w-full"
                />
              ) : (
                <Badge variant="soft">{conv.contact.stage}</Badge>
              )}
              {conv.contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {conv.contact.tags.map((t) => (
                    <Badge key={t} variant="outline">#{t}</Badge>
                  ))}
                </div>
              )}
              {isPremium && (
                <Link
                  href={`/panel/${slug}/clientes/${conv.contact.id}`}
                  className="block pt-2 text-xs text-accent underline-offset-2 hover:underline"
                >
                  Ver ficha completa →
                </Link>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-text-muted">
              Todavía no deja sus datos. Cuando comparta su teléfono o correo en la
              plática, su ficha aparece aquí sola.
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}
