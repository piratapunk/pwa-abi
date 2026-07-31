'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  /* texto revelado progresivamente (felt streaming) */
  visible: string
  error?: boolean
}

const SID_KEY = 'abi_chat_sid'
const GREETING =
  'Hola, soy Abi 🐝 Cuéntame, ¿a qué se dedica tu negocio? De ahí te armo tu asistente.'

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SID_KEY)
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem(SID_KEY, sid)
    }
    return sid
  } catch {
    return crypto.randomUUID()
  }
}

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const sidRef = useRef<string>('')
  const turnRef = useRef(0)
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    sidRef.current = getSessionId()
    setMessages([
      {
        id: 'greeting',
        role: 'assistant',
        content: GREETING,
        visible: GREETING,
      },
    ])
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current)
    }
  }, [])

  const reveal = useCallback((id: string, full: string) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, visible: full } : m))
      )
      return
    }
    const words = full.split(' ')
    let i = 0
    revealTimer.current = setInterval(() => {
      i += 1
      const partial = words.slice(0, i).join(' ')
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, visible: partial } : m))
      )
      if (i >= words.length && revealTimer.current) {
        clearInterval(revealTimer.current)
        revealTimer.current = null
      }
    }, 28)
  }, [])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isThinking) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        visible: trimmed,
      }
      setMessages((prev) => [...prev, userMsg])
      setIsThinking(true)
      turnRef.current += 1

      try {
        const history = messages
          .filter((m) => m.id !== 'greeting' && !m.error)
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }))

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            sessionId: sidRef.current,
            turnCount: turnRef.current,
            conversationHistory: history,
            pagePath: window.location.pathname,
            _h: '',
          }),
        })

        if (!res.ok) throw new Error(`chat ${res.status}`)
        const data = (await res.json()) as { output?: string }
        const output =
          data.output?.trim() ||
          'Se me atoró algo aquí adentro. ¿Lo intentamos de nuevo?'

        const botMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: output,
          visible: '',
        }
        setMessages((prev) => [...prev, botMsg])
        reveal(botMsg.id, output)
      } catch {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            'Se me atoró la conexión. Dame un momento e inténtalo otra vez.',
          visible:
            'Se me atoró la conexión. Dame un momento e inténtalo otra vez.',
          error: true,
        }
        setMessages((prev) => [...prev, errMsg])
      } finally {
        setIsThinking(false)
      }
    },
    [messages, isThinking, reveal]
  )

  return { messages, send, isThinking }
}
