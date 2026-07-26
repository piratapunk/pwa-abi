import { cookies, headers } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/*
 * Supabase aquí es SOLO identidad (GoTrue self-hosted compartido de la casa).
 * Los datos siguen yendo por postgres.js + funciones contrato — no PostgREST.
 */

export async function createAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            /* llamado desde un server component: las cookies ya viajaron */
          }
        },
      },
    }
  )
}

export async function getAuthUserId(): Promise<string | null> {
  try {
    const supabase = await createAuthClient()
    const { data } = await supabase.auth.getClaims()
    return (data?.claims?.sub as string) ?? null
  } catch {
    return null
  }
}

export async function getAuthUser(): Promise<{ id: string; email: string } | null> {
  try {
    const supabase = await createAuthClient()
    const { data } = await supabase.auth.getClaims()
    const id = data?.claims?.sub as string | undefined
    if (!id) return null
    return { id, email: (data?.claims?.email as string) ?? '' }
  } catch {
    return null
  }
}

/* request.url miente detrás de Traefik (gotcha heredado de bjj) */
export async function getAppOrigin(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/$/, '')
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'abi.agavesysmx.com'
  return `${proto}://${host.split(',')[0].trim()}`
}
