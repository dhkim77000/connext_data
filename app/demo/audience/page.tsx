// Demo · Audience — follower growth, who buys (customer demographics), and who
// each channel reaches (channel demographics). The gap between the two is the point.

import { Label, Panel, Stat, BarRow } from '@/components/dashboard/ui'
import { TimeSeriesChart } from '@/components/charts/time-series-chart'
import { StackBar } from '@/components/charts/stack-bar'
import { Heatmap } from '@/components/charts/heatmap'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { InsightCard } from '@/components/demo/insight-card'
import { fmtCompact, fmtInt } from '@/lib/format'
import {
  demoFollowerSeries,
  demoSummary as s,
  demoCustomerAge,
  demoCustomerGender,
  demoCustomerRegions,
  demoChannelDemographics,
  demoAgeCols,
} from '@/lib/demo/data'

const gained90 = demoFollowerSeries.reduce((a, d) => a + d.gained, 0)
const maxAge = Math.max(...demoCustomerAge.map((a) => a.pct), 1)
const maxRegion = Math.max(...demoCustomerRegions.map((r) => r.pct), 1)

// Channel × age-bucket reach — reuse the heatmap to contrast who each channel hits.
const channelAgeMatrix = demoChannelDemographics.map((c) => c.ageDist)
const channelRows = demoChannelDemographics.map((c) => c.channel)

const CHANNEL_GAP_INSIGHT = {
  kind: 'note' as const,
  title: 'You reach young, but 25–34 buys',
  body: 'Instagram skews to 18–24, yet most revenue comes from 25–34. Younger followers discover you; slightly older ones convert. Keep feeding the top of the funnel on Instagram.',
  evidence: 'IG reach 44% aged 18–24 · buyers 41% aged 25–34',
}

export default function DemoAudiencePage() {
  return (
    <div className="cx-stagger grid gap-3 lg:grid-cols-12">
      {/* Follower growth */}
      <Panel className="lg:col-span-8">
        <div className="flex items-baseline justify-between gap-3">
          <Label>Instagram followers · 90 days</Label>
          <span className="font-mono text-sm tabular-nums text-pos">▲ {s.followersDelta.toFixed(1)}% / 30d</span>
        </div>
        <p className="mt-3 text-4xl font-semibold tracking-tight">
          <AnimatedNumber value={s.followers} format="int" />
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
          +{fmtInt(gained90)} in 90 days · biggest jumps on viral days
        </p>
        <div className="mt-4">
          <TimeSeriesChart
            data={demoFollowerSeries.map((d) => ({ x: d.x, followers: d.followers }))}
            series={[{ key: 'followers', label: 'Followers' }]}
            format="int"
            baseline="auto"
            height={180}
            ariaLabel="Instagram follower growth"
          />
        </div>
      </Panel>

      {/* Follower KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:col-span-4 lg:grid-cols-1">
        <Stat label="Followers" value={fmtCompact(s.followers)} sub="Instagram" />
        <Stat label="Gained" value={`+${fmtCompact(gained90)}`} sub="last 90 days" />
        <Stat label="Engagement" value="4.2%" sub="per follower" />
      </div>

      {/* Who buys — age */}
      <Panel className="lg:col-span-4">
        <Label>Who buys · age</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Share of paying customers.</p>
        <ul className="space-y-2.5">
          {demoCustomerAge.map((a) => (
            <BarRow key={a.bucket} label={a.bucket} value={`${a.pct}%`} pct={(a.pct / maxAge) * 100} />
          ))}
        </ul>
      </Panel>

      {/* Who buys — gender */}
      <Panel className="lg:col-span-4">
        <Label>Who buys · gender</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Share of paying customers.</p>
        <StackBar
          parts={demoCustomerGender.map((g) => ({ label: g.label, value: g.pct, color: g.color }))}
          format={(v) => `${v}%`}
        />
      </Panel>

      {/* Who buys — regions */}
      <Panel className="lg:col-span-4">
        <Label>Who buys · region</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Top shipping regions.</p>
        <ul className="space-y-2.5">
          {demoCustomerRegions.map((r) => (
            <BarRow key={r.region} label={r.region} value={`${r.pct}%`} pct={(r.pct / maxRegion) * 100} />
          ))}
        </ul>
      </Panel>

      {/* Who each channel reaches */}
      <Panel className="lg:col-span-8">
        <Label>Who each channel reaches · age</Label>
        <p className="mt-1.5 mb-5 text-sm text-muted-foreground">
          Reach share by age bucket — darker is a bigger slice of that channel&apos;s audience.
        </p>
        <Heatmap values={channelAgeMatrix} rowLabels={channelRows} colLabels={demoAgeCols} unit="% reach" cellHeight={26} />
        <ul className="mt-5 space-y-1.5 border-t border-border pt-4">
          {demoChannelDemographics.map((c) => (
            <li key={c.channel} className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>{c.channel}</span>
              <span className="tabular-nums">{c.female}% female · {c.note}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <InsightCard insight={CHANNEL_GAP_INSIGHT} className="lg:col-span-4" />
    </div>
  )
}
