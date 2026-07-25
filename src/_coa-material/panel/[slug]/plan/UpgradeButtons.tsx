'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'

export function UpgradeButtons({
  slug,
  monthly,
  yearly,
}: {
  slug: string
  monthly: string
  yearly: string
}) {
  const [busy, setBusy] = useState<'month' | 'year' | null>(null)
  const [error, setError] = useState(false)

  const go = async (interval: 'month' | 'year') => {
    if (busy) return
    setBusy(interval)
    setError(false)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, interval, _h: '' }),
      })
      const data = (await res.json()) as { url?: string }
      if (data.url) {
        window.location.assign(data.url)
        return
      }
      setError(true)
    } catch {
      setError(true)
    }
    setBusy(null)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => go('month')} disabled={busy !== null}>
          {busy === 'month' ? 'Abriendo…' : `Mensual — $${monthly} MXN/mes`}
        </Button>
        <Button variant="outline" onClick={() => go('year')} disabled={busy !== null}>
          {busy === 'year' ? 'Abriendo…' : `Anual — $${yearly} MXN (2 meses gratis)`}
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-warn">
          No se pudo abrir el pago — inténtalo otra vez en un momento.
        </p>
      )}
      <p className="mt-3 text-xs text-text-muted">
        Pago seguro con Stripe. Cancelas cuando quieras; tu bot nunca se borra.
      </p>
    </div>
  )
}

export function PortalButton({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          const res = await fetch('/api/stripe/portal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, _h: '' }),
          })
          const data = (await res.json()) as { url?: string }
          if (data.url) {
            window.location.assign(data.url)
            return
          }
        } catch {}
        setBusy(false)
      }}
    >
      {busy ? 'Abriendo…' : 'Administrar suscripción'}
    </Button>
  )
}
