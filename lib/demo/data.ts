// Deterministic sample tenant for /demo (master plan 4.6.4).
// One seeded pass generates 90 days of CROSS-CORRELATED channel data — the
// correlations ARE the product story: an Instagram viral post lifts GA4
// sessions the same day and revenue a day later; a Meta campaign spike lifts
// orders; weekends dip. Every aggregate below is derived from the same daily
// series so the numbers tie out across tabs.
//
// No Math.random — mulberry32 with a fixed seed keeps builds reproducible.

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

// weekday factors (Korean D2C: weekday evenings strong, weekend dips)
const WF_REV = [0.78, 0.95, 1.0, 1.02, 1.05, 1.12, 0.85] // Sun..Sat
const WF_CVR = [0.86, 1.0, 1.02, 1.03, 1.04, 1.06, 0.9]

const VIRAL_DAYS = new Set([35, 71])
const CAMPAIGN_SPIKE = (i: number) => (i >= 38 && i <= 48 ? 1.65 : 1) // 여름 준비 캠페인
const AD_FATIGUE = (i: number) => (i >= 50 && i <= 62 ? 0.74 : 1) // 소재 피로 구간

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

    const igPostDay = dow === 1 || dow === 4 // 월·목 업로드 루틴
    let igReach = igPostDay ? 8_500 * trend * noise(0.35) : 2_600 * trend * noise(0.3)
    if (VIRAL_DAYS.has(i)) igReach *= 6.5
    igReach = Math.round(igReach)

    const adSpend = Math.round(620_000 * trend * CAMPAIGN_SPIKE(i) * noise(0.12))
    const roasDay = 3.05 * AD_FATIGUE(i) * (CAMPAIGN_SPIKE(i) > 1 ? 1.18 : 1) * noise(0.1)
    const adConvVal = Math.round(adSpend * roasDay)

    // sessions: organic base + paid + social (viral bleeds into the next day)
    const sessions = Math.round(
      3_800 * trend * WF_REV[dow] * noise(0.1) + adSpend * 0.0021 + igReach * 0.11 + prevReach * 0.06,
    )
    const cvr = 0.021 * WF_CVR[dow] * noise(0.08)
    const orders = Math.round(sessions * cvr)
    const aov = 41_000 * (dow === 0 || dow === 6 ? 1.05 : 1) * noise(0.06)
    const revenue = Math.round((orders * aov) / 100) * 100

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
  currency: 'KRW',
  revenue,
  orders,
  aov: Math.round(revenue / orders),
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
  cac: Math.round(adSpend / (orders * 0.63)),
}

// ── 홈: 채널 기여 (라스트터치) ────────────────────────────────────────────
export const demoChannelMix = [
  { key: 'meta', label: '메타 광고', value: Math.round(revenue * 0.38), color: 'var(--ch-meta)' },
  { key: 'search', label: '검색 유입', value: Math.round(revenue * 0.22), color: 'var(--ch-naver)' },
  { key: 'instagram', label: '인스타그램', value: Math.round(revenue * 0.17), color: 'var(--ch-instagram)' },
  { key: 'direct', label: '직접 방문', value: Math.round(revenue * 0.15), color: 'var(--ch-youtube)' },
  { key: 'etc', label: '기타', value: Math.round(revenue * 0.08), color: 'var(--cx-dim)' },
]

// ── 채널 탭 ──────────────────────────────────────────────────────────────
export const demoProducts = [
  { title: '글로우 세럼 30ml', revenue: Math.round(revenue * 0.24), units: 5_840 },
  { title: '수분 크림 50ml', revenue: Math.round(revenue * 0.18), units: 4_910 },
  { title: '선크림 SPF50+', revenue: Math.round(revenue * 0.15), units: 4_480 },
  { title: '클렌징 폼 150ml', revenue: Math.round(revenue * 0.11), units: 3_620 },
  { title: '토너 패드 60매', revenue: Math.round(revenue * 0.1), units: 2_950 },
  { title: '립 세럼 틴트', revenue: Math.round(revenue * 0.08), units: 2_710 },
  { title: '마스크팩 10매입', revenue: Math.round(revenue * 0.07), units: 2_360 },
  { title: '미스트 120ml', revenue: Math.round(revenue * 0.04), units: 1_180 },
]

export const demoCampaigns = [
  { name: '여름 준비 세일', spend: Math.round(adSpend * 0.34), roas: 3.9 },
  { name: '세럼 리뷰 리타겟팅', spend: Math.round(adSpend * 0.24), roas: 4.6 },
  { name: '신규 고객 환영 쿠폰', spend: Math.round(adSpend * 0.18), roas: 2.8 },
  { name: '브랜드 인지 (릴스)', spend: Math.round(adSpend * 0.15), roas: 1.9 },
  { name: '장바구니 리마인드', spend: Math.round(adSpend * 0.09), roas: 5.2 },
].map((c) => ({ ...c, convVal: Math.round(c.spend * c.roas) }))

export const demoIgPosts = [
  { caption: '“세럼 하나로 끝내는 아침 루틴” 릴스', type: '릴스', reach: 96_400, likes: 8_120, comments: 342, date: '6월 22일' },
  { caption: '수분크림 성분 카드뉴스', type: '카드', reach: 41_200, likes: 3_050, comments: 128, date: '5월 17일' },
  { caption: '고객 후기 리그램 모음', type: '카드', reach: 28_900, likes: 2_210, comments: 96, date: '6월 30일' },
  { caption: '선크림 백탁 테스트 릴스', type: '릴스', reach: 24_100, likes: 1_890, comments: 84, date: '6월 9일' },
  { caption: '신제품 티저', type: '사진', reach: 12_300, likes: 980, comments: 51, date: '7월 3일' },
]

