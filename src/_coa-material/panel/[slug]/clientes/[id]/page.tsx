import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'

import { ContactEditor } from '@/components/crm/ContactEditor'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthUserId } from '@/lib/auth/server'
import { type CrmContact } from '@/lib/crm'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ContactConv = {
  session_id: string
  channel: string
  mode: string
  started_at: string
  last_at: string
  last_user_msg: string | null
}

export default async function PanelCliente({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  if (!UUID_RE.test(id)) notFound()
  const userId = await getAuthUserId()
  const sql = getSql()

  const overviewRows = await sql!`select necta.tenant_overview(${userId}::uuid, ${slug}) as o`
  const o = overviewRows[0]?.o as { ok: boolean; plan: string }
  if (!o?.ok || o.plan === 'free') notFound()

  const rows = await sql!`
    select necta.tenant_contact_get(${userId}::uuid, ${slug}, ${id}::uuid) as r
  `
  const r = rows[0]?.r as { ok: boolean; contact: CrmContact; conversations: ContactConv[] }
  if (!r?.ok) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/panel/${slug}/clientes`}
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" /> Clientes
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">
        {r.contact.name ?? r.contact.phone ?? r.contact.email ?? '(sin nombre)'}
      </h1>
      <p className="mt-1 text-xs text-text-muted">
        Llegó por {r.contact.channel === 'whatsapp' ? 'WhatsApp' : 'chat web'} ·{' '}
        {new Date(r.contact.created_at).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'long',
        })}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Datos del cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactEditor slug={slug} contact={r.contact} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Sus pláticas</CardTitle>
        </CardHeader>
        <CardContent>
          {r.conversations.length === 0 ? (
            <p className="text-sm text-text-muted">Sin pláticas ligadas todavía.</p>
          ) : (
            <ul className="divide-y">
              {r.conversations.map((c) => (
                <li key={c.session_id}>
                  <Link
                    href={`/panel/${slug}/conversaciones/${c.session_id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-surface-raised"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <MessageSquare className="size-4 shrink-0 text-text-muted" />
                      <p className="truncate text-sm">
                        {c.last_user_msg ?? '(sin mensajes del cliente)'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
                      {c.mode === 'human' && <Badge variant="soft">tú atiendes</Badge>}
                      {new Date(c.last_at).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
