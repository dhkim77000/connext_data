// Demo · Marketing — what's working: paid campaigns, influencers, referral
// codes, and which promotions drove the most revenue.

import { Label, Panel, Stat, BarRow } from '@/components/dashboard/ui'
import { TrendExplorer } from '@/components/charts/trend-explorer'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { InsightCard } from '@/components/demo/insight-card'
import { fmtCurrency, fmtCompact, fmtInt } from '@/lib/format'
import {
  demoDays,
  demoSummary as s,
  demoCampaigns,
  demoInfluencers,
  demoReferralCodes,
  demoPromotions,
  demoInsights,
} from '@/lib/demo/data'

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

const TIER_DOT: Record<string, string> = { Mega: 'var(--ch-instagram)', Macro: 'var(--ch-meta)', Micro: 'var(--pos)' }

export default function DemoMarketingPage() {
  const maxCampaign = Math.max(...demoCampaigns.map((c) => c.spend), 1)
  const maxCode = Math.max(...demoReferralCodes.map((c) => c.revenue), 1)
  const maxPromo = Math.max(...demoPromotions.map((p) => p.revenue), 1)

  return (
    <div className="cx-stagger grid gap-3 lg:grid-cols-12">
      {/* Paid spend + ROAS */}
      <Panel className="lg:col-span-7">
        <div className="flex items-baseline justify-between gap-3">
          <Label>Ad spend & return · 90 days</Label>
          <span className="font-mono text-sm tabular-nums text-pos">{s.roas.toFixed(1)}× return</span>
        </div>
        <p className="mt-3 text-3xl font-semibold tracking-tight">
          <AnimatedNumber value={s.adSpend} format="currency" />
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
          {fmtCurrency(s.adConvVal)} revenue from ads
        </p>
        <div className="mt-4">
          <TrendExplorer
            data={demoDays.map((d) => ({ x: d.x, adSpend: d.adSpend, adConvVal: d.adConvVal, roas: d.adSpend ? d.adConvVal / d.adSpend : 0 }))}
            metrics={[
              { key: 'adSpend', label: 'Spend', format: 'currency', context: [{ key: 'roas', label: 'Return', format: 'multiple' }] },
              { key: 'adConvVal', label: 'Ad revenue', format: 'currency' },
            ]}
            height={160}
          />
        </div>
      </Panel>

      {/* Campaigns */}
      <Panel className="lg:col-span-5">
        <Label>Campaigns by spend</Label>
        <ul className="mt-4 space-y-2.5">
          {demoCampaigns.map((c) => (
            <BarRow
              key={c.name}
              label={c.name}
              value={`${fmtCurrency(c.spend)} · ${c.roas.toFixed(1)}×`}
              pct={(c.spend / maxCampaign) * 100}
              title={`${c.name} — ${fmtCurrency(c.convVal)} revenue from ads`}
            />
          ))}
        </ul>
      </Panel>

      {/* Influencers — tier vs ROI */}
      <Panel className="lg:col-span-7">
        <Label>Influencers</Label>
        <p className="mt-1.5 mb-3 text-sm text-muted-foreground">Attributed through each creator&apos;s referral code.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <Th>Creator</Th>
                <Th>Tier</Th>
                <Th right>Followers</Th>
                <Th right>Orders</Th>
                <Th right>ROI</Th>
              </tr>
            </thead>
            <tbody>
              {demoInfluencers.map((v) => (
                <tr key={v.handle} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 text-sm">
                    {v.handle}
                    <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{v.code}</span>
                  </td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_DOT[v.tier] }} aria-hidden />
                      {v.tier}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">{fmtCompact(v.followers)}</td>
                  <td className="py-2.5 text-right text-sm tabular-nums">{fmtInt(v.orders)}</td>
                  <td className="py-2.5 text-right text-sm font-medium tabular-nums">{v.roi.toFixed(1)}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Micro > mega insight */}
      <InsightCard insight={demoInsights[1]} className="lg:col-span-5" />

      {/* Referral / discount codes */}
      <Panel className="lg:col-span-7">
        <Label>Referral & discount codes</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Revenue after each code&apos;s own discount.</p>
        <ul className="space-y-2.5">
          {[...demoReferralCodes]
            .sort((a, b) => b.revenue - a.revenue)
            .map((c) => (
              <BarRow
                key={c.code}
                label={`${c.code}`}
                value={`${fmtCurrency(c.revenue)} · ${fmtInt(c.redemptions)} used`}
                pct={(c.revenue / maxCode) * 100}
                title={`${c.kind} · ${c.discountPct}% off`}
              />
            ))}
        </ul>
      </Panel>

      {/* Promotions timeline */}
      <Panel className="lg:col-span-5">
        <Label>Promotions & events</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">Ranked by revenue driven.</p>
        <ul className="space-y-3">
          {[...demoPromotions]
            .sort((a, b) => b.revenue - a.revenue)
            .map((p) => (
              <li key={p.name} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm">{p.name}</span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-pos">+{p.liftPct}%</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  <span>{p.kind} · {p.period}</span>
                  <span className="tabular-nums">{fmtCurrency(p.revenue)}</span>
                </div>
                <span className="mt-1.5 block h-1 rounded-full bg-cx-accent/70" style={{ width: `${(p.revenue / maxPromo) * 100}%` }} aria-hidden />
              </li>
            ))}
        </ul>
      </Panel>
    </div>
  )
}
