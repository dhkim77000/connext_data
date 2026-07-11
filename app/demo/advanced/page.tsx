// 데모 · 어드밴스드 — 코호트 리텐션, RFM 세그먼트, 요일×시간 패턴, 재구매 주기, LTV.

import { Label, Panel, BarRow } from '@/components/dashboard/ui'
import { TimeSeriesChart } from '@/components/charts/time-series-chart'
import { Heatmap } from '@/components/charts/heatmap'
import { CohortGrid } from '@/components/demo/cohort-grid'
import { InsightCard } from '@/components/demo/insight-card'
import { fmtCurrency, fmtInt } from '@/lib/format'
import { demoCohorts, demoRfm, demoWeekHour, demoRepurchaseGaps, demoLtvCurve, demoInsights } from '@/lib/demo/data'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? `${h}시` : null))

export default function DemoAdvancedPage() {
  const maxRfm = Math.max(...demoRfm.map((r) => r.customers), 1)
  const maxGap = Math.max(...demoRepurchaseGaps.map((g) => g.customers), 1)

  return (
    <div className="cx-stagger grid gap-3 lg:grid-cols-12">
      {/* 코호트 리텐션 */}
      <Panel className="lg:col-span-7">
        <Label>재구매 유지율 · 첫 구매 월 기준</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          최근에 들어온 고객일수록 더 오래 남아요 — 제품이 좋아지고 있다는 신호예요.
        </p>
        <CohortGrid cohorts={demoCohorts} />
      </Panel>

      {/* RFM 세그먼트 */}
      <Panel className="lg:col-span-5">
        <Label>고객 세그먼트</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">최근성·빈도·금액으로 자동 분류했어요.</p>
        <ul className="space-y-2.5">
          {demoRfm.map((r) => (
            <BarRow
              key={r.segment}
              label={r.segment}
              value={`${fmtInt(r.customers)}명 · 매출 ${r.revenueShare}%`}
              pct={(r.customers / maxRfm) * 100}
              title={r.desc}
            />
          ))}
        </ul>
      </Panel>

      {/* 요일×시간 히트맵 */}
      <Panel className="lg:col-span-7">
        <Label>주문이 몰리는 시간</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          평일 밤 9–11시가 피크예요. 광고와 알림을 이 시간에 맞추면 효율이 올라가요.
        </p>
        <Heatmap values={demoWeekHour} rowLabels={DOW} colLabels={HOUR_LABELS} unit="주문" />
      </Panel>

      {/* 재구매 주기 */}
      <Panel className="lg:col-span-5">
        <Label>재구매까지 걸리는 시간</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">두 번째 구매 고객 기준이에요.</p>
        <ul className="space-y-2.5">
          {demoRepurchaseGaps.map((g) => (
            <BarRow
              key={g.bucket}
              label={g.bucket}
              value={`${fmtInt(g.customers)}명`}
              pct={(g.customers / maxGap) * 100}
            />
          ))}
        </ul>
        <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
          평균 47일 — 이 주기가 지난 고객에게 다시 말을 걸 타이밍이에요.
        </p>
      </Panel>

      {/* LTV 곡선 */}
      <Panel className="lg:col-span-7">
        <Label>고객 한 명의 누적 가치</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          첫 구매 후 시간이 지나며 고객 한 명이 만들어 주는 매출이에요. 6개월이면{' '}
          {fmtCurrency(demoLtvCurve[5].ltv, 'KRW')}까지 자라요.
        </p>
        <TimeSeriesChart
          data={demoLtvCurve}
          series={[{ key: 'ltv', label: '누적 가치' }]}
          format="currency"
          currency="KRW"
          height={170}
          ariaLabel="고객 생애 가치 누적 곡선"
        />
      </Panel>

      {/* 재구매 인사이트 */}
      <InsightCard insight={demoInsights[2]} className="lg:col-span-5" />
    </div>
  )
}
