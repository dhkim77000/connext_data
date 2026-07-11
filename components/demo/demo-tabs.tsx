'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/demo', label: '홈' },
  { href: '/demo/channels', label: '채널' },
  { href: '/demo/advanced', label: '어드밴스드' },
  { href: '/demo/cross', label: '크로스플랫폼' },
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
