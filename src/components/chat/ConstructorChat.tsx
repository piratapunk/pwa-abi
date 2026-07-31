'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { ExternalLink, FileText, Loader2, Paperclip, Send, X } from 'lucide-react'

import { AbiBee } from '@/components/brand/AbiBee'
import { Linkify } from '@/components/chat/Linkify'
import { BuildSuccessCard } from '@/components/chat/BuildSuccessCard'
import { BuildingOverlay } from '@/components/chat/BuildingOverlay'
import { PersonalityTuner } from '@/components/chat/PersonalityTuner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Msg = { id: string; role: 'user' | 'assistant'; content: string }
type Stage = 'inicio' | 'conversando' | 'borrador' | 'afinado' | 'construido'
type Upload =
  | { phase: 'uploading'; filename: string }
  | { phase: 'review'; id: string; filename: string; chars: number; text: string }
  | { phase: 'error'; msg: string }

const UPLOAD_ERRORS: Record<string, string> = {
  tipo_no_permitido: 'Ese tipo de archivo no lo puedo leer. Sube PDF, Word, TXT, Markdown o CSV.',
  demasiado_grande: 'El archivo pesa más de lo que permite el plan gratis (2 MB).',
  limite_archivos: 'El plan gratis incluye 1 archivo. Descarta el anterior si quieres cambiarlo.',
  sin_texto: 'No encontré texto legible en ese archivo. ¿Tienes una versión con texto (no solo imágenes)?',
  turnstile_required: 'Antes de subir archivos, márcame la casilla de "soy humano".',
  rate_limited: 'Vas muy rápido — espera un momento e inténtalo de nuevo.',
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: string | HTMLElement,
        opts: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          appearance?: string
          theme?: string
          retry?: string
          'retry-interval'?: number
          'refresh-expired'?: string
        }
      ) => string
      reset: (id?: string) => void
    }
  }
}

const GREETING =
  'Hola, soy Abi 🐝 Cuéntame, ¿a qué se dedica tu negocio? En un ratito dejamos a tu asistente zumbando de verdad.'

/* endowed progress: el panal nunca arranca vacío */
const STAGE_CELLS: Record<Stage, number> = {
  inicio: 2,
  conversando: 3,
  borrador: 4,
  afinado: 5,
  construido: 6,
}

function getBuilderSession(): string {
  const key = 'abi_builder_session'
  try {
    let sid = localStorage.getItem(key)
    if (!sid) {
      sid = crypto.randomUUID()
      localStorage.setItem(key, sid)
    }
    return sid
  } catch {
    return crypto.randomUUID()
  }
}

function HoneycombProgress({ filled }: { filled: number }) {
  return (
    <svg viewBox="0 0 340 60" className="mx-auto w-full max-w-[260px]" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => {
        const x = 20 + i * 52
        const points = `${x},14 ${x + 22},2 ${x + 44},14 ${x + 44},40 ${x + 22},52 ${x},40`
        return (
          <polygon
            key={i}
            points={points}
            fill={i < filled ? 'var(--accent)' : 'transparent'}
            stroke="var(--accent)"
            strokeOpacity={i < filled ? 1 : 0.35}
            strokeWidth="2"
            style={{ transition: 'fill 0.6s ease' }}
          />
        )
      })}
    </svg>
  )
}

