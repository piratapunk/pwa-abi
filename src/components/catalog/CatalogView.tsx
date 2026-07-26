'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  Inbox,
  MessageCircle,
  Megaphone,
  Phone,
  PhoneCall,
  Plus,
  Puzzle,
  Send,
  Sparkles,
  Star,
  Users,
} from 'lucide-react'

import { AbiBee } from '@/components/brand/AbiBee'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { CatalogGroup } from '@/lib/catalog'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageCircle,
  Users,
  Phone,
  Send,
  Inbox,
  CalendarClock,
  Star,
  PhoneCall,
  Megaphone,
  BarChart3,
  Puzzle,
}

type Step = 'browse' | 'form' | 'done'

export function CatalogView({
  catalog,
  builderSessionId,
}: {
  catalog: CatalogGroup[]
  builderSessionId?: string
}) {
  const storageKey = `necta:cart:${builderSessionId ?? 'anon'}`
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<Step>('browse')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setSelected(new Set(JSON.parse(raw) as string[]))
    } catch {}
    setHydrated(true)
  }, [storageKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(storageKey, JSON.stringify([...selected]))
    } catch {}
  }, [selected, hydrated, storageKey])

  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })

  const count = selected.size
  const selectedServices = useMemo(
    () =>
      catalog
        .flatMap((g) => g.services)
        .filter((s) => selected.has(s.slug)),
    [catalog, selected]
  )

  if (step === 'done') {
    return <DoneCard />
  }

  if (step === 'form') {
    return (
      <RequestForm
        services={selectedServices.map((s) => s.slug)}
        serviceNames={selectedServices.map((s) => s.name)}
        builderSessionId={builderSessionId}
        onBack={() => setStep('browse')}
        onDone={() => {
          try {
            localStorage.removeItem(storageKey)
          } catch {}
          setStep('done')
        }}
      />
    )
  }

  return (
    <>
      <div className="space-y-10 pb-28">
        {catalog.map((group) => (
          <section key={group.category}>
            <h2 className="mb-4 font-display text-lg font-semibold">
              {group.category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.services.map((s) => {
                const Icon = (s.icon && ICONS[s.icon]) || Sparkles
                const on = selected.has(s.slug)
                return (
                  <button
                    key={s.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s.slug)}
                    className={cn(
                      'group relative flex flex-col rounded-xl border bg-card p-5 text-left transition-colors elev',
                      on
                        ? 'border-accent ring-2 ring-accent/30'
                        : 'hover:border-accent/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          'flex size-10 items-center justify-center rounded-lg',
                          on
                            ? 'bg-accent text-on-accent'
                            : 'bg-accent-soft text-accent'
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span
                        className={cn(
                          'flex size-6 items-center justify-center rounded-full border transition-colors',
                          on
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-border text-text-muted group-hover:border-accent/60'
                        )}
                        aria-hidden
                      >
                        {on ? <Check className="size-4" /> : <Plus className="size-4" />}
                      </span>
                    </div>
                    <h3 className="mt-3 font-semibold leading-tight">{s.name}</h3>
                    {s.description && (
                      <p className="mt-1 text-sm text-text-muted">{s.description}</p>
                    )}
                    {s.priceNote && (
                      <span className="mt-3 inline-flex w-fit rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-text-muted">
                        {s.priceNote}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* barra pegajosa del carrito */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="text-sm text-text-muted">
            {count === 0 ? (
              'Agrega lo que quieras que haga por ti'
            ) : (
              <>
                <span className="font-semibold text-text">{count}</span>{' '}
                {count === 1 ? 'servicio elegido' : 'servicios elegidos'}
              </>
            )}
          </p>
          <Button disabled={count === 0} onClick={() => setStep('form')}>
            Continuar
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </>
  )
}

function RequestForm({
  services,
  serviceNames,
  builderSessionId,
  onBack,
  onDone,
}: {
  services: string[]
  serviceNames: string[]
  builderSessionId?: string
  onBack: () => void
  onDone: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    business: '',
    notes: '',
  })
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setState('error')
      return
    }
    setState('sending')
    try {
      const res = await fetch('/api/service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          business: form.business.trim() || undefined,
          notes: form.notes.trim() || undefined,
          builderSessionId,
          services,
          _h: '',
        }),
      })
      if (res.ok) onDone()
      else setState('error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" /> Volver al catálogo
      </button>

      <div className="rounded-xl border bg-card p-6 elev">
        <h2 className="font-display text-xl font-bold">Casi listo</h2>
        <p className="mt-1 text-sm text-text-muted">
          Déjanos tus datos y te contactamos para agendar el arranque. Sin
          compromiso, sin cobros aquí.
        </p>

        <div className="mt-4 rounded-lg bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Tu suite ({serviceNames.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {serviceNames.map((n) => (
              <span
                key={n}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            type="text"
            name="_h"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden
          />
          <div>
            <label className="mb-1 block text-sm font-medium">Tu nombre *</label>
            <Input value={form.name} onChange={set('name')} placeholder="Nombre y apellido" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Correo</label>
              <Input type="email" value={form.email} onChange={set('email')} placeholder="tu@correo.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">WhatsApp / teléfono</label>
              <Input value={form.phone} onChange={set('phone')} placeholder="55 1234 5678" />
            </div>
          </div>
          <p className="text-xs text-text-muted">Con correo o teléfono basta.</p>
          <div>
            <label className="mb-1 block text-sm font-medium">Tu negocio</label>
            <Input value={form.business} onChange={set('business')} placeholder="Nombre de tu negocio" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">¿Algo que debamos saber?</label>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={3}
              placeholder="Cuéntanos qué buscas…"
              className="flex w-full rounded-lg border bg-surface px-3.5 py-2 text-sm text-text placeholder:text-text-muted/70 outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
            />
          </div>

          {state === 'error' && (
            <p className="text-sm text-warn">
              Revisa tu nombre y un medio de contacto (correo o teléfono).
            </p>
          )}

          <Button type="submit" className="w-full" disabled={state === 'sending'}>
            {state === 'sending' ? 'Enviando…' : 'Enviar y agendar arranque'}
          </Button>
        </form>
      </div>
    </div>
  )
}

function DoneCard() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <AbiBee className="mx-auto block text-5xl" />
      <h2 className="mt-4 font-display text-2xl font-bold">¡Recibido! 🎉</h2>
      <p className="mt-2 text-text-muted">
        Ya tenemos tu suite. Te contactamos muy pronto para agendar el arranque de
        tu proyecto. Mientras, tu asistente sigue vivo y puedes seguir probándolo.
      </p>
      <Button className="mt-6" asChild>
        <a href="/">Volver al inicio</a>
      </Button>
    </div>
  )
}
