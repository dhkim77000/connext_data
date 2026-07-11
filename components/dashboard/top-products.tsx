'use client'

import { useState } from 'react'
import { fmtCurrency, fmtInt } from '@/lib/format'

type Row = { title: string; revenue: number; units: number }

export function TopProducts({ rows, currency }: { rows: Row[]; currency: string }) {
  const [key, setKey] = useState<'revenue' | 'units'>('revenue')
  const sorted = [...rows].sort((a, b) => b[key] - a[key])
  const max = Math.max(...rows.map((r) => r[key]), 1)

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center font-mono text-xs text-muted-foreground">
        No product sales in this range yet.
      </p>
    )
  }

  const Header = ({ k, label }: { k: 'revenue' | 'units'; label: string }) => (
    <button
      onClick={() => setKey(k)}
      className={
        'font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ' +
        (key === k ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')
      }
      aria-pressed={key === k}
    >
      {label}
      {key === k ? ' ↓' : ''}
    </button>
  )

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="w-6 pb-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">#</th>
          <th className="pb-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Product</th>
          <th className="pb-2 pr-4 text-right"><Header k="revenue" label="Revenue" /></th>
          <th className="pb-2 text-right"><Header k="units" label="Units" /></th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r, i) => (
          <tr key={r.title + i} className="group border-b border-border/60 last:border-0">
            <td className="py-2.5 font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</td>
            <td className="relative py-2.5 pr-4">
              <span className="relative z-10 text-sm">{r.title}</span>
              <span
                className="absolute inset-y-1 left-0 rounded-sm bg-cx-accent/10"
                style={{ width: `${(r[key] / max) * 100}%` }}
                aria-hidden
              />
            </td>
            <td className="py-2.5 pr-4 text-right text-sm tabular-nums">{fmtCurrency(r.revenue, currency)}</td>
            <td className="py-2.5 text-right font-mono text-sm tabular-nums text-muted-foreground">{fmtInt(r.units)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
