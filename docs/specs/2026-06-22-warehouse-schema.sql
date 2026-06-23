-- ============================================================================
-- Connext Unified Warehouse — ClickHouse DDL
-- Sources: Shopify · Meta Ads · GA4 · Cafe24
-- Designed: 2026-06-22 (supersedes lib/clickhouse/ddl.sql Phase-1 minimal schema)
-- NOT auto-applied. Run once per environment.
-- ============================================================================
--
-- CONVENTIONS (every table carries these four control columns first):
--   tenant_id      String    -- Supabase tenants.id — first key, multi-tenant isolation
--   connection_id  String    -- Supabase channel_connections.id — distinguishes multiple
--                               accounts of the SAME source under one tenant (e.g. a brand
--                               with two Shopify stores or two Meta ad accounts)
--   ingested_at    DateTime  -- load timestamp; ALSO the ReplacingMergeTree version column
--   raw            String    -- original JSON payload, losslessly preserved (spec requirement)
--   <typed cols>             -- analytically useful fields extracted from raw
--
-- ENGINE — ReplacingMergeTree(ingested_at):
--   Incremental syncs re-fetch an entity whenever it changes (Shopify/Cafe24 by updated_at
--   watermark; Meta/GA4 by re-pulling a trailing window that the platforms restate for
--   1-4 days). Replacing dedups on the SORTING KEY, keeping the row with the greatest
--   ingested_at. NOTE: dedup is eventual (happens at background merge). Queries that must
--   see a guaranteed single version use `... FINAL` or `argMax(col, ingested_at) ... GROUP BY key`.
--
-- PARTITIONING — (tenant_id, toYYYYMM(<event_date>)):
--   Matches the Phase-1 tables and the spec's "tenant_id-first" mandate. Gives tenant +
--   time partition pruning. SCALING CAVEAT: partition count = tenants × months. Past a few
--   hundred tenants this grows large; at that point drop tenant_id from PARTITION BY (keep it
--   first in ORDER BY — pruning still works) and partition by month only.
--
-- MONEY — Decimal(18,4) in MAJOR currency units, EXCEPT columns suffixed `_minor` which are
--   Int64 in MINOR units. Meta returns ad budgets as minor-unit strings ("50000" = 500.00)
--   but insight `spend` as major-unit strings ("123.45") — both are mapped faithfully below.
--
-- TIME — DateTime stored in UTC. Shopify/Meta return UTC/ISO-8601. Cafe24 returns KST
--   (+09:00) — convert to UTC at ingest. Sentinel for "no value" = toDateTime(0).
-- ============================================================================

CREATE DATABASE IF NOT EXISTS connext;

-- ============================================================================
-- SHOPIFY  (GraphQL Admin API; IDs are numeric legacyResourceId, GID kept alongside)
-- ============================================================================

CREATE TABLE IF NOT EXISTS connext.shopify_orders (
  tenant_id                String,
  connection_id            String,
  ingested_at              DateTime DEFAULT now(),
  raw                      String,
  order_id                 String,                       -- legacyResourceId
  order_gid                String,                       -- gid://shopify/Order/...
  name                     String,                       -- "#1001"
  created_at               DateTime,
  updated_at               DateTime,                     -- incremental watermark
  processed_at             DateTime DEFAULT toDateTime(0),
  cancelled_at             DateTime DEFAULT toDateTime(0),
  closed_at                DateTime DEFAULT toDateTime(0),
  financial_status         String,                       -- displayFinancialStatus
  fulfillment_status       String,                       -- displayFulfillmentStatus
  cancel_reason            String DEFAULT '',
  currency                 String,                       -- shopMoney currencyCode
  current_total_price      Decimal(18,4),                -- currentTotalPriceSet.shopMoney
  subtotal_price           Decimal(18,4) DEFAULT 0,
  total_tax                Decimal(18,4) DEFAULT 0,
  total_shipping_price     Decimal(18,4) DEFAULT 0,
  total_discounts          Decimal(18,4) DEFAULT 0,
  total_refunded           Decimal(18,4) DEFAULT 0,
  presentment_total_price  Decimal(18,4) DEFAULT 0,       -- currentTotalPriceSet.presentmentMoney
  presentment_currency     String DEFAULT '',
  customer_id              String DEFAULT '',
  email                    String DEFAULT '',
  customer_accepts_marketing UInt8 DEFAULT 0,
  source_name              String DEFAULT '',
  tags                     Array(String) DEFAULT [],
  line_items_count         UInt32 DEFAULT 0,
  test                     UInt8 DEFAULT 0
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, connection_id, order_id);

