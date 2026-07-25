import { ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Overview = {
  ok: boolean
  name: string
  vertical: string
  plan: string
  status: string
  subdomain: string
  persona: { bot_name?: string; greeting?: string; tone?: string[] }
  limits: { msgs_day?: number; kb_max_chars?: number }
  msgs_today: number
  conversations: number
  kb_chars: number
  kb_chunks: number
  contacts: number
  contacts_week: number
}

export default async function PanelResumen({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const userId = await getAuthUserId()
  const sql = getSql()
  const rows = await sql!`select necta.tenant_overview(${userId}::uuid, ${slug}) as o`
  const o = rows[0]?.o as Overview
  if (!o?.ok) return null

  const msgsLimit = o.limits?.msgs_day ?? 50
  const kbLimit = o.limits?.kb_max_chars ?? 20000

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="t-eyebrow">Resumen</p>
          <h1 className="mt-1 text-2xl font-bold">{o.name}</h1>
          <p className="text-sm text-text-muted">
            {o.vertical} · {o.status === 'active' ? 'en línea' : o.status}
          </p>
        </div>
        <Button asChild>
          <a href={`https://${o.subdomain}`} target="_blank" rel="noopener noreferrer">
            Probar mi bot <ExternalLink className="size-4" />
          </a>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-text-muted">Mensajes hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">
              {o.msgs_today}
              <span className="text-base font-normal text-text-muted"> / {msgsLimit}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-text-muted">Conversaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">{o.conversations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-text-muted">Clientes captados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">
              {o.contacts}
              {o.contacts_week > 0 && (
                <span className="text-base font-normal text-success"> +{o.contacts_week} esta semana</span>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-text-muted">Memoria del bot</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold">
              {Math.round((o.kb_chars / kbLimit) * 100)}
              <span className="text-base font-normal text-text-muted">% usada</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Personalidad del bot <Badge variant="soft">solo lectura por ahora</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-text-muted">Nombre</p>
            <p>{o.persona?.bot_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Saludo</p>
            <p>{o.persona?.greeting ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Tono</p>
            <p>{(o.persona?.tone ?? []).join(', ') || '—'}</p>
          </div>
          <p className="pt-1 text-xs text-text-muted">
            Muy pronto: editar saludo, tono y respuestas desde aquí, con cambios al instante.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
