# Phase 1: Foundation + Shopify/Meta Connectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship working infrastructure (Next.js, Supabase, ClickHouse, connector registry, queue worker) and Shopify + Meta Ads ingestion pipelines with a Claude-style channel management UI.

**Architecture:** Next.js App Router serves UI + BFF routes. Supabase stores tenant/channel metadata and credentials. A sync worker invokes connector-specific API clients which write raw JSON rows to ClickHouse, partitioned by `tenant_id`. The `raw` column on every table preserves the full API response blob.

**Tech Stack:** Next.js 15 (App Router) · TypeScript (strict) · Supabase · ClickHouse (`@clickhouse/client`) · shadcn/ui · Vitest · pnpm

## Global Constraints

- pnpm only — no npm or yarn
- `"strict": true` in tsconfig.json at all times
- Every ClickHouse table: `tenant_id String` first column, `raw String` column always present
- Credentials stored in Supabase `channel_credentials` table (service-role only) — never in env vars
- Every Supabase table has RLS enabled
- No default exports in `lib/` or `components/` — named exports only
- Test files in `tests/` mirror `lib/` structure exactly
- Loop test (code quality + slop check) required after every task commit before moving on

---

## File Map

```
connext/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                                   # redirect → /dashboard
│   ├── globals.css
│   ├── auth/callback/route.ts                     # Supabase PKCE exchange
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                             # auth guard + sidebar shell
│   │   ├── dashboard/page.tsx                     # metric overview cards
│   │   ├── channels/
│   │   │   ├── page.tsx                           # channel list + add card
│   │   │   └── connect/[connectorId]/page.tsx     # OAuth initiation page
│   │   └── data/page.tsx                          # raw data table viewer
│   └── api/
│       ├── channels/
│       │   ├── route.ts                           # GET list / POST create
│       │   └── [id]/route.ts                      # DELETE
│       ├── oauth/
│       │   ├── shopify/route.ts                   # initiate Shopify OAuth
│       │   ├── shopify/callback/route.ts          # exchange code → store cred
│       │   ├── meta/route.ts                      # initiate Meta OAuth
│       │   └── meta/callback/route.ts             # exchange code → store cred
│       ├── sync/
│       │   ├── route.ts                           # POST — trigger sync job
│       │   └── process/route.ts                   # POST — queue consumer
│       └── data/route.ts                          # GET — ClickHouse query proxy
├── lib/
│   ├── supabase/
│   │   ├── client.ts                              # browser client
│   │   ├── server.ts                              # server + service-role clients
│   │   └── types.ts                              # hand-written DB types
│   ├── clickhouse/
│   │   ├── client.ts                              # singleton ClickHouseClient
│   │   ├── queries.ts                             # insertRows, queryRows helpers
│   │   └── ddl.sql                               # reference DDL (run manually)
│   ├── connectors/
│   │   ├── types.ts                              # ConnectorCredentials, FetchJob, FetchResult, Connector
│   │   ├── registry.ts                           # registerConnector, getConnector, listConnectors
│   │   ├── shopify/index.ts                      # Shopify connector
│   │   └── meta-ads/index.ts                     # Meta Ads connector
│   └── worker/
│       └── processor.ts                          # processJob: fetch → insertRows loop
├── components/
│   ├── ui/                                       # shadcn/ui auto-generated
│   ├── sidebar.tsx
│   ├── channel-card.tsx
│   └── data-table.tsx
├── supabase/
│   └── migrations/
│       ├── 001_tenants.sql
│       ├── 002_channel_connections.sql
│       ├── 003_sync_jobs.sql
│       └── 004_channel_credentials.sql
├── tests/
│   ├── setup.ts
│   ├── lib/
│   │   ├── connectors/
│   │   │   ├── registry.test.ts
│   │   │   ├── shopify.test.ts
│   │   │   └── meta-ads.test.ts
│   │   ├── clickhouse/
│   │   │   └── queries.test.ts
│   │   └── worker/
│   │       └── processor.test.ts
├── .env.example
├── next.config.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`
- Create: `.env.example`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `tests/setup.ts`

**Interfaces:**
- Produces: runnable Next.js 15 app with TypeScript strict mode, Tailwind, shadcn/ui, and Vitest configured

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/dhkim/Desktop/connext
pnpm create next-app@latest . --typescript --tailwind --app --eslint --import-alias="@/*" --yes
```

Expected: project files created, no errors

- [ ] **Step 2: Install runtime dependencies**

```bash
pnpm add @supabase/supabase-js @supabase/ssr @clickhouse/client
```

- [ ] **Step 3: Install dev dependencies**

```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 4: Install shadcn/ui**

```bash
pnpm dlx shadcn@latest init --defaults
pnpm dlx shadcn@latest add button card badge table separator avatar input label
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
})
```

- [ ] **Step 6: Create tests/setup.ts**

```typescript
// tests/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Add test scripts to package.json**

In `package.json` `"scripts"` section, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Create .env.example**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

CLICKHOUSE_URL=https://your-clickhouse-host:8443
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=your-password
CLICKHOUSE_DATABASE=connext

SHOPIFY_CLIENT_ID=your-shopify-client-id
SHOPIFY_CLIENT_SECRET=your-shopify-client-secret

META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 9: Update app/page.tsx**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 10: Run tests to verify scaffold**

```bash
pnpm test
```

Expected: 0 tests, exits 0 (Vitest reports "no test files found" — that's fine)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: project scaffold — Next.js 15, shadcn/ui, Vitest, Supabase + ClickHouse deps"
```

---

### Task 2: Supabase Schema + RLS

**Files:**
- Create: `supabase/migrations/001_tenants.sql`
- Create: `supabase/migrations/002_channel_connections.sql`
- Create: `supabase/migrations/003_sync_jobs.sql`
- Create: `supabase/migrations/004_channel_credentials.sql`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/types.ts`

**Interfaces:**
- Produces: `createClient()` (browser), `createServerClient()` (server), `createServiceClient()` (service-role) — used by all API routes and server components

- [ ] **Step 1: Create tenants migration**

```sql
-- supabase/migrations/001_tenants.sql
CREATE TABLE tenants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  owner_auth_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan            text NOT NULL DEFAULT 'free',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_only" ON tenants
  USING (owner_auth_id = auth.uid());
```

- [ ] **Step 2: Create channel_connections migration**

```sql
-- supabase/migrations/002_channel_connections.sql
CREATE TABLE channel_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id    text NOT NULL,
  display_name    text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'error', 'paused')),
  extra           jsonb NOT NULL DEFAULT '{}',
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_only" ON channel_connections
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_auth_id = auth.uid()
    )
  );
```

- [ ] **Step 3: Create sync_jobs migration**

```sql
-- supabase/migrations/003_sync_jobs.sql
CREATE TABLE sync_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id   uuid NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  connector_id    text NOT NULL,
  data_type       text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'running', 'done', 'error')),
  since           timestamptz,
  until           timestamptz,
  rows_ingested   int NOT NULL DEFAULT 0,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_only" ON sync_jobs
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE owner_auth_id = auth.uid()
    )
  );
