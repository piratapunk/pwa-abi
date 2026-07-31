'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'

import { AbiBee } from '@/components/brand/AbiBee'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || state === 'sending') return
    setState('sending')
    try {
      /* red de seguridad: si este navegador construyó un bot y quedó sin
         reclamar, el login normal también lo liga */
      let builderSessionId: string | null = null
      try {
        builderSessionId = localStorage.getItem('abi_builder_session')
      } catch {}
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          ...(builderSessionId ? { builderSessionId } : {}),
          _h: '',
        }),
      })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-2xl border bg-surface p-8 text-center">
        <Mail className="mx-auto size-10 text-accent" />
        <h1 className="mt-4 text-xl font-semibold">Revisa tu correo 🐝</h1>
        <p className="mt-2 text-sm text-text-muted">
          Si tienes cuenta con nosotros, te mandé un enlace de acceso a{' '}
          <span className="text-text">{email}</span>. Ábrelo y entras directo a
          tus bots.
        </p>
        <p className="mt-4 text-xs text-text-muted">
          ¿No llega? Revisa spam y márcalo como “no es no deseado”, o{' '}
          <button
            className="text-accent hover:underline"
            onClick={() => setState('idle')}
          >
            inténtalo de nuevo
          </button>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-surface p-8">
      <div className="text-center">
        <AbiBee className="mx-auto block text-5xl" />
        <h1 className="mt-4 text-2xl font-semibold">Entra a tu cuenta</h1>
        <p className="mt-2 text-sm text-text-muted">
          Sin contraseñas. Te mandamos un enlace a tu correo y entras al instante.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          aria-label="Tu correo"
          autoFocus
          required
        />
        <Button type="submit" className="w-full" disabled={state === 'sending'}>
          {state === 'sending' ? 'Enviando…' : 'Enviarme el enlace de acceso'}
        </Button>
        {state === 'error' && (
          <p className="text-center text-xs text-warn">
            No se pudo enviar — inténtalo otra vez en un momento.
          </p>
        )}
      </form>

      <p className="mt-5 text-center text-xs text-text-muted">
        ¿Aún no tienes bot?{' '}
        <a href="/constructor" className="text-accent hover:underline">
          Arma uno gratis
        </a>
      </p>
    </div>
  )
}
