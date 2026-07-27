import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        /* text-base (16px) en móvil evita el zoom automático de iOS Safari al
           enfocar; sm:text-sm recupera 14px en pantallas mayores. */
        'flex h-10 w-full min-w-0 rounded-lg border bg-surface px-3.5 py-2 text-base sm:text-sm text-text placeholder:text-text-muted/70 transition-colors outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Input }
