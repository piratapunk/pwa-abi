import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AbiWordmark } from '@/components/brand/AbiMark'
import { BackButton } from '@/components/panel/BackButton'
import { PanelNav } from '@/components/panel/PanelNav'
import { UserMenu } from '@/components/panel/UserMenu'
import { Badge } from '@/components/ui/badge'
import { getAuthUser } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { FEATURES } from '@/lib/flags'

export const dynamic = 'force-dynamic'

export default async function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  if (!FEATURES.selfServe) redirect('/')

  const { slug } = await params
  const user = await getAuthUser()
  if (!user) redirect('/entrar')
  const userId = user.id

  const sql = getSql()
  if (!sql) notFound()
  const rows = await sql`select abi.user_owns_tenant(${userId}::uuid, ${slug}) as id`
  if (!rows[0]?.id) notFound()

  const tenantRows = await sql`
    select name, plan from abi.tenants where slug = ${slug}
  `
  const tenant = tenantRows[0] as { name: string; plan: string }

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-surface/60 p-4 md:flex">
        <Link href="/inicio" className="px-2">
          <AbiWordmark />
        </Link>
        <Link
          href="/mis-bots"
          title="Cambiar de asistente"
          className="mt-6 block rounded-lg border bg-surface px-3 py-2.5 transition-colors hover:bg-surface-raised"
        >
          <p className="truncate text-sm font-semibold">{tenant.name}</p>
          <Badge variant={tenant.plan === 'free' ? 'soft' : 'premium'} className="mt-1">
            {tenant.plan}
          </Badge>
        </Link>
        <PanelNav slug={slug} />
        <div className="mt-auto pt-6">
          <UserMenu email={user.email} settingsHref={`/panel/${slug}/ajustes`} />
        </div>
      </aside>

      <div className="flex-1">
        <div className="border-b bg-surface/40 px-4 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{tenant.name}</p>
            <Link href="/mis-bots" className="text-xs text-accent">
              Mis bots
            </Link>
          </div>
          <PanelNav slug={slug} variant="mobile" />
        </div>
        <main className="p-5 sm:p-8">
          <BackButton className="mb-5" />
          {children}
        </main>
      </div>
    </div>
  )
}
