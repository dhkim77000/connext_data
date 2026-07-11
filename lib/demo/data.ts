// Deterministic sample tenant for /demo (master plan 4.6.4).
// One seeded pass generates 90 days of CROSS-CORRELATED channel data — the
// correlations ARE the product story: an Instagram viral post lifts GA4
// sessions the same day and revenue a day later; a Meta campaign spike lifts
// orders; weekends dip. Every aggregate below is derived from the same daily
// series so the numbers tie out across tabs.
//
// No Math.random — mulberry32 with a fixed seed keeps builds reproducible.
// NOTE: the PRNG is consumed in module order; inserting a rand() call upstream
// shifts every downstream number (harmless for a fixture, but be aware).

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260711)
const noise = (spread: number) => 1 + (rand() * 2 - 1) * spread

const DAYS = 90
const START = Date.UTC(2026, 3, 12) // ends 2026-07-10 — "synced this morning"
const dateOf = (i: number) => new Date(START + i * 86_400_000)
const iso = (i: number) => dateOf(i).toISOString().slice(0, 10)

// weekday factors (D2C: weekday evenings strong, weekend dips)
const WF_REV = [0.78, 0.95, 1.0, 1.02, 1.05, 1.12, 0.85] // Sun..Sat
const WF_CVR = [0.86, 1.0, 1.02, 1.03, 1.04, 1.06, 0.9]

const VIRAL_DAYS = new Set([35, 71])
// Campaign sits inside the last-30-day window (mid-June) so the home delta reads
// as growth; creative fatigue follows right after the push.
const CAMPAIGN_SPIKE = (i: number) => (i >= 66 && i <= 76 ? 1.65 : 1) // Summer Prep campaign
const AD_FATIGUE = (i: number) => (i >= 80 && i <= 88 ? 0.74 : 1)

export type DemoDay = {
  x: string
  revenue: number
  orders: number
  sessions: number
  adSpend: number
  adConvVal: number
  igReach: number
}

function build(): DemoDay[] {
  const days: DemoDay[] = []
  let prevReach = 0
  for (let i = 0; i < DAYS; i++) {
    const dow = dateOf(i).getUTCDay()
    const trend = 1 + 0.22 * (i / (DAYS - 1))

    const igPostDay = dow === 1 || dow === 4 // Mon/Thu posting routine
    let igReach = igPostDay ? 8_500 * trend * noise(0.35) : 2_600 * trend * noise(0.3)
    if (VIRAL_DAYS.has(i)) igReach *= 6.5
    igReach = Math.round(igReach)

    const adSpend = Math.round(1_150 * trend * CAMPAIGN_SPIKE(i) * noise(0.12))
    const roasDay = 3.05 * AD_FATIGUE(i) * (CAMPAIGN_SPIKE(i) > 1 ? 1.18 : 1) * noise(0.1)
    const adConvVal = Math.round(adSpend * roasDay)

    // sessions: organic base + paid + social (viral bleeds into the next day)
    const sessions = Math.round(
      3_800 * trend * WF_REV[dow] * noise(0.1) + adSpend * 2.7 + igReach * 0.11 + prevReach * 0.06,
    )
    const cvr = 0.021 * WF_CVR[dow] * noise(0.08)
    const orders = Math.round(sessions * cvr)
    // $75 basket keeps blended CAC (~$15) and ROAS (~3×) in realistic D2C territory
    const aov = 75 * (dow === 0 || dow === 6 ? 1.05 : 1) * noise(0.06)
    const revenue = Math.round(orders * aov)

    days.push({ x: iso(i), revenue, orders, sessions, adSpend, adConvVal, igReach })
    prevReach = igReach
  }
  return days
}

export const demoDays = build()

const sum = (k: keyof DemoDay) => demoDays.reduce((a, d) => a + Number(d[k]), 0)
const sumRange = (k: keyof DemoDay, from: number, to: number) =>
  demoDays.slice(from, to).reduce((a, d) => a + Number(d[k]), 0)

const revenue = sum('revenue')
const orders = sum('orders')
const sessions = sum('sessions')
const adSpend = sum('adSpend')
const adConvVal = sum('adConvVal')

// last 30d vs previous 30d — the deltas shown on the home tab
const rev30 = sumRange('revenue', 60, 90)
const rev30prev = sumRange('revenue', 30, 60)

export const demoSummary = {
  currency: 'USD',
  revenue,
  orders,
  aov: revenue / orders,
  sessions,
  adSpend,
  adConvVal,
  roas: adConvVal / adSpend,
  cvr: (orders / sessions) * 100,
  rev30,
  rev30DeltaPct: ((rev30 - rev30prev) / rev30prev) * 100,
  // blended CAC: ad spend over new customers (63% of orders are first orders)
  newCustomers: Math.round(orders * 0.63),
  returningRate: 28.4,
  followers: 24_620,
  followersDelta: 6.8,
  cac: adSpend / (orders * 0.63),
}

