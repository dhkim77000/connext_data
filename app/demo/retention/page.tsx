// Demo · Retention — do customers come back? Cohort retention, RFM segments,
// repurchase timing, lifetime value, and when orders happen.

import { Label, Panel, BarRow } from '@/components/dashboard/ui'
import { TimeSeriesChart } from '@/components/charts/time-series-chart'
import { Heatmap } from '@/components/charts/heatmap'
import { CohortGrid } from '@/components/demo/cohort-grid'
import { InsightCard } from '@/components/demo/insight-card'
import { fmtCurrency, fmtInt } from '@/lib/format'
import { demoCohorts, demoRfm, demoWeekHour, demoRepurchaseGaps, demoLtvCurve, demoInsights } from '@/lib/demo/data'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? `${h}:00` : null))

export default function DemoRetentionPage() {
  const maxRfm = Math.max(...demoRfm.map((r) => r.customers), 1)
  const maxGap = Math.max(...demoRepurchaseGaps.map((g) => g.customers), 1)

  return (
    <div className="cx-stagger grid gap-3 lg:grid-cols-12">
      <Panel className="lg:col-span-7">
        <Label>Repeat purchase retention · by first-order month</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          Newer customers stick around longer — a sign the product is getting better.
        </p>
        <CohortGrid cohorts={demoCohorts} />
      </Panel>

      <Panel className="lg:col-span-5">
        <Label>Customer segments</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Grouped by recency, frequency and spend.</p>
        <ul className="space-y-2.5">
          {demoRfm.map((r) => (
            <BarRow
              key={r.segment}
              label={r.segment}
              value={`${fmtInt(r.customers)} · ${r.revenueShare}%`}
              pct={(r.customers / maxRfm) * 100}
              title={r.desc}
            />
          ))}
        </ul>
      </Panel>

      <Panel className="lg:col-span-7">
        <Label>When orders happen</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          Weekday evenings 9–11 PM are the peak. Schedule ads and messages to match.
        </p>
        <Heatmap values={demoWeekHour} rowLabels={DOW} colLabels={HOUR_LABELS} unit="orders" />
      </Panel>

      <Panel className="lg:col-span-5">
        <Label>Time until the second order</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Among customers who bought again.</p>
        <ul className="space-y-2.5">
          {demoRepurchaseGaps.map((g) => (
            <BarRow key={g.bucket} label={g.bucket} value={fmtInt(g.customers)} pct={(g.customers / maxGap) * 100} />
          ))}
        </ul>
        <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
          47 days on average — the moment to reach out again.
        </p>
      </Panel>

      <Panel className="lg:col-span-7">
        <Label>Value of one customer over time</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          Cumulative revenue per customer after their first order — {fmtCurrency(demoLtvCurve[5].ltv)} by month six.
        </p>
        <TimeSeriesChart
          data={demoLtvCurve}
          series={[{ key: 'ltv', label: 'Cumulative value' }]}
          format="currency"
          height={170}
          ariaLabel="Customer lifetime value curve"
        />
      </Panel>

      <InsightCard insight={demoInsights[3]} className="lg:col-span-5" />
    </div>
  )
}
