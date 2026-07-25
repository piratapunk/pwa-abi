import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bot, CreditCard, LogOut, Palette, UserRound } from 'lucide-react'

import { ThemePicker } from '@/components/panel/ThemePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getAuthUser } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const SECTIONS = [
  { key: 'cuenta', label: 'Cuenta', hint: 'Perfil, acceso y sesión', icon: UserRound },
  { key: 'suscripcion', label: 'Suscripción', hint: 'Plan y facturación', icon: CreditCard },
  { key: 'asistente', label: 'Asistente', hint: 'Nombre, dirección y personalidad', icon: Bot },
  { key: 'apariencia', label: 'Apariencia', hint: 'Tema claro u oscuro', icon: Palette },
] as const

type Overview = {
  ok: boolean
  name: string
  vertical: string
  plan: string
  status: string
  subdomain: string
  subscription_status: string
  persona: { bot_name?: string; greeting?: string; tone?: string[] }
  limits: { msgs_day?: number }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-3.5 text-sm last:border-b-0">
      <p className="text-text-muted">{label}</p>
      <div className="min-w-0 text-right">{value}</div>
    </div>
  )
}

export default async function PanelAjustes({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ s?: string }>
}) {
  const { slug } = await params
  const { s = 'cuenta' } = await searchParams
  const section = SECTIONS.some((x) => x.key === s) ? s : 'cuenta'

  const user = await getAuthUser()
  if (!user) redirect('/entrar')
  const sql = getSql()
  const rows = await sql!`select necta.tenant_overview(${user.id}::uuid, ${slug}) as o`
  const o = rows[0]?.o as Overview
  if (!o?.ok) return null

  return (
    <div className="mx-auto max-w-4xl">
      <p className="t-eyebrow">Centro de administración</p>
      <h1 className="mt-1 text-2xl font-semibold">Configuración</h1>

      <div className="mt-6 flex flex-col gap-5 lg:flex-row">
        {/* sub-navegación */}
        <nav className="flex shrink-0 gap-2 overflow-x-auto lg:w-60 lg:flex-col">
          {SECTIONS.map((x) => (
            <Link
              key={x.key}
              href={`/panel/${slug}/ajustes?s=${x.key}`}
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

        {/* detalle */}
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
                    <Badge variant="soft" className="mt-0.5">Dueño</Badge>
                  </div>
                </div>
                <Row label="Correo de acceso" value={<span className="truncate">{user.email}</span>} />
                <Row
                  label="Acceso"
                  value={<span className="text-text-muted">Enlace mágico por correo (sin contraseñas)</span>}
                />
              </div>

              <Link
                href="/mis-bots"
                className="flex items-center justify-between rounded-2xl border bg-surface px-4 py-3.5 text-sm transition-colors hover:bg-surface-raised"
              >
                Mis asistentes
                <span className="text-text-muted">→</span>
              </Link>

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

          {section === 'suscripcion' && (
            <div className="overflow-hidden rounded-2xl border bg-surface">
              <div className="border-b px-4 py-4">
                <p className="text-sm font-semibold">Suscripción</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  El plan de {o.name} y su facturación.
                </p>
              </div>
              <Row
                label="Plan"
                value={<Badge variant={o.plan === 'free' ? 'soft' : 'premium'}>{o.plan}</Badge>}
              />
              <Row
                label="Estado"
                value={
                  <span className="text-text-muted">
                    {o.subscription_status === 'active'
                      ? 'activa ✅'
                      : o.plan === 'free'
                        ? 'sin suscripción'
                        : o.subscription_status}
                  </span>
                }
              />
              <Row
                label="Mensajes por día"
                value={<span>{o.limits?.msgs_day ?? 50}</span>}
              />
              <div className="px-4 py-4">
                <Button size="sm" asChild>
                  <Link href={`/panel/${slug}/plan`}>
                    {o.plan === 'free' ? 'Conocer Premium' : 'Administrar plan y facturación'}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {section === 'asistente' && (
            <div className="overflow-hidden rounded-2xl border bg-surface">
              <div className="border-b px-4 py-4">
                <p className="text-sm font-semibold">Tu asistente</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Cómo se presenta {o.persona?.bot_name ?? o.name} con tus clientes.
                </p>
              </div>
              <Row label="Nombre" value={<span>{o.persona?.bot_name ?? '—'}</span>} />
              <Row
                label="Dirección"
                value={
                  <a
                    href={`https://${o.subdomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {o.subdomain}
                  </a>
                }
              />
              <Row label="Giro" value={<span>{o.vertical}</span>} />
              <Row
                label="Saludo"
                value={<span className="text-text-muted">{o.persona?.greeting ?? '—'}</span>}
              />
              <Row
                label="Tono"
                value={<span>{(o.persona?.tone ?? []).join(', ') || '—'}</span>}
              />
              <p className="px-4 py-3.5 text-xs text-text-muted">
                Muy pronto: editar saludo, tono y respuestas desde aquí, con cambios al instante.
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
