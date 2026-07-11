// 데모 · 채널 탭 — 같은 데이터가 채널별 시점으로 어떻게 보이는지.
// 섹션마다 채널 도트 + 히어로 + 트렌드/브레이크다운 2패널.

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
      <SectionHead dot="var(--ch-shopify)" name="Shopify" desc="자사몰 매출" />
      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <Label>매출 · 90일</Label>
          <p className="mt-3 text-4xl font-semibold tracking-tight">
            <AnimatedNumber value={s.revenue} format="currency" currency="KRW" />
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            주문 {fmtInt(s.orders)}건 · 평균 {fmtCurrency(s.aov, 'KRW')}
          </p>
          <div className="mt-5">
            <TrendExplorer
              data={demoDays.map((d) => ({ x: d.x, revenue: d.revenue, orders: d.orders }))}
              metrics={[
                { key: 'revenue', label: '매출', format: 'currency' },
                { key: 'orders', label: '주문', format: 'int' },
              ]}
              currency="KRW"
              height={170}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-5">
          <Label>많이 팔린 상품</Label>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <Th>상품</Th>
                <Th right>매출</Th>
                <Th right>판매</Th>
              </tr>
            </thead>
            <tbody>
              {demoProducts.slice(0, 6).map((p) => (
                <tr key={p.title} className="border-b border-border/60 last:border-0">
                  <td className="w-full max-w-0 truncate py-2 pr-3 text-sm" title={p.title}>{p.title}</td>
                  <td className="py-2 text-right text-sm tabular-nums">{fmtCurrency(p.revenue, 'KRW')}</td>
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
      <SectionHead dot="var(--ch-instagram)" name="Instagram" desc="오가닉 콘텐츠" />
      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-5">
          <Label>팔로워</Label>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-4xl font-semibold tracking-tight">
              <AnimatedNumber value={s.followers} format="int" />
            </p>
            <span className="font-mono text-sm tabular-nums text-pos">▲ {s.followersDelta}%</span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">90일 도달 {fmtCompact(igReachTotal)}</p>
          <div className="mt-5">
            <TrendExplorer
              data={demoDays.map((d) => ({ x: d.x, igReach: d.igReach }))}
              metrics={[{ key: 'igReach', label: '도달', format: 'compact' }]}
              height={150}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-7">
          <Label>반응 좋았던 게시물</Label>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <Th>게시물</Th>
                <Th>형식</Th>
                <Th right>도달</Th>
                <Th right>좋아요</Th>
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
      <SectionHead dot="var(--ch-meta)" name="Meta Ads" desc="유료 광고" />
      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <Label>광고비 · 90일</Label>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-4xl font-semibold tracking-tight">
              <AnimatedNumber value={s.adSpend} format="currency" currency="KRW" />
            </p>
            <span className="font-mono text-sm tabular-nums text-pos">{s.roas.toFixed(1)}× 회수</span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            광고로 만든 매출 {fmtCurrency(s.adConvVal, 'KRW')}
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
                  label: '광고비',
                  format: 'currency',
                  context: [{ key: 'roas', label: '광고비 대비 매출', format: 'multiple' }],
                },
                { key: 'adConvVal', label: '광고 매출', format: 'currency' },
              ]}
              currency="KRW"
              height={170}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-5">
          <Label>캠페인별 광고비</Label>
          <ul className="mt-4 space-y-2.5">
            {demoCampaigns.map((c) => (
              <BarRow
                key={c.name}
                label={c.name}
                value={`${fmtCurrency(c.spend, 'KRW')} · ${c.roas.toFixed(1)}×`}
                pct={(c.spend / maxCampaign) * 100}
                title={`${c.name} — 광고 매출 ${fmtCurrency(c.convVal, 'KRW')}`}
              />
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
            ‘브랜드 인지 (릴스)’는 회수율이 낮아요 — 인사이트 탭에서 이유를 확인하세요.
          </p>
        </Panel>
      </div>

      {/* ── GA4 ── */}
      <SectionHead dot="var(--ch-naver)" name="Google Analytics" desc="트래픽 · 전환" />
      <div className="cx-stagger grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <Label>방문 · 90일</Label>
          <div className="mt-3 flex items-baseline gap-3">
            <p className="text-4xl font-semibold tracking-tight">
              <AnimatedNumber value={s.sessions} format="compact" />
            </p>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">전환율 {s.cvr.toFixed(1)}%</span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">세션 기준 · 주문 {fmtInt(s.orders)}건</p>
          <div className="mt-5">
            <TrendExplorer
              data={demoDays.map((d) => ({ x: d.x, sessions: d.sessions }))}
              metrics={[{ key: 'sessions', label: '방문', format: 'compact' }]}
              height={170}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-5">
          <Label>어디서 들어왔나</Label>
          <ul className="mt-4 space-y-2.5">
            {demoGa4Sources.map((g) => (
              <BarRow
                key={g.source}
                label={g.source}
                value={`${fmtCompact(g.sessions)} · ${g.cvr}%`}
                pct={(g.sessions / maxSource) * 100}
                title={`${g.source} — 방문 ${fmtInt(g.sessions)} · 전환율 ${g.cvr}%`}
              />
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
            직접 방문의 전환율이 가장 높아요 — 재방문 고객의 힘이에요.
          </p>
        </Panel>
      </div>
    </>
  )
}
