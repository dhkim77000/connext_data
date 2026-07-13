'use client'

// One revenue total, many angles. A pill switcher flips the stacked breakdown
// between product / channel / customer / region — the "다각도 조작성" for revenue.

import { useState } from 'react'
import { StackedAreaChart, type StackRow, type BandSpec } from '@/components/charts/stacked-area'

export type RevenueLensSpec = {
  key: string
  label: string
  bands: readonly BandSpec[]
  data: StackRow[]
}

export function RevenueLens({ lenses, height = 230 }: { lenses: RevenueLensSpec[]; height?: number }) {
  const [active, setActive] = useState(lenses[0]?.key)
  const lens = lenses.find((l) => l.key === active) ?? lenses[0]
  if (!lens) return null

  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5" role="group" aria-label="Break revenue down by">
        {lenses.map((l) => {
          const on = l.key === lens.key
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => setActive(l.key)}
              aria-pressed={on}
              className={`cx-press rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {l.label}
            </button>
          )
        })}
      </div>
      {/* remount per lens so bands redraw cleanly */}
      <StackedAreaChart key={lens.key} data={lens.data} bands={lens.bands} format="currency" height={height} />
    </div>
  )
}