```

- [ ] **Step 4: Create channel_credentials migration**

```sql
-- supabase/migrations/004_channel_credentials.sql
-- Credential store: only accessible via service role key.
-- anon and authenticated roles are explicitly revoked.
CREATE TABLE channel_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  access_token    text NOT NULL,
  refresh_token   text,
  expires_at      bigint,
  extra           jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channel_credentials ENABLE ROW LEVEL SECURITY;
-- No RLS policies = deny-all for anon/authenticated roles.
-- Service role bypasses RLS entirely (Supabase default behavior).
REVOKE ALL ON channel_credentials FROM anon, authenticated;
```

- [ ] **Step 5: Apply migrations locally**

```bash
pnpm add -D supabase
pnpm supabase init
pnpm supabase start
pnpm supabase db push
```

Expected: local Supabase running on http://localhost:54321, all 4 tables created

- [ ] **Step 6: Create lib/supabase/client.ts**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 7: Create lib/supabase/server.ts**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

- [ ] **Step 8: Create lib/supabase/types.ts**

```typescript
// lib/supabase/types.ts
export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          owner_auth_id: string
          plan: string
          created_at: string
        }
        Insert: {
          name: string
          owner_auth_id: string
          plan?: string
        }
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      channel_connections: {
        Row: {
          id: string
          tenant_id: string
          connector_id: string
          display_name: string
          status: 'active' | 'error' | 'paused'
          extra: Record<string, unknown>
          last_synced_at: string | null
          created_at: string
        }
        Insert: {
          tenant_id: string
          connector_id: string
          display_name?: string
          status?: 'active' | 'error' | 'paused'
          extra?: Record<string, unknown>
        }
        Update: Partial<Database['public']['Tables']['channel_connections']['Insert']>
      }
      sync_jobs: {
        Row: {
          id: string
          tenant_id: string
          connection_id: string
          connector_id: string
          data_type: string
          status: 'pending' | 'running' | 'done' | 'error'
          since: string | null
          until: string | null
          rows_ingested: number
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          tenant_id: string
          connection_id: string
          connector_id: string
          data_type: string
          status?: 'pending' | 'running' | 'done' | 'error'
          since?: string
          until?: string
        }
        Update: Partial<Database['public']['Tables']['sync_jobs']['Insert']>
      }
      channel_credentials: {
        Row: {
          id: string
          connection_id: string
          access_token: string
          refresh_token: string | null
          expires_at: number | null
          extra: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          connection_id: string
          access_token: string
          refresh_token?: string
          expires_at?: number
          extra?: Record<string, unknown>
        }
        Update: Partial<Database['public']['Tables']['channel_credentials']['Insert']>
      }
    }
  }
}
```

- [ ] **Step 9: Run tests**

```bash
pnpm test
```

Expected: still 0 tests, exits 0

- [ ] **Step 10: Commit**

```bash
git add supabase/ lib/supabase/
git commit -m "feat: Supabase schema — tenants, channel_connections, sync_jobs, channel_credentials with RLS"
```

---

### Task 3: ClickHouse Client + Table DDL

**Files:**
- Create: `lib/clickhouse/client.ts`
- Create: `lib/clickhouse/queries.ts`
- Create: `lib/clickhouse/ddl.sql`
- Create: `tests/lib/clickhouse/queries.test.ts`

**Interfaces:**
- Produces: `getCHClient()`, `insertRows(table: string, rows: Record<string, unknown>[]): Promise<void>`, `queryRows<T>(sql: string, params?: Record<string, unknown>): Promise<T[]>`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/clickhouse/queries.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({}),
    query: vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([{ order_id: '1' }]),
    }),
  })),
}))

import { insertRows, queryRows } from '@/lib/clickhouse/queries'

describe('insertRows', () => {
  it('inserts rows into a ClickHouse table without throwing', async () => {
    const rows = [{ tenant_id: 'abc', order_id: '1', raw: '{}' }]
    await expect(insertRows('shopify_orders', rows)).resolves.not.toThrow()
  })

  it('is a no-op when rows array is empty', async () => {
    await expect(insertRows('shopify_orders', [])).resolves.not.toThrow()
  })
})

describe('queryRows', () => {
  it('returns typed rows from a query', async () => {
    type Row = { order_id: string }
    const result = await queryRows<Row>(
      'SELECT order_id FROM shopify_orders WHERE tenant_id = {tenantId:String}',
      { tenantId: 'abc' }
    )
    expect(result).toEqual([{ order_id: '1' }])
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/lib/clickhouse/queries.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/clickhouse/queries'`

- [ ] **Step 3: Create lib/clickhouse/client.ts**

```typescript
// lib/clickhouse/client.ts
import { createClient, type ClickHouseClient } from '@clickhouse/client'

let _client: ClickHouseClient | null = null

export function getCHClient(): ClickHouseClient {
  if (!_client) {
    _client = createClient({
      url: process.env.CLICKHOUSE_URL!,
      username: process.env.CLICKHOUSE_USERNAME ?? 'default',
      password: process.env.CLICKHOUSE_PASSWORD!,
      database: process.env.CLICKHOUSE_DATABASE ?? 'connext',
    })
  }
  return _client
}
```

- [ ] **Step 4: Create lib/clickhouse/queries.ts**

```typescript
// lib/clickhouse/queries.ts
import { getCHClient } from './client'

export async function insertRows(
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return
  const ch = getCHClient()
  await ch.insert({ table, values: rows, format: 'JSONEachRow' })
}

export async function queryRows<T>(
  query: string,
  queryParams?: Record<string, unknown>,
): Promise<T[]> {
  const ch = getCHClient()
  const result = await ch.query({ query, query_params: queryParams, format: 'JSONEachRow' })
  return result.json<T>()
}
```

- [ ] **Step 5: Create lib/clickhouse/ddl.sql**

```sql
-- lib/clickhouse/ddl.sql
-- Run once per environment. These are NOT applied automatically.

CREATE DATABASE IF NOT EXISTS connext;

CREATE TABLE IF NOT EXISTS connext.shopify_orders (
  tenant_id          String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  order_id           String,
  created_at         DateTime,
  updated_at         DateTime,
  total_price        Decimal(18, 4),
  currency           String,
  financial_status   String,
  fulfillment_status String,
  customer_id        String DEFAULT '',
  email              String DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, created_at, order_id);

CREATE TABLE IF NOT EXISTS connext.shopify_products (
  tenant_id     String,
  ingested_at   DateTime DEFAULT now(),
  raw           String,
  product_id    String,
  title         String,
  vendor        String,
  product_type  String,
  status        String,
  created_at    DateTime,
  updated_at    DateTime
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, created_at, product_id);

CREATE TABLE IF NOT EXISTS connext.meta_ads_campaigns (
  tenant_id     String,
  ingested_at   DateTime DEFAULT now(),
  raw           String,
  campaign_id   String,
  account_id    String,
  name          String,
  status        String,
  objective     String,
  created_time  DateTime,
  updated_time  DateTime
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(created_time))
ORDER BY (tenant_id, created_time, campaign_id);

CREATE TABLE IF NOT EXISTS connext.meta_ads_insights (
  tenant_id    String,
  ingested_at  DateTime DEFAULT now(),
  raw          String,
  ad_id        String,
  account_id   String,
  campaign_id  String,
  adset_id     String,
  date_start   Date,
  impressions  Int64,
  clicks       Int64,
  spend        Decimal(18, 4),
  reach        Int64
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(date_start))
ORDER BY (tenant_id, date_start, ad_id);
```

