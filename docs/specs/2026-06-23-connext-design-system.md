# Connext — Design System & Dashboard Spec

**Date:** 2026-06-23
**Status:** Approved (identity + landing built; dashboard = blueprint, not yet built)
**Source of truth for tokens:** `app/globals.css`
**Apply with skills:** `anti-ai-slop-design`, `data-dashboard-design`

---

## 1. Design POV

Connext is a **data terminal** — a dark/light analytics *instrument*, not a marketing-soft SaaS. The product's value (messy multi-channel data made legible) becomes the aesthetic: live charts, monospace numbers, exposed grid, sharp corners. Dark-first, light fully supported.

**Owned color logic (Datadog principle):** Connext sits *above* every channel, so its signature is a color **no channel owns** — purple. Channels keep their own series colors; purple is the unifying layer.

**Audience:** Korean D2C brand operations & marketing teams (non-developers). Tone: precise, trustworthy, "serious data tool" — warm only through restraint, never through soft/paper textures.

---

## 2. Color system

Tokens live in `app/globals.css` as `:root` (light) / `.dark`, surfaced via Tailwind v4 `@theme`. All values below are authoritative.

### Core (semantic)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#F5F7F9` | `#0C0E10` | page (cool gray / charcoal — **never warm paper**) |
| `--card` | `#FFFFFF` | `#121519` | panels, KPI tiles |
| `--foreground` | `#0E1216` | `#E8EAED` | primary text |
| `--muted-foreground` | `#5B636C` | `#888F98` | secondary text / labels |
| `--border` | `#E4E7EB` | `#23282D` | hairline rules, panel borders |
| `--primary` / `--accent` | `#6E3AD6` | `#9B6CFF` | brand purple (CTAs, highlights, primary series) |
| `--primary-foreground` | `#FFFFFF` | `#0C0E10` | text on purple |

### Brand + chart

| Token | Light | Dark | Use |
|---|---|---|---|
| `--cx-accent` | `#6E3AD6` | `#9B6CFF` | signature purple |
| `--cx-accent-soft` | `#8B5CF6` | `#B79BFF` | hover / secondary purple |
| `--cx-grid` | `#E7EAEE` | `#23282D` | chart gridlines |
| `--cx-dim` | `#9AA1A9` | `#5A626B` | axis labels, faint meta |
| `--ch-shopify` | `#6E3AD6` | `#9B6CFF` | Shopify series (= brand/highlight) |
| `--ch-meta` | `#2F74D0` | `#4D8DF0` | Meta series (blue) |
| `--ch-youtube` | `#B8810C` | `#E0A23C` | YouTube series (gold) |
| `--ch-tiktok` | `#D83963` | `#F2557A` | TikTok series (rose) |
| `--ch-naver` | `#0E9C86` | `#2DD4BF` | Naver series (teal) |
| `--pos` | `#1F9E54` | `#2DD4BF` | positive delta |
| `--neg` | `#D83963` | `#FF5C5C` | negative delta |

### Rules
- **No green as a brand/UI color** — it reads as Naver (a channel). Green only appears as the Naver *series*.
- **No fintech blue, no indigo/violet gradient, no glassmorphism/glow.** Flat fills only.
- **Never encode status by color alone** — pair with icon / label / shape (accessibility).
- Channel palette is categorical; brand purple is reserved for the unifying layer + the highlighted/primary series.

---

## 3. Typography

