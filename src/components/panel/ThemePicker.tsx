'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'

/* mismo mecanismo que el toggle de la landing (data-theme + localStorage),
   presentado como opciones seleccionables para Ajustes */

export function ThemePicker() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    setTheme(
      document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
    )
  }, [])

  const apply = (next: 'dark' | 'light') => {
    setTheme(next)
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    try {
      localStorage.setItem('abi-theme', next)
    } catch {}
  }

  const options = [
    { key: 'dark' as const, label: 'Oscuro', icon: Moon },
    { key: 'light' as const, label: 'Claro', icon: Sun },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => apply(o.key)}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border px-4 py-5 transition-colors',
            theme === o.key
              ? 'border-accent/60 bg-accent-soft'
              : 'bg-surface hover:border-accent/30'
          )}
        >
          <o.icon className={cn('size-5', theme === o.key ? 'text-accent' : 'text-text-muted')} />
          <span className="text-sm font-medium">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