- [ ] **Step 6: Run tests to verify passing**

```bash
pnpm test tests/lib/clickhouse/queries.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 7: Commit**

```bash
git add lib/clickhouse/ tests/lib/clickhouse/
git commit -m "feat: ClickHouse client + insertRows/queryRows helpers + DDL reference"
```

---

### Task 4: Connector Types + Registry

**Files:**
- Create: `lib/connectors/types.ts`
- Create: `lib/connectors/registry.ts`
- Create: `tests/lib/connectors/registry.test.ts`

**Interfaces:**
- Produces: `ConnectorCredentials`, `FetchJob`, `FetchResult`, `Connector` (types); `registerConnector(c: Connector): void`, `getConnector(id: string): Connector`, `listConnectors(): Connector[]`, `__resetForTests(): void`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/connectors/registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { registerConnector, getConnector, listConnectors, __resetForTests } from '@/lib/connectors/registry'
import type { Connector, FetchJob, FetchResult } from '@/lib/connectors/types'

const mockConnector: Connector = {
  id: 'test_platform',
  displayName: 'Test Platform',
  authType: 'oauth2',
  fetch: async (_job: FetchJob): Promise<FetchResult> => ({ rows: [] }),
  targetTable: (dataType: string) => `test_${dataType}`,
}

describe('connector registry', () => {
  beforeEach(() => {
    __resetForTests()
  })

  it('registers and retrieves a connector by id', () => {
    registerConnector(mockConnector)
    expect(getConnector('test_platform')).toBe(mockConnector)
  })

  it('throws for unknown connector id', () => {
    expect(() => getConnector('nonexistent')).toThrow('Unknown connector: nonexistent')
  })

  it('lists all registered connectors', () => {
    registerConnector(mockConnector)
    const list = listConnectors()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('test_platform')
  })

  it('does not list connectors from previous tests after reset', () => {
    expect(listConnectors()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/lib/connectors/registry.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/connectors/registry'`

- [ ] **Step 3: Create lib/connectors/types.ts**

```typescript
// lib/connectors/types.ts

export interface ConnectorCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  extra?: Record<string, string>
}

export interface FetchJob {
  tenantId: string
  connectorId: string
  credentials: ConnectorCredentials
  dataType: string
  since: Date
  until: Date
  cursor?: string
}

export interface FetchResult {
  rows: Record<string, unknown>[]
  nextCursor?: string
  rateLimitRemaining?: number
}

export interface Connector {
  readonly id: string
  readonly displayName: string
  readonly authType: 'oauth2' | 'api_key'
  fetch(job: FetchJob): Promise<FetchResult>
  targetTable(dataType: string): string
  refreshCredentials?(creds: ConnectorCredentials): Promise<ConnectorCredentials>
}
```

- [ ] **Step 4: Create lib/connectors/registry.ts**

```typescript
// lib/connectors/registry.ts
import type { Connector } from './types'

const registry = new Map<string, Connector>()

export function registerConnector(connector: Connector): void {
  registry.set(connector.id, connector)
}

export function getConnector(id: string): Connector {
  const connector = registry.get(id)
  if (!connector) throw new Error(`Unknown connector: ${id}`)
  return connector
}

export function listConnectors(): Connector[] {
  return Array.from(registry.values())
}

export function __resetForTests(): void {
  registry.clear()
}
```

- [ ] **Step 5: Run tests to verify passing**

```bash
pnpm test tests/lib/connectors/registry.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add lib/connectors/types.ts lib/connectors/registry.ts tests/lib/connectors/registry.test.ts
git commit -m "feat: connector types + registry"
```

---

### Task 5: Worker Processor

**Files:**
- Create: `lib/worker/processor.ts`
- Create: `tests/lib/worker/processor.test.ts`

**Interfaces:**
- Consumes: `getConnector(id: string): Connector` from `@/lib/connectors/registry`; `insertRows(table: string, rows: Record<string, unknown>[]): Promise<void>` from `@/lib/clickhouse/queries`; `FetchJob` from `@/lib/connectors/types`
- Produces: `processJob(job: FetchJob): Promise<ProcessResult>` where `ProcessResult = { rowsIngested: number; pages: number }`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/worker/processor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/connectors/registry', () => ({
  getConnector: vi.fn(),
}))
vi.mock('@/lib/clickhouse/queries', () => ({
  insertRows: vi.fn().mockResolvedValue(undefined),
}))

import { processJob } from '@/lib/worker/processor'
import { getConnector } from '@/lib/connectors/registry'
import { insertRows } from '@/lib/clickhouse/queries'
import type { FetchJob } from '@/lib/connectors/types'

const baseJob: FetchJob = {
  tenantId: 'tenant-1',
  connectorId: 'shopify',
  credentials: { accessToken: 'tok', extra: { shop_url: 'x.myshopify.com' } },
  dataType: 'orders',
  since: new Date('2024-01-01'),
  until: new Date('2024-01-02'),
}

