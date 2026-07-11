# E2.1 v2 스키마 정합화 (2.1.1 + 2.1.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `lib/clickhouse/ddl.sql`의 v1 잔재를 제거하고(2.1.1), 라이브 ClickHouse ↔ v2 스펙 드리프트 점검을 상설 스크립트로 만들어(2.1.2) 웨어하우스의 단일 진실 원천을 `docs/specs/2026-07-05-warehouse-schema-v2.sql`로 고정한다.

**Architecture:** v2 SQL 스펙 파일을 파싱하는 로직을 두 곳에 둔다 — (a) vitest 계약 테스트: 커넥터 `targetTable()` 결과가 전부 v2 테이블명인지 영구 검증, (b) 드리프트 점검 스크립트: 라이브 ClickHouse `system.tables/columns`를 v2 스펙과 대조. `lib/clickhouse/ddl.sql`은 스키마 사본이 아니라 v2를 가리키는 포인터로 축소한다(이중화 제거).

**Tech Stack:** TypeScript + vitest(기존 설정: `@` alias, jsdom, globals) · Node 스크립트(`scripts/*.mjs`, 의존성 0 — fetch 기반 ClickHouse HTTP) · pnpm

## 사전 조사 결과 (2026-07-10, 이 플랜 작성 시점에 라이브 확인 완료)

- 라이브 ClickHouse(`connext` DB): **31개 테이블, v2 스펙과 컬럼·타입·PARTITION/ORDER 키 완전 일치, 드리프트 0.** 엔진은 `SharedReplacingMergeTree`로 표시되나 이는 ClickHouse Cloud가 `ReplacingMergeTree`를 자동 변환한 것(드리프트 아님).
- 커넥터 3종(shopify / meta_ads / instagram)의 `targetTable()`은 이미 전부 v2 테이블명 반환.
- `lib/clickhouse/ddl.sql`(v1, 98줄: `shopify_orders`·`meta_ads_insights`·`instagram_account_insights` 등 구 테이블)을 참조하는 코드·문서 없음 (grep 확인).
- 기존 라이브 테이블 중 v1 이름의 테이블은 존재하지 않음 → **삭제할 라이브 잔재도, 필요한 마이그레이션도 없음.**
- 베이스라인: `pnpm vitest run` 29/29 통과. `npx tsc --noEmit`은 기존 이슈 1건(TS5101 `baseUrl` deprecation — 이 작업과 무관, 범위 외).

## Global Constraints

- 웨어하우스 DDL의 권위 문서는 `docs/specs/2026-07-05-warehouse-schema-v2.sql` 하나다 — 개별 ddl 파일 신설 금지 (마스터 플랜 §5 규칙 3).
- 신규 테이블/스키마 변경은 E2.2 결정 트리 통과 후 v2 SQL에만 반영.
- ClickHouse 라이브 조회는 **읽기 전용**(system.* SELECT만). DDL 실행 금지 — 드리프트가 발견되면 보고만 하고 마이그레이션은 별도 결정.
- 시크릿 값(비밀번호 등)을 출력·로그·커밋에 남기지 않는다.
- pnpm only, Node ≥20. 새 npm 의존성 추가 금지(스크립트는 내장 fetch/fs만 사용).
- 완료 후 loop test(품질·슬롭 점검) 필수 — 설계 스펙 §8, 마스터 플랜 0.3.1.
- 커밋은 이 작업의 파일만 명시적으로 `git add`(경로 지정) — 워킹 트리에 이전 세션의 미커밋 변경이 많다. `git add -A` 절대 금지. `git checkout -- <기존 수정 파일>`도 금지(이전 세션 작업 파괴).

---

### Task 1: v2 스키마 계약 테스트 (2.1.1 검증 절반)

커넥터 `targetTable()`이 반환하는 모든 테이블명이 v2 스펙에 실존함을 영구 보증하는 테스트. 이후 커넥터가 추가될 때 v2에 없는 테이블로 매핑하면 CI가 잡는다.

**Files:**
- Test: `tests/lib/clickhouse/v2-schema-contract.test.ts` (신규)

**Interfaces:**
- Consumes: `shopifyConnector`/`metaAdsConnector`/`instagramConnector` (`lib/connectors/*`), v2 스펙 파일 텍스트
- Produces: (테스트 전용 — 다른 태스크가 소비하는 심볼 없음)

