'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function FeatureRequestForm({ slug }: { slug: string }) {
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim().length < 4 || state === 'sending') return
    setState('sending')
    try {
      const res = await fetch('/api/panel/feature-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title: title.trim(), detail: detail.trim(), _h: '' }),
      })
      setState(res.ok ? 'sent' : 'error')
      if (res.ok) {
        setTitle('')
        setDetail('')
      }
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-xl border bg-accent-soft p-6 text-center">
        <p className="text-sm font-semibold text-accent">Recibido 🐝</p>
        <p className="mt-1 text-xs text-text-muted">
          Lo revisamos y te contactamos con una propuesta. Somos desarrolladores:
          si se puede imaginar, se puede conectar.
        </p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setState('idle')}>
          Pedir otra función
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="¿Qué quieres que tu bot haga? (ej. cobrar apartados, avisar a mi equipo)"
        maxLength={160}
        aria-label="Función que necesitas"
      />
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Cuéntanos el detalle: con qué apps trabajas, cómo te gustaría que funcionara…"
        maxLength={4000}
        rows={4}
        className="w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/70 outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        aria-label="Detalle de la función"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {state === 'error' ? 'No se pudo enviar — inténtalo otra vez.' : ''}
        </p>
        <Button type="submit" disabled={title.trim().length < 4 || state === 'sending'}>
          {state === 'sending' ? 'Enviando…' : 'Solicitar función'}
        </Button>
      </div>
    </form>
  )
}