CREATE TABLE IF NOT EXISTS connext.shopify_order_line_items (
  tenant_id              String,
  connection_id          String,
  ingested_at            DateTime DEFAULT now(),
  raw                    String,
  order_id               String,
  order_created_at       DateTime,                       -- denormalized for partition/time filters
  line_item_id           String,
  product_id             String DEFAULT '',
  variant_id             String DEFAULT '',
  title                  String,
  sku                    String DEFAULT '',
  quantity               Int32,
  current_quantity       Int32,                          -- after refunds
  original_unit_price    Decimal(18,4),
  discounted_unit_price  Decimal(18,4),
  discounted_total       Decimal(18,4),
  total_discount         Decimal(18,4) DEFAULT 0,
  taxable                UInt8 DEFAULT 1,
  requires_shipping      UInt8 DEFAULT 1
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, line_item_id);

CREATE TABLE IF NOT EXISTS connext.shopify_products (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  product_id         String,
  product_gid        String,
  title              String,
  handle             String DEFAULT '',
  vendor             String DEFAULT '',
  product_type       String DEFAULT '',
  status             String,                              -- ACTIVE / DRAFT / ARCHIVED
  tags               Array(String) DEFAULT [],
  total_inventory    Int32 DEFAULT 0,
  min_price          Decimal(18,4) DEFAULT 0,             -- priceRangeV2.minVariantPrice
  max_price          Decimal(18,4) DEFAULT 0,             -- priceRangeV2.maxVariantPrice
  currency           String DEFAULT '',
  published_at       DateTime DEFAULT toDateTime(0),
  created_at         DateTime,
  updated_at         DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, connection_id, product_id);

CREATE TABLE IF NOT EXISTS connext.shopify_product_variants (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  variant_id         String,
  product_id         String,
  title              String,
  sku                String DEFAULT '',
  barcode            String DEFAULT '',
  price              Decimal(18,4),
  compare_at_price   Decimal(18,4) DEFAULT 0,
  position           Int32 DEFAULT 0,
  inventory_quantity Int32 DEFAULT 0,
  inventory_policy   String DEFAULT '',                   -- DENY / CONTINUE
  available_for_sale UInt8 DEFAULT 1,
  taxable            UInt8 DEFAULT 1,
  created_at         DateTime,
  updated_at         DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, connection_id, variant_id);

CREATE TABLE IF NOT EXISTS connext.shopify_customers (
  tenant_id             String,
  connection_id         String,
  ingested_at           DateTime DEFAULT now(),
  raw                   String,
  customer_id           String,
  customer_gid          String,
  email                 String DEFAULT '',
  phone                 String DEFAULT '',
  first_name            String DEFAULT '',
  last_name             String DEFAULT '',
  display_name          String DEFAULT '',
  locale                String DEFAULT '',
  state                 String DEFAULT '',                -- ENABLED/INVITED/DISABLED/DECLINED
  verified_email        UInt8 DEFAULT 0,
  tax_exempt            UInt8 DEFAULT 0,
  number_of_orders      UInt64 DEFAULT 0,
  amount_spent          Decimal(18,4) DEFAULT 0,          -- lifetime spend (MoneyV2)
  amount_spent_currency String DEFAULT '',
  email_marketing_state String DEFAULT '',                -- SUBSCRIBED/UNSUBSCRIBED/...
  tags                  Array(String) DEFAULT [],
  created_at            DateTime,
  updated_at            DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, connection_id, customer_id);

-- ============================================================================
-- META ADS  (Marketing API; budgets in MINOR units, insight spend in MAJOR units)
-- ============================================================================

