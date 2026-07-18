# Connext Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Connext analytics dashboard UI on a mock data source, fully designed and interactive, so real warehouse data can be swapped in later behind one typed interface.

**Architecture:** A typed `DashboardSource` interface (`lib/dashboard/types.ts`) decouples UI from data. A deterministic mock (`lib/dashboard/mock.ts`) implements it now; a ClickHouse/Supabase implementation replaces it in deferred Phase D with no UI changes. UI = server-composed page + client islands for interaction (filters, legend cross-filter, drill breadcrumb, live stream). Visual = the data-terminal design system already in `app/globals.css`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 (`@theme` tokens), TypeScript, Vitest + Testing Library, pnpm, Node 20. Fonts (Archivo/Pretendard/JetBrains Mono) and tokens already wired.

## Global Constraints

- **No real data yet** — every panel renders from the mock `DashboardSource`. Do NOT call ClickHouse/Supabase in this plan (that is Phase D).
- **Design system is fixed** — read `docs/specs/2026-06-23-connext-design-system.md`. Use only `globals.css` tokens (`--cx-accent`, `--ch-*`, `--pos/--neg`, `--border`, `--card`, `--muted-foreground`, `--cx-grid`, `--cx-dim`). Brand purple `#9B6CFF`(dark)/`#6E3AD6`(light). Sharp corners (`--radius` ≈ 2px). No green as UI color.
- **Type:** Pretendard (body/한글), Archivo (`font-display`, Latin), JetBrains Mono (`font-mono`, all numbers). Every number `font-mono tabular-nums` and rounded.
- **Motion:** `transform`/`opacity` only; value change 200–400ms, row reorder <300ms, micro 100–150ms; honor `prefers-reduced-motion`.
- **Accessibility:** never status-by-color-alone (color + icon/label); ARIA live region for live updates; keyboard-operable controls; WCAG AA (4.5:1).
- **Apply skills:** `anti-ai-slop-design`, `data-dashboard-design`.
- **Theme:** dark default; both modes must be verified in the browser.
- **Commit** after every task. Branch: `feat/dashboard`.

## File Structure

| File | Responsibility |
|---|---|
| `lib/format.ts` | Pure formatters: ₩ currency (compact), %, delta, count, time |
| `lib/dashboard/types.ts` | `DashboardData`, `DashboardSource`, `Period`, `ChannelId` — the swap interface |
| `lib/dashboard/mock.ts` | Deterministic mock `DashboardSource` + simulated live orders |
| `lib/dashboard/channels.ts` | Channel registry (id → label, css var) |
| `components/dashboard/states.tsx` | `Skeleton`, `EmptyState`, `ErrorBanner` |
| `components/dashboard/kpi-card.tsx` | One KPI tile (value + delta + sparkline) |
| `components/dashboard/sparkline.tsx` | Tiny inline SVG trend |
| `components/dashboard/freshness.tsx` | "Data as of …" + sync status + refresh |
| `components/dashboard/channel-chart.tsx` | Multi-line SVG chart + tooltip + legend-toggle (client) |
| `components/dashboard/campaigns-table.tsx` | Sortable table + CSV export (client) |
| `components/dashboard/live-orders.tsx` | Streaming list + pause (client) |
| `components/dashboard/dashboard-filters.tsx` | Period + channel global filters (client) |
| `components/dashboard/store.tsx` | Context + reducer: period, active channels (cross-filter), drill path |
| `app/(dashboard)/dashboard/page.tsx` | Compose everything (replaces current minimal page) |
| `tests/format.test.ts`, `tests/dashboard-mock.test.ts`, `tests/dashboard-store.test.ts` | Unit tests |

Deferred: `lib/dashboard/warehouse.ts` (Phase D) implements `DashboardSource` against ClickHouse/Supabase.

---

## Phase 0 — Foundation (pure logic, TDD)

### Task 1: Formatters

**Files:**
- Create: `lib/format.ts`
- Test: `tests/format.test.ts`

**Interfaces:**
- Produces: `formatKRW(n: number): string`, `formatPct(n: number, digits?: number): string`, `formatDelta(pct: number): { text: string; dir: 'up'|'down'|'flat' }`, `formatCount(n: number): string`, `formatClock(iso: string): string`

