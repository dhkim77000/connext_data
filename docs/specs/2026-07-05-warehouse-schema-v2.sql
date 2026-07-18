-- ============================================================================
-- Connext Unified Warehouse v2 — ClickHouse DDL
-- Supersedes 2026-06-22-warehouse-schema.sql + 2026-07-04-shopify-full-schema.sql
-- Sources: Shopify · Meta Ads · GA4 · Cafe24
--
-- NAMING = the suffix encodes the table's TIME semantics (no fact_/dim_ prefixes):
--   <source>_<entity>            → CURRENT-STATE snapshot. Latest value only, NO
--                                  history. Re-sync overwrites. PARTITION BY tenant_id.
--                                  (products, customers, catalog, ad config, locations…)
--   <source>_<entity>_history    → EVENT stream. Second-precision created_at, rows
--                                  ACCUMULATE over time. PARTITION BY (tenant, month of
--                                  event). We aggregate to any grain at query time.
--                                  (orders, refunds, transactions, returns…)
--   <source>_<entity>_stat       → VENDOR pre-aggregated time-series (daily grain). The
--                                  platform rolls up + restates a trailing window; we
--                                  store rows as-is. PARTITION BY (tenant, month of date).
--                                  (meta insights, ga4 daily…)
--
-- WHY the split (per product decision 2026-07-05): "매출/주문/고객수/반품" need history →
--   *_history / *_stat.  "상품/고객정보" do NOT → plain snapshot (latest-wins, cheap).
--   "고객 수" over time is DERIVED from shopify_customers.created_at (immutable) — no
--   separate history table. Each entity lives in EXACTLY ONE table (no dim/fact dupes).
--
-- CONVENTIONS (unchanged from v1):
--   • control cols first: tenant_id, connection_id, ingested_at, raw
--   • ENGINE = ReplacingMergeTree(ingested_at); dedup on the ORDER BY (sorting) key.
--     Snapshot: ORDER BY entity_id → only current survives (history discarded — intended).
--     History : ORDER BY entity_id but PARTITION spreads rows over created_at → every
--               event kept; a mutated entity (order status change) updates its one row.
--     Stat    : ORDER BY (entity, date) → one row per (entity, day), restated in place.
--   • money = Decimal(18,4) major units (suffix _minor = Int64 minor units)
--   • time = DateTime UTC, sentinel toDateTime(0); Cafe24 KST→UTC at ingest
--   • NO UUID type (project rule)
--
-- INCREMENTAL WATERMARK: snapshot/history → updated_at ; stat → date (re-pull last N days).
-- ============================================================================

CREATE DATABASE IF NOT EXISTS connext;

-- ############################################################################
-- SECTION 1 — CURRENT-STATE SNAPSHOTS  (no suffix; latest value only, no history)
--   PARTITION BY tenant_id  (enables per-tenant partition drop for GDPR erasure;
--   these tables are small, so no time partition is needed or wanted)
-- ############################################################################

-- ---- Shopify catalog / customers ----

CREATE TABLE IF NOT EXISTS connext.shopify_products (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  product_id       String,
  product_gid      String,
  title            String,
  handle           String DEFAULT '',
  vendor           String DEFAULT '',
  product_type     String DEFAULT '',
  status           String,                       -- ACTIVE / DRAFT / ARCHIVED
  tags             Array(String) DEFAULT [],
  total_inventory  Int32 DEFAULT 0,
  min_price        Decimal(18,4) DEFAULT 0,
  max_price        Decimal(18,4) DEFAULT 0,
  currency         String DEFAULT '',
  published_at     DateTime DEFAULT toDateTime(0),
  created_at       DateTime,
  updated_at       DateTime                      -- incremental watermark
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
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
  inventory_item_id  String DEFAULT '',           -- join key → shopify_inventory_levels
  price              Decimal(18,4),
  compare_at_price   Decimal(18,4) DEFAULT 0,
  position           Int32 DEFAULT 0,
  inventory_quantity Int32 DEFAULT 0,
  inventory_policy   String DEFAULT '',            -- DENY / CONTINUE
  taxable            UInt8 DEFAULT 1,
  created_at         DateTime,
  updated_at         DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, variant_id);