Loaded via `<link>` in `app/layout.tsx` (Pretendard can't go through `next/font/google`; the three are kept consistent as `<link>`).

| Role | Family | Token | Notes |
|---|---|---|---|
| Display / Latin wordmark | **Archivo** (700–900) | `--font-display` | "CONNEXT", big Latin, brutalist heft |
| Body / Korean | **Pretendard Variable** | `--font-sans` | 한글 + Latin body, headlines |
| Data / labels / numbers | **JetBrains Mono** (400–600) | `--font-mono` | the "instrument" signal; tabular numerals |

- **No serif** (NYT/magazine display was rejected — reads as newsletter).
- Headlines: Pretendard 700–800, `letter-spacing: -0.02em`, tight leading.
- Every number on screen: `font-mono`, `tabular-nums`, rounded.

---

## 4. Layout & components

- **Sharp corners** — `--radius: 0.125rem` (≈2px), effectively square. No rounded cards.
- **Exposed structure** — 1px `--border` rules between panels; tight, ledger-like; generous internal padding (12–16px).
- **KPI card** — `--card` bg, 1px border, mono uppercase label (~11px, `--muted-foreground`), value (mono, ~20–22px, 600), delta (`--pos`/`--neg` + ▲▼ icon) + optional sparkline.
- **Panel** — header (mono uppercase title + LIVE/state) → body → footer (legend). 1px border.
- **Buttons** — primary: `bg-primary text-primary-foreground` (purple); secondary: ghost with `--border`. Sharp.
- **Charts** — flat multi-line/area, 1px–2.4px strokes, channel-color series, `--cx-grid` gridlines, mono axis labels, live marker (dashed + dot).

---

## 5. Motion & interaction language

Per `anti-ai-slop-design` + `data-dashboard-design`:

- `transform` + `opacity` only. No `transition: all`.
- **Data value change:** 200–400ms · **row reorder:** <300ms (preserve spatial memory) · **micro (hover/press):** 100–150ms.
- Press feedback: `scale(0.98)` / `translateY(1px)`.
- Respect `prefers-reduced-motion`.
- Live indicators: gentle opacity pulse only.

---

## 6. Landing page — built (reference)

Route `/` (`app/page.tsx`) — replaced the old `/dashboard` redirect. `proxy.ts` only refreshes the Supabase session (no redirect).

Structure: **nav** (wordmark · links · theme toggle · CTA) → **hero** (mono kicker · Korean headline w/ purple highlight · subhead · primary+ghost CTAs) → **live channel-revenue chart** (5 series + purple primary + legend + live marker) → **KPI strip** (총매출 · ROAS · 전환 · 동기화).

Theme: default **dark**, toggle persists to `localStorage` (`components/theme-toggle.tsx`); init script in `app/layout.tsx`.

Remaining landing sections (later): 기능 / 온톨로지 시각화 / 가격 / 푸터 / 모바일.

---

## 7. Dashboard spec (blueprint — not yet built)

> No live data yet → build the UI with **representative/mock data** (as the landing hero does); wire real ClickHouse/Supabase queries in a later phase.

### 7.1 Layout (5-second rule)
1. **Header** — global filters (period 7D/30D/90D, channel multi-select) + **freshness widget** (`Data as of 14:42` · sync status · ↻ refresh). Sticky.
2. **KPI row** — ≤5 primary metrics, most-global top-left (총매출 · ROAS · 전환 · AOV · 동기화). Largest = most important.
3. **Channel revenue** — multi-line time series (compare channels; lines not stacked when comparison matters) + legend-as-toggle.
4. **Drill-down target** — channel → campaign → day, with breadcrumb back path.
5. **Live orders** stream (Pause/snapshot) + **campaigns** sortable table.
6. States layer (empty/loading/error) per panel.

### 7.2 Interaction library
- **Drill-down** — every aggregate clickable; breadcrumb back; ≤3 levels.
- **Cross-filter (brush & link)** — selection in one chart filters all others + KPIs.
- **Details-on-demand tooltip** — exact value **+ benchmark/target + trend**, not bare number.
- **Filters** — global (header, all panels) vs local (per-section); always accessible.
- **Legend = toggle** — show/hide series (checkbox); double-click to isolate.
- **Comparison** — deltas `▲ +3.2%` (icon + sign-color); baselines vs prev period / target / last year.
- **CSV export** always available.

### 7.3 Real-time discipline
- Update **critical metrics only**, not the whole page; offer **Pause**.
- Freshness widget (above). **Skeleton** placeholders, not spinners.
- Errors: exponential backoff → transparent banner (`Offline… reconnecting`, attempt N/5). Never hide partial/missing data.

### 7.4 States & accessibility
- Design **empty / loading / error** for every panel. First-run empty → next action ("채널 연결 →").
- **ARIA live regions** for live updates; keyboard-operable filters/toggles/drill; WCAG AA (4.5:1); color + icon/label (never color alone); tabular numerals.

### 7.5 Phase-1 data scope (what's real vs deferred)
- **Real (when data lands):** revenue & orders (Shopify), ad spend / campaigns / ROAS (Meta Ads), channel trend, live orders, campaigns table.
- **Deferred (Phase 2+, needs more data):** cohorts / retention heatmap, LTV, conversion funnel across channels, ontology/unified entities.

### 7.6 Chart selection (user-friendly set)

Audience = non-technical marketers → **readability first**. Every chart answers one of five goals (comparison / trend / composition / distribution / relationship). Use the simplest familiar chart that answers the question.

| Chart | Use for | Friendly | Watch out |
|---|---|---|---|
| KPI scorecard + sparkline | headline number + delta | ★★★★★ | — |
| Line | trend over time, multi-channel | ★★★★★ | ≤5 series (else spaghetti) |
| Bar | compare categories (channel/campaign) | ★★★★★ | needs zero baseline |
| Area (single) | one total's flow | ★★★★ | stacked → per-series compare hard |
| Funnel | sequential conversion drop-off | ★★★★ | useless if stages ≈ equal |
| Bullet | actual vs target | ★★★★ | label the target |
| Donut | share of total, **≤4 slices** | ★★★ | humans misread angles |
| Pyramid | static hierarchy / composition | ★★★ | not for conversion (use funnel) |
| Heatmap | cohort / density | ★★★ | needs legend; never color-alone |
| Radar | multi-axis profile | ★★ | no common baseline, order-dependent, area exaggerates → prefer grouped bar / small multiples |
| Scatter / bubble | correlation | ★★ | reads as "technical" |

**Never:** pie with many slices · any 3D chart · dual-axis (independently scalable axes mislead).

**Funnel vs pyramid:** funnel = a *process that shrinks* (each stage ⊂ previous) → conversion. Pyramid = *static* hierarchy/proportion. The marketing "전환 경로" panel is a **funnel**, not a pyramid.

**Connext panel → chart:**
- KPI row → scorecards + sparklines
- 채널 매출 추세 → multi-line (≤5)
- 채널 / 캠페인 비교 → horizontal bar
- 전환 경로 → funnel
- 목표 대비 ROAS → bullet
- 코호트 / 리텐션 (Phase 2) → heatmap

Sources: eazyBI, HubSpot, Peltier Tech / Darkhorse (radar critique), Domo (funnel), Observable (bars vs lines).

---

## 8. Skills & sources
- Visual craft + anti-slop: `anti-ai-slop-design` (global skill).
- Dashboard + interactions: `data-dashboard-design` (global skill).
- Color reference: Datadog (owned purple), Databricks (lava + categorical palette). Dashboard UX: UXPin, Pencil & Paper, Dashboard Design Patterns catalog, Smashing real-time UX.

---

## 9. Rejected — do not revisit
- Warm paper / editorial / serif display → "newsletter", no data feel.
- Fintech-clean (Toss) → user "질렸어".
- Green as brand color → reads as Naver.
- AI-slop tells: Inter/Geist/Space Grotesk, indigo `#6366F1`, purple→blue gradient, glassmorphism/glow, floating cards, centered badge + 3-card hero, "Your X. One Y." copy, fake `▲12.4%` mock-only cards.
