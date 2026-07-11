# 차트 키트 & 리액티브 모션 (4.4.1 + 4.3.1 일부) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. 디자인 반복(스크린샷 비교)이 포함되어 코드 스텝을 전부 사전 고정할 수 없음 — 스펙·게이트 중심 플랜.

**Goal:** 대시보드의 정적 스파크라인·CSS 막대를 인터랙티브 차트 키트(크로스헤어 툴팁·레전드/메트릭 토글·진입 모션)로 교체하고, 계산된 모션 시스템으로 "죽어있는" 느낌을 제거한다. AI-slop tell 0 유지.

**Architecture:** 의존성 0의 커스텀 SVG 차트 키트(`components/charts/`) + 순수 스케일 수학 모듈(vitest 대상) + CSS-only 진입 모션(서버 컴포넌트 호환). 디자인 truth는 Hume 토큰(`app/globals.css`) — 차트 전용 토큰만 추가.

## ADR — 4.4.1 차트 레이어 결정 (🧭 해소)

**결정: 커스텀 SVG 유지·고도화** (라이브러리 도입 안 함)

| 근거 | 내용 |
|---|---|
| 요구 범위 | 라인+영역, 24h 바, 스파크라인, 툴팁·크로스헤어·토글 — 좁고 고정적 |
| 번들 | 0KB 추가 (Recharts v4 ~14KB, visx 모듈 합산 그 이상) |
| 디자인 | anti-slop 원칙: 라이브러리 기본 룩(특히 Recharts)은 그 자체가 템플릿 시그니처. Hume 마크 스펙(2px 라인, 4px 라운드 바캡, 헤어라인 그리드)을 픽셀 단위로 소유 |
| 선례 | `components/dashboard/sparkline.tsx`가 이미 수제 SVG — 방향 일관 |
| 리스크 | 스케일/틱 수학 버그 → `components/charts/scale.ts`를 순수 함수로 분리해 vitest로 고정 |
| 재검토 트리거 | 산키·히트맵 등 E4.5 고급 시각화 착수 시 visx 모듈 단위 도입 재평가 |

## 팔레트 검증 (dataviz 스킬 §3 — 스크립트 통과 결과)

- **라이트** `#C094E4,#2AA18C,#3E7BD6,#C08A2E,#D65A7E` (canonical 인접 순서: shopify→naver→meta→youtube→tiktok): PASS. WARN: `#C094E4` 대비 2.44:1 → relief 의무 = 축 라벨·툴팁·sr 테이블 제공 + **라인 스트로크는 `--cx-chart-line: #A874D6`**(3:1 통과)로 그린다(영역 워시·필은 브랜드 액센트 유지).
- **다크** `--ch-*` 차트 토큰 교체: `#A874D6`(shopify) `#2AA893`(naver) `#4B7FCB`(meta) `#B8802A`(youtube) `#DB5077`(tiktok) — 전 항목 PASS (L 밴드 0.48–0.67, CVD 최악 인접 ΔE 38.9). 브랜드 `--accent`는 불변.

## 모션 스펙 (anti-slop + dashboard 스킬 합의값)

| 대상 | 스펙 |
|---|---|
| 패널 진입 | opacity 0→1 + translateY(6px)→0, 300ms ease-out, 40ms 스태거, **1회만** |
| 라인 드로우인 | pathLength 기반 350ms ease-out (마운트 1회) |
| 바 라이즈 | scaleY origin-bottom 300ms, 인덱스 스태거 12ms |
| BarRow 필 | scaleX origin-left 400ms (width 애니 금지 — transform만) |
| 숫자 카운트업 | 400ms ease-out, 카운트 중 tabular-nums → 종료 시 해제(대형 숫자는 proportional이 정칙) |
| 마이크로(hover/press) | 100–150ms, transform/opacity만. `transition: all` 금지 |
| 접근성 | 전부 `@media (prefers-reduced-motion: reduce)`에서 즉시 상태. ARIA: 차트에 sr-only 테이블 제공 |

## 차트 키트 계약 (Interfaces)

- `components/charts/scale.ts` (순수, 테스트 대상)
  - `linearScale(domain:[number,number], range:[number,number]) => (v:number)=>number`
  - `niceTicks(min:number, max:number, count?:number) => number[]` — 1/2/5×10ⁿ 스텝, 0 포함 규칙
  - `linePath(pts:[number,number][]) => string`, `areaPath(pts, baselineY) => string`
- `components/charts/time-series-chart.tsx` `'use client'`
  - props: `{ data: { x: string; [k:string]: number|string }[], series: { key:string; label:string; color?:string }[], height?, valueFormat?: 'currency'|'int'|'compact', currency?, tooltipExtra?: (row)=>string }`
  - 단일 시리즈 = 레전드 없음(제목이 명명). ≥2 시리즈 = 레전드 토글. **이중축 금지** — 서로 다른 스케일 지표는 부모가 메트릭 스위처(세그먼티드 컨트롤)로 한 번에 하나만
  - 크로스헤어 X 스냅 + 툴팁(값이 주인공, 라인 키, Δ vs 이전 포인트), 히트 영역 = 전체 플롯, 키보드 포커스 시 동일 정보, sr-only 테이블
  - 마크: 라인 2px round, 영역 10% 워시, 엔드닷 r4 + 2px 서피스 링, 그리드 헤어라인(`--cx-grid`), y nice 틱 + compact 포맷, x 첫/중간/끝 날짜
