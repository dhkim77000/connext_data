// Dev-only design QA gallery — renders the chart kit with labeled SAMPLE data
// so visual changes can be screenshot-verified without auth or live data.
// Hard-gated out of production builds.

import { notFound } from 'next/navigation'
import { Label, Panel, Stat, BarRow } from '@/components/dashboard/ui'
import { TrendExplorer } from '@/components/charts/trend-explorer'
import { TimeSeriesChart } from '@/components/charts/time-series-chart'
import { HourBars } from '@/components/charts/hour-bars'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { ThemeToggle } from '@/components/theme-toggle'
import { fmtCurrency, fmtInt } from '@/lib/format'

// Deterministic synthetic series (stable screenshots — no randomness).
const DAYS = 30
const rows = Array.from({ length: DAYS }, (_, i) => {
  const d = new Date(Date.UTC(2026, 5, 8 + i))
  const wave = Math.sin(i / 4.2) * 0.35 + Math.sin(i / 9) * 0.2
  const weekend = [0, 6].includes(d.getUTCDay()) ? 0.72 : 1
  const revenue = Math.round((3200 + 2100 * (0.5 + wave)) * weekend * 100) / 100
  const orders = Math.round((26 + 15 * (0.5 + wave)) * weekend)
  return { x: d.toISOString().slice(0, 10), revenue, orders, spend: Math.round(revenue * 0.24), roas: 3.1 + wave }
})
const hours = Array.from({ length: 24 }, (_, h) => Math.round(Math.max(0, 18 * Math.exp(-((h - 14) ** 2) / 28) + 6 * Math.exp(-((h - 21) ** 2) / 6))))
const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0)
const countries = [
  { label: 'KR', v: 61200 },
  { label: 'US', v: 23400 },
  { label: 'JP', v: 9800 },
  { label: 'SG', v: 4100 },
]

export default function DesignGallery() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <Label>Design QA · sample data</Label>
          <h1 className="mt-1.5 text-xl font-medium tracking-tight">Chart kit gallery</h1>
        </div>
        <ThemeToggle />
      </div>

      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        {/* Dominant trend panel — switcher + interactive chart */}
        <Panel className="lg:col-span-7">
          <Label>Revenue (sample)</Label>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-5xl font-semibold tracking-tight">
              <AnimatedNumber value={totalRevenue} format="currency" currency="USD" />
            </p>
            <span className="font-mono text-sm tabular-nums text-pos">▲ 8.2%</span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            {fmtInt(rows.reduce((a, r) => a + r.orders, 0))} orders · 30 days
          </p>
          <div className="mt-5">
            <TrendExplorer
              data={rows}
              metrics={[
                { key: 'revenue', label: 'Revenue', format: 'currency' },
                { key: 'orders', label: 'Orders', format: 'int' },
                {
                  key: 'spend',
                  label: 'Spend',
                  format: 'currency',
                  context: [{ key: 'roas', label: 'ROAS', format: 'multiple' }],
                },
              ]}
              currency="USD"
              height={190}
            />
          </div>
        </Panel>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-5">
          <Stat label="Orders" value={fmtInt(rows.reduce((a, r) => a + r.orders, 0))} sub="30 active days" />
          <Stat label="Avg order value" value={fmtCurrency(112.4, 'USD')} />
          <Stat label="Customers" value={fmtInt(1843)} sub={`LTV ${fmtCurrency(214, 'USD')}`} />
          <Stat label="Catalog" value={fmtInt(64)} sub="187 variants" />
        </div>

        {/* Multi-series (legend toggles) */}
        <Panel className="lg:col-span-7">
          <Label>Two series · legend toggles (sample)</Label>
          <div className="mt-4">
            <TimeSeriesChart
              data={rows}
              series={[
                { key: 'revenue', label: 'Shopify', color: 'var(--ch-shopify)' },
                { key: 'spend', label: 'Meta Ads', color: 'var(--ch-meta)' },
              ]}
              format="currency"
              currency="USD"
              height={180}
            />
          </div>
        </Panel>

        {/* Hour bars */}
        <Panel className="lg:col-span-5">
          <div className="mb-6">
            <Label>Orders by time of day (sample)</Label>
          </div>
          <HourBars hours={hours} unit="orders" />
        </Panel>

        {/* Bar rows */}
        <Panel className="lg:col-span-5">
          <Label>Revenue by country (sample)</Label>
          <ul className="mt-4 space-y-2.5">
            {countries.map((c) => (
              <BarRow
                key={c.label}
                label={c.label}
                value={fmtCurrency(c.v, 'USD')}
                pct={(c.v / countries[0].v) * 100}
              />
            ))}
          </ul>
        </Panel>

        {/* States */}
        <Panel className="lg:col-span-7">
          <Label>States — skeleton · empty</Label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="cx-skeleton h-28" />
            <div className="flex h-28 items-center justify-center rounded-[var(--radius)] border border-border">
              <TimeSeriesChart data={[]} series={[{ key: 'v', label: 'Empty' }]} height={80} />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
