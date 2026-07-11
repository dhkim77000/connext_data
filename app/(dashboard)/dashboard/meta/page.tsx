import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { queryCH } from '@/lib/clickhouse/http'
import { ChannelTabs } from '@/components/dashboard/channel-tabs'
import { Label, Panel, Stat, BarRow, num as n } from '@/components/dashboard/ui'
import { TrendExplorer } from '@/components/charts/trend-explorer'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { fmtCurrency, fmtInt, fmtCompact, fmtAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function MetaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: tenant } = await supabase
    .from('tenants').select('id, name').eq('owner_auth_id', user.id).single()

  let sum: Record<string, unknown> | undefined
  let daily: { d: string; spend: number; conv: number; convVal: number }[] = []
  let campaigns: { name: string; spend: number; convVal: number; conv: number }[] = []
  let error: string | null = null

  if (tenant) {
    try {
      const p = { tenant: tenant.id }
      const [s, day, camp] = await Promise.all([
        queryCH(`SELECT round(sum(spend),2) AS spend, sum(impressions) AS impr, sum(clicks) AS clicks,
                        sum(reach) AS reach, sum(conversions) AS conv, round(sum(conversion_value),2) AS conv_val,
                        anyIf(currency, currency != '') AS cur, max(ingested_at) AS ts
                 FROM connext.meta_ads_insights_stat FINAL WHERE tenant_id = {tenant:String}`, p),
        queryCH(`SELECT date_start AS d, round(sum(spend),2) AS spend, sum(conversions) AS conv,
                        round(sum(conversion_value),2) AS conv_val
                 FROM connext.meta_ads_insights_stat FINAL WHERE tenant_id = {tenant:String} GROUP BY d ORDER BY d`, p),
        queryCH(`SELECT any(c.name) AS name, round(sum(i.spend),2) AS spend,
                        round(sum(i.conversion_value),2) AS conv_val, sum(i.conversions) AS conv
                 FROM connext.meta_ads_insights_stat i
                 LEFT JOIN (SELECT campaign_id, argMax(name,ingested_at) AS name FROM connext.meta_ads_campaigns
                            WHERE tenant_id = {tenant:String} GROUP BY campaign_id) c ON i.campaign_id = c.campaign_id
                 WHERE i.tenant_id = {tenant:String} GROUP BY i.campaign_id ORDER BY spend DESC`, p),
      ])
      sum = s[0]
      daily = day.map((r) => ({ d: String(r.d), spend: n(r.spend), conv: n(r.conv), convVal: n(r.conv_val) }))
      campaigns = camp.map((r) => ({ name: String(r.name || 'Campaign'), spend: n(r.spend), convVal: n(r.conv_val), conv: n(r.conv) }))
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }

  const cur = String(sum?.cur || 'USD')
  const spend = n(sum?.spend)
  const impr = n(sum?.impr)
  const clicks = n(sum?.clicks)
  const conv = n(sum?.conv)
  const convVal = n(sum?.conv_val)
  const roas = spend ? convVal / spend : 0
  const ctr = impr ? (clicks / impr) * 100 : 0
  const cpc = clicks ? spend / clicks : 0
  const maxCampSpend = Math.max(...campaigns.map((c) => c.spend), 1)
  const hasData = spend > 0 || impr > 0

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Label>Analytics · Meta Ads</Label>
          <h1 className="mt-1.5 text-xl font-medium tracking-tight">{tenant?.name ?? 'Overview'}</h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-pos" aria-hidden />
          Data as of {fmtAgo((sum?.ts as string) ?? null, Date.now())}
        </div>
      </div>

      <ChannelTabs />

      {error && (
        <div className="mb-4 rounded-[var(--radius)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Couldn’t reach the warehouse — {error}
        </div>
      )}

      {!hasData ? (
        <Panel className="flex flex-col items-center justify-center py-16 text-center">
          <Label>No Meta Ads data yet</Label>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Connect a Meta ad account with active spend and run a sync to see spend, ROAS, and campaign performance.
          </p>
        </Panel>
      ) : (
        <div className="cx-stagger grid gap-3 lg:grid-cols-12">
          {/* Ad spend — dominant */}
          <Panel className="lg:col-span-7">
            <Label>Ad spend</Label>
            <div className="mt-3 flex items-baseline gap-3">
              <p className="text-5xl font-semibold tracking-tight">
                <AnimatedNumber value={spend} format="currency" currency={cur} />
              </p>
              <span className="font-mono text-sm tabular-nums text-pos">{roas.toFixed(2)}× ROAS</span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
              {fmtCurrency(convVal, cur)} attributed · {fmtInt(conv)} conversions
            </p>
            <div className="mt-5">
              <TrendExplorer
                data={daily.map((d) => ({
                  x: d.d,
                  spend: d.spend,
                  convVal: d.convVal,
                  roas: d.spend ? d.convVal / d.spend : 0,
                }))}
                metrics={[
                  {
                    key: 'spend',
                    label: 'Spend',
                    format: 'currency',
                    context: [
                      { key: 'convVal', label: 'Attributed', format: 'currency' },
                      { key: 'roas', label: 'ROAS', format: 'multiple' },
                    ],
                  },
                  {
                    key: 'convVal',
                    label: 'Attributed revenue',
                    format: 'currency',
                    context: [{ key: 'roas', label: 'ROAS', format: 'multiple' }],
                  },
                ]}
                currency={cur}
                height={190}
              />
            </div>
          </Panel>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            <Stat label="ROAS" value={`${roas.toFixed(2)}×`} sub={`${fmtCurrency(convVal, cur)} revenue`} />
            <Stat label="Impressions" value={fmtCompact(impr)} sub={`${fmtCompact(n(sum?.reach))} reach`} />
            <Stat label="Clicks" value={fmtCompact(clicks)} sub={`CTR ${ctr.toFixed(2)}%`} />
            <Stat label="Cost per click" value={fmtCurrency(cpc, cur)} sub={`${fmtInt(conv)} conversions`} />
          </div>

          {/* Spend by campaign */}
          <Panel className="lg:col-span-7">
            <Label>Campaigns by spend</Label>
            <ul className="mt-4 space-y-2.5">
              {campaigns.map((c) => (
                <BarRow
                  key={c.name}
                  label={c.name}
                  value={`${fmtCurrency(c.spend, cur)} · ${c.spend ? (c.convVal / c.spend).toFixed(1) : '0'}×`}
                  pct={(c.spend / maxCampSpend) * 100}
                  title={`${c.name} — ${fmtInt(c.conv)} conversions`}
                />
              ))}
            </ul>
          </Panel>

          {/* Efficiency summary */}
          <Panel className="lg:col-span-5">
            <Label>Efficiency</Label>
            <div className="mt-4 space-y-4">
              <div className="flex items-baseline justify-between border-b border-border pb-3">
                <span className="text-sm text-muted-foreground">Click-through rate</span>
                <span className="text-lg font-medium tabular-nums">{ctr.toFixed(2)}%</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-border pb-3">
                <span className="text-sm text-muted-foreground">Cost per conversion</span>
                <span className="text-lg font-medium tabular-nums">{fmtCurrency(conv ? spend / conv : 0, cur)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Return on ad spend</span>
                <span className="text-lg font-medium tabular-nums text-pos">{roas.toFixed(2)}×</span>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
