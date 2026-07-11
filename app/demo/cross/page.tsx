// Demo · Cross-platform — different channels' metrics as one flow.
// Metrics on different scales are indexed (7-day average, first week = 100)
// so they share ONE axis — never a dual-axis chart.

import { Label, Panel } from '@/components/dashboard/ui'
import { TimeSeriesChart } from '@/components/charts/time-series-chart'
import { StackBar } from '@/components/charts/stack-bar'
import { InsightCard } from '@/components/demo/insight-card'
import { fmtCurrency } from '@/lib/format'
import { demoDays, demoIndexed, demoChannelMix, demoChannelEfficiency, demoInsights } from '@/lib/demo/data'

export default function DemoCrossPage() {
  return (
    <div className="cx-stagger grid gap-3 lg:grid-cols-12">
      {/* Indexed comparison — content → visits → revenue */}
      <Panel className="lg:col-span-12">
        <Label>Content → visits → revenue · on the same scale</Label>
        <p className="mt-1.5 mb-4 max-w-[52em] text-sm text-muted-foreground">
          Reach, sessions and revenue use different units, so they can&apos;t be overlaid directly. Index each
          one&apos;s 7-day average to 100 at the first week and the flow lines up — when Instagram has a good
          week, visits rise with it and revenue follows. Click the legend to isolate a line.
        </p>
        <TimeSeriesChart
          data={demoIndexed}
          series={[
            { key: 'igReach', label: 'Instagram reach', color: 'var(--ch-instagram)' },
            { key: 'sessions', label: 'Site sessions', color: 'var(--ch-naver)' },
            { key: 'revenue', label: 'Revenue', color: 'var(--cx-chart-line)' },
          ]}
          format="int"
          height={220}
          ariaLabel="Instagram reach, site sessions and revenue indexed to 100 at the first week"
        />
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">Index · 7-day average · first week = 100</p>
      </Panel>

      {/* Ad spend vs ad revenue */}
      <Panel className="lg:col-span-7">
        <Label>From ad spend to revenue</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          During the mid-June campaign, revenue from ads climbed with spend — the gap between the lines is
          what you keep.
        </p>
        <TimeSeriesChart
          data={demoDays.map((d) => ({ x: d.x, adConvVal: d.adConvVal, adSpend: d.adSpend }))}
          series={[
            { key: 'adConvVal', label: 'Revenue from ads', color: 'var(--cx-chart-line)' },
            { key: 'adSpend', label: 'Ad spend', color: 'var(--ch-meta)' },
          ]}
          format="currency"
          height={190}
        />
      </Panel>

      {/* Channel efficiency */}
      <Panel className="lg:col-span-5">
        <Label>Channel efficiency at a glance</Label>
        <div className="mt-4 space-y-3.5">
          {demoChannelEfficiency.map((e) => (
            <div
              key={`${e.channel}-${e.note}`}
              className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{e.channel}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{e.note}</p>
              </div>
              <p className="shrink-0 text-lg font-medium tabular-nums">{e.value}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Attribution composition */}
      <Panel className="lg:col-span-5">
        <Label>Revenue attribution · channel mix</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">By the last touch before each order.</p>
        <StackBar parts={demoChannelMix} format={(v) => fmtCurrency(v)} />
      </Panel>

      {/* Cross-channel insights */}
      <InsightCard insight={demoInsights[0]} className="lg:col-span-4" />
      <InsightCard insight={demoInsights[3]} className="lg:col-span-3" />
    </div>
  )
}
