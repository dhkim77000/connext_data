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
        // Next.js-style .env.local: values may be wrapped in single/double quotes.
        const value = line.slice(eq + 1).trim().replace(/^(["'])(.*)\1$/, '$2')
        fromFile[line.slice(0, eq).trim()] = value
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

// Params are bound server-side via param_<name> (same pattern as lib/clickhouse/http.ts).
// Retries mirror queryCH(): ClickHouse Cloud idles when unused and the first request
// after a wake can fail or stall, so 3 attempts + per-attempt timeout keep this reliable.
async function chQuery(env, sql, params = {}) {
  const url = new URL(env.url.replace(/\/$/, '') + '/')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(`param_${k}`, String(v))
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt))
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 25_000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-ClickHouse-User': env.user,
          'X-ClickHouse-Key': env.pass,
          'Content-Type': 'text/plain',
        },
        body: `${sql}\nFORMAT JSONEachRow`,
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`ClickHouse ${res.status}: ${(await res.text()).slice(0, 300)}`)
      const text = (await res.text()).trim()
      return text ? text.split('\n').map((l) => JSON.parse(l)) : []
    } catch (e) {
      lastErr = e
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
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
  'SELECT name, engine, partition_key, sorting_key FROM system.tables WHERE database = {db:String}',
  { db: env.db },
)
const liveColumns = await chQuery(
  env,
  'SELECT table, name, type FROM system.columns WHERE database = {db:String} ORDER BY table, position',
  { db: env.db },
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
