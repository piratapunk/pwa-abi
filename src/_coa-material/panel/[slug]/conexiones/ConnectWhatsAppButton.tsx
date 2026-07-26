'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'

export function ConnectWhatsAppButton({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const go = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/panel/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, _h: '' }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.assign(data.url)
        return
      }
      setError(
        data.error === 'premium_required'
          ? 'Conectar tu número es parte de Premium.'
          : 'No se pudo iniciar la conexión — inténtalo en un momento.'
      )
    } catch {
      setError('No se pudo iniciar la conexión — inténtalo en un momento.')
    }
    setBusy(false)
  }

  return (
    <div>
      <Button size="sm" onClick={go} disabled={busy}>
        {busy ? 'Abriendo…' : 'Conectar mi WhatsApp'}
      </Button>
      {error && <p className="mt-2 text-xs text-warn">{error}</p>}
    </div>
  )
}
