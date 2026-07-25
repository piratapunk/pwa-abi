import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'

import { NectaWordmark } from '@/components/brand/NectaMark'
import { BackButton } from '@/components/panel/BackButton'
import { MisBotsNav } from '@/components/panel/PanelNav'
import { UserMenu } from '@/components/panel/UserMenu'
import { Badge } from '@/components/ui/badge'
import { getAuthUser } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { FEATURES } from '@/lib/flags'

export const dynamic = 'force-dynamic'

/* mismo shell que el panel por bot: sidebar persistente — post-login todo
   se siente app, nunca landing */

type TenantRow = { slug: string; name: string; plan: string }

export default async function MisBotsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!FEATURES.selfServe) redirect('/')

  const user = await getAuthUser()
  if (!user) redirect('/entrar')

  const sql = getSql()
  let tenants: TenantRow[] = []
  if (sql) {
    try {
      const rows = await sql`select necta.user_tenants(${user.id}::uuid) as t`
      tenants = (rows[0]?.t as TenantRow[]) ?? []
    } catch {}
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-surface/60 p-4 md:flex">
        <Link href="/inicio" className="px-2">
          <NectaWordmark />
        </Link>

        <MisBotsNav />

        {tenants.length > 0 && (
          <div className="mt-6">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Tus asistentes
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {tenants.map((t) => (
                <Link
                  key={t.slug}
                  href={`/panel/${t.slug}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
                >
                  <span className="truncate">{t.name}</span>
                  <Badge variant={t.plan === 'free' ? 'soft' : 'premium'}>
                    {t.plan}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Link
          href="/constructor"
          className="mt-3 flex items-center gap-2.5 rounded-lg border border-dashed px-3 py-2 text-sm text-text-muted transition-colors hover:border-accent/50 hover:text-text"
        >
          <Plus className="size-4 text-accent" />
          Armar otro asistente
        </Link>

        <div className="mt-auto pt-6">
          <UserMenu email={user.email} settingsHref="/mis-bots/cuenta" />
        </div>
      </aside>

      <div className="flex-1">
        <div className="border-b bg-surface/40 px-4 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/inicio">
              <NectaWordmark />
            </Link>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="text-xs text-text-muted">
                Salir
              </button>
            </form>
          </div>
        </div>
        <main className="p-5 sm:p-8">
          <BackButton className="mb-5" />
          {children}
        </main>
      </div>
    </div>
  )
}
