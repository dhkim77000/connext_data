'use client'

// Metric switcher + single-series chart. Metrics on different scales share one
// panel by taking turns on ONE axis (a dual-axis chart is banned by the chart
// ADR) — the pill segmented control picks which metric is plotted.

import { useState } from 'react'
import { TimeSeriesChart, type TimeSeriesRow, type ContextSpec } from './time-series-chart'
import type { ValueFormat } from './format'

export type MetricSpec = {
  key: string
  label: string
  format?: ValueFormat
  baseline?: 'zero' | 'auto'
  color?: string
  context?: ContextSpec[]
}

export function TrendExplorer({
  data,
  metrics,
  currency = 'USD',
  height = 200,
}: {
  data: TimeSeriesRow[]
  metrics: MetricSpec[]
  currency?: string
  height?: number
}) {
  const [active, setActive] = useState(metrics[0]?.key)
  const metric = metrics.find((m) => m.key === active) ?? metrics[0]
  if (!metric) return null

  return (
    <div>
      {metrics.length >= 2 && (
        <div
          className="mb-3 inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5"
          role="group"
          aria-label="Metric"
        >
          {metrics.map((m) => {
            const on = m.key === metric.key
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setActive(m.key)}
                aria-pressed={on}
                className={`cx-press rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                  on
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      )}
      <TimeSeriesChart
        key={metric.key} // remount per metric — the draw-in makes the switch legible
        data={data}
        series={[{ key: metric.key, label: metric.label, color: metric.color }]}
        format={metric.format ?? 'int'}
        currency={currency}
        height={height}
        baseline={metric.baseline ?? 'zero'}
        context={metric.context ?? []}
      />
    </div>
  )
}
