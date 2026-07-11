// Shared presentational primitives for the channel dashboards. Server-renderable.

export const num = (v: unknown) => Number(v ?? 0)

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{children}</p>
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[var(--radius)] border border-border bg-card p-5 ${className}`}>{children}</section>
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Panel>
      <Label>{label}</Label>
      <p className="mt-3 text-2xl font-medium tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">{sub}</p>}
    </Panel>
  )
}

// Horizontal bar-list row (label · bar · value) — used for geography/city/campaign breakdowns.
// The fill grows in once on load (transform-only) and lifts on row hover.
export function BarRow({ label, value, pct, title }: { label: string; value: string; pct: number; title?: string }) {
  return (
    <li className="group flex items-center gap-3" title={title}>
      <span className="w-24 truncate text-xs">{label}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="cx-grow-fill absolute inset-y-0 left-0 rounded-full bg-cx-accent opacity-80 transition-opacity duration-150 group-hover:opacity-100"
          style={{ width: `${Math.max(pct, 0)}%` }}
        />
      </span>
      <span className="w-24 text-right text-xs tabular-nums">{value}</span>
    </li>
  )
}