- [ ] **Step 1: Write failing tests**
```ts
// tests/format.test.ts
import { describe, it, expect } from 'vitest'
import { formatKRW, formatPct, formatDelta, formatCount } from '@/lib/format'

describe('formatKRW', () => {
  it('compacts millions and billions', () => {
    expect(formatKRW(431_000_000)).toBe('₩431.0M')
    expect(formatKRW(1_240_000_000)).toBe('₩1.2B')
    expect(formatKRW(82_400)).toBe('₩82.4K')
    expect(formatKRW(940)).toBe('₩940')
  })
})
describe('formatPct', () => {
  it('rounds to 1 digit with sign-free %', () => {
    expect(formatPct(9.234)).toBe('9.2%')
  })
})
describe('formatDelta', () => {
  it('returns arrow text + direction', () => {
    expect(formatDelta(9.2)).toEqual({ text: '▲ 9.2%', dir: 'up' })
    expect(formatDelta(-4)).toEqual({ text: '▼ 4.0%', dir: 'down' })
    expect(formatDelta(0)).toEqual({ text: '0.0%', dir: 'flat' })
  })
})
describe('formatCount', () => {
  it('uses thousands separators', () => {
    expect(formatCount(12480)).toBe('12,480')
  })
})
```

- [ ] **Step 2: Run, verify FAIL**
Run: `pnpm vitest run tests/format.test.ts`
Expected: FAIL (module not found / functions undefined)

- [ ] **Step 3: Implement**
```ts
// lib/format.ts
export function formatKRW(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return `₩${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `₩${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `₩${(n / 1e3).toFixed(1)}K`
  return `₩${Math.round(n)}`
}
export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`
}
export function formatDelta(pct: number): { text: string; dir: 'up' | 'down' | 'flat' } {
  const v = Math.abs(pct).toFixed(1)
  if (pct > 0) return { text: `▲ ${v}%`, dir: 'up' }
  if (pct < 0) return { text: `▼ ${v}%`, dir: 'down' }
  return { text: `0.0%`, dir: 'flat' }
}
export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}
export function formatClock(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}
```

- [ ] **Step 4: Run, verify PASS**
Run: `pnpm vitest run tests/format.test.ts` → Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add lib/format.ts tests/format.test.ts && git commit -m "feat(dashboard): currency/percent/delta formatters"
```

### Task 2: Channel registry + data types + mock source

**Files:**
- Create: `lib/dashboard/channels.ts`, `lib/dashboard/types.ts`, `lib/dashboard/mock.ts`
- Test: `tests/dashboard-mock.test.ts`

**Interfaces:**
- Produces:
  - `type ChannelId = 'shopify'|'meta'|'youtube'|'tiktok'|'naver'`
  - `CHANNELS: { id: ChannelId; label: string; cssVar: string }[]`
  - `type Period = '7d'|'30d'|'90d'`
  - `interface DashboardData { kpis: KpiDatum[]; series: SeriesPoint[]; campaigns: Campaign[]; orders: Order[]; meta: { lastSync: string; channels: ChannelId[]; offline?: boolean } }`
  - `interface DashboardSource { snapshot(period: Period): Promise<DashboardData>; subscribe(onOrder: (o: Order) => void): () => void }`
  - `mockSource: DashboardSource`, `buildSnapshot(period: Period): DashboardData` (pure, deterministic)

- [ ] **Step 1: Write failing tests**
```ts
// tests/dashboard-mock.test.ts
import { describe, it, expect } from 'vitest'
import { buildSnapshot } from '@/lib/dashboard/mock'

describe('buildSnapshot', () => {
  it('is deterministic and well-shaped', () => {
    const a = buildSnapshot('7d')
    const b = buildSnapshot('7d')
    expect(a).toEqual(b)                       // deterministic
    expect(a.series).toHaveLength(7)           // 7d → 7 points
    expect(a.kpis.length).toBeGreaterThanOrEqual(4)
    expect(Object.keys(a.series[0].values).sort())
      .toEqual(['meta', 'naver', 'shopify', 'tiktok', 'youtube'])
    expect(buildSnapshot('30d').series).toHaveLength(30)
  })
  it('kpi total revenue equals sum of last series point', () => {
    const s = buildSnapshot('7d')
    const last = s.series[s.series.length - 1].values
    const sum = Object.values(last).reduce((x, y) => x + y, 0)
    const total = s.kpis.find(k => k.key === 'revenue')!.value
    expect(total).toBe(sum)
  })
})
```

