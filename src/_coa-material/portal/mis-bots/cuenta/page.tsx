import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CreditCard, LogOut, Palette, UserRound } from 'lucide-react'

import { ThemePicker } from '@/components/panel/ThemePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getAuthUser } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Configuración de tu cuenta',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

const SECTIONS = [
  { key: 'cuenta', label: 'Cuenta', hint: 'Perfil, correo y sesión', icon: UserRound },
  { key: 'suscripciones', label: 'Suscripciones', hint: 'Plan de cada asistente', icon: CreditCard },
  { key: 'apariencia', label: 'Apariencia', hint: 'Tema claro u oscuro', icon: Palette },
] as const

type TenantRow = {
  slug: string
  name: string
  plan: string
  status: string
}

type PlanLimits = { plan: string; msgs_day: number; files_max: number; rag_enabled: boolean }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-3.5 text-sm last:border-b-0">
      <p className="shrink-0 text-text-muted">{label}</p>
      <div className="min-w-0 text-right">{value}</div>
    </div>
  )
}

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  const { s = 'cuenta' } = await searchParams
  const section = SECTIONS.some((x) => x.key === s) ? s : 'cuenta'

  const user = await getAuthUser()
  if (!user) redirect('/entrar')

  const sql = getSql()
  let tenants: TenantRow[] = []
  let limits: Record<string, PlanLimits> = {}
  if (sql) {
    try {
      const rows = await sql`select abi.user_tenants(${user.id}::uuid) as t`
      tenants = (rows[0]?.t as TenantRow[]) ?? []
      const pl = await sql`select plan, msgs_day, files_max, rag_enabled from abi.plan_limits`
      limits = Object.fromEntries((pl as unknown as PlanLimits[]).map((p) => [p.plan, p]))
    } catch {}
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="t-eyebrow">Centro de administración</p>
      <h1 className="mt-1 text-2xl font-semibold">Configuración de tu cuenta</h1>

      <div className="mt-6 flex flex-col gap-5 lg:flex-row">
        <nav className="flex shrink-0 gap-2 overflow-x-auto lg:w-60 lg:flex-col">
          {SECTIONS.map((x) => (
            <Link
              key={x.key}
              href={`/mis-bots/cuenta?s=${x.key}`}
              className={cn(
                'min-w-fit rounded-xl border px-4 py-3 transition-colors',
                section === x.key
                  ? 'border-accent/50 bg-accent-soft'
                  : 'bg-surface hover:border-accent/30'
              )}
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                <x.icon className="size-4 text-accent" /> {x.label}
              </p>
              <p className="mt-0.5 hidden text-xs text-text-muted lg:block">{x.hint}</p>
            </Link>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {section === 'cuenta' && (
            <>
              <div className="overflow-hidden rounded-2xl border bg-surface">
                <div className="flex items-center gap-3 border-b px-4 py-4">
                  <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
                    {(user.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{user.email}</p>
                    <Badge variant="soft" className="mt-0.5">
                      {tenants.length} asistente{tenants.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                </div>
                <Row label="Correo de acceso" value={<span className="truncate">{user.email}</span>} />
                <Row
                  label="Acceso"
                  value={
                    <span className="text-text-muted">
                      Enlace mágico por correo (sin contraseñas)
                    </span>
                  }
                />
                <p className="px-4 py-3.5 text-xs text-text-muted">
                  ¿Necesitas cambiar tu correo? Escríbenos a{' '}
                  <a href="mailto:hola@nectacore.com" className="text-accent hover:underline">
                    hola@nectacore.com
                  </a>{' '}
                  y lo movemos contigo sin perder nada.
                </p>
              </div>

              <form action="/api/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-2xl border border-warn/30 bg-surface px-4 py-3.5 text-sm text-warn transition-colors hover:bg-surface-raised"
                >
                  <LogOut className="size-4" /> Cerrar sesión
                </button>
              </form>
            </>
          )}

          {section === 'suscripciones' && (
            <div className="space-y-3">
              {tenants.length === 0 && (
                <div className="rounded-2xl border bg-surface p-6 text-center text-sm text-text-muted">
                  Sin asistentes todavía —{' '}
                  <Link href="/constructor" className="text-accent hover:underline">
                    arma el primero gratis
                  </Link>
                  .
                </div>
              )}
              {tenants.map((t) => {
                const l = limits[t.plan]
                return (
                  <div
                    key={t.slug}
                    className="flex items-center justify-between gap-4 rounded-2xl border bg-surface px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{t.name}</span>
                        <Badge variant={t.plan === 'free' ? 'soft' : 'premium'}>{t.plan}</Badge>
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {t.status === 'active' ? 'en línea' : t.status}
                        {l &&
                          ` · ${l.msgs_day.toLocaleString('es-MX')} mensajes/día · ${l.files_max} archivo${l.files_max === 1 ? '' : 's'}${l.rag_enabled ? ' · búsqueda avanzada' : ''}`}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" className="shrink-0" asChild>
                      <Link href={`/panel/${t.slug}/plan`}>
                        {t.plan === 'free' ? 'Mejorar' : 'Facturación'}
                      </Link>
                    </Button>
                  </div>
                )
              })}
              <p className="px-1 text-xs text-text-muted">
                Cada asistente tiene su propio plan — así pagas solo por el que lo necesita.
              </p>
            </div>
          )}

          {section === 'apariencia' && (
            <div className="rounded-2xl border bg-surface p-4">
              <p className="text-sm font-semibold">Tema</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Cómo se ve NectaCore en este dispositivo.
              </p>
              <div className="mt-4">
                <ThemePicker />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
