'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

import { AbiWordmark } from '@/components/brand/AbiMark'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useChat } from '@/components/chat/ChatContext'
import { FEATURES } from '@/lib/flags'

const links = [
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#capacidades', label: 'Capacidades' },
  { href: '#crm', label: 'Tu CRM' },
  { href: '/servicios', label: 'Servicios' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const { openChat } = useChat()

  return (
    <header className="glass sticky top-0 z-40 border-b">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Abi — inicio">
          <AbiWordmark />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-text-muted transition-colors hover:text-text"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {FEATURES.selfServe && (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href="/entrar">Entrar</Link>
            </Button>
          )}
          <Button className="hidden sm:inline-flex" asChild>
            <Link href="/constructor">Arma tu asistente gratis</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </nav>

      {open && (
        <div className="border-t bg-bg px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="py-1 text-sm text-text-muted"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <Button className="mt-2 w-full" asChild>
              <Link href="/constructor" onClick={() => setOpen(false)}>
                Arma tu asistente gratis
              </Link>
            </Button>
            {FEATURES.selfServe && (
              <Button variant="secondary" className="w-full" asChild>
                <Link href="/entrar" onClick={() => setOpen(false)}>
                  Entrar a mi cuenta
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