- [ ] **Step 2: Run, verify FAIL**
Run: `pnpm vitest run tests/dashboard-mock.test.ts` → Expected: FAIL

- [ ] **Step 3: Implement channels + types**
```ts
// lib/dashboard/channels.ts
import type { ChannelId } from './types'
export const CHANNELS: { id: ChannelId; label: string; cssVar: string }[] = [
  { id: 'shopify', label: 'Shopify', cssVar: 'var(--ch-shopify)' },
  { id: 'meta', label: 'Meta', cssVar: 'var(--ch-meta)' },
  { id: 'youtube', label: 'YouTube', cssVar: 'var(--ch-youtube)' },
  { id: 'tiktok', label: 'TikTok', cssVar: 'var(--ch-tiktok)' },
  { id: 'naver', label: 'Naver', cssVar: 'var(--ch-naver)' },
]
```
```ts
// lib/dashboard/types.ts
export type ChannelId = 'shopify' | 'meta' | 'youtube' | 'tiktok' | 'naver'
export type Period = '7d' | '30d' | '90d'
export interface KpiDatum {
  key: string; label: string; value: number
  unit: 'krw' | 'x' | 'count'; deltaPct: number; baseline?: number; spark: number[]
}
export interface SeriesPoint { date: string; values: Record<ChannelId, number> }
export interface Campaign {
  id: string; name: string; channel: ChannelId
  clicks: number; conversions: number; spend: number; revenue: number; roas: number; spark: number[]
}
export interface Order {
  id: string; channel: ChannelId; amount: number; ts: string
  status: 'completed' | 'processing' | 'failed'
}
export interface DashboardData {
  kpis: KpiDatum[]; series: SeriesPoint[]; campaigns: Campaign[]; orders: Order[]
  meta: { lastSync: string; channels: ChannelId[]; offline?: boolean }
}
export interface DashboardSource {
  snapshot(period: Period): Promise<DashboardData>
  subscribe(onOrder: (o: Order) => void): () => void
}
```