export const demoGa4Sources = [
  { source: '메타 광고', sessions: Math.round(sessions * 0.31), cvr: 2.4 },
  { source: '네이버 검색', sessions: Math.round(sessions * 0.19), cvr: 2.9 },
  { source: '인스타그램', sessions: Math.round(sessions * 0.17), cvr: 1.6 },
  { source: '구글 검색', sessions: Math.round(sessions * 0.12), cvr: 2.6 },
  { source: '직접 방문', sessions: Math.round(sessions * 0.14), cvr: 3.4 },
  { source: '기타', sessions: Math.round(sessions * 0.07), cvr: 1.1 },
]

// ── 어드밴스드 ───────────────────────────────────────────────────────────
export const demoCohorts = [
  { label: '1월', values: [100, 31, 22, 17, 14, 12] },
  { label: '2월', values: [100, 33, 23, 18, 15] },
  { label: '3월', values: [100, 34, 25, 20] },
  { label: '4월', values: [100, 36, 27] },
  { label: '5월', values: [100, 38] },
  { label: '6월', values: [100] },
]

// 세그먼트 합(≈10,800)은 90일 신규(≈7,700) + 기존 고객 풀과 어긋나지 않게 잡았다 —
// 탭을 오가며 숫자를 대조해도 이야기가 무너지지 않도록.
export const demoRfm = [
  { segment: 'VIP', desc: '최근·자주·많이', customers: 820, revenueShare: 31 },
  { segment: '충성 고객', desc: '꾸준한 재구매', customers: 1_480, revenueShare: 27 },
  { segment: '성장 가능', desc: '두 번째 구매 직전', customers: 2_290, revenueShare: 18 },
  { segment: '신규 고객', desc: '첫 구매 후 30일 이내', customers: 2_890, revenueShare: 14 },
  { segment: '이탈 위험', desc: '재구매 주기 초과', customers: 1_170, revenueShare: 7 },
  { segment: '휴면', desc: '90일 이상 무활동', customers: 2_140, revenueShare: 3 },
]

// 요일×시간 주문 히트맵 — 평일 저녁(21–23시) 피크, 주말 오후 보조 피크
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
  { bucket: '30일 이내', customers: 412 },
  { bucket: '31–60일', customers: 779 },
  { bucket: '61–90일', customers: 596 },
  { bucket: '91일 이상', customers: 504 },
]

export const demoLtvCurve = Array.from({ length: 12 }, (_, m) => ({
  x: `${m + 1}개월`,
  ltv: Math.round(41_000 + 77_000 * (1 - Math.exp(-(m + 1) / 4.6))),
}))

// ── 크로스플랫폼: 지수 비교(7일 평균, 첫 주 = 100) — 서로 다른 스케일을 한 축에.
// 바이럴 스파이크가 축을 짓누르지 않도록 7일 이동평균으로 흐름만 남긴다(캡션에 명시).
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
  { channel: '메타 광고', value: `${(adConvVal / adSpend).toFixed(1)}×`, note: '광고비 대비 매출' },
  { channel: '메타 광고', value: '₩418', note: '클릭 한 번당 비용' },
  { channel: '인스타그램', value: '4.2%', note: '팔로워 대비 반응' },
  { channel: '검색 유입', value: '2.9%', note: '방문 대비 주문' },
  { channel: '직접 방문', value: '3.4%', note: '재방문 고객 중심' },
]

// ── 인사이트 카드 (평이한 한국어 — 상관계수·원값 노출 금지) ────────────────
export type DemoInsight = {
  kind: '기회' | '주의' | '알림'
  title: string
  body: string
  evidence: string
}

export const demoInsights: DemoInsight[] = [
  {
    kind: '기회',
    title: '인스타 게시물이 매출을 끌어요',
    body: '6월 22일 릴스가 퍼진 다음 날 매출이 평소보다 31% 높았어요. 게시물 반응이 매출로 이어지기까지 보통 하루 걸려요.',
    evidence: '도달 96,400 → 다음 날 주문 +38건',
  },
  {
    kind: '주의',
    title: '‘브랜드 인지 (릴스)’ 캠페인이 지치고 있어요',
    body: '같은 소재가 반복 노출되면서 클릭이 줄고 있어요. 소재를 교체할 때예요.',
    evidence: '최근 2주 노출당 클릭 −34% · 광고비 대비 매출 1.9×',
  },
  {
    kind: '기회',
    title: '다시 살 때가 된 고객이 214명 있어요',
    body: '평균 재구매 주기(47일)가 돌아온 고객들이에요. 지금 연락하면 가장 효과가 좋아요.',
    evidence: '지난달 같은 그룹 재구매율 22%',
  },
  {
    kind: '알림',
    title: '주말엔 방문은 많은데 덜 사요',
    body: '주말 전환율이 평일보다 15% 낮아요. 광고비를 평일 저녁에 더 실어보는 걸 추천해요.',
    evidence: '평일 2.1% vs 주말 1.8% · 주문 피크 21–23시',
  },
  {
    kind: '주의',
    title: '베스트셀러 재고가 6일치 남았어요',
    body: '‘글로우 세럼 30ml’가 지금 속도면 다음 주 품절이에요. 품절 기간의 매출 손실을 막으려면 지금 발주가 필요해요.',
    evidence: '일평균 65개 판매 · 재고 390개',
  },
]

export const demoBrand = {
  name: '글로우랩 (샘플)',
  note: '이 화면은 가상의 뷰티 브랜드 샘플 데이터예요. 연결하면 내 데이터로 똑같이 보여요.',
}
