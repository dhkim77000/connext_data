// Display formatting for the dashboard. Round every number; group thousands; keep money
// to 2 decimals in the account currency. Compact form for large counts.
//
// Intl.NumberFormat construction is expensive (~50µs) and AnimatedNumber calls these
// once per rAF frame — formatters are cached per option-set at module level.

const formatters = new Map<string, Intl.NumberFormat>()

function getFormatter(key: string, make: () => Intl.NumberFormat): Intl.NumberFormat {
  let f = formatters.get(key)
  if (!f) {
    f = make()
    formatters.set(key, f)
  }
  return f
}

export function fmtCurrency(n: number, currency = 'USD'): string {
  const whole = n >= 100_000
  return getFormatter(`cur:${currency}:${whole}`, () =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: whole ? 0 : 2,
    }),
  ).format(n || 0)
}

export function fmtInt(n: number): string {
  return getFormatter('int', () => new Intl.NumberFormat('en-US')).format(Math.round(n || 0))
}

export function fmtCompact(n: number): string {
  return getFormatter('compact', () =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }),
  ).format(n || 0)
}

// Compact money for axis ticks ("$8.4M") — full precision stays in tooltips/tables.
export function fmtCompactCurrency(n: number, currency = 'USD'): string {
  return getFormatter(`curc:${currency}`, () =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }),
  ).format(n || 0)
}

// Short axis/tooltip date ("Jul 5"). Accepts "YYYY-MM-DD" or ISO datetimes.
const shortDateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
export function fmtShortDate(x: string): string {
  const d = new Date(x.includes('T') ? x : `${x}T00:00:00`)
  return Number.isNaN(d.getTime()) ? x : shortDateFmt.format(d)
}

// "2h ago" / "3d ago" style relative time for the freshness widget.
// ClickHouse returns DateTime as "2026-07-05 19:03:59" (space, no T, no tz) — normalise
// to ISO-UTC before parsing, or the Date is misread and the delta explodes.
export function fmtAgo(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return '—'
  let str = iso.trim()
  if (!str.includes('T')) str = str.replace(' ', 'T')
  if (!/[Z+]/.test(str.slice(10))) str += 'Z'
  const then = new Date(str).getTime()
  if (Number.isNaN(then)) return '—'
  const s = Math.max(0, Math.floor((nowMs - then) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
