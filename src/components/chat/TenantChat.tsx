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

const sidKey = (slug: string) => `abi_tenant_sid_${slug}`
const prevKey = (slug: string) => `abi_tenant_sid_previas_${slug}`

function getSid(slug: string): string {
  const key = sidKey(slug)
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

function getPrevias(slug: string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(prevKey(slug)) ?? '[]')
    return Array.isArray(raw) ? (raw as string[]).filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/*
 * Empezar de cero = un `session_id` nuevo, no un borrado.
 *
 * `<schema>.conversations.session_id` es UNIQUE y `abi.tenant_log_message` hace
 * upsert sobre esa llave: un uuid nuevo abre una conversación nueva y la
 * anterior queda intacta en la base, con sus mensajes y su contacto. El
 * checkpointer del cerebro también va por `thread_id = session_id`, así que el
 * hilo nuevo arranca sin arrastrar el contexto del viejo.
 *
 * El uuid retirado se guarda porque ES la llave para volver: la conversación
 * seguiría en la base sin él, pero nadie podría volver a nombrarla.
 */
function guardarSid(slug: string, actual: string, retirado: string): void {
  try {
    const lista = getPrevias(slug).filter((x) => x !== retirado && x !== actual)
    localStorage.setItem(prevKey(slug), JSON.stringify([retirado, ...lista].slice(0, 20)))
    localStorage.setItem(sidKey(slug), actual)
  } catch {
    /* sin almacenamiento el chat sigue: la conversación vive lo que la pestaña */
  }
}

type Resumen = {
  session_id: string
  created_at: string
  last_message_at: string
  messages: number
  title: string | null
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

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
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [resumenes, setResumenes] = useState<Resumen[] | null>(null)
  const [hayPrevias, setHayPrevias] = useState(false)
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
    setHayPrevias(getPrevias(slug).length > 0)
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

  /* Sin confirmación a propósito: la conversación anterior no se pierde, queda
     a un clic en "Anteriores". Un paso extra para algo reversible solo estorba
     — y la primera versión, con confirmación que expiraba sola, dejaba al
     usuario apretando un botón que ya se había desarmado. */
  const nuevaConversacion = () => {
    if (busy) return
    const retirado = sidRef.current
    sidRef.current = crypto.randomUUID()
    guardarSid(slug, sidRef.current, retirado)
    setHayPrevias(true)
    setResumenes(null)
    setMessages([])
    setHumanMode(false)
    setDraft('')
  }

  /* Retomar: el hilo elegido pasa a ser el actual y el que estaba se guarda.
     No hay borrado en ningún sentido — solo se mueve cuál está en pantalla. */
  const retomar = (destino: string) => {
    setPanelAbierto(false)
    if (busy || destino === sidRef.current) return
    const retirado = sidRef.current
    sidRef.current = destino
    guardarSid(slug, destino, retirado)
    setHayPrevias(getPrevias(slug).length > 0)
    setResumenes(null)
    setMessages([])
    setHumanMode(false)
    setDraft('')
    void syncHistory()
  }

  const abrirPanel = async () => {
    setPanelAbierto(true)
    setResumenes(null)
    const ids = [sidRef.current, ...getPrevias(slug)]
    try {
      const r = await fetch(`/api/t/${slug}/conversations?ids=${ids.join(',')}`)
      const data = (await r.json()) as { conversations?: Resumen[] }
      setResumenes(data.conversations ?? [])
    } catch {
      setResumenes([])
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
        <div className="min-w-0 flex-1">
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

        {/* Conversaciones anteriores. Solo si este navegador conoce alguna. */}
        {hayPrevias && (
          <button
            type="button"
            onClick={() => (panelAbierto ? setPanelAbierto(false) : void abrirPanel())}
            title="Ver conversaciones anteriores"
            className="mr-px shrink-0 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-[filter] hover:brightness-125"
            style={{
              backgroundColor: panelAbierto ? A.accent : A.blockHi,
              color: panelAbierto ? A.ink : A.textMuted,
              border: `1px solid ${panelAbierto ? A.accent : A.rule}`,
            }}
          >
            Anteriores
          </button>
        )}

        {/* Empezar de nuevo. Solo con plática andando. */}
        {hasUserMessages && (
          <button
            type="button"
            onClick={nuevaConversacion}
            disabled={busy}
            title="Empezar una conversación nueva"
            className="shrink-0 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-[filter] hover:brightness-125 disabled:opacity-40"
            style={{ backgroundColor: A.blockHi, color: A.textMuted, border: `1px solid ${A.rule}` }}
          >
            Nueva
          </button>
        )}
      </div>

      {/* El cuerpo. Vacío = saludo centrado (tipo assistant-ui); con plática =
          hilo de burbujas cuadradas con scroll interno. */}
      {panelAbierto ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <p
            className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: A.textFaint }}
          >
            Tus conversaciones
          </p>

          {resumenes === null && (
            <p className="text-[13px]" style={{ color: A.textMuted }}>
              Cargando…
            </p>
          )}

          {resumenes?.length === 0 && (
            <p className="text-[13px]" style={{ color: A.textMuted }}>
              Todavía no hay conversaciones guardadas en este dispositivo.
            </p>
          )}

          <div className="flex flex-col gap-px">
            {resumenes?.map((c) => {
              const actual = c.session_id === sidRef.current
              return (
                <button
                  key={c.session_id}
                  type="button"
                  onClick={() => retomar(c.session_id)}
                  className="flex flex-col gap-1 px-4 py-3 text-left transition-[filter] hover:brightness-125"
                  style={{
                    backgroundColor: A.blockHi,
                    border: `1px solid ${actual ? A.accent : A.rule}`,
                  }}
                >
                  <span className="text-[13.5px] leading-snug" style={{ color: A.text }}>
                    {c.title ?? 'Conversación sin pregunta'}
                  </span>
                  <span
                    className="font-mono text-[9px] uppercase tracking-[0.16em]"
                    style={{ color: actual ? A.accent : A.textFaint }}
                  >
                    {actual ? 'en pantalla · ' : ''}
                    {fecha(c.last_message_at)} · {c.messages}{' '}
                    {c.messages === 1 ? 'mensaje' : 'mensajes'}
                  </span>
                </button>
              )
            })}
          </div>

          <p className="mt-4 text-[12px] leading-relaxed" style={{ color: A.textFaint }}>
            Se guardan en este navegador. Desde otro dispositivo no aparecen.
          </p>
        </div>
      ) : !hasUserMessages ? (
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
      {!panelAbierto && !hasUserMessages && !busy && suggestions.length > 0 && (
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
      {!panelAbierto && (
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
      )}
    </div>
  )
}