- [x] **Step 1: 테스트 작성**

```ts
// tests/lib/clickhouse/v2-schema-contract.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { shopifyConnector } from '@/lib/connectors/shopify'
import { metaAdsConnector } from '@/lib/connectors/meta-ads'
import { instagramConnector } from '@/lib/connectors/instagram'
import type { Connector } from '@/lib/connectors/types'

// The single source of truth for warehouse DDL (master plan §5 rule 3).
const V2_SPEC_PATH = join(process.cwd(), 'docs/specs/2026-07-05-warehouse-schema-v2.sql')

function v2TableNames(): Set<string> {
  const sql = readFileSync(V2_SPEC_PATH, 'utf8')
  const names = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS connext\.(\w+)/g)].map((m) => m[1])
  return new Set(names)
}

// Every dataType each connector can be asked to sync (the connector's public contract).
const CONNECTOR_CONTRACTS: Array<{ connector: Connector; dataTypes: string[] }> = [
  {
    connector: shopifyConnector,
    dataTypes: ['orders', 'order_line_items', 'products', 'product_variants', 'customers'],
  },
  { connector: metaAdsConnector, dataTypes: ['campaigns', 'insights'] },
  { connector: instagramConnector, dataTypes: ['media', 'account_insights'] },
]

describe('v2 schema contract', () => {
  it('parses the v2 spec into a plausible table set', () => {
    const tables = v2TableNames()
    // v2 ships 31 tables today; a collapsing parse (0–2 tables) means the regex broke.
    expect(tables.size).toBeGreaterThanOrEqual(31)
    expect(tables.has('shopify_orders_history')).toBe(true)
    expect(tables.has('meta_ads_insights_stat')).toBe(true)
  })

  it.each(
    CONNECTOR_CONTRACTS.flatMap(({ connector, dataTypes }) =>
      dataTypes.map((dataType) => ({ id: connector.id, connector, dataType })),
    ),
  )('$id targetTable($dataType) is a v2 table', ({ connector, dataType }) => {
    const table = connector.targetTable(dataType)
    expect(v2TableNames().has(table), `"${table}" not found in v2 spec`).toBe(true)
  })

  it.each(CONNECTOR_CONTRACTS.map(({ connector }) => ({ id: connector.id, connector })))(
    '$id targetTable throws on an unknown dataType',
    ({ connector }) => {
      expect(() => connector.targetTable('no_such_data_type')).toThrow(/no target table/)
    },
  )
})
```

- [x] **Step 2: 실행 — 통과 확인**

Run: `pnpm vitest run tests/lib/clickhouse/v2-schema-contract.test.ts`
Expected: PASS (커넥터는 이미 v2 매핑이므로 green이 정상)

- [x] **Step 3: 뮤테이션으로 "실패 가능함" 증명** (계약 테스트는 fail-first가 불가능하므로 변이로 검증)

```bash
cp lib/connectors/shopify/index.ts /tmp/shopify-index.bak.ts
# v2 테이블명을 v1 이름으로 일시 변조
sed -i '' 's/shopify_orders_history/shopify_orders/' lib/connectors/shopify/index.ts
pnpm vitest run tests/lib/clickhouse/v2-schema-contract.test.ts
# Expected: FAIL — "shopify_orders" not found in v2 spec
cp /tmp/shopify-index.bak.ts lib/connectors/shopify/index.ts   # 원복 (git checkout 금지!)
pnpm vitest run tests/lib/clickhouse/v2-schema-contract.test.ts   # 원복 후 다시 PASS 확인
```

**주의:** `git checkout -- lib/connectors/shopify/index.ts`로 원복하면 이전 세션의 미커밋 변경까지 날아간다. 반드시 cp 백업으로 원복.

### Task 2: `lib/clickhouse/ddl.sql` v1 잔재 제거 → v2 포인터로 축소 (2.1.1 나머지 절반)

