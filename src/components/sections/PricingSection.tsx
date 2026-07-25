import Link from 'next/link'
import { ArrowRight, Rocket, ListChecks, Handshake } from 'lucide-react'

import { Reveal } from '@/components/Reveal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const steps = [
  {
    icon: Rocket,
    title: 'Arma y pruébalo, gratis',
    body: 'Sin tarjeta, sin caducidad. En minutos ves a tu asistente contestar con la información de tu negocio.',
  },
  {
    icon: ListChecks,
    title: 'Elige tu suite',
    body: 'WhatsApp, redes, reseñas, campañas, teléfono, CRM… agrega todo lo que quieras que haga por ti.',
  },
  {
    icon: Handshake,
    title: 'Lo armamos contigo',
    body: 'Nos dejas tus datos y te contactamos para agendar el arranque. El precio se cotiza a tu medida, sin sorpresas.',
  },
]

export function PricingSection() {
  return (
    <section id="planes" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="t-eyebrow">Cómo empezar</p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
            Arma tu asistente gratis. Elige tu suite. Lo armamos contigo.
          </h2>
          <p className="mt-4 text-text-muted">
            Empiezas probando de verdad — no es un demo que caduca. Cuando ves lo
            que puede hacer, eliges los servicios que quieres y nosotros nos
            encargamos del arranque.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 80} className="flex">
              <Card className="flex w-full flex-col p-6">
                <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <s.icon className="size-5" />
                </span>
                <CardContent className="mt-4 flex-1 p-0">
                  <p className="text-xs font-semibold text-accent">Paso {i + 1}</p>
                  <h3 className="mt-1 font-display text-lg font-semibold">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm text-text-muted">{s.body}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/constructor">Arma tu asistente gratis</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/servicios">
              Ver todo lo que puede hacer
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Reveal>
      </div>
    </section>
  )
}