-- Customer PROFILE only (current). created_at is immutable → doubles as the acquisition
-- timestamp: `SELECT toDate(created_at), count() ... GROUP BY 1` = new customers/day.
-- LTV-over-time comes from shopify_orders_history, not from re-snapshotting amount_spent.
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
  state                 String DEFAULT '',         -- ENABLED/INVITED/DISABLED/DECLINED
  country_code          String DEFAULT '',         -- default_address.country_code
  province              String DEFAULT '',         -- default_address.province
  city                  String DEFAULT '',
  verified_email        UInt8 DEFAULT 0,
  tax_exempt            UInt8 DEFAULT 0,
  number_of_orders      UInt64 DEFAULT 0,          -- current lifetime count (snapshot)
  amount_spent          Decimal(18,4) DEFAULT 0,   -- current lifetime spend (snapshot)
  amount_spent_currency String DEFAULT '',
  email_marketing_state String DEFAULT '',
  tags                  Array(String) DEFAULT [],
  created_at            DateTime,                   -- acquisition date (immutable)
  updated_at            DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, customer_id);

CREATE TABLE IF NOT EXISTS connext.shopify_collections (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  collection_id    String,
  kind             String,                        -- 'custom' | 'smart'
  title            String,
  handle           String DEFAULT '',
  published_scope  String DEFAULT '',
  sort_order       String DEFAULT '',
  disjunctive      UInt8 DEFAULT 0,               -- smart: ANY(1) vs ALL(0) of rules
  published_at     DateTime DEFAULT toDateTime(0),
  updated_at       DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, collection_id);

CREATE TABLE IF NOT EXISTS connext.shopify_collects (
  tenant_id      String,
  connection_id  String,
  ingested_at    DateTime DEFAULT now(),
  raw            String,
  collect_id     String,
  collection_id  String,
  product_id     String,
  position       Int32 DEFAULT 0,
  updated_at     DateTime DEFAULT toDateTime(0)
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, collection_id, product_id);

-- Current stock per (inventory_item, location). Snapshot by design — if stockout/
-- inventory-over-time analysis is later needed, add shopify_inventory_levels_stat
-- (a daily snapshot job writing one row per item×location×day).
CREATE TABLE IF NOT EXISTS connext.shopify_inventory_levels (
  tenant_id         String,
  connection_id     String,
  ingested_at       DateTime DEFAULT now(),
  raw               String,
  inventory_item_id String,
  location_id       String,
  available         Int32 DEFAULT 0,
  updated_at        DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, inventory_item_id, location_id);

CREATE TABLE IF NOT EXISTS connext.shopify_locations (
  tenant_id      String,
  connection_id  String,
  ingested_at    DateTime DEFAULT now(),
  raw            String,
  location_id    String,
  name           String,
  active         UInt8 DEFAULT 1,
  legacy         UInt8 DEFAULT 0,
  country_code   String DEFAULT '',
  province_code  String DEFAULT '',
  city           String DEFAULT '',
  zip            String DEFAULT '',
  created_at     DateTime,
  updated_at     DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, location_id);

CREATE TABLE IF NOT EXISTS connext.shopify_price_rules (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  price_rule_id      String,
  title              String,
  target_type        String DEFAULT '',           -- line_item/shipping_line
  target_selection   String DEFAULT '',           -- all/entitled
  allocation_method  String DEFAULT '',           -- across/each
  value_type         String DEFAULT '',           -- fixed_amount/percentage
  value              Decimal(18,4) DEFAULT 0,      -- negative ("-10.0")
  once_per_customer  UInt8 DEFAULT 0,
  usage_limit        Int32 DEFAULT 0,             -- 0 = unlimited
  customer_selection String DEFAULT '',
  starts_at          DateTime DEFAULT toDateTime(0),
  ends_at            DateTime DEFAULT toDateTime(0),
  created_at         DateTime,
  updated_at         DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, price_rule_id);

CREATE TABLE IF NOT EXISTS connext.shopify_discount_codes (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  discount_code_id String,
  price_rule_id    String,
  code             String,
  usage_count      Int64 DEFAULT 0,
  created_at       DateTime,
  updated_at       DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, price_rule_id, discount_code_id);

