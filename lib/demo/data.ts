// Deterministic sample tenant for /demo (master plan 4.6.4).
// One seeded pass generates 90 days of CROSS-CORRELATED channel data — the
// correlations ARE the product story: an influencer collab and an organic reel
// each spike reach → sessions → next-day revenue; a Meta campaign + a referral
// blast lift orders; weekends dip. Every aggregate below is derived from the
// same daily series so the numbers tie out across tabs.
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

// Named events, each landing on a real revenue peak (see build()).
const EV_INFLUENCER = 35 // @seoyeon.beauty collab (reach spike)
const EV_REFERRAL = 52 // SUMMER20 code blast
const EV_CAMPAIGN_START = 66 // Summer Prep campaign window 66–76
const EV_REEL = 71 // organic "one-serum routine" reel

const VIRAL_DAYS = new Set([EV_INFLUENCER, EV_REEL])
const PROMO_DAYS = new Set([EV_REFERRAL])
const CAMPAIGN_SPIKE = (i: number) => (i >= EV_CAMPAIGN_START && i <= 76 ? 1.65 : 1)
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
    let orders = Math.round(sessions * cvr)
    if (PROMO_DAYS.has(i)) orders = Math.round(orders * 1.45) // referral blast
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

// last 30d vs previous 30d — the deltas shown on the overview tab
const rev30 = sumRange('revenue', 60, 90)
const rev30prev = sumRange('revenue', 30, 60)

// ── Follower time series (Audience tab) — grows daily, jumps on viral days ──
export type FollowerDay = { x: string; followers: number; gained: number }
export const demoFollowerSeries: FollowerDay[] = (() => {
  let followers = 18_900
  return demoDays.map((d, i) => {
    const dow = dateOf(i).getUTCDay()
    const base = 42 * (dow === 0 || dow === 6 ? 0.7 : 1) * noise(0.4)
    const viral = VIRAL_DAYS.has(i) ? 820 : 0
    const campaign = CAMPAIGN_SPIKE(i) > 1 ? 55 : 0
    const gained = Math.round(base + viral + campaign)
    followers += gained
    return { x: d.x, followers, gained }
  })
})()
const followersEnd = demoFollowerSeries[demoFollowerSeries.length - 1].followers
const followers30Ago = demoFollowerSeries[demoFollowerSeries.length - 31].followers

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
  followers: followersEnd,
  followersDelta: ((followersEnd - followers30Ago) / followers30Ago) * 100,
  cac: adSpend / (orders * 0.63),
}

// ── Revenue attribution (last touch) ─────────────────────────────────────
export const demoChannelMix = [
  { key: 'meta', label: 'Meta ads', value: Math.round(revenue * 0.38), color: 'var(--ch-meta)' },
  { key: 'search', label: 'Search', value: Math.round(revenue * 0.22), color: 'var(--ch-naver)' },
  { key: 'instagram', label: 'Instagram', value: Math.round(revenue * 0.17), color: 'var(--ch-instagram)' },
  { key: 'direct', label: 'Direct', value: Math.round(revenue * 0.15), color: 'var(--ch-youtube)' },
  { key: 'etc', label: 'Other', value: Math.round(revenue * 0.08), color: 'var(--cx-dim)' },
]

// ── Sales tab: revenue stacked by product, over time ─────────────────────
// The stacked area is THE store-revenue-by-product view. Shares shift with
// events: the serum jumps on reel/collab days, sunscreen rises in the summer
// campaign — so the composition itself tells a story.
export const demoProductBands = [
  { key: 'serum', label: 'Glow Serum', color: 'var(--ch-shopify)' },
  { key: 'cream', label: 'Hydra Cream', color: 'var(--ch-meta)' },
  { key: 'sun', label: 'Sunscreen', color: 'var(--ch-youtube)' },
  { key: 'cleanser', label: 'Cleansing Foam', color: 'var(--ch-naver)' },
  { key: 'other', label: 'Other', color: 'var(--cx-dim)' },
] as const

