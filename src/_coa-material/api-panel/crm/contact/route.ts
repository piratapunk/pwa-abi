import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId } from '@/lib/auth/server'
import { getSql } from '@/lib/db'
import { SLUG_RE } from '@/lib/factory/spec'
import { clientIp, hasAllowedOrigin, rateLimit } from '@/lib/security'

const patchSchema = z
  .object({
    name: z.string().max(160).optional(),
    company: z.string().max(160).optional(),
    phone: z.string().max(30).optional(),
    email: z.string().max(200).optional(),
    stage: z.enum(['nuevo', 'en_platica', 'interesado', 'cliente', 'descartado']).optional(),
    notes: z.string().max(4000).optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
  })
  .strict()

const bodySchema = z
  .object({
    slug: z.string().regex(SLUG_RE),
    id: z.uuid().optional(),
    patch: patchSchema,
  })
  .strict()

async function guard(req: NextRequest, slug: string, userId: string) {
  const sql = getSql()
  if (!sql) return { error: NextResponse.json({ error: 'unavailable' }, { status: 503 }) }
  const rows = await sql`
    select t.plan from abi.tenants t
    where t.id = abi.user_owns_tenant(${userId}::uuid, ${slug})
  `
  if (!rows[0]) return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  if (rows[0].plan === 'free') {
    return { error: NextResponse.json({ error: 'premium_required' }, { status: 402 }) }
  }
  return { sql }
}

async function handle(req: NextRequest, method: 'create' | 'update') {
  if (!hasAllowedOrigin(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!rateLimit(`crmcontact:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (method === 'update' && !body.id) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const g = await guard(req, body.slug, userId)
  if ('error' in g) return g.error

  try {
    const rows =
      method === 'create'
        ? await g.sql`
            select abi.tenant_contact_create(
              ${userId}::uuid, ${body.slug}, ${g.sql.json(body.patch)}
            ) as r
          `
        : await g.sql`
            select abi.tenant_contact_update(
              ${userId}::uuid, ${body.slug}, ${body.id!}::uuid, ${g.sql.json(body.patch)}
            ) as r
          `
    const r = rows[0]?.r as { ok: boolean; id?: string; error?: string }
    if (!r?.ok) {
      return NextResponse.json({ error: r?.error ?? 'invalid' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, id: r.id })
  } catch {
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return handle(req, 'create')
}

export async function PATCH(req: NextRequest) {
  return handle(req, 'update')
}