- `components/charts/hour-bars.tsx` `'use client'` — `{ hours: number[] /*24*/, label:(h,v)=>string }` 바 ≤24px·4px 라운드 캡·2px 갭, per-bar 툴팁+호버 리프트, 피크 직접 라벨 1개
- `components/charts/animated-number.tsx` `'use client'` — `{ value:number, format:(n:number)=>string }` SSR = 최종값 렌더(무 JS 정상), 마운트 후 60%→100% 카운트
- `components/charts/metric-switcher.tsx` `'use client'` — pill 세그먼트(Hume), `aria-pressed`, 100ms press 모션

## Tasks

- [x] **T1 스케일 수학 + 테스트** — `scale.ts` 구현, `tests/lib/charts/scale.test.ts` (niceTicks 경계: 0~0, 음수, 단일값, 1/2/5 스텝; linearScale 역전 도메인; path 문자열)
- [x] **T2 차트 컴포넌트 4종** — 위 계약대로. 팔레트·모션 스펙 준수
- [x] **T3 토큰·모션 CSS** — globals.css: `--cx-chart-line`, 다크 `--ch-*` 교체, `cx-rise`/`cx-draw`/`cx-grow-x`/`cx-grow-y` 키프레임 + reduced-motion 가드, focus-visible 링
- [x] **T4 통합** — dashboard(Revenue|Orders 스위처 차트, HourBars, AnimatedNumber 히어로, 히어로 proportional-nums), meta(Spend 차트 + 툴팁에 그날 ROAS/전환 컨텍스트), instagram(Followers|Reach 스위처), `BarRow` scaleX 모션·호버, `dashboard/loading.tsx` 스켈레톤(12-col 골격, opacity 펄스만)
- [x] **T5 갤러리 + 브라우저 검증 2패스** — `app/dev/design/page.tsx`(프로덕션 `notFound()`), preview_start → 스크린샷(라이트/다크) → 스킬 self-audit 6문항 + anti-pattern 카탈로그 대조 → diff 수정 → 재스크린샷
- [x] **T6 loop test + 커밋 + 마커** — code-review(max) → 수정 → 경로 지정 커밋 → 마스터 플랜 4.4.1 ✅(결정 포함)·4.3.1 🔶 갱신

## Global Constraints

- 새 npm 의존성 금지. pnpm only, Node ≥20
- Hume 토큰이 유일한 truth — 컴포넌트에 raw hex 금지(토큰 var()만)
- 슬롭 tell 금지: `transition: all`·width/height 애니·균일 그림자·mock 지표(갤러리는 dev-only + SAMPLE 라벨)·이중축
- UX 카피: 쉬운 언어, API 용어 노출 금지 (§5.6)
- `git add -A` 금지(경로 지정), `git checkout -- <기존 수정 파일>` 금지
- 데이터 정직성: 비교 불가 시 델타 미표시(기존 규칙 유지), 시리즈 색은 엔티티 고정

---

## 실행 결과 (2026-07-10)

- **키트:** `components/charts/` — scale.ts(순수 수학, 11 테스트) · time-series-chart(크로스헤어 스냅 툴팁·Δ표시·레전드 토글·sr 테이블·키보드 조작·틱 헤일로) · trend-explorer(메트릭 스위처, 원축 원칙) · hour-bars(피크 직접 라벨 1개·공유 툴팁) · animated-number(카운트업, reduced-motion 대응).
- **모션:** globals.css `cx-*` 시스템 — 패널 스태거 rise(300ms/40ms), 라인 드로우인(350ms), 바 scaleY(12ms 스태거), BarRow scaleX, 마이크로 press(120ms). 전부 transform/opacity, reduced-motion에서 일괄 비활성.
- **팔레트:** dataviz 검증기 통과 — 라이트 PASS(액센트 WARN → `--cx-chart-line #A874D6` 스트로크 + 축 라벨·sr 테이블로 relief), 다크 `--ch-*` 스냅 재검증 전항목 PASS. `--ch-instagram` 시맨틱 토큰 신설.
- **브라우저 검증:** dev 갤러리(`/dev/design`, 프로덕션 notFound)로 라이트/다크/모바일(375px) 스크린샷 2패스. 크로스헤어 툴팁·스위처 드로우인·아워바 강조 실호버 확인. 발견·수정: stale `.next` 캐시(재발 방지: dev 전 rm), y틱 헤일로, 아워바 툴팁 transform 충돌(유틸 클래스 사멸 → 인라인 통합).
- **Loop test (max, 10앵글+스윕):** 수정 7 — `--ch-instagram`, meta 통화 스레딩(`anyIf(currency)` + 폴백), Intl 포매터 캐싱(rAF 프레임당 생성 제거), fmtShortDate 승격, `.cx-tooltip` 공용화, loading `role=status`, 마스킹 주석. 반증 5(타임존 지적은 로컬파싱+로컬포맷 조합이 정답 등), 보류 4(Delta 컴포넌트·빈상태 통합 → 4.1.3/4.6.3, sparkline.tsx 미참조 보존, 포매터 캐시 상한 YAGNI).
- **게이트:** vitest 53/53 · tsc 신규 에러 0 · `pnpm build` 성공. Meta 커넥터 currency 적재는 별도 태스크 칩 발행.
