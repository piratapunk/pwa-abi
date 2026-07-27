'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ChatMarkdown } from '@/components/chat/ChatMarkdown'
import { Linkify } from '@/components/chat/Linkify'
import { AbiAsterisk } from '@/components/brand/AbiAsterisk'
import { cn } from '@/lib/utils'

type Msg = { id: string; role: 'user' | 'assistant' | 'owner'; content: string }

/* La paleta del sistema Abi del portal (labTheme), aplicada tal cual. */
const A = {
  block: '#0a0a0a',
  blockUp: '#141414',
  blockHi: '#1f1f1f',
  rule: '#262626',
  accent: '#f2ed5c',
  ink: '#000000',
  text: '#f4f4f0',
  textMuted: '#a3a396',
  textFaint: '#6b6b60',
}

function getSid(slug: string): string {
  const key = `abi_tenant_sid_${slug}`
  const legacy = `necta_tenant_sid_${slug}`
  try {
    /* localStorage: la sesión sobrevive al cierre del navegador — el bot
       recuerda al visitante 1:1. Migra la clave vieja de necta sin perderla. */
    let sid = localStorage.getItem(key) ?? localStorage.getItem(legacy)
    if (!sid) sid = crypto.randomUUID()
    localStorage.setItem(key, sid)
    localStorage.removeItem(legacy)
    return sid
  } catch {
    return crypto.randomUUID()
  }
}

export function TenantChat({
  slug,
  botName,
  greeting,
  suggestions = [],
}: {
  slug: string
  botName: string
  greeting: string
  suggestions?: string[]
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [humanMode, setHumanMode] = useState(false)
  const sidRef = useRef('')
  const busyRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hasUserMessages = messages.some((m) => m.role === 'user')

  const syncHistory = useCallback(async () => {
    if (busyRef.current) return
    try {
      const r = await fetch(`/api/t/${slug}/history?sessionId=${sidRef.current}`)
      if (!r.ok) return
      const data = (await r.json()) as {
        messages?: { id?: number; role: Msg['role']; content: string }[]
        mode?: string
      }
      if (busyRef.current) return
      setHumanMode(data.mode === 'human')
      if (data.messages?.length) {
        setMessages(
          data.messages.map((m) => ({
            id: m.id != null ? `db-${m.id}` : crypto.randomUUID(),
            role: m.role,
            content: m.content,
          })),
        )
      }
    } catch {}
  }, [slug])

  useEffect(() => {
    sidRef.current = getSid(slug)
    void syncHistory()
  }, [slug, syncHistory])

  /* polling: si una persona del negocio entra a la plática, sus mensajes
     aparecen sin recargar */
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') void syncHistory()
    }, 5000)
    return () => clearInterval(iv)
  }, [syncHistory])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, busy])

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
    busyRef.current = true
    try {
      const history = messages
        .filter((m) => m.role !== 'owner')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))
      const body = JSON.stringify({
        message: text,
        sessionId: sidRef.current,
        conversationHistory: history,
        _h: '',
      })
      /* un reintento ante fallos transitorios (521 de deploy, WiFi de venue) */
      let res: Response | null = null
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await fetch(`/api/t/${slug}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
          if (res.ok) break
        } catch {
          res = null
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500))
      }
      if (!res) throw new Error('network')
      const data = (await res.json()) as { output?: string | null; queued?: boolean }
      if (data.queued) {
        /* una persona del negocio tiene la plática: la respuesta llega por polling */
        setHumanMode(true)
        return
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.output?.trim() || 'Se me atoró algo. ¿Lo intentamos de nuevo?',
        },
      ])
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
      busyRef.current = false
    }
  }

  const status = busy
    ? 'escribiendo…'
    : humanMode
      ? 'te atiende una persona del equipo'
      : 'en línea'

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-[min(50rem,86dvh)] lg:flex-none"
      style={{ backgroundColor: A.block, border: `1px solid ${A.rule}` }}
    >
      {/* Encabezado: marca + nombre + estado, en el registro del portal. */}
      <div
        className="flex items-center gap-3 border-b px-5 py-3.5"
        style={{ borderColor: A.rule, backgroundColor: A.blockUp }}
      >
        <AbiAsterisk className="h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold" style={{ color: A.text }}>
            {botName}
          </p>
          <p
            className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: busy || humanMode ? A.accent : A.textFaint }}
          >
            {status}
          </p>
        </div>
      </div>

      {/* El cuerpo. Vacío = saludo centrado (tipo assistant-ui); con plática =
          hilo de burbujas cuadradas con scroll interno. */}
      {!hasUserMessages ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AbiAsterisk className="h-8 w-8 opacity-90" />
          <p className="max-w-md text-lg font-semibold leading-snug sm:text-xl" style={{ color: A.text }}>
            {greeting}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: A.textFaint }}>
            {botName} responde al momento
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {messages.map((m) => (
            <div key={m.id} className={cn(m.role !== 'user' && 'space-y-1')}>
              <div
                className="w-fit max-w-[85%] px-4 py-3 text-[14px] leading-relaxed"
                style={
                  m.role === 'user'
                    ? { marginLeft: 'auto', backgroundColor: A.accent, color: A.ink, whiteSpace: 'pre-wrap' }
                    : { backgroundColor: A.blockHi, color: A.text }
                }
              >
                {m.role === 'user' ? <Linkify text={m.content} /> : <ChatMarkdown text={m.content} />}
              </div>
              {m.role === 'owner' && (
                <p className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: A.textFaint }}>
                  equipo de {botName}
                </p>
              )}
            </div>
          ))}
          {busy && (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: A.textFaint }}>
              {botName} está escribiendo…
            </p>
          )}
        </div>
      )}

      {/* Arranques pegados al chat bar, como en el constructor del portal. */}
      {!hasUserMessages && !busy && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-px px-5 pb-2">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void sendText(q)}
              className="max-w-full whitespace-normal break-words px-3 py-2 text-left text-[12px] leading-snug transition-[filter] hover:brightness-125"
              style={{ backgroundColor: A.blockUp, color: A.textMuted, border: `1px solid ${A.rule}` }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Composer del sistema: input cuadrado + ENVIAR lima en mono. */}
      <form onSubmit={send} className="flex gap-px p-5 pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe tu mensaje…"
          maxLength={2000}
          aria-label="Mensaje"
          /* 16px en móvil: por debajo de eso iOS Safari hace zoom al enfocar. */
          className="w-0 min-w-0 flex-1 px-4 py-3 text-[16px] outline-none sm:text-[14px]"
          style={{ backgroundColor: A.blockHi, color: A.text, border: `1px solid ${A.rule}` }}
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy}
          className="shrink-0 px-5 font-mono text-[11px] uppercase tracking-[0.18em] transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: A.accent, color: A.ink }}
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
