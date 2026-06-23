'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/channels', label: 'Channels' },
  { href: '/data', label: 'Raw Data' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-background px-3 py-4">
      <div className="mb-6 px-3">
        <span className="text-base font-semibold tracking-tight">Connext</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
              pathname === item.href
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
