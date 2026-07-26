'use client'

import { BookOpenCheck, Check, Crown, MessagesSquare } from 'lucide-react'

import { AbiChatDemo } from '@/components/chat/AbiChatDemo'
import { useChat } from '@/components/chat/ChatContext'
import { Reveal } from '@/components/Reveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const points = [
  {
    icon: MessagesSquare,
    text: 'Habla contigo en español, sin tecnicismos: decisiones de negocio, no de software.',
  },
  {
    icon: BookOpenCheck,
    text: 'Aprende de tu menú, catálogo o lo que le cuentes — y tú validas lo que entendió.',
  },
  {
    icon: Crown,
    text: 'En esta colmena la reina eres tú: el asistente es tuyo — tu tono, tu marca, tus reglas.',
  },
]

const chips = [
  'Conversa en español, sin jerga',
  'Aprende de tu información',
  'Tú revisas y validas todo',
  'El asistente es tuyo, tu marca',
]

export function AbiSection() {
  const { openChat } = useChat()

  return (
    <section id="abi" className="scroll-mt-16 bg-surface/40">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-24 md:grid-cols-[6fr_6fr] lg:grid-cols-[7fr_5fr] lg:gap-16">
        <Reveal>
          <Badge variant="soft">Un producto de Agave Systems</Badge>
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
            Abi, la abejita que arma tu asistente
          </h2>
          <p className="mt-4 max-w-[34rem] leading-relaxed text-text-muted">
            Abi no es un formulario ni un panel con mil opciones. Es una
            abejita que conversa contigo, entiende tu negocio y va armando tu
            asistente mientras tú solo eliges. Tú revisas, tú decides, tú
            mandas — ella hace el trabajo pesado.
          </p>
          <ul className="mt-7 space-y-4 text-sm text-text-muted">
            {points.map((p) => (
              <li key={p.text} className="flex gap-3">
                <p.icon className="mt-0.5 size-4.5 shrink-0 text-accent" strokeWidth={1.5} />
                <span className="leading-relaxed">{p.text}</span>
              </li>
            ))}
          </ul>
          <Button className="mt-8" size="lg" onClick={() => openChat()}>
            Habla con Abi ahora
          </Button>
        </Reveal>

        <Reveal delay={120}>
          <AbiChatDemo />
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {chips.map((c) => (
              <div
                key={c}
                className="flex items-center gap-2 rounded-lg bg-surface-raised/60 px-3 py-2.5 text-xs text-text-muted"
              >
                <Check className="size-3.5 shrink-0 text-accent" strokeWidth={2} />
                {c}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