**⚠️ 실행 중 발견 (2026-07-10):** Step 2의 잔재 검증 grep이 사전 조사에서 놓친 v1 테이블명 잔재를 추가로 발견 — `/data` 원본 뷰어가 라이브에 존재하지 않는 v1 테이블(`shopify_orders`, `meta_ads_insights`)을 허용목록·드롭다운·기본값으로 사용(기본 화면이 에러나는 실사용 버그). 아래 파일들을 Task 2 범위에 편입:
- `app/api/data/route.ts` — `ALLOWED_TABLES`를 커넥터가 실제 적재하는 v2 테이블 9종으로 교체
- `app/(dashboard)/data/page.tsx` — 드롭다운·기본값을 같은 9종으로 교체
- `tests/lib/clickhouse/queries.test.ts` · `tests/lib/worker/processor.test.ts` — 픽스처 문자열 `shopify_orders` → `shopify_orders_history` (grep 무잔재 불변식 유지용)

**Files:**
- Modify: `lib/clickhouse/ddl.sql` (98줄 v1 DDL → 포인터 주석으로 전면 교체)
- Modify: `app/api/data/route.ts`, `app/(dashboard)/data/page.tsx` (v1 테이블명 → v2 9종)
- Modify: `tests/lib/clickhouse/queries.test.ts`, `tests/lib/worker/processor.test.ts` (픽스처명)

**Interfaces:**
- Consumes: 없음 (ddl.sql을 참조하는 코드 없음 — 사전 조사에서 확인)
- Produces: `/api/data`의 유효 `table` 파라미터 = v2 테이블 9종 (`shopify_orders_history`, `shopify_order_line_items_history`, `shopify_products`, `shopify_product_variants`, `shopify_customers`, `meta_ads_campaigns`, `meta_ads_insights_stat`, `instagram_media`, `instagram_account_insights_stat`)

- [x] **Step 1: 파일 전체를 아래 내용으로 교체**

```sql
-- lib/clickhouse/ddl.sql — POINTER ONLY, not a schema.
--
-- The authoritative warehouse DDL lives at:
--   docs/specs/2026-07-05-warehouse-schema-v2.sql   (v2 — snapshot / _history / _stat)
--
-- Apply that file manually per environment (statements are CREATE TABLE IF NOT EXISTS;
-- ClickHouse Cloud auto-rewrites the MergeTree family to Shared*).
--
-- Do NOT add CREATE TABLE statements here. New tables must pass the E2.2 decision tree
-- (docs/plans/2026-07-09-master-task-plan.md) and land in the v2 spec only.
--
-- Drift check (live cluster vs v2 spec):  pnpm check:drift
-- Last verified 2026-07-10 — 31/31 tables, zero column/type/key drift (task 2.1.2).
```

- [x] **Step 2: 잔재 검증** — v1 테이블명이 코드베이스(문서 제외)에서 사라졌는지 확인

Run: `grep -rn "meta_ads_insights\b\|instagram_account_insights\b\|shopify_orders\b" lib/ app/ components/ tests/ --include='*.ts' --include='*.tsx' --include='*.sql' | grep -v '_history\|_stat'`
Expected: 출력 없음 (v1 이름은 `_history`/`_stat` 접미사 없는 bare 이름)

- [x] **Step 3: 전체 테스트 재실행**

Run: `pnpm vitest run`
Expected: 전부 PASS (ddl.sql은 어떤 코드도 import하지 않으므로 영향 0)

### Task 3: 드리프트 점검 스크립트 상설화 (2.1.2)

일회성 점검으로 끝내지 않고 `pnpm check:drift` 한 방으로 재검증 가능하게 만든다. 향후 스키마 작업(E2.3, 1.2.7 등) 전후로 돌리는 안전망.

**Files:**
- Create: `scripts/check-warehouse-drift.mjs`
- Modify: `package.json` (scripts에 `"check:drift"` 1줄 추가)

**Interfaces:**
- Consumes: env `CLICKHOUSE_URL`/`CLICKHOUSE_USERNAME`/`CLICKHOUSE_PASSWORD`/`CLICKHOUSE_DATABASE`(기본 `connext`), 없으면 `.env.local`에서 로드. v2 스펙 파일.
- Produces: exit 0(드리프트 없음) / exit 1(드리프트 or 접속 실패), stdout 리포트. 시크릿은 출력하지 않음.

- [x] **Step 1: 스크립트 작성** — 전체 코드는 아래. 파싱 규칙: v2 SQL의 `CREATE TABLE IF NOT EXISTS connext.<name> ( … ) ENGINE = <E>(<ver>) PARTITION BY <p> ORDER BY (<o>);` 블록을 정규식으로 추출, 컬럼 줄은 `--` 주석 제거 후 `<name> <type> [DEFAULT …]`로 분해. 라이브는 `system.tables`(파티션/정렬 키·엔진)와 `system.columns`(컬럼·타입). 비교 시 공백 정규화(`, ` → `,`), 엔진은 `Shared` 접두 허용, 단일 표현식 파티션 키의 겉괄호 차이 허용.

