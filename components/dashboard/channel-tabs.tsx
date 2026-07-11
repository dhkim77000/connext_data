'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard', label: 'Shopify', dot: 'var(--ch-shopify)' },
  { href: '/dashboard/instagram', label: 'Instagram', dot: 'var(--ch-instagram)' },
  { href: '/dashboard/meta', label: 'Meta Ads', dot: 'var(--ch-meta)' },
]

export function ChannelTabs() {
  const pathname = usePathname()
  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'cx-press relative flex items-center gap-2 px-4 py-2.5 text-sm',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} aria-hidden />
            {t.label}
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" aria-hidden />}
          </Link>
        )
      })}
    </div>
  )
}
