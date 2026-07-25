'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Copy, ExternalLink, Mail } from 'lucide-react'

import { AbiBee } from '@/components/brand/AbiBee'
import { TenantChat } from '@/components/chat/TenantChat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FEATURES } from '@/lib/flags'

/*
 * Cierre del Constructor: al construirse el bot, el chat se retira y entra
 * esta tarjeta — éxito + liga + claim SIEMPRE visible + mini-chat de prueba.
 */

export function BuildSuccessCard({
  botUrl,
  botName,
  builderSessionId,
  claimed = false,
}: {
  botUrl: string
  botName: string
  builderSessionId: string
  claimed?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const [claimEmail, setClaimEmail] = useState('')
  const [claimState, setClaimState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const slug = new URL(botUrl).hostname.split('.')[0]
  const prettyUrl = botUrl.replace('https://', '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(botUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const claim = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!claimEmail.trim() || claimState === 'sending') return
    setClaimState('sending')
    try {
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: claimEmail.trim(),
          builderSessionId,
          _h: '',
        }),
      })
      setClaimState(res.ok ? 'sent' : 'error')
    } catch {
      setClaimState('error')
    }
  }

  return (
    /* desktop: celebración+claim | pruébalo, LADO A LADO; móvil: apilado */
    <div className="flex min-h-0 flex-1 animate-fade-in flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="flex flex-col lg:w-[44%] lg:justify-center lg:overflow-y-auto lg:border-r">
      {/* celebración + liga */}
      <div className="border-b bg-accent-soft px-6 py-6 text-center lg:border-b-0">
        <AbiBee className="mx-auto block text-5xl" />
        <h2 className="mt-3 font-display text-xl font-bold">
          ¡Tu asistente está vivo! 🎉
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {botName} ya contesta en su propia dirección:
        </p>
        <div className="mx-auto mt-3 flex max-w-md items-center gap-2">
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 break-all rounded-lg border bg-surface px-3 py-2 text-sm font-semibold text-accent hover:underline"
          >
            {prettyUrl}
          </a>
          <Button variant="secondary" size="icon" aria-label="Copiar liga" onClick={copy}>
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          </Button>
          <Button size="icon" aria-label="Abrir" asChild>
            <a href={botUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* claim — siempre a la vista (o el acceso directo si ya hay sesión) */}
      <div className="border-b bg-bg/50 px-6 py-4 lg:border-b-0 lg:border-t">
        {!FEATURES.selfServe ? (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <AbiBee className="text-lg" /> ¿Te late? Ahora arma tu suite
            </p>
            <p className="mb-3 text-sm text-text-muted">
              Elige todo lo que quieres que haga por ti — WhatsApp, redes, reseñas,
              campañas y más. Nosotros lo armamos contigo.
            </p>
            <Button className="w-full" asChild>
              <Link href={`/servicios?s=${builderSessionId}`}>
                Ver todo lo que puede hacer
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : claimed ? (
          <div className="text-center">
            <p className="text-sm text-text-muted">
              Ya quedó ligado a tu cuenta ✓
            </p>
            <Button className="mt-3" asChild>
              <a href={`/panel/${slug}`}>Ir a su panel</a>
            </Button>
          </div>
        ) : claimState !== 'sent' ? (
          <>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Mail className="size-4 text-accent" /> Hazlo tuyo — para
              administrarlo cuando quieras
            </p>
            <form onSubmit={claim} className="flex items-center gap-2">
              <Input
                type="email"
                value={claimEmail}
                onChange={(e) => setClaimEmail(e.target.value)}
                placeholder="Tu correo"
                aria-label="Correo para reclamar tu bot"
              />
              <Button type="submit" disabled={claimState === 'sending'} className="shrink-0">
                {claimState === 'sending' ? 'Enviando…' : 'Ligarlo a mí'}
              </Button>
            </form>
            {claimState === 'error' && (
              <p className="mt-1.5 text-xs text-warn">
                No pude mandar el correo — tu bot sigue en línea; inténtalo en un momento.
              </p>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-text-muted">
            Te mandé un enlace de acceso 🐝 ábrelo y tu bot queda a tu nombre —
            caerás directo en tu panel.
          </p>
        )}
      </div>

      </div>

      {/* mini-chat de prueba embebido */}
      <div className="flex min-h-[320px] flex-1 flex-col px-6 py-4 lg:min-h-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Pruébalo aquí mismo
        </p>
        <TenantChat
          slug={slug}
          botName={botName}
          greeting={`Hola, soy ${botName}. ¿En qué te ayudo?`}
        />
      </div>
    </div>
  )
}