export type ProductStackRow = { x: string } & Record<'serum' | 'cream' | 'sun' | 'cleanser' | 'other', number>
export const demoProductStack: ProductStackRow[] = demoDays.map((d, i) => {
  let w = { serum: 0.24, cream: 0.18, sun: 0.15, cleanser: 0.11, other: 0.32 }
  if (VIRAL_DAYS.has(i)) w = { ...w, serum: w.serum + 0.12, other: w.other - 0.12 } // reel/collab featured the serum
  if (CAMPAIGN_SPIKE(i) > 1) w = { ...w, sun: w.sun + 0.09, other: w.other - 0.09 } // summer → sunscreen
  const total = w.serum + w.cream + w.sun + w.cleanser + w.other
  const alloc = (share: number) => Math.round((d.revenue * share) / total)
  return {
    x: d.x,
    serum: alloc(w.serum),
    cream: alloc(w.cream),
    sun: alloc(w.sun),
    cleanser: alloc(w.cleanser),
    other: alloc(w.other),
  }
})

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

// ── Moments tab: peak detection + attributed cause ───────────────────────
// A 7-day trailing baseline; each named event's lift is DERIVED from the peak
// revenue around its day vs that baseline — not hardcoded.
const trailingBaseline = (i: number) => {
  const from = Math.max(0, i - 7)
  const win = demoDays.slice(from, Math.max(from + 1, i)) // days before i
  return win.reduce((a, d) => a + d.revenue, 0) / win.length
}
const peakLift = (day: number) => {
  const peak = Math.max(demoDays[day].revenue, demoDays[Math.min(DAYS - 1, day + 1)].revenue)
  return (peak / trailingBaseline(day) - 1) * 100
}

export type MomentKind = 'content' | 'ad' | 'influencer' | 'referral'
export type DemoMoment = {
  day: number
  x: string
  kind: MomentKind
  title: string
  detail: string
  liftPct: number
  metric: string
}
const MOMENT_DEFS: Omit<DemoMoment, 'x' | 'liftPct'>[] = [
  {
    day: EV_REEL,
    kind: 'content',
    title: 'Instagram reel went viral',
    detail: '“One-serum morning routine” — organic, no spend behind it',
    metric: 'Reach 96,400 · +8,120 likes',
  },
  {
    day: EV_INFLUENCER,
    kind: 'influencer',
    title: '@seoyeon.beauty collab posted',
    detail: 'Mega creator (1.24M) with code SEO15',
    metric: '412 orders from the code',
  },
  {
    day: EV_CAMPAIGN_START,
    kind: 'ad',
    title: 'Summer Prep campaign launched',
    detail: 'Five Meta campaigns, budget raised 65%',
    metric: `${Math.round(sumRange('adSpend', 66, 77) / 1000)}K spend over 10 days`,
  },
  {
    day: EV_REFERRAL,
    kind: 'referral',
    title: 'SUMMER20 code blast',
    detail: 'Email + SMS to the 40K subscriber list',
    metric: '1,840 redemptions',
  },
]
export const demoMoments: DemoMoment[] = MOMENT_DEFS.map((m) => ({
  ...m,
  x: demoDays[m.day].x,
  liftPct: peakLift(m.day),
})).sort((a, b) => b.liftPct - a.liftPct)

// Event markers for the annotated revenue chart (Moments tab).
export const demoEventMarkers = demoMoments.map((m) => ({ x: m.x, kind: m.kind, label: momentShort(m.kind) }))
function momentShort(kind: MomentKind): string {
  return kind === 'content' ? 'Reel' : kind === 'influencer' ? 'Collab' : kind === 'ad' ? 'Campaign' : 'Code'
}

