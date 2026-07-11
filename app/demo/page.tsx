// Demo overview — four channels merged into one view. Domain strip → revenue
// hero → insight cards → revenue vs ad spend → channel attribution.

import { Label, Panel, Stat } from '@/components/dashboard/ui'
import { TrendExplorer } from '@/components/charts/trend-explorer'
import { TimeSeriesChart } from '@/components/charts/time-series-chart'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { StackBar } from '@/components/charts/stack-bar'
import { InsightCard } from '@/components/demo/insight-card'
import { fmtCurrency, fmtCompact, fmtInt } from '@/lib/format'
import { demoDays, demoSummary as s, demoChannelMix, demoInsights } from '@/lib/demo/data'

const DOMAINS = [
  { label: 'Commerce', value: fmtCurrency(s.revenue), sub: `${fmtInt(s.orders)} orders` },
  { label: 'Ads', value: `${s.roas.toFixed(1)}×`, sub: `${fmtCurrency(s.adSpend)} spend` },
  { label: 'Audience', value: fmtCompact(s.followers), sub: `followers +${s.followersDelta}%` },
  { label: 'Content', value: fmtCompact(demoDays.reduce((a, d) => a + d.igReach, 0)), sub: '90-day reach' },
  { label: 'Conversion', value: `${s.cvr.toFixed(1)}%`, sub: `${fmtCompact(s.sessions)} sessions` },
]

export default function DemoHomePage() {
  return (
    <>
      {/* Domain strip — one glance across commerce, ads, audience, content, conversion */}
      <div className="cx-stagger mb-3 grid grid-cols-2 gap-3 md:grid-cols-5">
        {DOMAINS.map((d) => (
          <Panel key={d.label} className="py-4">
            <Label>{d.label}</Label>
            <p className="mt-2 text-lg font-medium tabular-nums tracking-tight">{d.value}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">{d.sub}</p>
          </Panel>
        ))}
      </div>

      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        {/* Unified revenue — dominant panel */}
        <Panel className="lg:col-span-7">
          <Label>Last 30 days revenue · all channels</Label>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-5xl font-semibold tracking-tight">
              <AnimatedNumber value={s.rev30} format="currency" />
            </p>
            <span
              className={`font-mono text-sm tabular-nums ${s.rev30DeltaPct >= 0 ? 'text-pos' : 'text-neg'}`}
            >
              {s.rev30DeltaPct >= 0 ? '▲' : '▼'} {Math.abs(s.rev30DeltaPct).toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            vs previous 30 days · average order {fmtCurrency(s.aov)}
          </p>
          <div className="mt-5">
            <TrendExplorer
              data={demoDays.map((d) => ({ x: d.x, revenue: d.revenue, orders: d.orders, sessions: d.sessions }))}
              metrics={[
                { key: 'revenue', label: 'Revenue', format: 'currency' },
                { key: 'orders', label: 'Orders', format: 'int' },
                { key: 'sessions', label: 'Sessions', format: 'compact' },
              ]}
              height={190}
            />
          </div>
        </Panel>

        {/* Blended KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-5">
          <Stat label="Return on ad spend" value={`${s.roas.toFixed(1)}×`} sub="all ad channels combined" />
          <Stat label="Cost per new customer" value={fmtCurrency(s.cac)} sub="blended acquisition cost" />
          <Stat label="New customers" value={fmtInt(s.newCustomers)} sub="90-day total" />
          <Stat label="Repeat rate" value={`${s.returningRate}%`} sub="of paying customers" />
        </div>

        {/* Insights — where data turns into sentences */}
        <div className="lg:col-span-12">
          <div className="mb-3 mt-2 flex items-center gap-4">
            <Label>This week&apos;s insights</Label>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {demoInsights.slice(0, 3).map((ins) => (
              <InsightCard key={ins.title} insight={ins} />
            ))}
          </div>
        </div>

        {/* Revenue ↔ ad spend */}
        <Panel className="lg:col-span-7">
          <Label>Revenue and ad spend · together</Label>
          <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
            See how revenue followed the weeks you raised spend — on one axis.
          </p>
          <TimeSeriesChart
            data={demoDays.map((d) => ({ x: d.x, revenue: d.revenue, adSpend: d.adSpend }))}
            series={[
              { key: 'revenue', label: 'Revenue', color: 'var(--cx-chart-line)' },
              { key: 'adSpend', label: 'Ad spend', color: 'var(--ch-meta)' },
            ]}
            format="currency"
            height={180}
          />
        </Panel>

        {/* Channel attribution */}
        <Panel className="lg:col-span-5">
          <Label>Which channels made the revenue</Label>
          <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Split by the last touch before each order.</p>
          <StackBar parts={demoChannelMix} format={(v) => fmtCurrency(v)} />
        </Panel>
      </div>
    </>
  )
}
