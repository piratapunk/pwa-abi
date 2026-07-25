import {
  Globe,
  Instagram,
  Lock,
  MessageCircle,
  Phone,
  Send,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'

import { ConnectWhatsAppButton } from './ConnectWhatsAppButton'

export const dynamic = 'force-dynamic'

/*
 * Homologado al dashboard de conexiones del canal (perfil → plataforma →
 * tarjeta con estado + settings/disconnect). Hoy: chat web conectado real;
 * WhatsApp con el flujo self-serve diseñado en WHATSAPP-ONBOARDING.md
 * (esqueleto hasta F1); el resto marcado como próximamente.
 */

export default async function PanelConexiones({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const userId = await getAuthUserId()
  const sql = getSql()
  const rows = await sql!`select necta.tenant_overview(${userId}::uuid, ${slug}) as o`
  const o = rows[0]?.o as {
    ok: boolean
    plan: string
    subdomain: string
    channel_status: string
    channel_number: string | null
  }
  if (!o?.ok) return null

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="t-eyebrow">Conexiones</p>
          <h1 className="mt-1 text-2xl font-semibold">Los canales de tu asistente</h1>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {/* conectado real */}
        <div className="rounded-xl border bg-surface p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft">
                <Globe className="size-4.5 text-accent" />
              </span>
              <div>
                <p className="text-sm font-semibold">Chat web</p>
                <Badge className="mt-0.5 bg-success text-on-accent">conectado</Badge>
              </div>
            </div>
          </div>
          <p className="mt-3 truncate text-xs text-text-muted">{o.subdomain}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a href={`https://${o.subdomain}`} target="_blank" rel="noopener noreferrer">
                Abrir
              </a>
            </Button>
          </div>
        </div>

        {/* WhatsApp — conectado / conectar / candado según plan */}
        <div className="rounded-xl border border-accent/40 bg-surface p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft">
                <MessageCircle className="size-4.5 text-accent" />
              </span>
              <div>
                <p className="text-sm font-semibold">WhatsApp</p>
                {o.channel_status === 'connected' ? (
                  <Badge className="mt-0.5 bg-success text-on-accent">conectado</Badge>
                ) : (
                  <Badge variant="premium" className="mt-0.5">Premium</Badge>
                )}
              </div>
            </div>
            {o.plan === 'free' && <Lock className="size-4 text-text-muted" />}
          </div>

          {o.channel_status === 'connected' ? (
            <>
              <p className="mt-3 text-xs text-text-muted">
                Tu asistente contesta en {o.channel_number ?? 'tu número'} — y tú
                puedes entrar a la conversación desde tu app cuando quieras.
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-xs text-text-muted">
                Conecta tu número de siempre en ~5 minutos, guiado por el flujo
                oficial de WhatsApp. Tu app sigue funcionando igual — tu bot
                contesta y tú entras cuando quieras.
              </p>
              <div className="mt-4">
                {o.plan === 'free' ? (
                  <Button size="sm" asChild>
                    <a href={`/panel/${slug}/plan`}>Desbloquear con Premium</a>
                  </Button>
                ) : (
                  <ConnectWhatsAppButton slug={slug} />
                )}
              </div>
              {o.channel_status === 'error' && (
                <p className="mt-2 text-xs text-warn">
                  La última conexión no se completó — inténtalo de nuevo.
                </p>
              )}
            </>
          )}
        </div>

        {/* próximamente */}
        {[
          { icon: Instagram, name: 'Instagram DMs' },
          { icon: Send, name: 'Facebook Messenger' },
          { icon: Phone, name: 'Teléfono con IA' },
          { icon: Send, name: 'Telegram' },
        ].map((p) => (
          <div key={p.name} className="rounded-xl border border-dashed bg-surface/50 p-5 opacity-70">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-surface-raised">
                <p.icon className="size-4.5 text-text-muted" />
              </span>
              <div>
                <p className="text-sm font-semibold">{p.name}</p>
                <Badge variant="outline" className="mt-0.5">próximamente</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
