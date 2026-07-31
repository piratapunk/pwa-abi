'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, SquarePen, X } from 'lucide-react'

import { AbiBee } from '@/components/brand/AbiBee'
import { Linkify } from '@/components/chat/Linkify'
import { useChat } from '@/components/chat/ChatContext'
import { useChatSession } from '@/components/chat/useChatSession'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function ChatWidget() {
  const { isOpen, openChat, closeChat, consumePendingMessage } = useChat()
  const { messages, send, isThinking, reset } = useChatSession()
  const [draft, setDraft] = useState('')
  const [confirmandoNueva, setConfirmandoNueva] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const pending = consumePendingMessage()
    if (pending) void send(pending)
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, isThinking])

  useEffect(() => {
    if (!confirmandoNueva) return
    const t = setTimeout(() => setConfirmandoNueva(false), 5000)
    return () => clearTimeout(t)
  }, [confirmandoNueva])

  const hayPlatica = messages.some((m) => m.role === 'user')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    void send(draft)
    setDraft('')
  }

  return (
    <>
      {!isOpen && (
        <button
          aria-label="Habla con Abi"
          onClick={() => openChat()}
          className="fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg transition-transform hover:scale-105 honey-glow sm:right-6 sm:bottom-6"
        >
          <MessageCircle className="size-6" />
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Chat con Abi"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl border bg-surface shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[560px] sm:w-[400px] sm:rounded-2xl"
        >
          <div className="flex items-center justify-between border-b bg-bg/60 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <AbiBee className="text-2xl" />
              <div>
                <p className="font-display text-sm font-bold leading-tight">Abi</p>
                <p className="text-xs text-text-muted">
                  {isThinking ? 'escribiendo…' : 'tu abejita constructora'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hayPlatica &&
                (confirmandoNueva ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => {
                      setConfirmandoNueva(false)
                      reset()
                    }}
                  >
                    ¿Empezar de nuevo?
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Nueva conversación"
                    title="Nueva conversación"
                    disabled={isThinking}
                    onClick={() => setConfirmandoNueva(true)}
                  >
                    <SquarePen className="size-4.5" />
                  </Button>
                ))}
              <Button variant="ghost" size="icon" aria-label="Cerrar chat" onClick={closeChat}>
                <X className="size-4.5" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'ml-auto rounded-br-sm bg-accent text-on-accent'
                    : 'rounded-bl-sm bg-bubble text-text'
                )}
              >
                <Linkify text={m.visible} />
              </div>
            ))}
            {isThinking && (
              <div className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-sm bg-bubble px-4 py-3">
                <span className="size-1.5 animate-honey-pulse rounded-full bg-accent" />
                <span className="size-1.5 animate-honey-pulse rounded-full bg-accent [animation-delay:0.4s]" />
                <span className="size-1.5 animate-honey-pulse rounded-full bg-accent [animation-delay:0.8s]" />
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t bg-bg/60 p-3">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Cuéntale a Abi de tu negocio…"
              maxLength={2000}
              aria-label="Mensaje para Abi"
            />
            <Button type="submit" size="icon" aria-label="Enviar" disabled={!draft.trim() || isThinking}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
