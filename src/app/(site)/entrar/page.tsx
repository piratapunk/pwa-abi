import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/auth/LoginForm'
import { getAuthUserId } from '@/lib/auth/server'
import { FEATURES } from '@/lib/flags'

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Entra a tu cuenta de Abi para administrar tus asistentes.',
}

export const dynamic = 'force-dynamic'

export default async function EntrarPage() {
  if (!FEATURES.selfServe) redirect('/')

  /* ya con sesión: directo a sus bots */
  const userId = await getAuthUserId()
  if (userId) redirect('/mis-bots')

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center px-4 py-12 sm:px-6">
      <div className="w-full">
        <LoginForm />
      </div>
    </div>
  )
}
