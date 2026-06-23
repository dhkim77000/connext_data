import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

const CHANNELS = [
  { name: 'Shopify', value: '₩182M', color: 'var(--ch-shopify)' },
  { name: 'Meta', value: '₩96M', color: 'var(--ch-meta)' },
  { name: 'YouTube', value: '₩42M', color: 'var(--ch-youtube)' },
  { name: 'TikTok', value: '₩33M', color: 'var(--ch-tiktok)' },
  { name: 'Naver', value: '₩78M', color: 'var(--ch-naver)' },
]

const KPIS = [
  { label: '총 매출 · 7D', value: '₩431.0M', delta: '▲ 9.2%', spark: '2,12 12,10 22,11 32,6 42,4 48,3' },
  { label: '평균 ROAS', value: '3.9x', delta: '▲ 0.3', spark: '2,9 12,10 22,8 32,7 42,6 48,5' },
  { label: '전환', value: '12,480', delta: '▲ 6.1%', spark: '2,11 12,9 22,10 32,7 42,6 48,4' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <div className="font-display text-[19px] font-extrabold tracking-tight">
            CONNEXT<span className="text-cx-accent">.</span>
          </div>
          <nav className="hidden items-center gap-6 font-mono text-xs text-muted-foreground md:flex">
            <a href="#" className="hover:text-foreground transition-colors">채널</a>
            <a href="#" className="hover:text-foreground transition-colors">대시보드</a>
            <a href="#" className="hover:text-foreground transition-colors">가격</a>
            <a href="#" className="hover:text-foreground transition-colors">문서</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link href="/login" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
              로그인
            </Link>
            <Link
              href="/signup"
              className="bg-primary px-3 py-2 font-mono text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              시작하기
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-16 pb-8">
        <p className="mb-4 font-mono text-xs tracking-[0.12em] text-cx-accent">[ 실시간 · 7개 채널 · 1개 대시보드 ]</p>
        <h1 className="max-w-[18ch] font-sans text-[clamp(34px,6vw,56px)] font-extrabold leading-[1.05] tracking-[-0.025em]">
          흩어진 채널 데이터를,
          <br />
          <span className="text-cx-accent">실시간 대시보드</span>로.
        </h1>
        <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
          Shopify · Meta · YouTube · TikTok · Naver의 매출·광고·전환을 자동으로 수집해 한 화면에서 추적합니다. 코딩 없이.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="bg-primary px-5 py-3 font-sans text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            무료로 연결하기 →
          </Link>
          <a href="#demo" className="border border-border px-5 py-3 font-sans text-sm transition-colors hover:bg-secondary">
            라이브 데모
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">채널별 매출 · 최근 7일</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-cx-accent">
                <span className="size-1.5 rounded-full bg-cx-accent animate-pulse" />
                LIVE 14:32:07
              </span>
            </div>
            <div className="flex border border-border font-mono text-[11px]">
              <span className="bg-secondary px-2.5 py-1 text-foreground">7D</span>
              <span className="px-2.5 py-1 text-muted-foreground">30D</span>
              <span className="px-2.5 py-1 text-muted-foreground">90D</span>
            </div>
          </div>

          <div className="px-3 pt-3">
            <svg className="block w-full" style={{ height: 210 }} viewBox="0 0 600 178" preserveAspectRatio="none" fill="none">
              {[14, 48, 82, 116].map((y) => (
                <line key={y} x1="46" y1={y} x2="590" y2={y} style={{ stroke: 'var(--cx-grid)' }} strokeWidth="1" />
              ))}
              <line x1="46" y1="150" x2="590" y2="150" style={{ stroke: 'var(--border)' }} strokeWidth="1" />
              <polygon
                points="46,75 136,63 226,68 317,48 407,38 498,33 588,26 588,150 46,150"
                style={{ fill: 'var(--cx-accent)', fillOpacity: 0.12 }}
              />
              <polyline points="46,85 136,89 226,83 317,90 407,93 498,89 588,85" style={{ stroke: 'var(--ch-meta)' }} strokeWidth="1.5" />
              <polyline points="46,130 136,127 226,124 317,126 407,123 498,122 588,121" style={{ stroke: 'var(--ch-youtube)' }} strokeWidth="1.5" />
              <polyline points="46,142 136,140 226,138 317,135 407,132 498,130 588,128" style={{ stroke: 'var(--ch-tiktok)' }} strokeWidth="1.5" />
              <polyline points="46,102 136,101 226,100 317,102 407,99 498,98 588,98" style={{ stroke: 'var(--ch-naver)' }} strokeWidth="1.5" />
              <polyline points="46,75 136,63 226,68 317,48 407,38 498,33 588,26" style={{ stroke: 'var(--cx-accent)' }} strokeWidth="2.4" />
              <line x1="588" y1="14" x2="588" y2="150" style={{ stroke: 'var(--cx-accent)' }} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
              <circle cx="588" cy="26" r="3.5" style={{ fill: 'var(--cx-accent)' }} />
            </svg>
            <svg className="block w-full" style={{ height: 18 }} viewBox="0 0 600 16" fill="none">
              <text x="46" y="11" style={{ fill: 'var(--cx-dim)' }} fontFamily="var(--font-mono)" fontSize="11">06-17</text>
              <text x="317" y="11" textAnchor="middle" style={{ fill: 'var(--cx-dim)' }} fontFamily="var(--font-mono)" fontSize="11">06-20</text>
              <text x="590" y="11" textAnchor="end" style={{ fill: 'var(--cx-dim)' }} fontFamily="var(--font-mono)" fontSize="11">06-23</text>
            </svg>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border px-4 py-3">
            {CHANNELS.map((c) => (
              <span key={c.name} className="inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="size-2" style={{ background: c.color }} />
                {c.name} <b className="font-medium text-foreground">{c.value}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {KPIS.map((k) => (
            <div key={k.label} className="border border-border bg-card p-3.5">
              <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="font-mono text-xl font-semibold tabular-nums">{k.value}</p>
              <p className="mt-1.5 flex items-center justify-between font-mono text-[11px]">
                <span style={{ color: 'var(--pos)' }}>{k.delta}</span>
                <svg width="50" height="15" fill="none">
                  <polyline points={k.spark} style={{ stroke: 'var(--cx-accent)' }} strokeWidth="1.3" />
                </svg>
              </p>
            </div>
          ))}
          <div className="border border-border bg-card p-3.5">
            <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">동기화 상태</p>
            <p className="font-mono text-xl font-semibold tabular-nums">7/7</p>
            <p className="mt-1.5 flex items-center justify-between font-mono text-[11px]">
              <span style={{ color: 'var(--pos)' }}>실시간 ●</span>
              <span className="text-cx-dim">14:32</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