-- Marketing event metadata (config-like records, not daily metrics) → snapshot.
CREATE TABLE IF NOT EXISTS connext.shopify_marketing_events (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  marketing_event_id String,
  event_type         String DEFAULT '',
  marketing_channel  String DEFAULT '',
  paid               UInt8 DEFAULT 0,
  budget             Decimal(18,4) DEFAULT 0,
  currency           String DEFAULT '',
  utm_campaign       String DEFAULT '',
  utm_source         String DEFAULT '',
  utm_medium         String DEFAULT '',
  started_at         DateTime DEFAULT toDateTime(0),
  ended_at           DateTime DEFAULT toDateTime(0)
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, marketing_event_id);

-- One row per connection. Currency/timezone/plan context for all money & timestamps.
CREATE TABLE IF NOT EXISTS connext.shopify_shop (
  tenant_id         String,
  connection_id     String,
  ingested_at       DateTime DEFAULT now(),
  raw               String,
  shop_id           String,
  name              String,
  domain            String DEFAULT '',
  myshopify_domain  String,
  plan_name         String DEFAULT '',
  currency          String DEFAULT '',
  country_code      String DEFAULT '',
  iana_timezone     String DEFAULT '',
  primary_locale    String DEFAULT '',
  multi_location    UInt8 DEFAULT 0,
  created_at        DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id);

-- ---- Meta Ads config (current state of the ad hierarchy) ----

CREATE TABLE IF NOT EXISTS connext.meta_ads_campaigns (
  tenant_id              String,
  connection_id          String,
  ingested_at            DateTime DEFAULT now(),
  raw                    String,
  campaign_id            String,
  account_id             String,
  name                   String,
  status                 String,                  -- ACTIVE/PAUSED/DELETED/ARCHIVED
  effective_status       String DEFAULT '',
  objective              String DEFAULT '',
  buying_type            String DEFAULT '',
  bid_strategy           String DEFAULT '',
  daily_budget_minor     Int64 DEFAULT 0,
  lifetime_budget_minor  Int64 DEFAULT 0,
  budget_remaining_minor Int64 DEFAULT 0,
  start_time             DateTime DEFAULT toDateTime(0),
  stop_time              DateTime DEFAULT toDateTime(0),
  created_time           DateTime,
  updated_time           DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
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
PARTITION BY tenant_id
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
PARTITION BY tenant_id
ORDER BY (tenant_id, account_id, ad_id);

-- ---- Cafe24 catalog / customers ----

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
PARTITION BY tenant_id
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
  member_type      String DEFAULT '',
  group_no         String DEFAULT '',
  gender           String DEFAULT '',
  status           String DEFAULT '',
  last_login_date  DateTime DEFAULT toDateTime(0),
  created_date     DateTime,                       -- acquisition date (immutable)
  modified_date    DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, mall_id, member_id);

-- ---- Instagram (organic) — media posts. Current engagement per post (snapshot);
--      `timestamp` is the immutable post time → posts/day derivable like customers. ----

CREATE TABLE IF NOT EXISTS connext.instagram_media (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  media_id           String,
  ig_user_id         String,
  media_type         String DEFAULT '',        -- IMAGE / VIDEO / CAROUSEL_ALBUM
  media_product_type String DEFAULT '',        -- FEED / REELS / STORY
  caption            String DEFAULT '',
  permalink          String DEFAULT '',
  like_count         Int64 DEFAULT 0,           -- current (snapshot)
  comments_count     Int64 DEFAULT 0,           -- current (snapshot)
  timestamp          DateTime                   -- post time (immutable)
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, media_id);

-- ############################################################################
-- SECTION 2 — EVENT HISTORY  (_history; second-precision events, accumulate)
--   PARTITION BY (tenant_id, toYYYYMM(<event created_at>))
-- ############################################################################

