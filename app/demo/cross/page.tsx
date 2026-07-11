// 데모 · 크로스플랫폼 — 서로 다른 채널 지표를 하나의 흐름으로.
// 스케일이 다른 지표는 지수화(첫 주 평균=100)로 한 축에서 비교한다(이중축 금지).

import { Label, Panel } from '@/components/dashboard/ui'
import { TimeSeriesChart } from '@/components/charts/time-series-chart'
import { StackBar } from '@/components/charts/stack-bar'
import { InsightCard } from '@/components/demo/insight-card'
import { fmtCurrency } from '@/lib/format'
import { demoDays, demoIndexed, demoChannelMix, demoChannelEfficiency, demoInsights } from '@/lib/demo/data'

export default function DemoCrossPage() {
  return (
    <div className="cx-stagger grid gap-3 lg:grid-cols-12">
      {/* 지수 비교 — 콘텐츠 → 방문 → 매출 */}
      <Panel className="lg:col-span-12">
        <Label>콘텐츠 → 방문 → 매출 · 같은 눈금으로 보기</Label>
        <p className="mt-1.5 mb-4 max-w-[52em] text-sm text-muted-foreground">
          도달·방문·매출은 단위가 달라 그대로 겹칠 수 없어요. 7일 평균 흐름을 첫 주 = 100으로 맞춰 보면 —
          인스타가 잘 되는 주에 방문이 같이 오르고, 매출이 뒤따라와요. 레전드를 눌러 하나씩 꺼 보세요.
        </p>
        <TimeSeriesChart
          data={demoIndexed}
          series={[
            { key: 'igReach', label: '인스타 도달', color: 'var(--ch-instagram)' },
            { key: 'sessions', label: '사이트 방문', color: 'var(--ch-naver)' },
            { key: 'revenue', label: '매출', color: 'var(--cx-chart-line)' },
          ]}
          format="int"
          height={220}
          ariaLabel="인스타 도달, 사이트 방문, 매출 지수 비교 (첫 주 평균=100)"
        />
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">지수 · 7일 이동평균 · 첫 주 = 100</p>
      </Panel>

      {/* 광고비 vs 광고가 만든 매출 */}
      <Panel className="lg:col-span-7">
        <Label>광고비가 매출로 돌아오기까지</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">
          5월 말 캠페인 기간에 광고비를 올리자 광고가 만든 매출이 함께 올라왔어요. 두 선의 간격이 곧 남는 돈이에요.
        </p>
        <TimeSeriesChart
          data={demoDays.map((d) => ({ x: d.x, adConvVal: d.adConvVal, adSpend: d.adSpend }))}
          series={[
            { key: 'adConvVal', label: '광고가 만든 매출', color: 'var(--cx-chart-line)' },
            { key: 'adSpend', label: '광고비', color: 'var(--ch-meta)' },
          ]}
          format="currency"
          currency="KRW"
          height={190}
        />
      </Panel>

      {/* 채널 효율 비교 */}
      <Panel className="lg:col-span-5">
        <Label>채널별 효율 한눈에</Label>
        <div className="mt-4 space-y-3.5">
          {demoChannelEfficiency.map((e) => (
            <div key={`${e.channel}-${e.note}`} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm">{e.channel}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{e.note}</p>
              </div>
              <p className="shrink-0 text-lg font-medium tabular-nums">{e.value}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* 어트리뷰션 구성 */}
      <Panel className="lg:col-span-5">
        <Label>매출 기여 · 채널 구성</Label>
        <p className="mt-1.5 mb-4 text-sm text-muted-foreground">주문 직전 접점 기준이에요.</p>
        <StackBar parts={demoChannelMix} format={(v) => fmtCurrency(v, 'KRW')} />
      </Panel>

      {/* 크로스 인사이트 2장 */}
      <InsightCard insight={demoInsights[0]} className="lg:col-span-4" />
      <InsightCard insight={demoInsights[3]} className="lg:col-span-3" />
    </div>
  )
}
