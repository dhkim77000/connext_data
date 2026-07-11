// 데모 홈 — 4개 채널이 하나로 합쳐진 통합 뷰. 5도메인 스트립 → 매출 히어로 →
// 인사이트 카드 → 매출↔광고비 → 채널 기여.

import { Label, Panel, Stat } from '@/components/dashboard/ui'
import { TrendExplorer } from '@/components/charts/trend-explorer'
import { TimeSeriesChart } from '@/components/charts/time-series-chart'
import { AnimatedNumber } from '@/components/charts/animated-number'
import { StackBar } from '@/components/charts/stack-bar'
import { InsightCard } from '@/components/demo/insight-card'
import { fmtCurrency, fmtCompact, fmtInt } from '@/lib/format'
import { demoDays, demoSummary as s, demoChannelMix, demoInsights } from '@/lib/demo/data'

const DOMAINS = [
  { label: '커머스', value: fmtCurrency(s.revenue, 'KRW'), sub: `주문 ${fmtInt(s.orders)}건` },
  { label: '광고', value: `${s.roas.toFixed(1)}×`, sub: `광고비 ${fmtCurrency(s.adSpend, 'KRW')}` },
  { label: '오디언스', value: fmtCompact(s.followers), sub: `팔로워 +${s.followersDelta}%` },
  { label: '콘텐츠', value: fmtCompact(demoDays.reduce((a, d) => a + d.igReach, 0)), sub: '90일 도달' },
  { label: '전환', value: `${s.cvr.toFixed(1)}%`, sub: `세션 ${fmtCompact(s.sessions)}` },
]

export default function DemoHomePage() {
  return (
    <>
      {/* 5도메인 스트립 — 채널이 아니라 도메인으로 묶인 한 눈 요약 */}
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
        {/* 통합 매출 — 지배 패널 */}
        <Panel className="lg:col-span-7">
          <Label>최근 30일 매출 · 전체 채널</Label>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-5xl font-semibold tracking-tight">
              <AnimatedNumber value={s.rev30} format="currency" currency="KRW" />
            </p>
            <span className="font-mono text-sm tabular-nums text-pos">▲ {s.rev30DeltaPct.toFixed(1)}%</span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            지난 30일 대비 · 평균 주문 금액 {fmtCurrency(s.aov, 'KRW')}
          </p>
          <div className="mt-5">
            <TrendExplorer
              data={demoDays.map((d) => ({ x: d.x, revenue: d.revenue, orders: d.orders, sessions: d.sessions }))}
              metrics={[
                { key: 'revenue', label: '매출', format: 'currency' },
                { key: 'orders', label: '주문', format: 'int' },
                { key: 'sessions', label: '방문', format: 'compact' },
              ]}
              currency="KRW"
              height={190}
            />
          </div>
        </Panel>

        {/* 블렌디드 KPI */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-5">
          <Stat label="광고비 대비 매출" value={`${s.roas.toFixed(1)}×`} sub="모든 광고 채널 합산" />
          <Stat label="고객 모시는 비용" value={fmtCurrency(s.cac, 'KRW')} sub="신규 고객 1명당" />
          <Stat label="신규 고객" value={fmtInt(s.newCustomers)} sub="90일 누적" />
          <Stat label="재구매율" value={`${s.returningRate}%`} sub="구매 고객 기준" />
        </div>

        {/* 인사이트 — 데이터가 문장이 되는 순간 */}
        <div className="lg:col-span-12">
          <div className="mb-3 mt-2 flex items-center gap-4">
            <Label>이번 주 인사이트</Label>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {demoInsights.slice(0, 3).map((ins) => (
              <InsightCard key={ins.title} insight={ins} />
            ))}
          </div>
        </div>

        {/* 매출 ↔ 광고비 */}
        <Panel className="lg:col-span-7">
          <Label>매출과 광고비 · 함께 보기</Label>
          <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
            광고비를 올린 주에 매출이 어떻게 따라왔는지 한 축에서 비교해요.
          </p>
          <TimeSeriesChart
            data={demoDays.map((d) => ({ x: d.x, revenue: d.revenue, adSpend: d.adSpend }))}
            series={[
              { key: 'revenue', label: '매출', color: 'var(--cx-chart-line)' },
              { key: 'adSpend', label: '광고비', color: 'var(--ch-meta)' },
            ]}
            format="currency"
            currency="KRW"
            height={180}
          />
        </Panel>

        {/* 채널 기여 */}
        <Panel className="lg:col-span-5">
          <Label>어떤 채널이 매출을 만들었나</Label>
          <p className="mt-1.5 mb-4 text-sm text-muted-foreground">주문 직전 접점 기준으로 나눴어요.</p>
          <StackBar parts={demoChannelMix} format={(v) => fmtCurrency(v, 'KRW')} />
        </Panel>
      </div>
    </>
  )
}
