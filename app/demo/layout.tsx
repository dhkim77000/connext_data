// Public demo shell (master plan 4.6.4) — no auth. Every view carries the
// "sample data" badge and a "Connect your data" CTA so nothing reads as real.

import Link from 'next/link'
import type { Metadata } from 'next'
import { ThemeToggle } from '@/components/theme-toggle'
import { DemoTabs } from '@/components/demo/demo-tabs'
import { demoBrand } from '@/lib/demo/data'

export const metadata: Metadata = {
  title: 'Connext Demo — Cross-platform dashboard',
  description:
    'Explore Connext with sample data: Shopify, Instagram, Meta and GA4 connected into one dashboard.',
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-6 py-2">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-display text-[17px] font-semibold tracking-tight">
              Connext<span className="text-cx-accent">.</span>
            </Link>
            <span className="whitespace-nowrap rounded-full bg-cx-accent/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-foreground dark:text-cx-accent-soft">
              Demo · sample data
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/signup"
              className="cx-press rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
            >
              Connect your data
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Unified dashboard demo
            </p>
            <h1 className="mt-1.5 text-xl font-medium tracking-tight">{demoBrand.name}</h1>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[11px] text-muted-foreground sm:flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-pos" aria-hidden />
            Synced this morning
          </div>
        </div>

        <DemoTabs />
        {children}

        <p className="mt-10 border-t border-border pt-5 text-center font-mono text-[11px] text-muted-foreground">
          {demoBrand.note}{' '}
          <Link href="/signup" className="text-foreground underline underline-offset-4 hover:text-cx-accent">
            Start free
          </Link>
        </p>
      </main>
    </div>
  )
}