// ── Marketing tab ────────────────────────────────────────────────────────
export const demoCampaigns = [
  { name: 'Summer Prep Sale', spend: Math.round(adSpend * 0.34), roas: 3.9 },
  { name: 'Serum Review Retargeting', spend: Math.round(adSpend * 0.24), roas: 4.6 },
  { name: 'New Customer Welcome', spend: Math.round(adSpend * 0.18), roas: 2.8 },
  { name: 'Brand Awareness (Reels)', spend: Math.round(adSpend * 0.15), roas: 1.9 },
  { name: 'Cart Reminder', spend: Math.round(adSpend * 0.09), roas: 5.2 },
].map((c) => ({ ...c, convVal: Math.round(c.spend * c.roas) }))

// Influencers — tier vs ROI is the story: micro creators return more per dollar.
export type Influencer = {
  handle: string
  tier: 'Mega' | 'Macro' | 'Micro'
  followers: number
  code: string
  orders: number
  revenue: number
  roi: number
  engagement: number
}
const INFLUENCERS: Omit<Influencer, 'revenue'>[] = [
  { handle: '@seoyeon.beauty', tier: 'Mega', followers: 1_240_000, code: 'SEO15', orders: 412, roi: 6.2, engagement: 2.1 },
  { handle: '@jiwoo_skincare', tier: 'Macro', followers: 318_000, code: 'JIWOO', orders: 286, roi: 8.1, engagement: 3.4 },
  { handle: '@minji.glow', tier: 'Micro', followers: 47_800, code: 'MINJI', orders: 174, roi: 11.4, engagement: 6.8 },
  { handle: '@k.beautyhaul', tier: 'Micro', followers: 62_100, code: 'HAUL', orders: 143, roi: 9.0, engagement: 5.9 },
  { handle: '@dermdiary', tier: 'Macro', followers: 208_000, code: 'DERM10', orders: 61, roi: 2.1, engagement: 1.4 },
]
export const demoInfluencers: Influencer[] = INFLUENCERS.map((v) => ({ ...v, revenue: Math.round(v.orders * 74) }))

// Referral / discount codes — broader than influencer codes.
export type ReferralCode = { code: string; kind: 'Promotion' | 'Influencer' | 'Lifecycle' | 'Loyalty'; redemptions: number; discountPct: number; revenue: number }
const REFERRAL_CODES: Omit<ReferralCode, 'revenue'>[] = [
  { code: 'SUMMER20', kind: 'Promotion', redemptions: 1_840, discountPct: 20 },
  { code: 'WELCOME10', kind: 'Lifecycle', redemptions: 1_290, discountPct: 10 },
  { code: 'SEO15', kind: 'Influencer', redemptions: 412, discountPct: 15 },
  { code: 'JIWOO', kind: 'Influencer', redemptions: 286, discountPct: 15 },
  { code: 'VIP25', kind: 'Loyalty', redemptions: 214, discountPct: 25 },
  { code: 'MINJI', kind: 'Influencer', redemptions: 174, discountPct: 15 },
]
// net revenue after the code's own discount, on an $84 pre-discount basket
export const demoReferralCodes: ReferralCode[] = REFERRAL_CODES.map((c) => ({
  ...c,
  revenue: Math.round(c.redemptions * 84 * (1 - c.discountPct / 100)),
}))

// Promotions / events timeline — "what was popular".
export type Promotion = { name: string; period: string; kind: 'Sitewide' | 'Code' | 'Influencer' | 'Bundle'; revenue: number; liftPct: number }
export const demoPromotions: Promotion[] = [
  { name: 'Summer Prep Sale', period: 'Jun 17–27', kind: 'Sitewide', revenue: Math.round(revenue * 0.19), liftPct: 42 },
  { name: 'SUMMER20 code drop', period: 'Jun 3', kind: 'Code', revenue: Math.round(revenue * 0.09), liftPct: 28 },
  { name: '@seoyeon collab', period: 'May 17', kind: 'Influencer', revenue: Math.round(revenue * 0.06), liftPct: 34 },
  { name: 'Serum + Cream bundle', period: 'Jun 1–30', kind: 'Bundle', revenue: Math.round(revenue * 0.07), liftPct: 12 },
]

