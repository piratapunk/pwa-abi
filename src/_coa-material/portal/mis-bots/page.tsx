import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ExternalLink, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getAuthUser } from '@/lib/auth/server'
import { getSql } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Mis asistentes',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

type TenantRow = {
  slug: string
  name: string
  vertical: string
  plan: string
  status: string
  subdomain: string
}

export default async function MisBotsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/entrar')

  const sql = getSql()
  let tenants: TenantRow[] = []
  if (sql) {
    try {
      const rows = await sql`select abi.user_tenants(${user.id}::uuid) as t`
      tenants = (rows[0]?.t as TenantRow[]) ?? []
    } catch {}
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="t-eyebrow">Tu colmena</p>
      <h1 className="mt-1 text-2xl font-semibold">Mis asistentes</h1>
      <p className="mt-1 text-sm text-text-muted">
        Cada asistente atiende su negocio con su propia dirección y su propio CRM.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {tenants.map((t) => (
          <Card key={t.slug} className="animate-pop-in">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="truncate">{t.name}</span>
                <Badge variant={t.plan === 'free' ? 'soft' : 'premium'}>
                  {t.plan}
                </Badge>
              </CardTitle>
              <CardDescription>
                {t.vertical} · {t.status === 'active' ? 'en línea' : t.status}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" asChild>
                <Link href={`/panel/${t.slug}`}>Administrar</Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <a
                  href={`https://${t.subdomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}

        <Link
          href="/constructor"
          className="flex min-h-36 animate-pop-in flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-surface/50 p-6 text-center transition-colors hover:border-accent/60 hover:bg-surface"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft">
            <Plus className="size-5 text-accent" />
          </span>
          <p className="text-sm font-medium">
            {tenants.length === 0 ? 'Armar mi primer asistente' : 'Armar otro asistente'}
          </p>
          <p className="text-xs text-text-muted">
            Platícale a Abi y queda en línea en minutos.
          </p>
        </Link>
      </div>
    </div>
  )
}
