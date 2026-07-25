import { FileText, FolderOpen, Lock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function PanelArchivos({
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
    kb_chunks: number
    kb_chars: number
    limits: { kb_max_chars?: number; files_max?: number; file_max_mb?: number }
  }
  if (!o?.ok) return null

  return (
    <div className="mx-auto max-w-4xl">
      <p className="t-eyebrow">Archivos y memoria</p>
      <h1 className="mt-1 text-2xl font-semibold">Lo que tu asistente sabe</h1>
      <p className="mt-2 text-sm text-text-muted">
        La memoria de tu asistente es la información que le diste en el Constructor.
        Tu plan permite {o.limits?.files_max ?? 1} archivo(s) de hasta{' '}
        {o.limits?.file_max_mb ?? 2} MB.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="size-4 text-accent" /> Memoria actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border bg-bg/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <FileText className="size-4 text-text-muted" />
              <div>
                <p className="text-sm">Información del negocio</p>
                <p className="text-xs text-text-muted">
                  {o.kb_chunks} bloque(s) · {o.kb_chars.toLocaleString()} caracteres
                </p>
              </div>
            </div>
            <Badge variant="soft">del Constructor</Badge>
          </div>

          <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-text-muted">
              Subir menú, catálogo o documentos (PDF, Word, imagen)
            </p>
            <Button className="mt-3" variant="secondary" disabled>
              Muy pronto
            </Button>
            <p className="mt-2 text-xs text-text-muted">
              La ingesta pasa por revisión automática antes de entrar a la
              memoria de tu bot.
            </p>
          </div>

          {o.plan === 'free' && (
            <p className="mt-4 flex items-center gap-2 text-xs text-text-muted">
              <Lock className="size-3.5" /> Memoria ampliada y búsqueda avanzada
              en documentos grandes: parte de Premium.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