CREATE TABLE IF NOT EXISTS connext.meta_ads_campaigns (
  tenant_id              String,
  connection_id          String,
  ingested_at            DateTime DEFAULT now(),
  raw                    String,
  campaign_id            String,
  account_id             String,
  name                   String,
  status                 String,                          -- ACTIVE/PAUSED/DELETED/ARCHIVED
  effective_status       String DEFAULT '',
  objective              String DEFAULT '',
  buying_type            String DEFAULT '',
  bid_strategy           String DEFAULT '',
  daily_budget_minor     Int64 DEFAULT 0,                 -- minor currency units
  lifetime_budget_minor  Int64 DEFAULT 0,
  budget_remaining_minor Int64 DEFAULT 0,
  start_time             DateTime DEFAULT toDateTime(0),
  stop_time              DateTime DEFAULT toDateTime(0),
  created_time           DateTime,
  updated_time           DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_time))
ORDER BY (tenant_id, account_id, campaign_id);

CREATE TABLE IF NOT EXISTS connext.meta_ads_adsets (
  tenant_id              String,
  connection_id          String,
  ingested_at            DateTime DEFAULT now(),
  raw                    String,
  adset_id               String,
  campaign_id            String,
  account_id             String,
  name                   String,
  status                 String,
  effective_status       String DEFAULT '',
  optimization_goal      String DEFAULT '',
  billing_event          String DEFAULT '',
  bid_strategy           String DEFAULT '',
  bid_amount_minor       Int64 DEFAULT 0,
  daily_budget_minor     Int64 DEFAULT 0,
  lifetime_budget_minor  Int64 DEFAULT 0,
  start_time             DateTime DEFAULT toDateTime(0),
  end_time               DateTime DEFAULT toDateTime(0),
  created_time           DateTime,
  updated_time           DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_time))
ORDER BY (tenant_id, account_id, adset_id);

CREATE TABLE IF NOT EXISTS connext.meta_ads_ads (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  ad_id              String,
  adset_id           String,
  campaign_id        String,
  account_id         String,
  name               String,
  status             String,
  effective_status   String DEFAULT '',
  creative_id        String DEFAULT '',
  created_time       DateTime,
  updated_time       DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_time))
ORDER BY (tenant_id, account_id, ad_id);

-- Daily grain per ad (time_increment=1, no breakdowns). For breakdown pulls
-- (age/gender/placement/country) add a sibling table per breakdown set so the row
-- grain stays unambiguous — do NOT mix breakdown and non-breakdown rows here.
CREATE TABLE IF NOT EXISTS connext.meta_ads_insights (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  date_start         Date,
  account_id         String,
  campaign_id        String DEFAULT '',
  adset_id           String DEFAULT '',
  ad_id              String,
  impressions        Int64 DEFAULT 0,
  clicks             Int64 DEFAULT 0,
  reach              Int64 DEFAULT 0,
  frequency          Float64 DEFAULT 0,
  spend              Decimal(18,4) DEFAULT 0,             -- MAJOR units (account currency)
  cpc                Decimal(18,4) DEFAULT 0,
  cpm                Decimal(18,4) DEFAULT 0,
  ctr                Float64 DEFAULT 0,
  cpp                Decimal(18,4) DEFAULT 0,
  inline_link_clicks Int64 DEFAULT 0,
  conversions        Int64 DEFAULT 0,                     -- summed from actions[] at ingest
  conversion_value   Decimal(18,4) DEFAULT 0,             -- summed from action_values[]
  currency           String DEFAULT ''
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(date_start))
ORDER BY (tenant_id, account_id, ad_id, date_start);

-- ============================================================================
-- GA4  (Data API v1 runReport — REPORT-based, not raw events)
--   Row grain = the requested dimension tuple, per day. This is the canonical
--   "traffic + ecommerce" daily report. Additional report shapes (e.g. landing-page
--   or event-level) become their own tables; a wide table beats EAV for OLAP here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS connext.ga4_daily_report (
  tenant_id             String,
  connection_id         String,
  ingested_at           DateTime DEFAULT now(),
  raw                   String,
  property_id           String,
  date                  Date,
  -- dimensions (define the row grain) — GA4 returns all dimension values as strings
  default_channel_group String DEFAULT '(not set)',      -- sessionDefaultChannelGroup
  source                String DEFAULT '(not set)',       -- sessionSource
  medium                String DEFAULT '(not set)',       -- sessionMedium
  campaign_name         String DEFAULT '(not set)',       -- sessionCampaignName
  country               String DEFAULT '(not set)',
  device_category       String DEFAULT '(not set)',
  -- metrics (typed per GA4 metric type: INTEGER→Int64, FLOAT/SECONDS→Float64, CURRENCY→Decimal)
  sessions              Int64   DEFAULT 0,
  active_users          Int64   DEFAULT 0,
  new_users             Int64   DEFAULT 0,
  engaged_sessions      Int64   DEFAULT 0,
  screen_page_views     Int64   DEFAULT 0,
  event_count           Int64   DEFAULT 0,
  conversions           Int64   DEFAULT 0,
  engagement_rate       Float64 DEFAULT 0,
  bounce_rate           Float64 DEFAULT 0,
  avg_session_duration  Float64 DEFAULT 0,                 -- seconds
  add_to_carts          Int64   DEFAULT 0,
  ecommerce_purchases   Int64   DEFAULT 0,
  transactions          Int64   DEFAULT 0,
  total_revenue         Decimal(18,4) DEFAULT 0,
  purchase_revenue      Decimal(18,4) DEFAULT 0
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(date))
ORDER BY (tenant_id, property_id, date, default_channel_group, source, medium, campaign_name, country, device_category);

