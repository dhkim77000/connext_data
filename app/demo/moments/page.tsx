// Demo · Moments — "what happened?" The revenue line is annotated with the
// events behind each spike, and each moment is broken out with its cause and lift.

import { Label, Panel } from '@/components/dashboard/ui'
import { TimeSeriesChart } from '@/components/charts/time-series-chart'
import { demoDays, demoEventMarkers, demoMoments, type MomentKind } from '@/lib/demo/data'

const KIND: Record<MomentKind, { label: string; dot: string }> = {
  content: { label: 'Instagram reel', dot: 'var(--ch-instagram)' },
  influencer: { label: 'Influencer collab', dot: 'var(--pos)' },
  ad: { label: 'Meta campaign', dot: 'var(--ch-meta)' },
  referral: { label: 'Referral code', dot: 'var(--ch-youtube)' },
}

export default function DemoMomentsPage() {
  return (
    <div className="cx-stagger grid gap-3 lg:grid-cols-12">
      {/* Annotated revenue — the markers say what drove each spike */}
      <Panel className="lg:col-span-12">
        <Label>What moved revenue · last 90 days</Label>
        <p className="mt-1.5 mb-6 max-w-[52em] text-sm text-muted-foreground">
          Every spike has a reason. The markers pin each jump to what happened that day — a viral reel, an
          influencer collab, a campaign launch, a code drop. Hover a marker to read it.
        </p>
        <TimeSeriesChart
          data={demoDays.map((d) => ({ x: d.x, revenue: d.revenue }))}
          series={[{ key: 'revenue', label: 'Revenue' }]}
          format="currency"
          events={demoEventMarkers}
          height={240}
          ariaLabel="Daily revenue with event markers"
        />
      </Panel>

      {/* Ranked moments — the story behind each peak */}
      <div className="lg:col-span-12">
        <div className="mb-3 mt-2 flex items-center gap-4">
          <Label>Biggest moments this quarter</Label>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {demoMoments.map((m) => {
            const k = KIND[m.kind]
            const date = new Date(`${m.x}T00:00:00`)
            const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
            return (
              <Panel key={m.day} className="flex gap-4">
                <div className="flex flex-col items-start gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
                  <span className="text-3xl font-semibold tabular-nums tracking-tight text-pos">
                    +{Math.round(m.liftPct)}%
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    vs normal
                  </span>
                </div>
                <div className="min-w-0 flex-1 border-l border-border pl-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: k.dot }} aria-hidden />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {k.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[15px] font-medium leading-snug">{m.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.detail}</p>
                  <p className="mt-2 font-mono text-[11px] tabular-nums text-muted-foreground">{m.metric}</p>
                </div>
              </Panel>
            )
          })}
        </div>
      </div>
    </div>
  )
}