describe('processJob', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls insertRows with fetched rows', async () => {
    const rows = [{ order_id: '1', raw: '{}', tenant_id: 'tenant-1' }]
    vi.mocked(getConnector).mockReturnValue({
      id: 'shopify',
      displayName: 'Shopify',
      authType: 'oauth2',
      fetch: vi.fn().mockResolvedValue({ rows, nextCursor: undefined }),
      targetTable: () => 'shopify_orders',
    })

    const result = await processJob(baseJob)

    expect(insertRows).toHaveBeenCalledWith('shopify_orders', rows)
    expect(result.rowsIngested).toBe(1)
    expect(result.pages).toBe(1)
  })

  it('paginates until nextCursor is undefined', async () => {
    const page1 = [{ order_id: '1', raw: '{}', tenant_id: 'tenant-1' }]
    const page2 = [{ order_id: '2', raw: '{}', tenant_id: 'tenant-1' }]
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ rows: page1, nextCursor: 'cursor-abc' })
      .mockResolvedValueOnce({ rows: page2, nextCursor: undefined })

    vi.mocked(getConnector).mockReturnValue({
      id: 'shopify', displayName: 'Shopify', authType: 'oauth2',
      fetch: mockFetch,
      targetTable: () => 'shopify_orders',
    })

    const result = await processJob(baseJob)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.rowsIngested).toBe(2)
    expect(result.pages).toBe(2)
  })

  it('skips insertRows when fetch returns no rows', async () => {
    vi.mocked(getConnector).mockReturnValue({
      id: 'shopify', displayName: 'Shopify', authType: 'oauth2',
      fetch: vi.fn().mockResolvedValue({ rows: [], nextCursor: undefined }),
      targetTable: () => 'shopify_orders',
    })

    await processJob(baseJob)
    expect(insertRows).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/lib/worker/processor.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/worker/processor'`

- [ ] **Step 3: Create lib/worker/processor.ts**

```typescript
// lib/worker/processor.ts
import { getConnector } from '@/lib/connectors/registry'
import { insertRows } from '@/lib/clickhouse/queries'
import type { FetchJob } from '@/lib/connectors/types'

export interface ProcessResult {
  rowsIngested: number
  pages: number
}

export async function processJob(job: FetchJob): Promise<ProcessResult> {
  const connector = getConnector(job.connectorId)
  let cursor: string | undefined = job.cursor
  let rowsIngested = 0
  let pages = 0

  do {
    const result = await connector.fetch({ ...job, cursor })
    const table = connector.targetTable(job.dataType)

    if (result.rows.length > 0) {
      await insertRows(table, result.rows)
      rowsIngested += result.rows.length
    }

    cursor = result.nextCursor
    pages++
  } while (cursor !== undefined)

  return { rowsIngested, pages }
}
```

- [ ] **Step 4: Run tests to verify passing**

```bash
pnpm test tests/lib/worker/processor.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/worker/ tests/lib/worker/
git commit -m "feat: worker processor — paginated fetch loop → ClickHouse write"
```

---

### Task 6: Shopify Connector

**Files:**
- Create: `lib/connectors/shopify/index.ts`
- Create: `tests/lib/connectors/shopify.test.ts`

**Interfaces:**
- Consumes: `Connector`, `FetchJob`, `FetchResult` from `@/lib/connectors/types`
- Produces: `shopifyConnector: Connector` — handles `dataType` values `'orders'` and `'products'`; `targetTable('orders') === 'shopify_orders'`, `targetTable('products') === 'shopify_products'`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/connectors/shopify.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { shopifyConnector } from '@/lib/connectors/shopify'
import type { FetchJob } from '@/lib/connectors/types'

const baseJob: FetchJob = {
  tenantId: 'tenant-1',
  connectorId: 'shopify',
  credentials: {
    accessToken: 'shpat_test123',
    extra: { shop_url: 'teststore.myshopify.com' },
  },
  dataType: 'orders',
  since: new Date('2024-01-01T00:00:00Z'),
  until: new Date('2024-01-02T00:00:00Z'),
}

describe('shopifyConnector', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('has id "shopify" and authType "oauth2"', () => {
    expect(shopifyConnector.id).toBe('shopify')
    expect(shopifyConnector.authType).toBe('oauth2')
  })

  it('maps orders to shopify_orders table', () => {
    expect(shopifyConnector.targetTable('orders')).toBe('shopify_orders')
  })

  it('maps products to shopify_products table', () => {
    expect(shopifyConnector.targetTable('products')).toBe('shopify_products')
  })

  it('fetches orders and returns normalized rows with raw field', async () => {
    const apiOrder = {
      id: 12345,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
      total_price: '99.99',
      currency: 'USD',
      financial_status: 'paid',
      fulfillment_status: null,
      customer: { id: 67890 },
      email: 'test@example.com',
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [apiOrder] }),
      headers: { get: () => null, has: () => false },
    })

    const result = await shopifyConnector.fetch(baseJob)

    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.tenant_id).toBe('tenant-1')
    expect(row.order_id).toBe('12345')
    expect(row.raw).toBe(JSON.stringify(apiOrder))
    expect(row.total_price).toBe(99.99)
    expect(result.nextCursor).toBeUndefined()
  })

  it('sends page_info cursor on paginated requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [] }),
      headers: { get: () => null, has: () => false },
    })

    await shopifyConnector.fetch({ ...baseJob, cursor: 'page_info_abc' })

    const calledUrl = new URL(mockFetch.mock.calls[0][0] as string)
    expect(calledUrl.searchParams.get('page_info')).toBe('page_info_abc')
  })

  it('throws on non-ok HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(shopifyConnector.fetch(baseJob)).rejects.toThrow('Shopify API error: 401')
  })

  it('throws when shop_url is missing from credentials', async () => {
    const badJob: FetchJob = { ...baseJob, credentials: { accessToken: 'tok' } }
    await expect(shopifyConnector.fetch(badJob)).rejects.toThrow('shop_url')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/lib/connectors/shopify.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/connectors/shopify'`

- [ ] **Step 3: Create lib/connectors/shopify/index.ts**

```typescript
// lib/connectors/shopify/index.ts
import type { Connector, FetchJob, FetchResult } from '@/lib/connectors/types'

const SHOPIFY_API_VERSION = '2024-01'

function ordersUrl(shopUrl: string, since: Date, until: Date, cursor?: string): string {
  const params = new URLSearchParams({ limit: '250', status: 'any' })
  if (cursor) {
    params.set('page_info', cursor)
  } else {
    params.set('created_at_min', since.toISOString())
    params.set('created_at_max', until.toISOString())
  }
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/orders.json?${params}`
}

function productsUrl(shopUrl: string, cursor?: string): string {
  const params = new URLSearchParams({ limit: '250' })
  if (cursor) params.set('page_info', cursor)
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/products.json?${params}`
}

function extractNextCursor(headers: { has(h: string): boolean; get(h: string): string | null }): string | undefined {
  if (!headers.has('Link')) return undefined
  const link = headers.get('Link') ?? ''
  const match = link.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
  return match?.[1]
}

async function shopifyFetch(
  url: string,
  accessToken: string,
): Promise<{ body: Record<string, unknown>; nextCursor: string | undefined }> {
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(`Shopify API error: ${response.status}`)
  const body = (await response.json()) as Record<string, unknown>
  return { body, nextCursor: extractNextCursor(response.headers) }
}

export const shopifyConnector: Connector = {
  id: 'shopify',
  displayName: 'Shopify',
  authType: 'oauth2',

  targetTable(dataType: string): string {
    return `shopify_${dataType}`
  },

  async fetch(job: FetchJob): Promise<FetchResult> {
    const shopUrl = job.credentials.extra?.shop_url
    if (!shopUrl) throw new Error('Shopify connector requires credentials.extra.shop_url')

    if (job.dataType === 'orders') {
      const url = ordersUrl(shopUrl, job.since, job.until, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const orders = (body.orders as Record<string, unknown>[]) ?? []
      return {
        rows: orders.map((order) => ({
          tenant_id: job.tenantId,
          raw: JSON.stringify(order),
          order_id: String(order.id),
          created_at: order.created_at,
          updated_at: order.updated_at,
          total_price: Number(order.total_price ?? 0),
          currency: order.currency ?? '',
          financial_status: order.financial_status ?? '',
          fulfillment_status: order.fulfillment_status ?? '',
          customer_id: String((order.customer as Record<string, unknown> | null)?.id ?? ''),
          email: order.email ?? '',
        })),
        nextCursor,
      }
    }

    if (job.dataType === 'products') {
      const url = productsUrl(shopUrl, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const products = (body.products as Record<string, unknown>[]) ?? []
      return {
        rows: products.map((product) => ({
          tenant_id: job.tenantId,
          raw: JSON.stringify(product),
          product_id: String(product.id),
          title: product.title ?? '',
          vendor: product.vendor ?? '',
          product_type: product.product_type ?? '',
          status: product.status ?? '',
          created_at: product.created_at,
          updated_at: product.updated_at,
        })),
        nextCursor,
      }
    }

    throw new Error(`Shopify connector: unsupported dataType "${job.dataType}"`)
  },
}
```

- [ ] **Step 4: Run tests to verify passing**

```bash
pnpm test tests/lib/connectors/shopify.test.ts
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add lib/connectors/shopify/ tests/lib/connectors/shopify.test.ts
git commit -m "feat: Shopify connector — orders + products with Link header pagination"
```

---

### Task 7: Meta Ads Connector

**Files:**
- Create: `lib/connectors/meta-ads/index.ts`
- Create: `tests/lib/connectors/meta-ads.test.ts`

**Interfaces:**
- Consumes: `Connector`, `FetchJob`, `FetchResult` from `@/lib/connectors/types`
- Produces: `metaAdsConnector: Connector` — handles `dataType` values `'campaigns'` and `'insights'`; `targetTable('campaigns') === 'meta_ads_campaigns'`, `targetTable('insights') === 'meta_ads_insights'`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/connectors/meta-ads.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { metaAdsConnector } from '@/lib/connectors/meta-ads'
import type { FetchJob } from '@/lib/connectors/types'

const baseJob: FetchJob = {
  tenantId: 'tenant-1',
  connectorId: 'meta_ads',
  credentials: {
    accessToken: 'EAAtest123',
    extra: { account_id: 'act_123456789' },
  },
  dataType: 'campaigns',
  since: new Date('2024-01-01T00:00:00Z'),
  until: new Date('2024-01-02T00:00:00Z'),
}

describe('metaAdsConnector', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('has id "meta_ads" and authType "oauth2"', () => {
    expect(metaAdsConnector.id).toBe('meta_ads')
    expect(metaAdsConnector.authType).toBe('oauth2')
  })

  it('maps campaigns to meta_ads_campaigns table', () => {
    expect(metaAdsConnector.targetTable('campaigns')).toBe('meta_ads_campaigns')
  })

  it('maps insights to meta_ads_insights table', () => {
    expect(metaAdsConnector.targetTable('insights')).toBe('meta_ads_insights')
  })

  it('fetches campaigns and returns normalized rows with raw field', async () => {
    const apiCampaign = {
      id: 'cmp_1',
      account_id: 'act_123456789',
      name: 'Test Campaign',
      status: 'ACTIVE',
      objective: 'LINK_CLICKS',
      created_time: '2024-01-01T00:00:00+0000',
      updated_time: '2024-01-01T12:00:00+0000',
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [apiCampaign], paging: {} }),
    })

    const result = await metaAdsConnector.fetch(baseJob)

    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.campaign_id).toBe('cmp_1')
    expect(row.tenant_id).toBe('tenant-1')
    expect(row.raw).toBe(JSON.stringify(apiCampaign))
    expect(result.nextCursor).toBeUndefined()
  })

  it('extracts next cursor from paging.cursors.after when paging.next exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        paging: { cursors: { after: 'cursor_xyz' }, next: 'https://graph.facebook.com/...' },
      }),
    })

    const result = await metaAdsConnector.fetch(baseJob)
    expect(result.nextCursor).toBe('cursor_xyz')
  })

  it('throws when Meta API returns an error object', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: { message: 'Invalid OAuth token', code: 190 } }),
    })
    await expect(metaAdsConnector.fetch(baseJob)).rejects.toThrow('Meta API error 190: Invalid OAuth token')
  })

  it('throws when account_id is missing from credentials', async () => {
    const badJob: FetchJob = { ...baseJob, credentials: { accessToken: 'tok' } }
    await expect(metaAdsConnector.fetch(badJob)).rejects.toThrow('account_id')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test tests/lib/connectors/meta-ads.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/connectors/meta-ads'`

- [ ] **Step 3: Create lib/connectors/meta-ads/index.ts**

```typescript
// lib/connectors/meta-ads/index.ts
import type { Connector, FetchJob, FetchResult } from '@/lib/connectors/types'

const META_API = 'https://graph.facebook.com/v19.0'

async function callMeta(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Meta HTTP error: ${response.status}`)
  const body = (await response.json()) as Record<string, unknown>
  if (body.error) {
    const err = body.error as Record<string, unknown>
    throw new Error(`Meta API error ${err.code}: ${err.message}`)
  }
  return body
}