- [ ] **Step 4: Implement deterministic mock**
Use a seeded PRNG (mulberry32) so output is stable — NO `Math.random` in `buildSnapshot`.
```ts
// lib/dashboard/mock.ts
import type { ChannelId, DashboardData, DashboardSource, Order, Period, SeriesPoint } from './types'

const CHANNEL_IDS: ChannelId[] = ['shopify', 'meta', 'youtube', 'tiktok', 'naver']
const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 }
const BASE: Record<ChannelId, number> = { shopify: 26_000_000, meta: 13_700_000, youtube: 6_000_000, tiktok: 4_700_000, naver: 11_000_000 }

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function buildSnapshot(period: Period): DashboardData {
  const days = PERIOD_DAYS[period]
  const rand = mulberry32(days) // seed by period → deterministic
  const series: SeriesPoint[] = []
  for (let d = 0; d < days; d++) {
    const values = {} as Record<ChannelId, number>
    for (const id of CHANNEL_IDS) {
      const drift = 1 + (d / days) * 0.45 + (rand() - 0.5) * 0.1
      values[id] = Math.round(BASE[id] * drift)
    }
    series.push({ date: `D-${days - d}`, values })
  }
  const last = series[series.length - 1].values
  const totalRevenue = Object.values(last).reduce((a, b) => a + b, 0)
  const kpis = [
    { key: 'revenue', label: '총 매출 · 7D', value: totalRevenue, unit: 'krw' as const, deltaPct: 9.2, spark: series.map(p => Object.values(p.values).reduce((a, b) => a + b, 0)) },
    { key: 'roas', label: '평균 ROAS', value: 3.9, unit: 'x' as const, deltaPct: 0.3, baseline: 3.5, spark: series.map((_, i) => 3.4 + i * 0.07) },
    { key: 'conversions', label: '전환', value: 12_480, unit: 'count' as const, deltaPct: 6.1, spark: series.map((_, i) => 1500 + i * 110) },
    { key: 'aov', label: '평균 객단가', value: 84_300, unit: 'krw' as const, deltaPct: -1.4, spark: series.map((_, i) => 86 - i * 0.2) },
  ]
  const campaigns: Campaign[] = CHANNEL_IDS.map((id, i) => {
    const revenue = last[id]; const spend = Math.round(revenue / (2.5 + rand() * 2.5))
    return {
      id: `c${i}`, name: `${id} · 캠페인 ${i + 1}`, channel: id,
      clicks: Math.round(8000 + rand() * 40000), conversions: Math.round(300 + rand() * 1800),
      spend, revenue, roas: Math.round((revenue / spend) * 10) / 10,
      spark: series.map(p => p.values[id]),
    }
  }).sort((a, b) => b.revenue - a.revenue)
  return {
    kpis, series, campaigns, orders: [],
    meta: { lastSync: '2026-06-23T14:42:00+09:00', channels: CHANNEL_IDS },
  }
}

export const mockSource: DashboardSource = {
  async snapshot(period) { return buildSnapshot(period) },
  subscribe(onOrder) {
    // Live order simulation — uses Math.random at runtime (NOT in tests).
    let n = 90_000
    const id = setInterval(() => {
      const ch = CHANNEL_IDS[Math.floor(Math.random() * CHANNEL_IDS.length)]
      onOrder({
        id: `#${n++}`, channel: ch, amount: Math.round(40_000 + Math.random() * 320_000),
        ts: new Date().toISOString(),
        status: Math.random() < 0.9 ? 'completed' : 'processing',
      })
    }, 2600)
    return () => clearInterval(id)
  },
}
```
(Add `import type { Campaign } from './types'` to the import line.)

- [ ] **Step 5: Run, verify PASS** → `pnpm vitest run tests/dashboard-mock.test.ts`
- [ ] **Step 6: Commit**
```bash
git add lib/dashboard tests/dashboard-mock.test.ts && git commit -m "feat(dashboard): typed DashboardSource + deterministic mock"
```

---

## Phase 1 — Primitives & states

### Task 3: State components (Skeleton, EmptyState, ErrorBanner)

**Files:** Create `components/dashboard/states.tsx`

**Interfaces:**
- Produces: `<Skeleton className?>`, `<EmptyState title cta?>`, `<ErrorBanner message attempt? onRetry>`

- [ ] **Step 1: Implement** (sharp corners, tokens, color+icon, `animate-pulse` for skeleton)
```tsx
// components/dashboard/states.tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted ${className}`} aria-hidden="true" />
}
export function EmptyState({ title, cta }: { title: string; cta?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">데이터 없음</p>
      <p className="text-sm text-muted-foreground">{title}</p>
      {cta && <a href={cta.href} className="bg-primary px-4 py-2 font-mono text-xs font-semibold text-primary-foreground">{cta.label} →</a>}
    </div>
  )
}
export function ErrorBanner({ message, attempt, onRetry }: { message: string; attempt?: number; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 border border-[color:var(--neg)] bg-[color:color-mix(in_srgb,var(--neg)_10%,transparent)] px-3 py-2">
      <span className="flex items-center gap-2 font-mono text-[11px]" style={{ color: 'var(--neg)' }}>
        <i className="ti ti-plug-connected-x" aria-hidden="true" />
        {message}{attempt ? ` · 재시도 ${attempt}/5` : ''}
      </span>
      <button onClick={onRetry} className="border border-border px-2.5 py-1 font-mono text-[11px] hover:bg-secondary">재시도</button>
    </div>
  )
}
```
(If Tabler icons aren't wired, replace `<i className="ti …" />` with a small inline SVG or `●`. Verify in Task 11.)

- [ ] **Step 2: Commit** → `git commit -m "feat(dashboard): empty/loading/error state components"`

### Task 4: Sparkline + KpiCard

**Files:** Create `components/dashboard/sparkline.tsx`, `components/dashboard/kpi-card.tsx`

**Interfaces:**
- Consumes: `KpiDatum` (Task 2), `formatKRW/formatCount/formatDelta` (Task 1)
- Produces: `<Sparkline points={number[]} />`, `<KpiCard datum={KpiDatum} />`

- [ ] **Step 1: Sparkline** (normalize to 0–15 viewBox, accent stroke)
```tsx
// components/dashboard/sparkline.tsx
export function Sparkline({ points, w = 50, h = 15 }: { points: number[]; w?: number; h?: number }) {
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1
  const step = w / (points.length - 1)
  const d = points.map((p, i) => `${(i * step).toFixed(1)},${(h - ((p - min) / span) * h).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} fill="none" aria-hidden="true">
      <polyline points={d} style={{ stroke: 'var(--cx-accent)' }} strokeWidth="1.3" />
    </svg>
  )
}
```

- [ ] **Step 2: KpiCard** (mono value, delta color = pos/neg, label uppercase mono)
```tsx
// components/dashboard/kpi-card.tsx
import type { KpiDatum } from '@/lib/dashboard/types'
import { formatKRW, formatCount, formatDelta } from '@/lib/format'
import { Sparkline } from './sparkline'

function value(d: KpiDatum) {
  if (d.unit === 'krw') return formatKRW(d.value)
  if (d.unit === 'x') return `${d.value.toFixed(1)}x`
  return formatCount(d.value)
}
export function KpiCard({ datum }: { datum: KpiDatum }) {
  const delta = formatDelta(datum.deltaPct)
  const color = delta.dir === 'down' ? 'var(--neg)' : 'var(--pos)'
  return (
    <div className="border border-border bg-card p-3.5">
      <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">{datum.label}</p>
      <p className="font-mono text-xl font-semibold tabular-nums">{value(datum)}</p>
      <p className="mt-1.5 flex items-center justify-between font-mono text-[11px]">
        <span style={{ color }}>{delta.text}</span>
        <Sparkline points={datum.spark} />
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit** → `git commit -m "feat(dashboard): KpiCard + sparkline"`

### Task 5: Freshness widget

**Files:** Create `components/dashboard/freshness.tsx`

**Interfaces:**
- Produces: `<Freshness lastSync={string} status='live'|'syncing'|'offline' onRefresh={() => void} />`

- [ ] **Step 1: Implement** (status = color + label, ARIA live, `Data as of HH:MM`, refresh button)
```tsx
// components/dashboard/freshness.tsx
'use client'
import { formatClock } from '@/lib/format'
const MAP = {
  live: { color: 'var(--pos)', label: 'LIVE' },
  syncing: { color: 'var(--cx-accent)', label: '동기화 중' },
  offline: { color: 'var(--neg)', label: '오프라인' },
} as const
export function Freshness({ lastSync, status, onRefresh }: { lastSync: string; status: keyof typeof MAP; onRefresh: () => void }) {
  const s = MAP[status]
  return (
    <div aria-live="polite" className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5" style={{ color: s.color }}>
        <span className="size-1.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
        {s.label}
      </span>
      <span>Data as of {formatClock(lastSync)}</span>
      <button onClick={onRefresh} aria-label="새로고침" className="border border-border px-2 py-1 hover:text-foreground hover:border-cx-accent">↻</button>
    </div>
  )
}
```

- [ ] **Step 2: Commit** → `git commit -m "feat(dashboard): freshness widget"`

---

## Phase 2 — Interaction state, charts, tables, live

### Task 6: Dashboard store (period + cross-filter + drill) — TDD reducer

**Files:** Create `components/dashboard/store.tsx`; Test `tests/dashboard-store.test.ts`

**Interfaces:**
- Produces: `dashboardReducer(state, action)`, `DashboardProvider`, `useDashboard()` returning `{ period, activeChannels, drill, setPeriod, toggleChannel, isolateChannel, resetChannels, drillTo, drillBack }`
- `activeChannels: ChannelId[]` (empty array = all shown). `drill: string[]` breadcrumb.

- [ ] **Step 1: Failing reducer test**
```ts
// tests/dashboard-store.test.ts
import { describe, it, expect } from 'vitest'
import { dashboardReducer, initialState } from '@/components/dashboard/store'

describe('dashboardReducer', () => {
  it('toggles a channel off then on (cross-filter)', () => {
    const s1 = dashboardReducer(initialState, { type: 'toggleChannel', id: 'meta' })
    expect(s1.activeChannels).toEqual(['meta'])     // first toggle isolates the rest off → only meta hidden? define: toggle = hide/show
    const s2 = dashboardReducer(s1, { type: 'toggleChannel', id: 'meta' })
    expect(s2.activeChannels).toEqual([])           // back to all
  })
  it('isolate keeps a single channel; reset clears', () => {
    const iso = dashboardReducer(initialState, { type: 'isolateChannel', id: 'shopify' })
    expect(iso.activeChannels).toEqual(['shopify'])
    expect(dashboardReducer(iso, { type: 'resetChannels' }).activeChannels).toEqual([])
  })
  it('drillTo pushes, drillBack pops', () => {
    const d1 = dashboardReducer(initialState, { type: 'drillTo', label: 'Shopify' })
    const d2 = dashboardReducer(d1, { type: 'drillTo', label: '캠페인 1' })
    expect(d2.drill).toEqual(['Shopify', '캠페인 1'])
    expect(dashboardReducer(d2, { type: 'drillBack', to: 0 }).drill).toEqual(['Shopify'])
  })
  it('setPeriod replaces period', () => {
    expect(dashboardReducer(initialState, { type: 'setPeriod', period: '30d' }).period).toBe('30d')
  })
})
```
Semantics: `activeChannels=[]` means **all visible**; `toggleChannel(id)` HIDES by membership in a hidden-set. To match the test above (toggle meta → `['meta']` then `[]`), model `activeChannels` as the **hidden** list. Rename in impl to `hiddenChannels` for clarity and update the test's expectations/comments accordingly before Step 2 (keep the array-content assertions).

- [ ] **Step 2: Run, verify FAIL** → `pnpm vitest run tests/dashboard-store.test.ts`

- [ ] **Step 3: Implement store**
```tsx
// components/dashboard/store.tsx
'use client'
import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { ChannelId, Period } from '@/lib/dashboard/types'

export interface State { period: Period; hiddenChannels: ChannelId[]; drill: string[] }
export const initialState: State = { period: '7d', hiddenChannels: [], drill: [] }
export type Action =
  | { type: 'setPeriod'; period: Period }
  | { type: 'toggleChannel'; id: ChannelId }
  | { type: 'isolateChannel'; id: ChannelId }
  | { type: 'resetChannels' }
  | { type: 'drillTo'; label: string }
  | { type: 'drillBack'; to: number }

const ALL: ChannelId[] = ['shopify', 'meta', 'youtube', 'tiktok', 'naver']
export function dashboardReducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setPeriod': return { ...s, period: a.period }
    case 'toggleChannel': return { ...s, hiddenChannels: s.hiddenChannels.includes(a.id) ? s.hiddenChannels.filter(c => c !== a.id) : [...s.hiddenChannels, a.id] }
    case 'isolateChannel': return { ...s, hiddenChannels: ALL.filter(c => c !== a.id) }
    case 'resetChannels': return { ...s, hiddenChannels: [] }
    case 'drillTo': return { ...s, drill: [...s.drill, a.label] }
    case 'drillBack': return { ...s, drill: s.drill.slice(0, a.to + 1) }
    default: return s
  }
}
const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null)
export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState)
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}
export function useDashboard() {
  const c = useContext(Ctx); if (!c) throw new Error('useDashboard outside provider'); return c
}
```
Update Task-6 test to assert on `hiddenChannels` (rename the comments/expectations); `toggleChannel('meta')` → `['meta']`, again → `[]`. Re-run → PASS.

- [ ] **Step 4: Commit** → `git commit -m "feat(dashboard): interaction store (period, cross-filter, drill)"`

### Task 7: Channel chart (multi-line + tooltip + legend-toggle)

**Files:** Create `components/dashboard/channel-chart.tsx` (client)

**Interfaces:**
- Consumes: `SeriesPoint[]`, `CHANNELS`, `useDashboard()` (hidden channels)
- Produces: `<ChannelChart series={SeriesPoint[]} />`

- [ ] **Step 1: Implement** the multi-line SVG (reuse the landing hero chart math: viewBox `0 0 600 178`, gridlines `--cx-grid`, baseline `--border`, one line per non-hidden channel using `var(--ch-*)`, live marker dashed + dot). Below the chart render the **legend as buttons** (`role="checkbox"` `aria-checked`), click → `toggleChannel`, dbl-click → `isolateChannel`; hidden channel → opacity 0.25. On hover over a vertical band, show a **tooltip** card: date + each visible channel value (`formatKRW`) + total + "vs 평균" benchmark + trend arrow. Tooltip is keyboard-reachable (focusable points) and `role="tooltip"`. Respect `prefers-reduced-motion` (no transition when set).
  - Reference visual: design spec §4 + the landing chart in `app/page.tsx`.
  - Use `--cx-dim` for axis labels (mono 11px).

- [ ] **Step 2: Verify in browser** (Task 11 wires it; defer screenshot to then). Commit.
```bash
git commit -m "feat(dashboard): channel line chart with legend-toggle cross-filter + tooltip"
```

### Task 8: Campaigns table (sortable + CSV export)

**Files:** Create `components/dashboard/campaigns-table.tsx` (client)

**Interfaces:**
- Consumes: `Campaign[]`, `useDashboard()` (hidden channels filter rows), `formatKRW/formatCount/formatDelta`
- Produces: `<CampaignsTable campaigns={Campaign[]} />`

- [ ] **Step 1: Implement** — columns: `채널 | 캠페인 | 클릭 | 전환 | 비용 | 매출 | ROAS | 추세(sparkline)`. Numbers mono/tabular/right-aligned. Sortable headers (click toggles asc/desc; `aria-sort`). Sticky header. Channel cell = color swatch + label (color+label, never color alone). Rows filtered by `hiddenChannels`. A **CSV export** button in the panel header builds a CSV string from current (filtered+sorted) rows and triggers download via a Blob `<a download>`.

- [ ] **Step 2: Commit** → `git commit -m "feat(dashboard): sortable campaigns table + CSV export"`

### Task 9: Live orders (stream + pause)

**Files:** Create `components/dashboard/live-orders.tsx` (client)

**Interfaces:**
- Consumes: `mockSource.subscribe`, `Order`, `formatKRW/formatClock`
- Produces: `<LiveOrders />`

- [ ] **Step 1: Implement** — `useEffect` subscribes to `mockSource.subscribe`, prepends incoming orders (cap list at 12). New row animates in (`translateY(-8px)`→0, opacity, ≤300ms; skip if `prefers-reduced-motion`). A **Pause** button (`aria-pressed`) stops/starts ingestion (buffer dropped while paused; show "일시정지됨 14:42"). Container `aria-live="polite"`, each row `aria-label` summarizing the order. Status = icon + label (✓ 완료 / ⏳ 처리중) with color. Time via `formatClock`.

- [ ] **Step 2: Commit** → `git commit -m "feat(dashboard): live orders stream with pause"`

### Task 10: Global filters

**Files:** Create `components/dashboard/dashboard-filters.tsx` (client)

**Interfaces:**
- Consumes: `useDashboard()` → `period`, `setPeriod`
- Produces: `<DashboardFilters />` (period segmented control `7D/30D/90D` + channel multiselect that maps to `toggleChannel`)

- [ ] **Step 1: Implement** — segmented control (active = `bg-secondary text-foreground`, others muted), `aria-pressed`; channel chips reflect `hiddenChannels` (hidden = struck/dimmed). Keyboard operable. Period change re-fetches snapshot (wired in Task 11). Always visible (sticky header).

- [ ] **Step 2: Commit** → `git commit -m "feat(dashboard): global period + channel filters"`

---

## Phase 3 — Compose & verify

### Task 11: Dashboard page composition + states + browser verification

**Files:** Modify `app/(dashboard)/dashboard/page.tsx` (replace the current single-card page)

**Interfaces:**
- Consumes: every component above + `mockSource`

- [ ] **Step 1: Make the page a client island under the provider.** Compose: sticky header (left: breadcrumb from `drill` or "DASHBOARD"; right: `<DashboardFilters/>` + `<Freshness/>`) → KPI row (`grid grid-cols-2 md:grid-cols-4 gap-3`, ≤5 cards, most-global top-left) → `<ChannelChart/>` panel → two-column (`<CampaignsTable/>` | `<LiveOrders/>`). Fetch snapshot with `useEffect`/`useState` keyed on `period`; show `<Skeleton/>` placeholders while loading, `<EmptyState/>` if `channels.length===0`, `<ErrorBanner/>` on thrown error (simulate with a `?fail=1` test hook). Wire `Freshness` `onRefresh` to re-fetch.
  - The page already inherits dark/light via tokens; no per-page theme code.

- [ ] **Step 2: Run the dev server**
Use preview: server `connext-dev` (`.claude/launch.json`). Navigate to `/dashboard`.

- [ ] **Step 3: Verify DARK** — `preview_screenshot`. Check: KPI hierarchy (top-left largest-weight), purple primary line, channel colors, mono numbers, sharp corners, freshness widget shows "Data as of 14:42", live orders streaming, legend toggle hides a series across chart, table sorts, CSV downloads.

- [ ] **Step 4: Verify LIGHT** — set `localStorage.theme='light'`, reload, screenshot. Confirm cool-gray (not warm), deep-purple accent, contrast holds.

- [ ] **Step 5: Verify states & a11y** — force loading (skeleton), empty (`channels:[]`), error (`?fail=1`). Check `preview_console_logs` clean. Tab through filters/legend/sort (keyboard). Confirm `prefers-reduced-motion` kills animations.

- [ ] **Step 6: Commit** → `git commit -m "feat(dashboard): compose dashboard page with states + a11y, verified light/dark"`

---

## Phase D — Deferred: real data (DO NOT build until warehouse data exists)

> Tracked here so the seam is explicit. No work now.

### Task D1: Warehouse source
- Create `lib/dashboard/warehouse.ts` implementing `DashboardSource` against ClickHouse (`shopify_orders`, `meta_ads_*`) + Supabase (`channel_connections`, `sync_jobs`). `snapshot(period)` runs the aggregate queries; `subscribe` uses Supabase Realtime on new orders/syncs.
- Swap `mockSource` → `warehouseSource` in `app/(dashboard)/dashboard/page.tsx` (single import change — UI untouched).
- Replace `lastSync` with real `sync_jobs.completed_at`; wire `offline`/`error` to real sync failures.
- Delete `lib/dashboard/mock.ts` once parity confirmed; keep `buildSnapshot` only if used by Storybook/tests.

---

## Self-Review

**Spec coverage** (against `2026-06-23-connext-design-system.md` §7):
- Layout/5s-rule → Task 11 (KPI row top-left, ≤5). ✓
- Interaction library: drill-down → store + Task 11 breadcrumb; cross-filter → store + legend (Task 7) + table/chart honoring `hiddenChannels`; details-on-demand tooltip → Task 7; global/local filters → Task 10; legend-toggle → Task 7; comparison/deltas → KpiCard (Task 4) + tooltip; CSV → Task 8. ✓
- Real-time: timings → Tasks 7/9 (≤300ms, reduced-motion); restraint+pause → Task 9; freshness widget → Task 5; skeleton → Task 3/11; error backoff banner → Task 3 (+ retry). ✓ (auto-retry backoff loop itself lives in Phase D real source; mock surfaces the banner via `?fail=1`.)
- States empty/loading/error → Task 3 + Task 11. ✓
- Accessibility ARIA-live/keyboard/color+icon/tabular → Tasks 5/7/8/9/11. ✓
- Phase-1 data scope (mock now, warehouse later) → Phase D. ✓

**Placeholder scan:** logic tasks (1,2,6) carry full code + tests; visual tasks specify exact files, props, tokens, and acceptance checks with the design spec as the pixel reference (intentional — JSX verified in-browser at Task 11, not asserted in the plan). No "TBD/add error handling/etc."

**Type consistency:** `DashboardSource.snapshot/subscribe`, `KpiDatum.unit ∈ {krw,x,count}`, `ChannelId` union, store `hiddenChannels`/`drill` — names match across Tasks 2/4/6/7/8/9/11.