export const demoGa4Sources = [
  { source: 'Meta ads', sessions: Math.round(sessions * 0.31), cvr: 2.4 },
  { source: 'Naver search', sessions: Math.round(sessions * 0.19), cvr: 2.9 },
  { source: 'Instagram', sessions: Math.round(sessions * 0.17), cvr: 1.6 },
  { source: 'Google search', sessions: Math.round(sessions * 0.12), cvr: 2.6 },
  { source: 'Direct', sessions: Math.round(sessions * 0.14), cvr: 3.4 },
  { source: 'Other', sessions: Math.round(sessions * 0.07), cvr: 1.1 },
]

// ── Audience tab: demographics ───────────────────────────────────────────
// Who BUYS (customers) — a beauty brand skews young + female + metro.
export const demoCustomerAge = [
  { bucket: '18–24', pct: 22 },
  { bucket: '25–34', pct: 41 },
  { bucket: '35–44', pct: 24 },
  { bucket: '45–54', pct: 9 },
  { bucket: '55+', pct: 4 },
]
export const demoCustomerGender = [
  { label: 'Female', pct: 78, color: 'var(--ch-instagram)' },
  { label: 'Male', pct: 19, color: 'var(--ch-meta)' },
  { label: 'Undisclosed', pct: 3, color: 'var(--cx-dim)' },
]
export const demoCustomerRegions = [
  { region: 'Seoul', pct: 34 },
  { region: 'Gyeonggi', pct: 21 },
  { region: 'Busan', pct: 9 },
  { region: 'Incheon', pct: 7 },
  { region: 'Daegu', pct: 5 },
  { region: 'Other', pct: 24 },
]

// Who we REACH per channel (audience) — differs from who buys. The gap is the
// insight: Instagram reaches 18–24, but buyers skew 25–34.
export type ChannelDemo = { channel: string; topAge: string; female: number; note: string; ageDist: number[] }
// ageDist columns: 18–24, 25–34, 35–44, 45+
export const demoChannelDemographics: ChannelDemo[] = [
  { channel: 'Instagram', topAge: '18–24', female: 84, note: 'youngest, most female', ageDist: [44, 34, 15, 7] },
  { channel: 'Meta ads', topAge: '25–34', female: 71, note: 'broad reach', ageDist: [24, 38, 26, 12] },
  { channel: 'Naver search', topAge: '35–44', female: 66, note: 'oldest, high intent', ageDist: [14, 30, 34, 22] },
]
export const demoAgeCols = ['18–24', '25–34', '35–44', '45+']

// ── Retention tab ────────────────────────────────────────────────────────
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

// ── Cross insights kept for Overview ─────────────────────────────────────
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
    kind: 'opportunity',
    title: 'Micro creators beat your mega collab',
    body: '@minji.glow (48K followers) returns 11× per dollar while your 1.2M-follower collab returns 6×. Shift budget toward micro creators.',
    evidence: 'Micro 11.4× vs mega 6.2× ROI',
  },
  {
    kind: 'watch',
    title: '“Brand Awareness (Reels)” is wearing out',
    body: 'The same creative keeps getting shown and clicks are fading. Time to rotate in fresh creative.',
    evidence: 'Clicks per impression −34% in 2 weeks · 1.9× return',
  },
  {
    kind: 'note',
    title: 'Weekends bring visitors, not buyers',
    body: 'Weekend conversion runs 15% below weekdays. Try shifting more ad budget into weekday evenings.',
    evidence: 'Weekday 2.1% vs weekend 1.8% · orders peak 9–11 PM',
  },
]

export const demoBrand = {
  name: 'Glowlab (sample)',
  note: 'This is a fictional beauty brand with sample data. Connect your channels to see it with your own numbers.',
}