```js
#!/usr/bin/env node
// scripts/check-warehouse-drift.mjs — task 2.1.2 (master plan E2.1)
//
// Compares the LIVE ClickHouse schema against the authoritative v2 spec
// (docs/specs/2026-07-05-warehouse-schema-v2.sql) and reports drift:
//   • tables missing live / unknown live tables
//   • column name/type mismatches
//   • PARTITION BY / ORDER BY (sorting key) mismatches
//
// Read-only: issues SELECTs against system.tables / system.columns only.
// Exit 0 = no drift. Exit 1 = drift found (report printed) or connection failure.
// Usage: pnpm check:drift   (env from shell or .env.local; secrets never printed)

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const V2_SPEC = join(ROOT, 'docs/specs/2026-07-05-warehouse-schema-v2.sql')

// ---- env (shell first, .env.local fallback — no dotenv dependency) ----
function loadEnv() {
  const fromFile = {}
  const envPath = join(ROOT, '.env.local')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const eq = line.indexOf('=')
      if (eq > 0 && !line.trim().startsWith('#')) {
        fromFile[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
      }
    }
  }
  const get = (k, fallback) => process.env[k] ?? fromFile[k] ?? fallback
  return {
    url: get('CLICKHOUSE_URL'),
    user: get('CLICKHOUSE_USERNAME', 'default'),
    pass: get('CLICKHOUSE_PASSWORD', ''),
    db: get('CLICKHOUSE_DATABASE', 'connext'),
  }
}

async function chQuery(env, sql) {
  const url = new URL(env.url.replace(/\/$/, '') + '/')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-ClickHouse-User': env.user,
      'X-ClickHouse-Key': env.pass,
      'Content-Type': 'text/plain',
    },
    body: `${sql}\nFORMAT JSONEachRow`,
  })
  if (!res.ok) throw new Error(`ClickHouse ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const text = (await res.text()).trim()
  return text ? text.split('\n').map((l) => JSON.parse(l)) : []
}

// ---- v2 spec parsing ----
const normType = (t) => t.replace(/\s+/g, ' ').replace(/,\s+/g, ',').trim()
const normKey = (k) => k.replace(/\s+/g, '').replace(/^\((.*)\)$/, '$1')

function parseV2() {
  const text = readFileSync(V2_SPEC, 'utf8')
  const tables = new Map()
  const re =
    /CREATE TABLE IF NOT EXISTS connext\.(\w+)\s*\((.*?)\n\)\s*ENGINE\s*=\s*(\w+)\([^)]*\)\s*PARTITION BY\s*(.+?)\s*ORDER BY\s*\((.+?)\);/gs
  for (const m of text.matchAll(re)) {
    const [, name, body, engine, partition, orderBy] = m
    const columns = new Map()
    for (const rawLine of body.split('\n')) {
      const line = rawLine.split('--')[0].trim().replace(/,$/, '')
      if (!line) continue
      const cm = line.match(/^([a-z0-9_]+)\s+(.+)$/)
      if (!cm) continue
      const type = cm[2].split(/\s+DEFAULT\s+/)[0]
      columns.set(cm[1], normType(type))
    }
    tables.set(name, { columns, engine, partition: normKey(partition), orderBy: normKey(orderBy) })
  }
  return tables
}

// ---- main ----
const env = loadEnv()
if (!env.url) {
  console.error('CLICKHOUSE_URL is not set (shell env or .env.local).')
  process.exit(1)
}

const v2 = parseV2()
if (v2.size < 31) {
  console.error(`v2 spec parse collapsed: got ${v2.size} tables (expected ≥31). Fix the parser.`)
  process.exit(1)
}

const liveTables = await chQuery(
  env,
  `SELECT name, engine, partition_key, sorting_key FROM system.tables WHERE database = '${env.db}'`,
)
const liveColumns = await chQuery(
  env,
  `SELECT table, name, type FROM system.columns WHERE database = '${env.db}' ORDER BY table, position`,
)
const liveByTable = new Map(liveTables.map((t) => [t.name, t]))
const liveCols = new Map()
for (const c of liveColumns) {
  if (!liveCols.has(c.table)) liveCols.set(c.table, new Map())
  liveCols.get(c.table).set(c.name, normType(c.type))
}

