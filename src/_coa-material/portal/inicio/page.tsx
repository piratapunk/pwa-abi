import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, MessageSquare, Plus, UsersRound } from 'lucide-react'

import { AbiBee } from '@/components/brand/AbiBee'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthUser } from '@/lib/auth/server'
import { getSql } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Inicio',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type TenantRow = { slug: string; name: string; plan: string; status: string }
type Overview = { ok: boolean; msgs_today: number; conversations: number; contacts: number }

export default async function PortalInicio() {
  const user = await getAuthUser()
  if (!user) redirect('/entrar')

  const sql = getSql()
  let tenants: TenantRow[] = []
  const stats: Record<string, Overview> = {}
  if (sql) {
    try {
      const rows = await sql`select abi.user_tenants(${user.id}::uuid) as t`
      tenants = (rows[0]?.t as TenantRow[]) ?? []
      for (const t of tenants.slice(0, 6)) {
        const o = await sql`select abi.tenant_overview(${user.id}::uuid, ${t.slug}) as o`
        if ((o[0]?.o as Overview)?.ok) stats[t.slug] = o[0].o as Overview
      }
    } catch {}
  }

  const total = (k: 'msgs_today' | 'conversations' | 'contacts') =>
    Object.values(stats).reduce((acc, s) => acc + (s[k] ?? 0), 0)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3">
        <AbiBee className="text-4xl" />
        <div>
          <p className="t-eyebrow">Tu portal</p>
          <h1 className="mt-0.5 text-2xl font-semibold">La colmena está trabajando</h1>
        </div>
      </div>

      {tenants.length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-surface p-10 text-center">
          <p className="text-sm text-text-muted">
            Todavía no tienes asistentes. Arma el primero y aquí verás su actividad.
          </p>
          <Button className="mt-5" asChild>
            <Link href="/constructor">Armar mi primer asistente</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-text-muted">Mensajes hoy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold">{total('msgs_today')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-text-muted">Conversaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold">{total('conversations')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-text-muted">Clientes captados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold">{total('contacts')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 space-y-3">
            {tenants.map((t) => {
              const s = stats[t.slug]
              return (
                <Link
                  key={t.slug}
                  href={`/panel/${t.slug}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border bg-surface px-4 py-4 transition-colors hover:bg-surface-raised"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <span className="truncate">{t.name}</span>
                      <Badge variant={t.plan === 'free' ? 'soft' : 'premium'}>{t.plan}</Badge>
                    </p>
                    <p className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3.5" /> {s?.msgs_today ?? 0} hoy
                      </span>
                      <span className="flex items-center gap-1">
                        <UsersRound className="size-3.5" /> {s?.contacts ?? 0} clientes
                      </span>
                      <span>{t.status === 'active' ? 'en línea' : t.status}</span>
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-text-muted" />
                </Link>
              )
            })}

            <Link
              href="/constructor"
              className="flex items-center gap-2.5 rounded-2xl border border-dashed bg-surface/50 px-4 py-4 text-sm text-text-muted transition-colors hover:border-accent/60 hover:text-text"
            >
              <Plus className="size-4 text-accent" /> Armar otro asistente
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