function getNextCursor(paging: Record<string, unknown> | undefined): string | undefined {
  if (!paging?.next) return undefined
  return (paging.cursors as Record<string, string> | undefined)?.after
}

export const metaAdsConnector: Connector = {
  id: 'meta_ads',
  displayName: 'Meta Ads',
  authType: 'oauth2',

  targetTable(dataType: string): string {
    return `meta_ads_${dataType}`
  },

  async fetch(job: FetchJob): Promise<FetchResult> {
    const accountId = job.credentials.extra?.account_id
    if (!accountId) throw new Error('Meta Ads connector requires credentials.extra.account_id')
    const token = job.credentials.accessToken

    if (job.dataType === 'campaigns') {
      const params = new URLSearchParams({
        access_token: token,
        fields: 'id,account_id,name,status,objective,created_time,updated_time',
        limit: '200',
      })
      if (job.cursor) params.set('after', job.cursor)

      const body = await callMeta(`${META_API}/${accountId}/campaigns?${params}`)
      const data = (body.data as Record<string, unknown>[]) ?? []
      const paging = body.paging as Record<string, unknown> | undefined

      return {
        rows: data.map((c) => ({
          tenant_id: job.tenantId,
          raw: JSON.stringify(c),
          campaign_id: c.id,
          account_id: c.account_id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          created_time: c.created_time,
          updated_time: c.updated_time,
        })),
        nextCursor: getNextCursor(paging),
      }
    }

    if (job.dataType === 'insights') {
      const params = new URLSearchParams({
        access_token: token,
        fields: 'ad_id,account_id,campaign_id,adset_id,date_start,impressions,clicks,spend,reach',
        level: 'ad',
        time_range: JSON.stringify({
          since: job.since.toISOString().split('T')[0],
          until: job.until.toISOString().split('T')[0],
        }),
        limit: '200',
      })
      if (job.cursor) params.set('after', job.cursor)

      const body = await callMeta(`${META_API}/${accountId}/insights?${params}`)
      const data = (body.data as Record<string, unknown>[]) ?? []
      const paging = body.paging as Record<string, unknown> | undefined

      return {
        rows: data.map((i) => ({
          tenant_id: job.tenantId,
          raw: JSON.stringify(i),
          ad_id: i.ad_id,
          account_id: i.account_id,
          campaign_id: i.campaign_id,
          adset_id: i.adset_id,
          date_start: i.date_start,
          impressions: Number(i.impressions ?? 0),
          clicks: Number(i.clicks ?? 0),
          spend: Number(i.spend ?? 0),
          reach: Number(i.reach ?? 0),
        })),
        nextCursor: getNextCursor(paging),
      }
    }

    throw new Error(`Meta Ads connector: unsupported dataType "${job.dataType}"`)
  },
}
```

- [ ] **Step 4: Run tests to verify passing**

```bash
pnpm test tests/lib/connectors/meta-ads.test.ts
```

Expected: PASS — 6 tests

- [ ] **Step 5: Run all tests to confirm nothing broken**

```bash
pnpm test
```

Expected: all prior tests still passing (13 total)

- [ ] **Step 6: Commit**

```bash
git add lib/connectors/meta-ads/ tests/lib/connectors/meta-ads.test.ts
git commit -m "feat: Meta Ads connector — campaigns + insights with cursor pagination"
```

---

### Task 8: BFF API Routes (Channels + OAuth + Sync)

**Files:**
- Create: `app/api/channels/route.ts`
- Create: `app/api/channels/[id]/route.ts`
- Create: `app/api/oauth/shopify/route.ts`
- Create: `app/api/oauth/shopify/callback/route.ts`
- Create: `app/api/oauth/meta/route.ts`
- Create: `app/api/oauth/meta/callback/route.ts`
- Create: `app/api/sync/route.ts`
- Create: `app/api/sync/process/route.ts`

**Interfaces:**
- Consumes: `createClient()` and `createServiceClient()` from `@/lib/supabase/server`; `processJob(job: FetchJob): Promise<ProcessResult>` from `@/lib/worker/processor`; `registerConnector` from `@/lib/connectors/registry`; `shopifyConnector` and `metaAdsConnector`
- Produces: REST endpoints as described below

- [ ] **Step 1: Create app/api/channels/route.ts**

```typescript
// app/api/channels/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { data: connections, error } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(connections)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const body = await request.json() as {
    connector_id: string
    display_name: string
    extra?: Record<string, string>
  }

  const { data, error } = await supabase
    .from('channel_connections')
    .insert({ tenant_id: tenant.id, connector_id: body.connector_id, display_name: body.display_name, extra: body.extra ?? {} })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create app/api/channels/[id]/route.ts**