const drift = []
for (const name of v2.keys()) if (!liveByTable.has(name)) drift.push(`MISSING live table: ${name}`)
for (const name of liveByTable.keys()) if (!v2.has(name)) drift.push(`UNKNOWN live table (not in v2 spec): ${name}`)

for (const [name, spec] of v2) {
  const live = liveByTable.get(name)
  if (!live) continue
  const lcols = liveCols.get(name) ?? new Map()
  for (const [col, type] of spec.columns) {
    if (!lcols.has(col)) drift.push(`${name}: column missing live: ${col} ${type}`)
    else if (lcols.get(col) !== type) drift.push(`${name}.${col}: type v2=${type} live=${lcols.get(col)}`)
  }
  for (const col of lcols.keys())
    if (!spec.columns.has(col)) drift.push(`${name}: extra live column: ${col}`)
  // ClickHouse Cloud rewrites ReplacingMergeTree → SharedReplacingMergeTree: accept the prefix.
  if (live.engine !== spec.engine && live.engine !== `Shared${spec.engine}`)
    drift.push(`${name}: engine v2=${spec.engine} live=${live.engine}`)
  if (normKey(live.partition_key) !== spec.partition)
    drift.push(`${name}: partition v2=${spec.partition} live=${normKey(live.partition_key)}`)
  if (normKey(live.sorting_key) !== spec.orderBy)
    drift.push(`${name}: sorting key v2=${spec.orderBy} live=${normKey(live.sorting_key)}`)
}

if (drift.length === 0) {
  console.log(`OK — ${v2.size} v2 tables, live matches the spec exactly (db=${env.db}).`)
  process.exit(0)
}
console.error(`DRIFT — ${drift.length} issue(s):\n` + drift.map((d) => `  • ${d}`).join('\n'))
console.error('\nDo NOT auto-migrate. Decide migrations explicitly (master plan 2.1.2).')
process.exit(1)
```

- [x] **Step 2: package.json에 스크립트 등록** — `"test": "vitest run",` 아래에 추가:

```json
    "check:drift": "node scripts/check-warehouse-drift.mjs",
```

- [x] **Step 3: 실행 — 라이브 대조**

Run: `pnpm check:drift`
Expected: `OK — 31 v2 tables, live matches the spec exactly (db=connext).` / exit 0

- [x] **Step 4: 실패 경로 검증** — 파서·비교기가 실제로 드리프트를 잡는지 확인

Run: `CLICKHOUSE_DATABASE=default pnpm check:drift`
Expected: `MISSING live table: …` 31건 + exit 1 (default DB에는 connext 테이블이 없으므로)

### Task 4: Loop test → 커밋 → 마스터 플랜 마커 갱신

**Files:**
- Modify: `docs/plans/2026-07-09-master-task-plan.md` (2.1.1·2.1.2 마커 ⬜→✅, 현황 스냅샷 표의 "v1 잔재" 문구 갱신)
- (참고) 커밋 대상: `tests/lib/clickhouse/v2-schema-contract.test.ts`, `lib/clickhouse/ddl.sql`, `scripts/check-warehouse-drift.mjs`, `package.json`, `docs/plans/2026-07-09-master-task-plan.md`, `docs/superpowers/plans/2026-07-10-e21-v2-schema-alignment.md`

- [x] **Step 1: Loop test (품질 게이트, 설계 스펙 §8)** — `code-review` 스킬로 이번 작업 파일들의 diff를 리뷰. 워킹 트리에 이전 세션의 미커밋 변경이 섞여 있으므로, **이번 작업 파일 5종에 대한 지적만 반영**하고 그 외 파일 지적은 사용자 보고로 넘긴다. 지적 반영 후 `pnpm vitest run` 재확인.

- [x] **Step 2: 검증 일괄 재실행**

Run: `pnpm vitest run && pnpm check:drift`
Expected: 테스트 전부 PASS + `OK — 31 v2 tables …`

- [x] **Step 3: 커밋 (경로 명시 add — `-A` 금지)**

```bash
git add tests/lib/clickhouse/v2-schema-contract.test.ts lib/clickhouse/ddl.sql \
        scripts/check-warehouse-drift.mjs package.json
