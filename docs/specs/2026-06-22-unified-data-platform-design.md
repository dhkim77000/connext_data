# Unified Data Platform — System Design Spec

**Date:** 2026-06-22  
**Project:** connext  
**Status:** Approved

---

## 1. Overview

Multi-tenant SaaS that ingests raw data from ecommerce and ad platform APIs (global + Korean domestic), stores it in ClickHouse, and exposes it through a unified dashboard. Ontology/semantic normalization is deferred to the final phase.

**Core value:** Data availability first. A brand or seller gets all their platform data in one place, queryable, before any normalization layer is introduced.

---

## 2. Architecture (Option C)

### 2.1 Layer Overview

```
Tenants (sellers/brands)
        │
        ▼
Next.js — FDE / connext
  Dashboard UI · BFF API Routes · Tenant management · Channel setup (Claude-style UI)
        │                          │
        ▼                          ▼
Supabase                   Queue + Scheduler
Auth · Tenant DB            Vercel Queues / BullMQ + Redis
OAuth Vault                 Rate limit control · Retry · Priority · Scheduling
Row-level security          ─────────────────────────────────
                                        │
                                        ▼
                             Connector Workers
               [Shopify] [Meta Ads] [YouTube] [TikTok Ads] [Google Ads] [Naver] [Cafe24] …
                    │                                                  │
                    ▼                                                  ▼
            External APIs (3rd Party)                          ClickHouse
            Shopify · Meta · YouTube · TikTok · …          Raw Data Warehouse
            Naver Commerce · Cafe24 · …                     Tenant partitioning · Analytics queries
```

**Read path:** Next.js BFF queries ClickHouse directly for dashboard rendering.

### 2.2 Multi-Tenant Isolation

- **Supabase:** Row-level security on all tables — `tenant_id = auth.uid()`
- **ClickHouse:** Every table has `tenant_id` as the first partition column. No cross-tenant queries possible at the schema level.
- **Workers:** Job payload always carries `tenant_id`. Credentials are injected from Supabase Vault per-tenant; cross-tenant credential access is structurally impossible.

### 2.3 Technology Stack

| Layer | Technology |
|---|---|
| Web / BFF | Next.js (App Router) |
| Auth + Control DB | Supabase (Postgres + RLS) |
| Credential Vault | Supabase Vault (encrypted secrets) |
| Queue + Scheduler | Vercel Queues (기본) — BullMQ+Redis는 self-hosted 전환 시 대안 |
| Raw Data Warehouse | ClickHouse (기존 인프라 활용) |
| Connector Workers | Next.js API route handlers (Vercel Functions 위에서 실행) |

---

## 3. Connector Interface

Every platform connector implements one interface. The registry pattern means adding a new channel never requires modifying existing code.

### 3.1 Core Types

```typescript
interface ConnectorCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  extra?: Record<string, string>  // shop_url, account_id, etc.
}

interface FetchJob {
  tenantId: string
  connectorId: string           // 'shopify' | 'meta_ads' | 'youtube' | ...
  credentials: ConnectorCredentials
  dataType: string              // 'orders' | 'campaigns' | 'analytics' | ...
  since: Date
  until: Date
  cursor?: string
}

interface FetchResult {
  rows: Record<string, unknown>[]
  nextCursor?: string           // undefined = done
  rateLimitRemaining?: number
}

interface Connector {
  readonly id: string
  readonly displayName: string
  readonly authType: 'oauth2' | 'api_key'

  fetch(job: FetchJob): Promise<FetchResult>
  targetTable(dataType: string): string  // → ClickHouse table name
  refreshCredentials?(creds: ConnectorCredentials): Promise<ConnectorCredentials>
}
```

### 3.2 Registry

```typescript
// lib/connectors/registry.ts
const registry = new Map<string, Connector>()
export const registerConnector = (c: Connector) => registry.set(c.id, c)
export const getConnector = (id: string): Connector => {
  const c = registry.get(id)
  if (!c) throw new Error(`Unknown connector: ${id}`)
  return c
}
```

### 3.3 Connector File Structure

```
lib/connectors/
  types.ts              ← ConnectorCredentials, FetchJob, FetchResult, Connector
  registry.ts           ← registerConnector, getConnector
  shopify/index.ts
  meta-ads/index.ts
  youtube/index.ts
  tiktok-ads/index.ts
  google-ads/index.ts
  naver/index.ts
  cafe24/index.ts
```

### 3.4 Rate Limit Responsibilities

Rate limit handling lives **inside each connector** (not the queue layer), because limits are platform-specific:

| Platform | Limit | Handling |
|---|---|---|
| GA4 | 200k tokens/day | Token bucket inside connector |
| YouTube | 10k units/day | Unit counting per request |
| Meta | Business Use Case-based | Retry on 429 with backoff |
| Naver Commerce | 2 RPS | Sleep between requests |
| Cafe24 | 2 req/sec | Same as Naver |
| TikTok | 600 req/min | Token bucket |

The queue scheduler runs a **separate lane for Korean domestic channels** to prevent their strict rate limits from blocking global channel jobs.

---