// ── Home: revenue attribution (last touch) ───────────────────────────────
export const demoChannelMix = [
  { key: 'meta', label: 'Meta ads', value: Math.round(revenue * 0.38), color: 'var(--ch-meta)' },
  { key: 'search', label: 'Search', value: Math.round(revenue * 0.22), color: 'var(--ch-naver)' },
  { key: 'instagram', label: 'Instagram', value: Math.round(revenue * 0.17), color: 'var(--ch-instagram)' },
  { key: 'direct', label: 'Direct', value: Math.round(revenue * 0.15), color: 'var(--ch-youtube)' },
  { key: 'etc', label: 'Other', value: Math.round(revenue * 0.08), color: 'var(--cx-dim)' },
]

// ── Channels tab ─────────────────────────────────────────────────────────
export const demoProducts = [
  { title: 'Glow Serum 30ml', revenue: Math.round(revenue * 0.24), units: 5_840 },
  { title: 'Hydra Cream 50ml', revenue: Math.round(revenue * 0.18), units: 4_910 },
  { title: 'Sunscreen SPF50+', revenue: Math.round(revenue * 0.15), units: 4_480 },
  { title: 'Cleansing Foam 150ml', revenue: Math.round(revenue * 0.11), units: 3_620 },
  { title: 'Toner Pads (60)', revenue: Math.round(revenue * 0.1), units: 2_950 },
  { title: 'Lip Serum Tint', revenue: Math.round(revenue * 0.08), units: 2_710 },
  { title: 'Sheet Mask 10-pack', revenue: Math.round(revenue * 0.07), units: 2_360 },
  { title: 'Face Mist 120ml', revenue: Math.round(revenue * 0.04), units: 1_180 },
]

export const demoCampaigns = [
  { name: 'Summer Prep Sale', spend: Math.round(adSpend * 0.34), roas: 3.9 },
  { name: 'Serum Review Retargeting', spend: Math.round(adSpend * 0.24), roas: 4.6 },
  { name: 'New Customer Welcome', spend: Math.round(adSpend * 0.18), roas: 2.8 },
  { name: 'Brand Awareness (Reels)', spend: Math.round(adSpend * 0.15), roas: 1.9 },
  { name: 'Cart Reminder', spend: Math.round(adSpend * 0.09), roas: 5.2 },
].map((c) => ({ ...c, convVal: Math.round(c.spend * c.roas) }))

export const demoIgPosts = [
  { caption: '"One-serum morning routine" reel', type: 'Reel', reach: 96_400, likes: 8_120, comments: 342, date: 'Jun 22' },
  { caption: 'Hydra Cream ingredients explainer', type: 'Carousel', reach: 41_200, likes: 3_050, comments: 128, date: 'May 17' },
  { caption: 'Customer reviews roundup', type: 'Carousel', reach: 28_900, likes: 2_210, comments: 96, date: 'Jun 30' },
  { caption: 'Sunscreen white-cast test reel', type: 'Reel', reach: 24_100, likes: 1_890, comments: 84, date: 'Jun 9' },
  { caption: 'New product teaser', type: 'Photo', reach: 12_300, likes: 980, comments: 51, date: 'Jul 3' },
]

export const demoGa4Sources = [
  { source: 'Meta ads', sessions: Math.round(sessions * 0.31), cvr: 2.4 },
  { source: 'Naver search', sessions: Math.round(sessions * 0.19), cvr: 2.9 },
  { source: 'Instagram', sessions: Math.round(sessions * 0.17), cvr: 1.6 },
  { source: 'Google search', sessions: Math.round(sessions * 0.12), cvr: 2.6 },
  { source: 'Direct', sessions: Math.round(sessions * 0.14), cvr: 3.4 },
  { source: 'Other', sessions: Math.round(sessions * 0.07), cvr: 1.1 },
]

// ── Advanced tab ─────────────────────────────────────────────────────────
export const demoCohorts = [
  { label: 'Jan', values: [100, 31, 22, 17, 14, 12] },
  { label: 'Feb', values: [100, 33, 23, 18, 15] },
  { label: 'Mar', values: [100, 34, 25, 20] },
  { label: 'Apr', values: [100, 36, 27] },
  { label: 'May', values: [100, 38] },
  { label: 'Jun', values: [100] },
]

// Segment totals (≈10,800) stay consistent with ~7,700 new customers in 90d
// plus the existing customer pool — the story survives cross-tab comparison.
export const demoRfm = [
  { segment: 'VIP', desc: 'Recent, frequent, high spend', customers: 820, revenueShare: 31 },
  { segment: 'Loyal', desc: 'Steady repeat buyers', customers: 1_480, revenueShare: 27 },
  { segment: 'Promising', desc: 'On the edge of a second order', customers: 2_290, revenueShare: 18 },
  { segment: 'New', desc: 'First order within 30 days', customers: 2_890, revenueShare: 14 },
  { segment: 'At risk', desc: 'Past their repurchase window', customers: 1_170, revenueShare: 7 },
  { segment: 'Dormant', desc: 'No activity for 90+ days', customers: 2_140, revenueShare: 3 },
]