git commit -m "feat: E2.1 v2 schema alignment — contract test + drift check, retire v1 ddl.sql

- v2 schema contract test: every connector targetTable() must resolve to a
  table in docs/specs/2026-07-05-warehouse-schema-v2.sql
- scripts/check-warehouse-drift.mjs (pnpm check:drift): live ClickHouse vs
  v2 spec — tables/columns/types/partition/sorting keys. 2026-07-10: 0 drift.
- lib/clickhouse/ddl.sql: v1 DDL removed, now a pointer to the v2 spec

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [x] **Step 4: 마스터 플랜 마커 갱신** — `docs/plans/2026-07-09-master-task-plan.md`:
  - `| 2.1.1 | ⬜ v1 잔재 제거 |` → `| 2.1.1 | ✅ v1 잔재 제거 |` + 내용 끝에 ` (2026-07-10 완료)` 추가
  - `| 2.1.2 | ⬜ 라이브 CH ↔ v2 드리프트 점검 |` → `| 2.1.2 | ✅ 라이브 CH ↔ v2 드리프트 점검 |` + 내용 끝에 ` (2026-07-10 드리프트 0 확인, pnpm check:drift 상설화)` 추가
  - 현황 스냅샷 표 `웨어하우스 스키마` 행: `lib/clickhouse/ddl.sql은 v1 잔재` 문구를 `ddl.sql은 v2 포인터로 정리(2.1.1 완료)`로 교체
  - 알려진 불일치 목록의 `lib/clickhouse/ddl.sql(v1) ↔ docs/specs/…v2.sql(권위) 이중화 (2.1.1)` 줄 삭제

- [x] **Step 5: 플랜 문서 + 마스터 플랜 커밋**

```bash
git add docs/plans/2026-07-09-master-task-plan.md docs/superpowers/plans/2026-07-10-e21-v2-schema-alignment.md
git commit -m "docs: master plan — mark 2.1.1/2.1.2 done (E2.1 complete) + E2.1 implementation plan

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review 체크 결과

- **Spec coverage:** 2.1.1(ddl.sql 교체=Task 2, targetTable 검증=Task 1) ✓ · 2.1.2(라이브 대조=사전 조사+Task 3 상설화, "차이는 마이그레이션으로 해소"=차이 0이므로 해당 없음, 스크립트가 향후 드리프트 시 exit 1로 강제) ✓ · loop test 게이트(0.3.1)=Task 4 ✓ · 마커 갱신(§5 규칙 1)=Task 4 ✓
- **Placeholder scan:** TBD/TODO/유사 표현 없음, 모든 코드 스텝에 전체 코드 포함 ✓
- **Type consistency:** `Connector` 타입은 `lib/connectors/types.ts`의 기존 인터페이스 사용, 테스트·스크립트 간 공유 심볼 없음 ✓

---

## 실행 결과 (2026-07-10)

- **드리프트 점검(2.1.2):** 라이브 31/31 테이블 — 컬럼·타입·파티션/정렬 키 완전 일치, 드리프트 0. 마이그레이션 불필요. `pnpm check:drift` 상설화(정상 exit 0 / 드리프트·접속실패 exit 1 확인).
- **v1 잔재(2.1.1):** ddl.sql 외에 `/data` 뷰어(route 허용목록·드롭다운·기본값)와 테스트 픽스처 2곳에서 v1 테이블명 추가 발견·제거. bare v1 이름 grep = 0건.
- **Loop test (max, 파인더 10앵글 + 검증 + 스윕):** 9건 보고 — 6건 수정(테이블 목록 단일화 `lib/warehouse-tables.ts` 신설, 드리프트 스크립트 재시도/파라미터 바인딩/따옴표 처리, 테스트 스펙 파싱 1회화), 2건 보류(근거 기록), 1건 변경 불요. 오탐 반증 1건(vitest expect 메시지 — 실행으로 확인).
- **최종 검증:** vitest 42/42 PASS · `pnpm check:drift` OK(exit 0) · 실패 경로 exit 1 · tsc 신규 에러 0 (기존 TS5101만).
- **플랜 대비 변경:** Task 2 파일 목록에 `lib/warehouse-tables.ts` 추가(loop test 산출물), 커밋 대상에 동일 반영.