```typescript
// app/api/channels/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('channel_connections').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Create app/api/oauth/shopify/route.ts**

```typescript
// app/api/oauth/shopify/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SCOPES = 'read_orders,read_products,read_customers'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')
  if (!shop) return NextResponse.json({ error: 'shop param required' }, { status: 400 })

  const nonce = crypto.randomUUID()
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/shopify/callback`
  const installUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: process.env.SHOPIFY_CLIENT_ID!,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: nonce,
  })

  const res = NextResponse.redirect(installUrl)
  res.cookies.set('shopify_oauth_nonce', nonce, { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  res.cookies.set('shopify_oauth_shop', shop, { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  return res
}
```

- [ ] **Step 4: Create app/api/oauth/shopify/callback/route.ts**

```typescript
// app/api/oauth/shopify/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const shop = searchParams.get('shop')

  const cookieStore = await cookies()
  const nonce = cookieStore.get('shopify_oauth_nonce')?.value
  const savedShop = cookieStore.get('shopify_oauth_shop')?.value

  if (!code || !state || !shop || state !== nonce || shop !== savedShop) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
      code,
    }),
  })
  if (!tokenRes.ok) return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.redirect(new URL('/dashboard', request.url))

  const service = await createServiceClient()
  const { data: connection, error } = await service
    .from('channel_connections')
    .insert({ tenant_id: tenant.id, connector_id: 'shopify', display_name: shop, extra: { shop_url: shop } })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service
    .from('channel_credentials')
    .insert({ connection_id: connection.id, access_token })

  const redirect = NextResponse.redirect(new URL('/channels', request.url))
  redirect.cookies.delete('shopify_oauth_nonce')
  redirect.cookies.delete('shopify_oauth_shop')
  return redirect
}
```

- [ ] **Step 5: Create app/api/oauth/meta/route.ts**