// Day-of-week × hour order heatmap — weekday-evening (9–11 PM) peak,
// secondary weekend-afternoon bump.
export const demoWeekHour: number[][] = Array.from({ length: 7 }, (_, dow) =>
  Array.from({ length: 24 }, (_, h) => {
    const evening = Math.exp(-((h - 21.5) ** 2) / 7)
    const lunch = Math.exp(-((h - 12.5) ** 2) / 5) * 0.45
    const weekendAfternoon = (dow === 0 || dow === 6 ? 1 : 0) * Math.exp(-((h - 15) ** 2) / 12) * 0.5
    const base = (evening + lunch + weekendAfternoon) * WF_REV[dow]
    return Math.round(base * 46 * noise(0.18))
  }),
)

export const demoRepurchaseGaps = [
  { bucket: 'Within 30 days', customers: 412 },
  { bucket: '31–60 days', customers: 779 },
  { bucket: '61–90 days', customers: 596 },
  { bucket: '91+ days', customers: 504 },
]

export const demoLtvCurve = Array.from({ length: 12 }, (_, m) => ({
  x: `Month ${m + 1}`,
  ltv: Math.round(75 + 140 * (1 - Math.exp(-(m + 1) / 4.6))),
}))

// ── Cross-platform: indexed comparison (7-day MA, first week = 100) — puts
// different scales on ONE axis. The moving average keeps the viral spike from
// crushing the axis (called out in the caption).
function indexSeries(pick: (d: DemoDay) => number): number[] {
  const ma = demoDays.map((_, i) => {
    const from = Math.max(0, i - 6)
    const win = demoDays.slice(from, i + 1)
    return win.reduce((a, d) => a + pick(d), 0) / win.length
  })
  const base = ma[6] || ma[0] || 1
  return ma.map((v) => Math.round((v / base) * 100))
}
const idxRevenue = indexSeries((d) => d.revenue)
const idxReach = indexSeries((d) => d.igReach)
const idxSessions = indexSeries((d) => d.sessions)

export const demoIndexed = demoDays.map((d, i) => ({
  x: d.x,
  revenue: idxRevenue[i],
  igReach: idxReach[i],
  sessions: idxSessions[i],
}))

export const demoChannelEfficiency = [
  { channel: 'Meta ads', value: `${(adConvVal / adSpend).toFixed(1)}×`, note: 'revenue per ad dollar' },
  { channel: 'Meta ads', value: '$0.32', note: 'cost per click' },
  { channel: 'Instagram', value: '4.2%', note: 'engagement per follower' },
  { channel: 'Search', value: '2.9%', note: 'orders per session' },
  { channel: 'Direct', value: '3.4%', note: 'mostly returning customers' },
]

// ── Insight cards (plain language — never raw correlation values, 3.6.4) ──
export type DemoInsight = {
  kind: 'opportunity' | 'watch' | 'note'
  title: string
  body: string
  evidence: string
}

export const demoInsights: DemoInsight[] = [
  {
    kind: 'opportunity',
    title: 'Instagram posts are driving sales',
    body: 'The day after the June 22 reel took off, revenue ran 31% above normal. It usually takes about a day for post engagement to turn into orders.',
    evidence: 'Reach 96,400 → next-day orders +38',
  },
  {
    kind: 'watch',
    title: '"Brand Awareness (Reels)" is wearing out',
    body: 'The same creative keeps getting shown and clicks are fading. Time to rotate in fresh creative.',
    evidence: 'Clicks per impression −34% in 2 weeks · 1.9× return',
  },
  {
    kind: 'opportunity',
    title: '214 customers are due to buy again',
    body: 'Their average repurchase window (47 days) has just come around. Reaching out now works best.',
    evidence: 'Same group last month: 22% repurchased',
  },
  {
    kind: 'note',
    title: 'Weekends bring visitors, not buyers',
    body: 'Weekend conversion runs 15% below weekdays. Try shifting more ad budget into weekday evenings.',
    evidence: 'Weekday 2.1% vs weekend 1.8% · orders peak 9–11 PM',
  },
  {
    kind: 'watch',
    title: 'Your bestseller has 6 days of stock left',
    body: 'At the current pace, Glow Serum 30ml sells out next week. Reorder now to avoid losing sales to a stockout.',
    evidence: '65 units/day · 390 units in stock',
  },
]

export const demoBrand = {
  name: 'Glowlab (sample)',
  note: 'This is a fictional beauty brand with sample data. Connect your channels to see it with your own numbers.',
}
