'use client'

import { useCallback, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    setLight(document.documentElement.getAttribute('data-theme') === 'light')
  }, [])

  const toggle = useCallback(() => {
    const next = !light
    setLight(next)
    if (next) {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    try {
      localStorage.setItem('abi-theme', next ? 'light' : 'dark')
    } catch {}
  }, [light])

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={light ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
      onClick={toggle}
    >
      {light ? <Moon className="size-4.5" /> : <Sun className="size-4.5" />}
    </Button>
  )
}
