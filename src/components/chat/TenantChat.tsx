'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'

import { ChatMarkdown } from '@/components/chat/ChatMarkdown'
import { Linkify } from '@/components/chat/Linkify'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Msg = { id: string; role: 'user' | 'assistant' | 'owner'; content: string }

function getSid(slug: string): string {
  const key = `necta_tenant_sid_${slug}`
  try {
    /* localStorage: la sesión sobrevive al cierre del navegador — el bot
       recuerda al visitante 1:1 */
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
        setMessages([
          { id: 'greeting', role: 'assistant', content: greeting },
          ...data.messages.map((m) => ({
            id: m.id != null ? `db-${m.id}` : crypto.randomUUID(),
            role: m.role,
            content: m.content,
          })),
        ])
      }
    } catch {}
  }, [slug, greeting])

  useEffect(() => {
    sidRef.current = getSid(slug)
    setMessages([{ id: 'greeting', role: 'assistant', content: greeting }])
    void syncHistory()
  }, [slug, greeting, syncHistory])

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
        .filter((m) => m.id !== 'greeting' && m.role !== 'owner')
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
          content:
            data.output?.trim() ||
            'Se me atoró algo. ¿Lo intentamos de nuevo?',
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden border bg-surface">
      <div className="border-b bg-bg/60 px-4 py-3">
        <p className="font-display text-sm font-bold">{botName}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          {busy
            ? 'escribiendo…'
            : humanMode
              ? 'te atiende una persona del equipo'
              : 'en línea'}
        </p>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div key={m.id} className={cn(m.role !== 'user' && 'space-y-0.5')}>
            <div
              className={cn(
                'px-3.5 py-2.5 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'ml-auto max-w-[85%] w-fit whitespace-pre-wrap bg-accent text-on-accent'
                  : 'w-fit max-w-full bg-surface-raised text-text'
              )}
            >
              {m.role === 'user' ? <Linkify text={m.content} /> : <ChatMarkdown text={m.content} />}
            </div>
            {m.role === 'owner' && (
              <p className="text-[10px] text-text-muted">equipo de {botName}</p>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex w-fit items-center gap-1.5 bg-surface-raised px-4 py-3">
            <span className="size-1.5 animate-honey-pulse bg-accent" />
            <span className="size-1.5 animate-honey-pulse bg-accent [animation-delay:0.4s]" />
            <span className="size-1.5 animate-honey-pulse bg-accent [animation-delay:0.8s]" />
          </div>
        )}
      </div>

      {/* Arranques pegados al chat bar, como en el constructor del portal. */}
      {!hasUserMessages && !busy && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void sendText(q)}
              className="border border-accent/40 bg-accent-soft px-3 py-2 text-left text-xs leading-snug text-accent transition-colors hover:bg-accent hover:text-on-accent"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t bg-bg/60 p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe tu mensaje…"
          maxLength={2000}
          aria-label="Mensaje"
          className="rounded-none"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Enviar"
          disabled={!draft.trim() || busy}
          className="rounded-none"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
