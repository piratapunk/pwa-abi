import { Check, Lock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'

import { PortalButton, UpgradeButtons } from './UpgradeButtons'

export const dynamic = 'force-dynamic'

export default async function PanelPlan({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const userId = await getAuthUserId()
  const sql = getSql()
  const rows = await sql!`select necta.tenant_overview(${userId}::uuid, ${slug}) as o`
  const o = rows[0]?.o as {
    ok: boolean
    plan: string
    limits: Record<string, number | boolean | string>
  }
  if (!o?.ok) return null

  const subRows = await sql!`
    select subscription_status from necta.tenants where slug = ${slug}
  `
  const subStatus = (subRows[0]?.subscription_status as string) ?? 'none'
  const monthly = process.env.ABI_PREMIUM_MONTHLY_MXN ?? '999'
  const yearly = process.env.ABI_PREMIUM_YEARLY_MXN ?? '9990'

  const limitRows = await sql!`
    select plan, msgs_day, files_max, file_max_mb, rag_enabled
    from necta.plan_limits order by case plan when 'free' then 1 when 'premium' then 2 else 3 end
  `

  return (
    <div className="mx-auto max-w-3xl">
      <p className="t-eyebrow">Mi plan</p>
      <h1 className="mt-1 text-2xl font-bold">
        Estás en el plan{' '}
        <span className="capitalize text-accent">{o.plan}</span>
      </h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Comparación de planes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-text-muted">
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4">Mensajes/día</th>
                  <th className="pb-2 pr-4">Archivos</th>
                  <th className="pb-2 pr-4">MB/archivo</th>
                  <th className="pb-2">Búsqueda avanzada</th>
                </tr>
              </thead>
              <tbody>
                {limitRows.map((p) => (
                  <tr key={p.plan as string} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 capitalize">
                      {p.plan as string}{' '}
                      {p.plan === o.plan && <Badge variant="soft">actual</Badge>}
                    </td>
                    <td className="py-2.5 pr-4">{p.msgs_day as number}</td>
                    <td className="py-2.5 pr-4">{p.files_max as number}</td>
                    <td className="py-2.5 pr-4">{String(p.file_max_mb)}</td>
                    <td className="py-2.5">
                      {p.rag_enabled ? (
                        <Check className="size-4 text-success" />
                      ) : (
                        <Lock className="size-4 text-text-muted" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {o.plan === 'free' && (
        <Card className="mt-6 border-accent/50">
          <CardHeader>
            <CardTitle className="text-base">Ponlo a trabajar de verdad ⭐</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="mb-5 space-y-2 text-sm text-text-muted">
              {[
                'Tu número de WhatsApp real (conexión en ~5 min desde este panel)',
                'Más mensajes, más memoria y documentos grandes',
                'Redes sociales, campañas y reseñas',
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" /> {f}
                </li>
              ))}
            </ul>
            <UpgradeButtons slug={slug} monthly={monthly} yearly={yearly} />
          </CardContent>
        </Card>
      )}

      {o.plan !== 'free' && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Tu suscripción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-text-muted">
              Estado:{' '}
              {subStatus === 'active'
                ? 'activa ✅'
                : subStatus === 'past_due'
                  ? 'con pago pendiente — revisa tu método de pago'
                  : subStatus}
            </p>
            <PortalButton slug={slug} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
