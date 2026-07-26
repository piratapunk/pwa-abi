import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ConfirmLogin } from '@/components/auth/ConfirmLogin'
import { FEATURES } from '@/lib/flags'

export const metadata: Metadata = {
  title: 'Entrando a tu cuenta',
  robots: { index: false },
}

export default function ConfirmarPage() {
  if (!FEATURES.selfServe) redirect('/')

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center px-4">
      <Suspense>
        <ConfirmLogin />
      </Suspense>
    </div>
  )
}