-- Order header. THE revenue/order fact. Each order = one row kept forever (spread over
-- created_at); a status change (unfulfilled→fulfilled, refund) updates that one row to
-- latest state. Time series = aggregate over created_at at query time.
CREATE TABLE IF NOT EXISTS connext.shopify_orders_history (
  tenant_id                String,
  connection_id            String,
  ingested_at              DateTime DEFAULT now(),
  raw                      String,
  order_id                 String,
  order_gid                String,
  name                     String,                 -- "#1001"
  created_at               DateTime,               -- event time (partition axis)
  updated_at               DateTime,               -- incremental watermark
  processed_at             DateTime DEFAULT toDateTime(0),
  cancelled_at             DateTime DEFAULT toDateTime(0),
  closed_at                DateTime DEFAULT toDateTime(0),
  financial_status         String,                 -- paid/pending/refunded/…
  fulfillment_status       String,                 -- fulfilled/partial/unfulfilled
  cancel_reason            String DEFAULT '',
  currency                 String,
  current_total_price      Decimal(18,4),
  subtotal_price           Decimal(18,4) DEFAULT 0,
  total_tax                Decimal(18,4) DEFAULT 0,
  total_shipping_price     Decimal(18,4) DEFAULT 0,
  total_discounts          Decimal(18,4) DEFAULT 0,
  total_refunded           Decimal(18,4) DEFAULT 0,
  customer_id              String DEFAULT '',
  email                    String DEFAULT '',
  country_code             String DEFAULT '',       -- shipping_address.country_code
  source_name              String DEFAULT '',       -- web/pos/…
  landing_site             String DEFAULT '',       -- attribution
  referring_site           String DEFAULT '',
  discount_codes           Array(String) DEFAULT [],
  tags                     Array(String) DEFAULT [],
  line_items_count         UInt32 DEFAULT 0,
  test                     UInt8 DEFAULT 0
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, connection_id, order_id);

CREATE TABLE IF NOT EXISTS connext.shopify_order_line_items_history (
  tenant_id              String,
  connection_id          String,
  ingested_at            DateTime DEFAULT now(),
  raw                    String,
  order_id               String,
  order_created_at       DateTime,                  -- denormalized for partition/time filters
  line_item_id           String,
  product_id             String DEFAULT '',
  variant_id             String DEFAULT '',
  title                  String,
  sku                    String DEFAULT '',
  vendor                 String DEFAULT '',
  quantity               Int32,
  current_quantity       Int32,                     -- after refunds
  price                  Decimal(18,4),             -- unit price
  total_discount         Decimal(18,4) DEFAULT 0,
  taxable                UInt8 DEFAULT 1,
  requires_shipping      UInt8 DEFAULT 1
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, line_item_id);

-- Payment ledger (sale/authorization/capture/void/refund). Money actually moved.
CREATE TABLE IF NOT EXISTS connext.shopify_transactions_history (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  transaction_id   String,
  order_id         String,
  order_created_at DateTime,
  kind             String,                          -- sale/authorization/capture/void/refund
  status           String,                          -- success/failure/pending/error
  gateway          String,                          -- manual/shopify_payments/paypal/…
  amount           Decimal(18,4),
  currency         String,
  parent_id        String DEFAULT '',
  payment_id       String DEFAULT '',
  error_code       String DEFAULT '',
  test             UInt8 DEFAULT 0,
  processed_at     DateTime,
  created_at       DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, transaction_id);

CREATE TABLE IF NOT EXISTS connext.shopify_refunds_history (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  refund_id        String,
  order_id         String,
  order_created_at DateTime,
  note             String DEFAULT '',
  total_refunded   Decimal(18,4) DEFAULT 0,         -- summed from transactions[] (kind=refund)
  currency         String DEFAULT '',
  line_items_count UInt32 DEFAULT 0,
  restock          UInt8 DEFAULT 0,
  processed_at     DateTime DEFAULT toDateTime(0),
  created_at       DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, refund_id);

-- Returns / RMA (source: GraphQL Admin API `returns`; scope read_returns).
CREATE TABLE IF NOT EXISTS connext.shopify_returns_history (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  return_id        String,
  order_id         String,
  order_created_at DateTime,
  status           String,                          -- OPEN/CLOSED/DECLINED/CANCELED/REQUESTED
  total_quantity   Int32 DEFAULT 0,
  name             String DEFAULT '',               -- "#1001-R1"
  created_at       DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, return_id);

