'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Boxes,
  Filter,
  FolderOpen,
  Home,
  LayoutDashboard,
  MessageSquare,
  Plug,
  Settings,
  Sparkles,
  UsersRound,
} from 'lucide-react'

import { cn } from '@/lib/utils'

/* navegación con estado activo real: el resaltado sigue a la ruta */

const PANEL_ITEMS = [
  { href: '', label: 'Resumen', icon: LayoutDashboard },
  { href: '/conversaciones', label: 'Conversaciones', icon: MessageSquare },
  { href: '/clientes', label: 'Clientes', icon: UsersRound },
  { href: '/embudo', label: 'Embudo', icon: Filter },
  { href: '/archivos', label: 'Archivos y memoria', icon: FolderOpen },
  { href: '/conexiones', label: 'Conexiones', icon: Plug },
  { href: '/funciones', label: 'Funciones a la medida', icon: Sparkles },
  { href: '/plan', label: 'Mi plan', icon: BarChart3 },
  { href: '/ajustes', label: 'Configuración', icon: Settings },
]

export function PanelNav({
  slug,
  variant = 'sidebar',
}: {
  slug: string
  variant?: 'sidebar' | 'mobile'
}) {
  const pathname = usePathname()
  const base = `/panel/${slug}`
  const isActive = (href: string) =>
    href === '' ? pathname === base : pathname.startsWith(`${base}${href}`)

  if (variant === 'mobile') {
    return (
      <div className="mt-2 flex gap-3 overflow-x-auto text-xs">
        <Link href="/inicio" className="whitespace-nowrap text-text-muted">
          Inicio
        </Link>
        {PANEL_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={`${base}${item.href}`}
            className={cn(
              'whitespace-nowrap',
              isActive(item.href) ? 'font-medium text-accent' : 'text-text-muted'
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    )
  }

  return (
    <nav className="mt-6 flex flex-col gap-1">
      <Link
        href="/inicio"
        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
      >
        <Home className="size-4" />
        Inicio
      </Link>
      {PANEL_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={`${base}${item.href}`}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive(item.href)
              ? 'bg-accent-soft font-medium text-accent'
              : 'text-text-muted hover:bg-surface-raised hover:text-text'
          )}
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

const PORTAL_ITEMS = [
  { href: '/inicio', label: 'Inicio', icon: Home },
  { href: '/mis-bots', label: 'Mis asistentes', icon: Boxes },
]

export function MisBotsNav() {
  const pathname = usePathname()
  return (
    <nav className="mt-6 flex flex-col gap-1">
      {PORTAL_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
            pathname === item.href
              ? 'bg-accent-soft font-medium text-accent'
              : 'text-text-muted hover:bg-surface-raised hover:text-text'
          )}
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