-- ============================================================================
-- CAFE24  (Admin API v2; prices are decimal strings, timestamps are KST +09:00)
-- ============================================================================

CREATE TABLE IF NOT EXISTS connext.cafe24_orders (
  tenant_id            String,
  connection_id        String,
  ingested_at          DateTime DEFAULT now(),
  raw                  String,
  mall_id              String,
  order_id             String,                            -- "20240101-0000001"
  order_status         String DEFAULT '',
  payment_status       String DEFAULT '',
  shipping_status      String DEFAULT '',
  order_date           DateTime,                           -- KST→UTC at ingest
  created_date         DateTime,
  modified_date        DateTime,                           -- incremental watermark
  order_total_price    Decimal(18,4),
  order_discount_price Decimal(18,4) DEFAULT 0,
  order_tax_price      Decimal(18,4) DEFAULT 0,
  order_shipping_price Decimal(18,4) DEFAULT 0,
  currency             String DEFAULT 'KRW',
  buyer_name           String DEFAULT '',
  buyer_email          String DEFAULT '',
  buyer_phone          String DEFAULT '',
  buyer_member_id      String DEFAULT '',                  -- FK → cafe24_customers.member_id
  receiver_name        String DEFAULT '',
  items_count          UInt32 DEFAULT 0
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_date))
ORDER BY (tenant_id, mall_id, order_id);

CREATE TABLE IF NOT EXISTS connext.cafe24_order_items (
  tenant_id            String,
  connection_id        String,
  ingested_at          DateTime DEFAULT now(),
  raw                  String,
  mall_id              String,
  order_id             String,
  order_date           DateTime,                           -- denormalized for partition
  item_no              String,
  product_no           String,
  product_name         String DEFAULT '',
  product_price        Decimal(18,4),
  item_discount_price  Decimal(18,4) DEFAULT 0,
  quantity             Int32,
  option_value         String DEFAULT '',
  variant_code         String DEFAULT ''
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_date))
ORDER BY (tenant_id, mall_id, order_id, item_no);

CREATE TABLE IF NOT EXISTS connext.cafe24_products (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  mall_id            String,
  product_no         String,
  product_name       String,
  price              Decimal(18,4),
  supply_price       Decimal(18,4) DEFAULT 0,
  currency           String DEFAULT 'KRW',
  status             String DEFAULT '',
  use_product_option UInt8 DEFAULT 0,
  weight             Float64 DEFAULT 0,
  created_date       DateTime,
  modified_date      DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_date))
ORDER BY (tenant_id, mall_id, product_no);

CREATE TABLE IF NOT EXISTS connext.cafe24_customers (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  mall_id          String,
  member_id        String,
  member_no        String DEFAULT '',
  member_name      String DEFAULT '',
  member_email     String DEFAULT '',
  member_phone     String DEFAULT '',
  member_type      String DEFAULT '',                      -- general/corporate/group
  group_no         String DEFAULT '',
  group_name       String DEFAULT '',
  gender           String DEFAULT '',
  birthday         String DEFAULT '',                      -- YYYY-MM-DD, kept as-is
  status           String DEFAULT '',                      -- active/dormant/suspended/withdrawn
  last_login_date  DateTime DEFAULT toDateTime(0),
  created_date     DateTime,
  modified_date    DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_date))
ORDER BY (tenant_id, mall_id, member_id);