-- Fulfillment orders (modern fulfillment model). One per order+location.
CREATE TABLE IF NOT EXISTS connext.shopify_fulfillments_history (
  tenant_id            String,
  connection_id        String,
  ingested_at          DateTime DEFAULT now(),
  raw                  String,
  fulfillment_order_id String,
  order_id             String,
  order_created_at     DateTime,
  status               String,                      -- open/in_progress/scheduled/closed/cancelled
  request_status       String DEFAULT '',
  assigned_location_id String DEFAULT '',
  fulfill_at           DateTime DEFAULT toDateTime(0),
  line_items_count     UInt32 DEFAULT 0,
  created_at           DateTime,
  updated_at           DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, fulfillment_order_id);

-- Abandoned checkouts (pre-purchase funnel: reached checkout, never ordered).
CREATE TABLE IF NOT EXISTS connext.shopify_abandoned_checkouts_history (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  checkout_id      String,
  token            String DEFAULT '',
  email            String DEFAULT '',
  customer_id      String DEFAULT '',
  currency         String DEFAULT '',
  subtotal_price   Decimal(18,4) DEFAULT 0,
  total_tax        Decimal(18,4) DEFAULT 0,
  total_price      Decimal(18,4) DEFAULT 0,
  line_items_count UInt32 DEFAULT 0,
  recovery_url     String DEFAULT '',
  completed_at     DateTime DEFAULT toDateTime(0),
  created_at       DateTime,
  updated_at       DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, connection_id, checkout_id);

-- Shopify Payments payouts (bank settlement batches). gross → fees → net deposited.
CREATE TABLE IF NOT EXISTS connext.shopify_payouts_history (
  tenant_id         String,
  connection_id     String,
  ingested_at       DateTime DEFAULT now(),
  raw               String,
  payout_id         String,
  status            String DEFAULT '',              -- scheduled/in_transit/paid/failed/cancelled
  currency          String DEFAULT '',
  amount            Decimal(18,4) DEFAULT 0,        -- net deposited
  charges_gross     Decimal(18,4) DEFAULT 0,
  charges_fee       Decimal(18,4) DEFAULT 0,
  refunds_gross     Decimal(18,4) DEFAULT 0,
  refunds_fee       Decimal(18,4) DEFAULT 0,
  adjustments_gross Decimal(18,4) DEFAULT 0,
  adjustments_fee   Decimal(18,4) DEFAULT 0,
  payout_date       Date
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(payout_date))
ORDER BY (tenant_id, connection_id, payout_id);

-- Disputes / chargebacks.
CREATE TABLE IF NOT EXISTS connext.shopify_disputes_history (
  tenant_id       String,
  connection_id   String,
  ingested_at     DateTime DEFAULT now(),
  raw             String,
  dispute_id      String,
  order_id        String DEFAULT '',
  type            String DEFAULT '',                -- chargeback/inquiry
  amount          Decimal(18,4) DEFAULT 0,
  currency        String DEFAULT '',
  reason          String DEFAULT '',
  status          String DEFAULT '',                -- needs_response/under_review/won/lost/…
  evidence_due_by DateTime DEFAULT toDateTime(0),
  initiated_at    DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(initiated_at))
ORDER BY (tenant_id, connection_id, dispute_id);

-- ---- Cafe24 order events (KST → UTC at ingest) ----

CREATE TABLE IF NOT EXISTS connext.cafe24_orders_history (
  tenant_id            String,
  connection_id        String,
  ingested_at          DateTime DEFAULT now(),
  raw                  String,
  mall_id              String,
  order_id             String,                      -- "20240101-0000001"
  order_status         String DEFAULT '',
  payment_status       String DEFAULT '',
  shipping_status      String DEFAULT '',
  order_date           DateTime,                    -- event time (partition axis), KST→UTC
  created_date         DateTime,
  modified_date        DateTime,                    -- incremental watermark
  order_total_price    Decimal(18,4),
  order_discount_price Decimal(18,4) DEFAULT 0,
  order_tax_price      Decimal(18,4) DEFAULT 0,
  order_shipping_price Decimal(18,4) DEFAULT 0,
  currency             String DEFAULT 'KRW',
  buyer_name           String DEFAULT '',
  buyer_email          String DEFAULT '',
  buyer_member_id      String DEFAULT '',           -- FK → cafe24_customers.member_id
  items_count          UInt32 DEFAULT 0
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_date))
ORDER BY (tenant_id, mall_id, order_id);

