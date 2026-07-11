import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

const CHANNELS = ['Shopify', 'Meta', 'YouTube', 'TikTok', 'Naver']

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="font-display text-[20px] font-semibold tracking-tight">
          Connext<span className="text-cx-accent">.</span>
        </div>
        <nav className="hidden items-center gap-7 font-mono text-[12.5px] text-muted-foreground md:flex">
          <a href="#" className="transition-colors hover:text-foreground">Channels</a>
          <Link href="/demo" className="transition-colors hover:text-foreground">Demo</Link>
          <a href="#" className="transition-colors hover:text-foreground">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/signup"
            className="rounded-full bg-primary px-4.5 py-2 font-sans text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-24 pb-12 text-center">
        <p className="mb-6 font-mono text-[12px] uppercase tracking-[0.16em] text-muted-foreground">
          Cross-platform data analytics
        </p>
        <h1 className="font-display text-[clamp(32px,5.5vw,52px)] font-medium leading-[1.12] tracking-[-0.02em]">
          Scattered channels,
          <br />
          <span
            style={{
              background: 'linear-gradient(transparent 66%, color-mix(in srgb, var(--cx-accent) 42%, transparent) 66%)',
            }}
          >
            one understanding
          </span>
          .
        </h1>
        <p className="mx-auto mt-6 max-w-[34em] font-sans text-[16px] font-light leading-[1.6] text-muted-foreground">
          Sales, ads, content and audience from Shopify · Meta · YouTube · TikTok · Naver in one place —
          with the flows and correlations read for you.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-primary px-7 py-3.5 font-sans text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start free
          </Link>
          <Link
            href="/demo"
            className="rounded-full border border-border px-6 py-3.5 font-sans text-[15px] transition-colors hover:bg-secondary"
          >
            Try the demo
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-28">
        <Link
          href="/demo"
          className="block rounded-2xl border border-border p-5 transition-colors hover:border-cx-accent/50"
          style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--cx-accent) 5%, transparent), transparent 55%)' }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11.5px] tracking-wide text-muted-foreground">Channel flows · sample preview</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-cx-accent">
              Try the demo →
            </span>
          </div>
          <svg className="block w-full" style={{ height: 150 }} viewBox="0 0 600 130" preserveAspectRatio="none" fill="none">
            <polygon
              points="10,86 110,74 210,78 310,54 410,46 510,32 590,24 590,120 10,120"
              style={{ fill: 'var(--cx-accent)', fillOpacity: 0.1 }}
            />
            <polyline points="10,100 110,98 210,96 310,94 410,92 510,90 590,88" style={{ stroke: 'var(--ch-meta)' }} strokeWidth="1.4" strokeOpacity="0.5" />
            <polyline points="10,110 110,108 210,106 310,107 410,105 510,104 590,103" style={{ stroke: 'var(--ch-naver)' }} strokeWidth="1.4" strokeOpacity="0.5" />
            <polyline points="10,86 110,74 210,78 310,54 410,46 510,32 590,24" style={{ stroke: 'var(--cx-accent)' }} strokeWidth="2.4" />
            <circle cx="590" cy="24" r="3.6" style={{ fill: 'var(--cx-accent)' }} />
          </svg>
          <div className="mt-4 flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <span key={c} className="rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted-foreground">
                {c}
              </span>
            ))}
          </div>
        </Link>
      </section>
    </main>
  )
}