```typescript
// app/api/oauth/meta/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SCOPES = 'ads_read,ads_management,business_management,read_insights'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const nonce = crypto.randomUUID()
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/meta/callback`
  const authUrl = 'https://www.facebook.com/v19.0/dialog/oauth?' + new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state: nonce,
    response_type: 'code',
  })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('meta_oauth_nonce', nonce, { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  return res
}
```

- [ ] **Step 6: Create app/api/oauth/meta/callback/route.ts**

```typescript
// app/api/oauth/meta/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const nonce = cookieStore.get('meta_oauth_nonce')?.value
  if (!code || !state || state !== nonce) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/meta/callback`
  const tokenRes = await fetch(
    'https://graph.facebook.com/v19.0/oauth/access_token?' +
    new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    })
  )
  if (!tokenRes.ok) return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  // Fetch the first ad account for this user
  const accountsRes = await fetch(
    `https://graph.facebook.com/v19.0/me/adaccounts?access_token=${access_token}&fields=id,name`
  )
  const { data: adAccounts } = (await accountsRes.json()) as { data: Array<{ id: string; name: string }> }
  const firstAccount = adAccounts?.[0]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.redirect(new URL('/dashboard', request.url))

  const service = await createServiceClient()
  const { data: connection, error } = await service
    .from('channel_connections')
    .insert({
      tenant_id: tenant.id,
      connector_id: 'meta_ads',
      display_name: firstAccount?.name ?? 'Meta Ads',
      extra: { account_id: firstAccount?.id ?? '' },
    })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service.from('channel_credentials').insert({ connection_id: connection.id, access_token })

  const redirect = NextResponse.redirect(new URL('/channels', request.url))
  redirect.cookies.delete('meta_oauth_nonce')
  return redirect
}
```

- [ ] **Step 7: Create app/api/sync/route.ts**

```typescript
// app/api/sync/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId, dataType } = (await request.json()) as {
    connectionId: string
    dataType: string
  }

  const { data: connection } = await supabase
    .from('channel_connections').select('*').eq('id', connectionId).single()
  if (!connection) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  const until = new Date()
  const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000)

  const { data: job, error } = await supabase
    .from('sync_jobs')
    .insert({
      tenant_id: connection.tenant_id,
      connection_id: connection.id,
      connector_id: connection.connector_id,
      data_type: dataType,
      status: 'pending',
      since: since.toISOString(),
      until: until.toISOString(),
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire and forget — async processing
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  fetch(`${appUrl}/api/sync/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: job.id }),
  }).catch(console.error)

  return NextResponse.json({ jobId: job.id }, { status: 202 })
}
```

- [ ] **Step 8: Create app/api/sync/process/route.ts**

```typescript
// app/api/sync/process/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processJob } from '@/lib/worker/processor'
import { registerConnector } from '@/lib/connectors/registry'
import { shopifyConnector } from '@/lib/connectors/shopify'
import { metaAdsConnector } from '@/lib/connectors/meta-ads'
import type { FetchJob } from '@/lib/connectors/types'

registerConnector(shopifyConnector)
registerConnector(metaAdsConnector)

export async function POST(request: Request) {
  const { jobId } = (await request.json()) as { jobId: string }
  const service = await createServiceClient()

  const { data: syncJob } = await service
    .from('sync_jobs')
    .select('*, channel_connections(extra)')
    .eq('id', jobId)
    .single()
  if (!syncJob) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  await service
    .from('sync_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId)

  const { data: cred } = await service
    .from('channel_credentials')
    .select('access_token, refresh_token, expires_at, extra')
    .eq('connection_id', syncJob.connection_id)
    .single()

  if (!cred) {
    await service.from('sync_jobs').update({ status: 'error', error_message: 'Credentials not found' }).eq('id', jobId)
    return NextResponse.json({ error: 'Credentials not found' }, { status: 500 })
  }

  const connExtra = (syncJob.channel_connections as Record<string, unknown> | null)
    ?.extra as Record<string, string> | undefined

  const job: FetchJob = {
    tenantId: syncJob.tenant_id,
    connectorId: syncJob.connector_id,
    credentials: {
      accessToken: cred.access_token,
      refreshToken: cred.refresh_token ?? undefined,
      expiresAt: cred.expires_at ?? undefined,
      extra: { ...connExtra, ...(cred.extra as Record<string, string>) },
    },
    dataType: syncJob.data_type,
    since: new Date(syncJob.since!),
    until: new Date(syncJob.until!),
  }

  try {
    const result = await processJob(job)
    await service.from('sync_jobs').update({
      status: 'done',
      rows_ingested: result.rowsIngested,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)
    await service.from('channel_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', syncJob.connection_id)
    return NextResponse.json({ rowsIngested: result.rowsIngested })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await service.from('sync_jobs').update({ status: 'error', error_message: message }).eq('id', jobId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 9: Run all tests**

```bash
pnpm test
```

Expected: all 13 prior tests still pass

- [ ] **Step 10: Commit**

```bash
git add app/api/
git commit -m "feat: BFF API routes — channels CRUD, Shopify/Meta OAuth, sync trigger + processor"
```

---

### Task 9: Auth UI

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/client` (browser) and `@/lib/supabase/server` (server)

- [ ] **Step 1: Create app/auth/callback/route.ts**

```typescript
// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

- [ ] **Step 2: Create app/(auth)/login/page.tsx**

```tsx
// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Sign in to Connext</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={signIn} className="space-y-3">
            <Input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Input type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{' '}
            <a href="/signup" className="underline underline-offset-4 hover:text-foreground">
              Sign up
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create app/(auth)/signup/page.tsx**

```tsx
// app/(auth)/signup/page.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const [teamName, setTeamName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('tenants').insert({ name: teamName, owner_auth_id: data.user.id })
    }
    setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm shadow-none border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Check your email to confirm your account.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Create your account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={signUp} className="space-y-3">
            <Input type="text" placeholder="Team or brand name" value={teamName}
              onChange={(e) => setTeamName(e.target.value)} required />
            <Input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password (min 8 chars)" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <a href="/login" className="underline underline-offset-4 hover:text-foreground">
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all tests passing

- [ ] **Step 5: Commit**

```bash
git add app/auth/ "app/(auth)/"
git commit -m "feat: auth UI — login and signup pages with Supabase"
```

---

### Task 10: Dashboard Shell + Sidebar

**Files:**
- Create: `components/sidebar.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`

- [ ] **Step 1: Create components/sidebar.tsx**

```tsx
// components/sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/channels', label: 'Channels' },
  { href: '/data', label: 'Raw Data' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-background px-3 py-4">
      <div className="mb-6 px-3">
        <span className="text-base font-semibold tracking-tight">Connext</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
              pathname === item.href
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Create app/(dashboard)/layout.tsx**

```tsx
// app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create app/(dashboard)/dashboard/page.tsx**

```tsx
// app/(dashboard)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tenant } = await supabase
    .from('tenants').select('name').eq('owner_auth_id', user!.id).single()

  const { count: channelCount } = await supabase
    .from('channel_connections')
    .select('*', { count: 'exact', head: true })

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">{tenant?.name ?? 'Dashboard'}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Connected Channels</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{channelCount ?? 0}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all tests passing

- [ ] **Step 5: Commit**

```bash
git add components/sidebar.tsx "app/(dashboard)/layout.tsx" "app/(dashboard)/dashboard/"
git commit -m "feat: dashboard shell — sidebar + overview page"
```

---

### Task 11: Channels Page + Connect Flow

**Files:**
- Create: `components/channel-card.tsx`
- Create: `app/(dashboard)/channels/page.tsx`
- Create: `app/(dashboard)/channels/connect/[connectorId]/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`; `Database` types from `@/lib/supabase/types`

- [ ] **Step 1: Create components/channel-card.tsx**

```tsx
// components/channel-card.tsx
import { Badge } from '@/components/ui/badge'
import type { Database } from '@/lib/supabase/types'

type ChannelConnection = Database['public']['Tables']['channel_connections']['Row']

const CONNECTOR_LABELS: Record<string, string> = {
  shopify: 'Shopify',
  meta_ads: 'Meta Ads',
}

export function ChannelCard({ connection }: { connection: ChannelConnection }) {
  const variantMap: Record<string, 'default' | 'destructive' | 'secondary'> = {
    active: 'default',
    error: 'destructive',
    paused: 'secondary',
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div>
        <p className="text-sm font-medium">
          {connection.display_name || CONNECTOR_LABELS[connection.connector_id] || connection.connector_id}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {connection.last_synced_at
            ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
            : 'Never synced'}
        </p>
      </div>
      <Badge variant={variantMap[connection.status] ?? 'secondary'}>{connection.status}</Badge>
    </div>
  )
}
```

- [ ] **Step 2: Create app/(dashboard)/channels/page.tsx**

```tsx
// app/(dashboard)/channels/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChannelCard } from '@/components/channel-card'

const AVAILABLE_CONNECTORS = [
  { id: 'shopify', label: 'Shopify' },
  { id: 'meta_ads', label: 'Meta Ads' },
]

export default async function ChannelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user!.id).single()

  const { data: connections } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('tenant_id', tenant!.id)
    .order('created_at', { ascending: false })

  const connectedIds = new Set((connections ?? []).map((c) => c.connector_id))

  const available = AVAILABLE_CONNECTORS.filter((c) => !connectedIds.has(c.id))

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Channels</h1>

      {connections && connections.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Connected</p>
          <div className="space-y-2">
            {connections.map((c) => <ChannelCard key={c.id} connection={c} />)}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Add a channel</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {available.map((connector) => (
              <Link
                key={connector.id}
                href={`/channels/connect/${connector.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
              >
                {connector.label}
                <span className="text-muted-foreground text-base leading-none">+</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create app/(dashboard)/channels/connect/[connectorId]/page.tsx**

```tsx
// app/(dashboard)/channels/connect/[connectorId]/page.tsx
import { redirect } from 'next/navigation'

const CONNECTOR_INFO: Record<string, { label: string; description: string; oauthPath: string; needsShop?: boolean }> = {
  shopify: {
    label: 'Shopify',
    description: 'Import orders, products, and customer data from your Shopify store.',
    oauthPath: '/api/oauth/shopify',
    needsShop: true,
  },
  meta_ads: {
    label: 'Meta Ads',
    description: 'Pull campaign performance and ad insights from Meta Ads Manager.',
    oauthPath: '/api/oauth/meta',
  },
}

export default async function ConnectPage({
  params,
}: {
  params: Promise<{ connectorId: string }>
}) {
  const { connectorId } = await params
  const info = CONNECTOR_INFO[connectorId]
  if (!info) redirect('/channels')

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-1">Connect {info.label}</h1>
      <p className="text-sm text-muted-foreground mb-6">{info.description}</p>

      {info.needsShop ? (
        <form action={info.oauthPath} method="GET">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Shopify store URL</label>
            <div className="flex items-center gap-2">
              <input
                name="shop"
                type="text"
                placeholder="yourstore"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                required
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.myshopify.com</span>
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Connect with {info.label}
          </button>
        </form>
      ) : (
        <a
          href={info.oauthPath}
          className="block w-full rounded-md bg-foreground px-4 py-2 text-center text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Connect with {info.label}
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all tests passing

- [ ] **Step 5: Commit**

```bash
git add components/channel-card.tsx "app/(dashboard)/channels/"
git commit -m "feat: channels page — ChannelCard list + OAuth connect flow"
```

---

### Task 12: Raw Data Viewer

**Files:**
- Create: `components/data-table.tsx`
- Create: `app/api/data/route.ts`
- Create: `app/(dashboard)/data/page.tsx`

**Interfaces:**
- Consumes: `queryRows<T>()` from `@/lib/clickhouse/queries`; `createClient()` and `createServiceClient()` from `@/lib/supabase/server`

- [ ] **Step 1: Create app/api/data/route.ts**

```typescript
// app/api/data/route.ts
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { queryRows } from '@/lib/clickhouse/queries'

const ALLOWED_TABLES = new Set([
  'shopify_orders',
  'shopify_products',
  'meta_ads_campaigns',
  'meta_ads_insights',
])

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service client to bypass RLS when reading from tenants table
  const service = await createServiceClient()
  const { data: tenant } = await service
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table') ?? 'shopify_orders'
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200)

  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
  }

  const rows = await queryRows(
    `SELECT * FROM ${table} WHERE tenant_id = {tenantId:String} ORDER BY ingested_at DESC LIMIT {limit:UInt32}`,
    { tenantId: tenant.id, limit },
  )

  return NextResponse.json({ rows, table })
}
```

- [ ] **Step 2: Create components/data-table.tsx**

```tsx
// components/data-table.tsx
type Row = Record<string, unknown>

export function DataTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No data yet. Trigger a sync from the Channels page to load data.
      </p>
    )
  }

  const columns = Object.keys(rows[0]).filter((k) => k !== 'raw')

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/40 transition-colors">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-xs text-foreground max-w-48 truncate">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Create app/(dashboard)/data/page.tsx**

