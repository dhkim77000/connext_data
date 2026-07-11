'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/demo', label: 'Overview' },
  { href: '/demo/channels', label: 'Channels' },
  { href: '/demo/advanced', label: 'Advanced' },
  { href: '/demo/cross', label: 'Cross-platform' },
]

export function DemoTabs() {
  const pathname = usePathname()
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'cx-press relative shrink-0 px-4 py-2.5 text-sm',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            {t.label}
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" aria-hidden />}
          </Link>
        )
      })}
    </div>
  )
}
