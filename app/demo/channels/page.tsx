// Demo · Channels — the same data through each channel's lens.
// Each section: channel dot + hero + trend/breakdown panels.

import { Label, Panel, BarRow } from '@/components/dashboard/ui'
import { TrendExplorer } from '@/components/charts/trend-explorer'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { fmtCurrency, fmtCompact, fmtInt } from '@/lib/format'
import {
  demoDays,
  demoSummary as s,
  demoProducts,
  demoCampaigns,
  demoIgPosts,
  demoGa4Sources,
} from '@/lib/demo/data'

function Th({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}

function SectionHead({ dot, name, desc }: { dot: string; name: string; desc: string }) {
  return (
    <div className="mt-9 mb-4 flex items-center gap-3 first:mt-0">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden />
      <span className="text-sm font-medium">{name}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{desc}</span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}

export default function DemoChannelsPage() {
  const maxCampaign = Math.max(...demoCampaigns.map((c) => c.spend), 1)
  const maxSource = Math.max(...demoGa4Sources.map((g) => g.sessions), 1)
  const igReachTotal = demoDays.reduce((a, d) => a + d.igReach, 0)

  return (
    <>
      {/* ── Shopify ── */}
      <SectionHead dot="var(--ch-shopify)" name="Shopify" desc="store revenue" />
      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <Label>Revenue · 90 days</Label>
          <p className="mt-3 text-4xl font-semibold tracking-tight">
            <AnimatedNumber value={s.revenue} format="currency" />
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            {fmtInt(s.orders)} orders · {fmtCurrency(s.aov)} average
          </p>
          <div className="mt-5">
            <TrendExplorer
              data={demoDays.map((d) => ({ x: d.x, revenue: d.revenue, orders: d.orders }))}
              metrics={[
                { key: 'revenue', label: 'Revenue', format: 'currency' },
                { key: 'orders', label: 'Orders', format: 'int' },
              ]}
              height={170}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-5">
          <Label>Top products</Label>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <Th>Product</Th>
                <Th right>Revenue</Th>
                <Th right>Units</Th>
              </tr>
            </thead>
            <tbody>
              {demoProducts.slice(0, 6).map((p) => (
                <tr key={p.title} className="border-b border-border/60 last:border-0">
                  <td className="w-full max-w-0 truncate py-2 pr-3 text-sm" title={p.title}>{p.title}</td>
                  <td className="py-2 text-right text-sm tabular-nums">{fmtCurrency(p.revenue)}</td>
                  <td className="py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {fmtInt(p.units)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* ── Instagram ── */}
      <SectionHead dot="var(--ch-instagram)" name="Instagram" desc="organic content" />
      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-5">
          <Label>Followers</Label>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-4xl font-semibold tracking-tight">
              <AnimatedNumber value={s.followers} format="int" />
            </p>
            <span className="font-mono text-sm tabular-nums text-pos">▲ {s.followersDelta}%</span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            {fmtCompact(igReachTotal)} reach in 90 days
          </p>
          <div className="mt-5">
            <TrendExplorer
              data={demoDays.map((d) => ({ x: d.x, igReach: d.igReach }))}
              metrics={[{ key: 'igReach', label: 'Reach', format: 'compact' }]}
              height={150}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-7">
          <Label>Best-performing posts</Label>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <Th>Post</Th>
                <Th>Format</Th>
                <Th right>Reach</Th>
                <Th right>Likes</Th>
              </tr>
            </thead>
            <tbody>
              {demoIgPosts.map((p) => (
                <tr key={p.caption} className="border-b border-border/60 last:border-0">
                  <td className="w-full max-w-0 truncate py-2 pr-3 text-sm" title={p.caption}>{p.caption}</td>
                  <td className="py-2 font-mono text-[11px] text-muted-foreground">{p.type}</td>
                  <td className="py-2 text-right text-sm tabular-nums">{fmtCompact(p.reach)}</td>
                  <td className="py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {fmtCompact(p.likes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* ── Meta Ads ── */}
      <SectionHead dot="var(--ch-meta)" name="Meta Ads" desc="paid media" />
      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <Label>Ad spend · 90 days</Label>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-4xl font-semibold tracking-tight">
              <AnimatedNumber value={s.adSpend} format="currency" />
            </p>
            <span className="font-mono text-sm tabular-nums text-pos">{s.roas.toFixed(1)}× back</span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            {fmtCurrency(s.adConvVal)} revenue from ads
          </p>
          <div className="mt-5">
            <TrendExplorer
              data={demoDays.map((d) => ({
                x: d.x,
                adSpend: d.adSpend,
                adConvVal: d.adConvVal,
                roas: d.adSpend ? d.adConvVal / d.adSpend : 0,
              }))}
              metrics={[
                {
                  key: 'adSpend',
                  label: 'Spend',
                  format: 'currency',
                  context: [{ key: 'roas', label: 'Return', format: 'multiple' }],
                },
                { key: 'adConvVal', label: 'Ad revenue', format: 'currency' },
              ]}
              height={170}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-5">
          <Label>Spend by campaign</Label>
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
          <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
            &ldquo;Brand Awareness (Reels)&rdquo; returns the least — the insights tab explains why.
          </p>
        </Panel>
      </div>

      {/* ── GA4 ── */}
      <SectionHead dot="var(--ch-naver)" name="Google Analytics" desc="traffic · conversion" />
      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <Label>Sessions · 90 days</Label>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-4xl font-semibold tracking-tight">
              <AnimatedNumber value={s.sessions} format="compact" />
            </p>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {s.cvr.toFixed(1)}% convert
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">{fmtInt(s.orders)} orders</p>
          <div className="mt-5">
            <TrendExplorer
              data={demoDays.map((d) => ({ x: d.x, sessions: d.sessions }))}
              metrics={[{ key: 'sessions', label: 'Sessions', format: 'compact' }]}
              height={170}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-5">
          <Label>Where visitors came from</Label>
          <ul className="mt-4 space-y-2.5">
            {demoGa4Sources.map((g) => (
              <BarRow
                key={g.source}
                label={g.source}
                value={`${fmtCompact(g.sessions)} · ${g.cvr}%`}
                pct={(g.sessions / maxSource) * 100}
                title={`${g.source} — ${fmtInt(g.sessions)} sessions · ${g.cvr}% convert`}
              />
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
            Direct visits convert best — that&apos;s your returning customers.
          </p>
        </Panel>
      </div>
    </>
  )
}