CREATE TABLE IF NOT EXISTS connext.cafe24_order_items_history (
  tenant_id            String,
  connection_id        String,
  ingested_at          DateTime DEFAULT now(),
  raw                  String,
  mall_id              String,
  order_id             String,
  order_date           DateTime,                    -- denormalized for partition
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

-- ############################################################################
-- SECTION 3 — VENDOR TIME-SERIES STATS  (_stat; pre-aggregated daily rows)
--   PARTITION BY (tenant_id, toYYYYMM(date)). Platform restates a trailing window
--   (Meta ~1-4d, GA4 ~1-2d): re-pull those days each sync; Replacing dedups on
--   (entity, date) keeping the latest ingested_at.
-- ############################################################################

-- Daily grain per ad (time_increment=1, NO breakdowns). Breakdown pulls
-- (age/gender/publisher_platform/country) go to sibling *_stat tables so the row
-- grain stays unambiguous — do NOT mix breakdown and non-breakdown rows here.
CREATE TABLE IF NOT EXISTS connext.meta_ads_insights_stat (
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
  spend              Decimal(18,4) DEFAULT 0,       -- MAJOR units (account currency)
  cpc                Decimal(18,4) DEFAULT 0,
  cpm                Decimal(18,4) DEFAULT 0,
  ctr                Float64 DEFAULT 0,
  inline_link_clicks Int64 DEFAULT 0,
  conversions        Int64 DEFAULT 0,               -- summed from actions[] at ingest
  conversion_value   Decimal(18,4) DEFAULT 0,       -- summed from action_values[]
  currency           String DEFAULT ''
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(date_start))
ORDER BY (tenant_id, account_id, ad_id, date_start);

-- GA4 daily report. Row grain = the requested dimension tuple, per day. Other report
-- shapes (landing-page, event-level) become their own *_stat tables.
CREATE TABLE IF NOT EXISTS connext.ga4_daily_stat (
  tenant_id             String,
  connection_id         String,
  ingested_at           DateTime DEFAULT now(),
  raw                   String,
  property_id           String,
  date                  Date,
  -- dimensions (define row grain; GA4 returns all as strings)
  default_channel_group String DEFAULT '(not set)',
  source                String DEFAULT '(not set)',
  medium                String DEFAULT '(not set)',
  campaign_name         String DEFAULT '(not set)',
  country               String DEFAULT '(not set)',
  device_category       String DEFAULT '(not set)',
  -- metrics
  sessions              Int64   DEFAULT 0,
  active_users          Int64   DEFAULT 0,
  new_users             Int64   DEFAULT 0,
  engaged_sessions      Int64   DEFAULT 0,
  screen_page_views     Int64   DEFAULT 0,
  event_count           Int64   DEFAULT 0,
  conversions           Int64   DEFAULT 0,
  engagement_rate       Float64 DEFAULT 0,
  bounce_rate           Float64 DEFAULT 0,
  avg_session_duration  Float64 DEFAULT 0,          -- seconds
  add_to_carts          Int64   DEFAULT 0,
  ecommerce_purchases   Int64   DEFAULT 0,
  transactions          Int64   DEFAULT 0,
  total_revenue         Decimal(18,4) DEFAULT 0,
  purchase_revenue      Decimal(18,4) DEFAULT 0
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(date))
ORDER BY (tenant_id, property_id, date, default_channel_group, source, medium, campaign_name, country, device_category);

-- Instagram account insights (daily reach/impressions/followers/profile views).
CREATE TABLE IF NOT EXISTS connext.instagram_account_insights_stat (
  tenant_id       String,
  connection_id   String,
  ingested_at     DateTime DEFAULT now(),
  raw             String,
  ig_user_id      String,
  date            Date,
  reach           Int64 DEFAULT 0,
  impressions     Int64 DEFAULT 0,
  follower_count  Int64 DEFAULT 0,
  profile_views   Int64 DEFAULT 0
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(date))
ORDER BY (tenant_id, connection_id, ig_user_id, date);