export function ConstructorChat() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [botUrl, setBotUrl] = useState<string | null>(null)
  const [claimed, setClaimed] = useState(false)
  const [building, setBuilding] = useState(false)
  const [stage, setStage] = useState<Stage>('inicio')
  const [tsToken, setTsToken] = useState<string | null>(null)
  const [tsVerified, setTsVerified] = useState(false)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [tunerOpen, setTunerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /* overlay del reto: visible → fading (éxito, se desvanece) → hidden */
  const [tsOverlay, setTsOverlay] = useState<'visible' | 'fading' | 'hidden'>('visible')
  const sidRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tsContainer = useRef<HTMLDivElement>(null)
  const tsRendered = useRef(false)
  const pendingUrlRef = useRef<string | null>(null)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    sidRef.current = getBuilderSession()
    try {
      const built = localStorage.getItem(`abi_built_${sidRef.current}`)
      if (built) {
        setBotUrl(built)
        setStage('construido')
        return
      }
    } catch {}
    /* sesiones que construyeron antes de esta versión: preguntar al servidor */
    fetch(`/api/constructor/status?bs=${sidRef.current}`)
      .then((r) => r.json())
      .then((d: { built?: boolean; subdomain?: string }) => {
        if (d.built && d.subdomain) {
          const url = `https://${d.subdomain}`
          setBotUrl(url)
          setStage('construido')
          try {
            localStorage.setItem(`abi_built_${sidRef.current}`, url)
          } catch {}
        }
      })
      .catch(() => {})
    setMessages([{ id: 'greeting', role: 'assistant', content: GREETING }])
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, busy, stage, tunerOpen])

  const renderTurnstile = useCallback(() => {
    if (tsRendered.current || !siteKey || !window.turnstile || !tsContainer.current) return
    tsRendered.current = true
    window.turnstile.render(tsContainer.current, {
      sitekey: siteKey,
      appearance: 'always',
      retry: 'auto',
      'retry-interval': 4000,
      'refresh-expired': 'auto',
      callback: (token) => {
        setTsToken(token)
        setTsOverlay('fading')
        setTimeout(() => setTsOverlay('hidden'), 700)
      },
      'error-callback': () => {
        setTsToken(null)
        setTsOverlay('visible')
        /* reto atorado (red/extensión): reintentar en vez de morir */
        setTimeout(() => {
          try {
            window.turnstile?.reset()
          } catch {}
        }, 4000)
      },
    })
  }, [siteKey])

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || upload?.phase === 'uploading') return
    setUpload({ phase: 'uploading', filename: file.name })
    try {
      const fd = new FormData()
      fd.set('sessionId', sidRef.current)
      fd.set('file', file)
      const res = await fetch('/api/constructor/upload', { method: 'POST', body: fd })
      const data = (await res.json()) as {
        ok?: boolean
        id?: string
        filename?: string
        chars?: number
        text?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        setUpload({
          phase: 'error',
          msg: UPLOAD_ERRORS[data.error ?? ''] ?? 'No pude leer tu archivo. Inténtalo de nuevo.',
        })
        return
      }
      setUpload({
        phase: 'review',
        id: data.id!,
        filename: data.filename ?? file.name,
        chars: data.chars ?? 0,
        text: data.text ?? '',
      })
    } catch {
      setUpload({ phase: 'error', msg: 'Se me atoró la conexión al subir. Inténtalo de nuevo.' })
    }
  }

  const resolveUpload = async (action: 'approve' | 'reject') => {
    if (upload?.phase !== 'review') return
    const { id, filename, text } = upload
    try {
      const res = await fetch('/api/constructor/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sidRef.current,
          id,
          action,
          ...(action === 'approve' ? { text } : {}),
        }),
      })
      const data = (await res.json()) as { ok?: boolean; chars?: number; error?: string }
      if (!res.ok || !data.ok) {
        setUpload({
          phase: 'error',
          msg: UPLOAD_ERRORS[data.error ?? ''] ?? 'No se pudo guardar. Inténtalo de nuevo.',
        })
        return
      }
      setUpload(null)
      if (action === 'approve') {
        /* aviso automático al agente (no es texto del dueño) para que lo confirme */
        const safeName = filename.replace(/[^\w .()-]/g, '').slice(0, 80)
        setBusy(true)
        try {
          const res2 = await fetch('/api/constructor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              builderSessionId: sidRef.current,
              message: `[ARCHIVO] El dueño subió y aprobó "${safeName}" (${data.chars ?? 0} caracteres). Su contenido ya quedó guardado como información del negocio y se integrará al asistente al construirlo.${stage === 'afinado' || stage === 'construido' ? ' La personalidad ya está afinada — si el dueño aprueba, puedes construir.' : ''}`,
              _h: '',
            }),
          })
          const d2 = (await res2.json()) as { output?: string; stage?: Stage }
          if (d2.output) {
            setMessages((prev) => [
              ...prev,
              { id: crypto.randomUUID(), role: 'assistant', content: d2.output!.trim() },
            ])
          }
          if (d2.stage) setStage(d2.stage)
        } catch {}
        setBusy(false)
      }
    } catch {
      setUpload({ phase: 'error', msg: 'Se me atoró la conexión. Inténtalo de nuevo.' })
    }
  }

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    void sendText(draft)
  }

  const sendText = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setDraft('')
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: text },
    ])
    setBusy(true)
    try {
      const res = await fetch('/api/constructor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          builderSessionId: sidRef.current,
          message: text,
          ...(!tsVerified && tsToken ? { turnstileToken: tsToken } : {}),
          _h: '',
        }),
      })
      const data = (await res.json()) as {
        output?: string
        error?: string
        provisioned?: { subdomain?: string } | null
        stage?: Stage
        claimed?: boolean
      }
      if (res.status === 403 && data.error?.startsWith('turnstile')) {
        setTsVerified(false)
        setTsToken(null)
        setTsOverlay('visible')
        tsRendered.current = false
        setTimeout(renderTurnstile, 100)
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'Antes de seguir, márcame la casilla de "soy humano" aquí abajo 🐝 y me lo vuelves a mandar.',
          },
        ])
        return
      }
      setTsVerified(true)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.output?.trim() || 'Se me atoró algo. ¿Me lo repites?',
        },
      ])
      if (data.stage) setStage(data.stage)
      if (data.provisioned?.subdomain) {
        const url = `https://${data.provisioned.subdomain}`
        try {
          localStorage.setItem(`abi_built_${sidRef.current}`, url)
        } catch {}
        if (data.claimed) setClaimed(true)
        setBuilding(true)
        pendingUrlRef.current = url
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Se me atoró la conexión. Inténtalo otra vez en un momento.',
        },
      ])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    /* la ventana se expande cuando el bot ya vive (éxito en dos columnas) */
    <div
      className={cn(
        'relative mx-auto flex w-full flex-1 flex-col overflow-hidden rounded-2xl border bg-surface transition-[max-width] duration-500',
        botUrl || building ? 'max-w-5xl' : 'max-w-2xl'
      )}
    >
      {siteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          onLoad={renderTurnstile}
        />
      )}

      <div className="flex items-center justify-between gap-2.5 border-b bg-bg/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <AbiBee className="text-2xl" />
          <div>
            <p className="font-display text-sm font-bold leading-tight">
              Abi · el Constructor
            </p>
            <p className="text-xs text-text-muted">
              {busy ? 'trabajando…' : 'armando tu asistente'}
            </p>
          </div>
        </div>
        <HoneycombProgress filled={STAGE_CELLS[stage]} />
      </div>

      {building ? (
        <BuildingOverlay
          onDone={() => {
            setBuilding(false)
            setBotUrl(pendingUrlRef.current)
            setStage('construido')
          }}
        />
      ) : botUrl ? (
        <BuildSuccessCard
          botUrl={botUrl}
          botName={botUrl
            .replace('https://', '')
            .split('.')[0]
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')}
          builderSessionId={sidRef.current}
          claimed={claimed}
        />
      ) : (
        <>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
              m.role === 'user'
                ? 'ml-auto rounded-br-sm bg-accent text-on-accent'
                : 'rounded-bl-sm bg-bubble text-text'
            )}
          >
            <Linkify text={m.content} />
          </div>
        ))}
        {busy && (
          <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-sm bg-bubble px-4 py-3 text-xs text-text-muted">
            <span className="size-1.5 animate-honey-pulse rounded-full bg-accent" />
            <span className="size-1.5 animate-honey-pulse rounded-full bg-accent [animation-delay:0.4s]" />
            <span className="size-1.5 animate-honey-pulse rounded-full bg-accent [animation-delay:0.8s]" />
            Abi está trabajando…
          </div>
        )}

        {(stage === 'borrador' || stage === 'afinado') && !tunerOpen && !busy && (
          /* opciones dentro del flujo del chat (estilo panel de servicios):
             que avance con un clic, sin leer de más ni teclear */
          <div className="mx-auto w-full max-w-md animate-pop-in space-y-2 pt-2">
            {stage === 'borrador' ? (
              <button
                type="button"
                onClick={() => setTunerOpen(true)}
                className="w-full rounded-xl border border-accent bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
              >
                Configurar personalidad ✨
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={upload?.phase === 'uploading'}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border bg-surface px-4 py-3 text-sm text-text transition-colors hover:border-accent/60 disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Paperclip className="size-4 text-accent" /> Adjuntar un archivo de tu negocio
                  </span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    menú, catálogo, lista de precios o servicios…
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void sendText('constrúyelo')}
                  className="w-full rounded-xl border border-accent bg-accent px-4 py-3 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
                >
                  Constrúyelo 🐝
                </button>
                <button
                  type="button"
                  onClick={() => setTunerOpen(true)}
                  className="w-full rounded-xl border bg-surface px-4 py-3 text-sm text-text-muted transition-colors hover:border-accent/60 hover:text-text"
                >
                  Ajustar personalidad
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {tunerOpen && (
        /* modal: el cuestionario no tapa la conversación — se abre cuando el
           dueño ya leyó el mensaje y presiona el botón */
        <div className="absolute inset-0 z-10 flex animate-fade-in items-center justify-center bg-bg/70 p-4 backdrop-blur-[2px]">
          <div className="relative flex max-h-full w-full max-w-xl animate-pop-in flex-col overflow-hidden rounded-2xl border border-accent/40 bg-surface shadow-xl">
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setTunerOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-full p-1 text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
            >
              <X className="size-4" />
            </button>
            <PersonalityTuner
              builderSessionId={sidRef.current}
              onDone={() => {
                setTunerOpen(false)
                setStage('afinado')
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content:
                      'Quedó con carácter propio ✨ Ya afiné cómo habla, qué persigue y qué hace cuando no sabe algo.\n\n¿Tienes la información de tu negocio en algún archivo (menú, catálogo, lista de precios o de servicios)? Adjúntalo y tu asistente se lo aprende — o constrúyelo de una vez.',
                  },
                ])
              }}
            />
          </div>
        </div>
      )}

      {upload && (
        /* overlay: la revisión del documento no empuja el chat ni el cuestionario */
        <div className="absolute inset-0 z-10 flex animate-fade-in items-center justify-center bg-bg/70 p-4 backdrop-blur-[2px]">
          {upload.phase === 'uploading' ? (
            <div className="flex animate-pop-in flex-col items-center gap-3 rounded-2xl border border-accent/40 bg-surface px-8 py-6 shadow-xl">
              <Loader2 className="size-6 animate-spin text-accent" />
              <p className="text-sm font-medium">Leyendo tu archivo…</p>
              <p className="max-w-56 text-center text-xs text-text-muted">
                Abi está extrayendo el texto de{' '}
                <span className="text-text">{upload.filename}</span>
              </p>
            </div>
          ) : upload.phase === 'error' ? (
            <div className="flex w-full max-w-md animate-pop-in items-center justify-between gap-3 rounded-2xl border border-warn/40 bg-surface p-4 shadow-xl">
              <p className="text-xs text-warn">{upload.msg}</p>
              <Button size="sm" variant="ghost" onClick={() => setUpload(null)}>
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="flex max-h-full w-full max-w-xl animate-pop-in flex-col rounded-2xl border border-accent/40 bg-surface p-4 shadow-xl">
              <div className="flex items-center gap-2">
                <FileText className="size-4 shrink-0 text-accent" />
                <p className="min-w-0 truncate text-sm font-medium">{upload.filename}</p>
                <span className="ml-auto shrink-0 text-xs text-text-muted">
                  {upload.chars.toLocaleString('es-MX')} caracteres
                </span>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                Esto fue lo que leí. Revísalo y corrige lo que quieras — solo lo aprobado
                aprende tu asistente.
              </p>
              <textarea
                value={upload.text}
                onChange={(e) =>
                  setUpload({ ...upload, text: e.target.value, chars: e.target.value.length })
                }
                className="mt-2 min-h-40 w-full flex-1 resize-none rounded-lg border bg-bg px-3 py-2 font-mono text-xs leading-relaxed text-text outline-none focus-visible:border-accent"
                aria-label="Contenido extraído del archivo"
              />
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => void resolveUpload('approve')}>
                  Se ve bien, agrégalo
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void resolveUpload('reject')}>
                  Descartar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!tsVerified && siteKey && tsOverlay !== 'hidden' && (
        <div
          className={cn(
            'absolute inset-0 z-10 flex items-center justify-center bg-bg/70 backdrop-blur-[2px] transition-opacity duration-500',
            tsOverlay === 'fading' && 'pointer-events-none opacity-0'
          )}
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-surface/95 px-6 py-5 shadow-xl">
            <p className="text-sm text-text-muted">
              Un segundo — confirmando que eres humano 🐝
            </p>
            <div ref={tsContainer} />
          </div>
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t bg-bg/60 p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,.docx"
          className="hidden"
          onChange={(e) => void pickFile(e)}
          aria-label="Subir archivo del negocio"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Adjuntar un archivo de tu negocio"
          title="Adjunta un archivo con información de tu negocio: menú, catálogo, precios, servicios… (PDF, Word, TXT, CSV)"
          disabled={busy || upload?.phase === 'uploading' || (!tsVerified && !!siteKey && !tsToken)}
          onClick={() => fileInputRef.current?.click()}
        >
          {upload?.phase === 'uploading' ? (
            <span className="size-3.5 animate-honey-pulse rounded-full bg-accent" />
          ) : (
            <Paperclip className="size-4" />
          )}
        </Button>
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Cuéntale a Abi de tu negocio…"
          maxLength={2000}
          aria-label="Mensaje para Abi"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Enviar"
          disabled={!draft.trim() || busy || (!tsVerified && !!siteKey && !tsToken)}
        >
          <Send className="size-4" />
        </Button>
      </form>
        </>
      )}
    </div>
  )
}