## 4. ClickHouse Schema Design

### 4.1 Table Naming Convention

```
{connector_id}_{data_type}
shopify_orders
shopify_products
meta_ads_campaigns
meta_ads_ad_insights
youtube_channel_analytics
tiktok_ads_campaigns
naver_orders
```

### 4.2 Required Columns (all tables)

```sql
CREATE TABLE shopify_orders (
  tenant_id     String,      -- partition key, always first
  ingested_at   DateTime,    -- when we pulled it
  raw           String,      -- full JSON blob from the API
  -- platform-specific extracted columns below
  order_id      String,
  created_at    DateTime,
  total_price   Decimal(18,4),
  currency      String,
  ...
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, created_at, order_id);
```

`raw` column stores the full API response JSON so we never lose data when we later add new extracted columns.

---

## 5. Supabase Schema

### 5.1 Core Tables

```sql
-- Tenants
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'free',
  created_at  timestamptz DEFAULT now()
);

-- Channel connections per tenant
CREATE TABLE channel_connections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id  text NOT NULL,        -- 'shopify', 'meta_ads', ...
  display_name  text,                 -- "My Shopify Store"
  status        text DEFAULT 'active', -- 'active' | 'error' | 'paused'
  last_synced_at timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- Encrypted credentials (Supabase Vault)
-- Each channel_connection has a corresponding vault secret

-- Sync jobs (queue state tracking)
CREATE TABLE sync_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES tenants(id),
  connection_id   uuid REFERENCES channel_connections(id),
  connector_id    text NOT NULL,
  data_type       text NOT NULL,
  status          text DEFAULT 'pending',  -- 'pending' | 'running' | 'done' | 'error'
  since           timestamptz,
  until           timestamptz,
  rows_ingested   int DEFAULT 0,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz DEFAULT now()
);
```

### 5.2 RLS Policies

Phase 1에서는 **1 tenant = 1 auth user** 단순화. 이후 multi-user-per-tenant는 별도 `tenant_members` 테이블로 확장.

```sql
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON channel_connections
  USING (tenant_id = (
    SELECT id FROM tenants WHERE owner_auth_id = auth.uid() LIMIT 1
  ));

-- tenants 테이블에 owner_auth_id 컬럼 추가
ALTER TABLE tenants ADD COLUMN owner_auth_id uuid REFERENCES auth.users(id);

-- Same pattern for sync_jobs
```

---

## 6. UI Design Direction

**Connector management UI follows Claude.ai visual style:**
- Minimal, clean typography
- Dark/light mode support
- Sidebar navigation
- Card-based connector status display
- Simple step-by-step OAuth connection flows
- Status indicators: connected (green) / error (red) / syncing (spinner)

**Key screens:**
1. Dashboard home — high-level metric cards per connected channel
2. Channels page — list of connected/available channels (Claude-style cards)
3. Channel detail — sync status, last sync time, data types enabled
4. Connect new channel — OAuth flow, minimal steps
5. Raw data explorer — table view of ingested data, filterable by date

---

## 7. Phase Roadmap

### Phase 1 — Foundation + Core Global Channels

**Deliverables:**
- Next.js project scaffold in `/Users/dhkim/Desktop/connext`
- Supabase project: tenants, channel_connections, sync_jobs tables + RLS
- ClickHouse: base table designs, partition strategy
- Queue/Worker infrastructure (Vercel Queues or BullMQ)
- Connector registry + base types
- **Shopify connector** — orders, products, customers
- **Meta Ads connector** — campaigns, ad sets, ads, insights
- Tenant onboarding UI, channel connection page (Claude-style)
- Basic raw data viewer

### Phase 2 — Global Ad/Analytics Channels

**Deliverables:**
- **YouTube Analytics connector** — channel analytics, video metrics
- **TikTok Ads connector** — campaigns, ad groups, creatives, insights
- **Google Ads connector** — campaigns, ad groups, keywords, performance
- GA4 connector (optional, lower priority)
- Per-channel dashboard widgets, date range filtering

### Phase 3 — Korean Domestic Channels

**Deliverables:**
- **Naver 스마트스토어 connector** — orders, reviews, settlements (2 RPS lane)
- **Cafe24 connector** — orders, products (2 req/sec lane)
- **Naver Search Ads connector**
- Optional: Coupang, Kakao Moment, TikTok Shop, 지그재그
- Separate queue lane for strict-rate-limit Korean channels

### Phase 4 — Ontology / Semantic Normalization

**Deliverables:**
- Unified entity mapping: `unified_orders`, `unified_campaigns`, `unified_products`
- Cross-channel query abstraction layer
- Dashboard views that work without knowing the source channel
- **Prerequisite:** Phase 1–3 raw data fully stable, patterns observable

---

## 8. Quality Gate

Every feature implementation runs a **loop test** for code quality and slop detection before the feature is considered done. This is a required step, not optional post-processing.

---

## 9. Out of Scope (this spec)

- Billing / subscription management
- Email notifications / alerting
- User team management (multi-user per tenant)
- Data export / CSV download
- Ontology layer (Phase 4 — separate spec when the time comes)