```tsx
// app/(dashboard)/data/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { DataTable } from '@/components/data-table'

const TABLES = [
  { value: 'shopify_orders', label: 'Shopify Orders' },
  { value: 'shopify_products', label: 'Shopify Products' },
  { value: 'meta_ads_campaigns', label: 'Meta Campaigns' },
  { value: 'meta_ads_insights', label: 'Meta Insights' },
]

export default function DataPage() {
  const [table, setTable] = useState('shopify_orders')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/data?table=${table}&limit=50`)
      .then((r) => r.json())
      .then(({ rows, error }) => {
        if (error) setError(error)
        else setRows(rows ?? [])
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }, [table])

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold">Raw Data</h1>
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TABLES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable rows={rows} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: all 13 tests passing

- [ ] **Step 5: Commit**

```bash
git add components/data-table.tsx app/api/data/ "app/(dashboard)/data/"
git commit -m "feat: raw data viewer — ClickHouse-backed table with connector selector"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task |
|---|---|
| Next.js project scaffold in `/Users/dhkim/Desktop/connext` | Task 1 |
| Supabase: tenants, channel_connections, sync_jobs + RLS | Task 2 |
| ClickHouse: base table DDL, partition strategy | Task 3 |
| Connector registry + base types | Task 4 |
| Queue/Worker infrastructure | Task 5 |
| Shopify connector — orders, products | Task 6 |
| Meta Ads connector — campaigns, insights | Task 7 |
| Tenant onboarding UI (auth) | Task 9 |
| Channel connection page (Claude-style) | Task 10, 11 |
| Basic raw data viewer | Task 12 |
| `raw` column preserved on all ClickHouse tables | Tasks 3, 6, 7 |
| Multi-tenant isolation via tenant_id + RLS | Tasks 2, 3, all API routes |
| Loop test gate on every task | Global Constraints + every commit step |

### 2. Placeholder Scan

No TBD, TODO, or "handle edge cases" patterns found. Every step has concrete code or commands.

### 3. Type Consistency

- `ConnectorCredentials`, `FetchJob`, `FetchResult`, `Connector` — defined in Task 4, used identically in Tasks 5, 6, 7, 8
- `processJob(job: FetchJob): Promise<ProcessResult>` — defined in Task 5, called in Task 8 with a correctly-shaped `FetchJob`
- `insertRows(table: string, rows: Record<string, unknown>[]): Promise<void>` — defined in Task 3, called in Task 5 with exact signature
- `getConnector(id: string): Connector` — defined in Task 4, called in Task 5
- `createClient()` / `createServiceClient()` — defined in Task 2, used throughout Tasks 8–12 with `await`
- `Database['public']['Tables']['channel_connections']['Row']` — defined in Task 2, used in Task 11's `ChannelCard`
