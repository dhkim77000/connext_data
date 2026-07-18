-- ============================================================================
-- Connext — Shopify FULL object coverage (ClickHouse DDL)
-- Supplements 2026-06-22-warehouse-schema.sql (which already defines the 5 core
-- tables: shopify_orders, shopify_order_line_items, shopify_products,
-- shopify_product_variants, shopify_customers — NOT redefined here).
--
-- Verified 2026-07-04 against dev store connext-test.myshopify.com with a live
-- offline token. Every table below was confirmed accessible (HTTP 200) with the
-- token's granted read scopes; field names are the real REST Admin API keys
-- observed on live objects (order #1001, its transactions, locations, etc.).
--
-- SAME CONVENTIONS AS THE MAIN SCHEMA:
--   • control cols first: tenant_id, connection_id, ingested_at, raw
--   • ENGINE = ReplacingMergeTree(ingested_at); dedup on the ORDER BY (sorting) key
--   • PARTITION BY (tenant_id, toYYYYMM(<date>)); dimension tables w/o an event
--     date partition by tenant_id only
--   • money = Decimal(18,4) major units;  time = DateTime UTC, sentinel toDateTime(0)
--   • NO UUID type anywhere (project rule)
--
-- ACCESS NOTE: the connext app's install granted ~50 read_* scopes (much broader
-- than the OAuth route's requested `read_orders,read_products,read_customers`).
-- The ONLY commerce objects NOT granted on the test token: read_draft_orders (403)
-- and read_gift_cards (403). Everything below is reachable today.
-- ============================================================================

-- ============================================================================
-- ORDER SUB-OBJECTS  (scope: read_orders — already granted)
-- ============================================================================

-- Payment/settlement events per order (sale, authorization, capture, void, refund).
-- The money truth for "what was actually charged/settled" — orders.total_price is
-- the intended total; transactions are the ledger. Order #1001 → 1 'sale' txn $74.90.
CREATE TABLE IF NOT EXISTS connext.shopify_transactions (
  tenant_id       String,
  connection_id   String,
  ingested_at     DateTime DEFAULT now(),
  raw             String,
  transaction_id  String,
  order_id        String,
  order_created_at DateTime,                    -- denormalized for partition/time filters
  kind            String,                       -- sale/authorization/capture/void/refund
  status          String,                       -- success/failure/pending/error
  gateway         String,                       -- manual/shopify_payments/paypal/...
  amount          Decimal(18,4),
  currency        String,
  parent_id       String DEFAULT '',            -- refunds/captures point back to the sale
  payment_id      String DEFAULT '',
  error_code      String DEFAULT '',
  test            UInt8 DEFAULT 0,
  processed_at    DateTime,
  created_at      DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, transaction_id);

-- Refund headers. total_refunded = sum of the refund's transactions[] at ingest.
CREATE TABLE IF NOT EXISTS connext.shopify_refunds (
  tenant_id         String,
  connection_id     String,
  ingested_at       DateTime DEFAULT now(),
  raw               String,
  refund_id         String,
  order_id          String,
  order_created_at  DateTime,
  note              String DEFAULT '',
  total_refunded    Decimal(18,4) DEFAULT 0,    -- summed from transactions[] (kind=refund)
  currency          String DEFAULT '',
  line_items_count  UInt32 DEFAULT 0,           -- length(refund_line_items)
  restock           UInt8 DEFAULT 0,
  processed_at      DateTime DEFAULT toDateTime(0),
  created_at        DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, refund_id);

-- Modern fulfillment model (replaces legacy /fulfillments). One per order+location.
CREATE TABLE IF NOT EXISTS connext.shopify_fulfillment_orders (
  tenant_id            String,
  connection_id        String,
  ingested_at          DateTime DEFAULT now(),
  raw                  String,
  fulfillment_order_id String,
  order_id             String,
  order_created_at     DateTime,
  status               String,                  -- open/in_progress/scheduled/closed/cancelled
  request_status       String DEFAULT '',       -- unsubmitted/submitted/accepted/rejected
  assigned_location_id String DEFAULT '',
  fulfill_at           DateTime DEFAULT toDateTime(0),
  line_items_count     UInt32 DEFAULT 0,
  created_at           DateTime,
  updated_at           DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, fulfillment_order_id);

-- Returns (RMA). Source = GraphQL Admin API `returns` (no stable REST resource);
-- scope read_returns is granted. Empty on the test store — DDL ready regardless.
CREATE TABLE IF NOT EXISTS connext.shopify_returns (
  tenant_id       String,
  connection_id   String,
  ingested_at     DateTime DEFAULT now(),
  raw             String,
  return_id       String,
  order_id        String,
  order_created_at DateTime,
  status          String,                       -- OPEN/CLOSED/DECLINED/CANCELED/REQUESTED
  total_quantity  Int32 DEFAULT 0,
  name            String DEFAULT '',            -- "#1001-R1"
  created_at      DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(order_created_at))
ORDER BY (tenant_id, connection_id, order_id, return_id);

-- ============================================================================
-- CATALOG / MERCHANDISING  (scope: read_products — already granted)
-- ============================================================================

-- Custom + smart collections unified via `kind`. Test store: 2 custom + 1 smart.
CREATE TABLE IF NOT EXISTS connext.shopify_collections (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  collection_id    String,
  kind             String,                      -- 'custom' | 'smart'
  title            String,
  handle           String DEFAULT '',
  published_scope  String DEFAULT '',           -- web/global
  sort_order       String DEFAULT '',           -- manual/best-selling/alpha-asc/...
  disjunctive      UInt8 DEFAULT 0,             -- smart only: ANY(1) vs ALL(0) of rules
  published_at     DateTime DEFAULT toDateTime(0),
  updated_at       DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, collection_id);

-- product ↔ custom-collection membership (smart collections are rule-based, no collects).
CREATE TABLE IF NOT EXISTS connext.shopify_collects (
  tenant_id      String,
  connection_id  String,
  ingested_at    DateTime DEFAULT now(),
  raw            String,
  collect_id     String,
  collection_id  String,
  product_id     String,
  position       Int32 DEFAULT 0,
  created_at     DateTime DEFAULT toDateTime(0),
  updated_at     DateTime DEFAULT toDateTime(0)
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, collection_id, product_id);

-- ============================================================================
-- INVENTORY  (scopes: read_inventory, read_locations — granted)
-- ============================================================================

-- Physical/virtual stock locations. Test store: 3 (Shop location, Custom, Snow City WH).
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

-- Available quantity per (inventory_item, location). Join to variants on
-- inventory_item_id (shopify_product_variants.raw carries it). Grain = item×location.
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

-- ============================================================================
-- DISCOUNTS  (scopes: read_discounts, read_price_rules — granted). Test store: 3.
-- ============================================================================

CREATE TABLE IF NOT EXISTS connext.shopify_price_rules (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  price_rule_id      String,
  title              String,
  target_type        String DEFAULT '',         -- line_item/shipping_line
  target_selection   String DEFAULT '',         -- all/entitled
  allocation_method  String DEFAULT '',         -- across/each
  value_type         String DEFAULT '',         -- fixed_amount/percentage
  value              Decimal(18,4) DEFAULT 0,    -- negative ("-10.0")
  once_per_customer  UInt8 DEFAULT 0,
  usage_limit        Int32 DEFAULT 0,            -- 0 = unlimited
  customer_selection String DEFAULT '',          -- all/prerequisite
  starts_at          DateTime DEFAULT toDateTime(0),
  ends_at            DateTime DEFAULT toDateTime(0),
  created_at         DateTime,
  updated_at         DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, price_rule_id);

CREATE TABLE IF NOT EXISTS connext.shopify_discount_codes (
  tenant_id       String,
  connection_id   String,
  ingested_at     DateTime DEFAULT now(),
  raw             String,
  discount_code_id String,
  price_rule_id   String,
  code            String,
  usage_count     Int64 DEFAULT 0,
  created_at      DateTime,
  updated_at      DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id, price_rule_id, discount_code_id);

-- ============================================================================
-- FUNNEL / MARKETING
-- ============================================================================

-- Abandoned checkouts (scope: read_orders/read_checkouts — granted). Empty now.
-- Pre-purchase funnel: carts that reached checkout but never became an order.
CREATE TABLE IF NOT EXISTS connext.shopify_abandoned_checkouts (
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
  recovery_url     String DEFAULT '',            -- abandoned_checkout_url
  completed_at     DateTime DEFAULT toDateTime(0),
  created_at       DateTime,
  updated_at       DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(created_at))
ORDER BY (tenant_id, connection_id, checkout_id);

-- Marketing events (scopes: read_marketing_events — granted). Empty now.
-- Spend/campaign metadata the merchant (or apps) push to Shopify's marketing surface.
CREATE TABLE IF NOT EXISTS connext.shopify_marketing_events (
  tenant_id          String,
  connection_id      String,
  ingested_at        DateTime DEFAULT now(),
  raw                String,
  marketing_event_id String,
  event_type         String DEFAULT '',          -- ad/post/message/retargeting/...
  marketing_channel  String DEFAULT '',          -- search/display/social/email/...
  paid               UInt8 DEFAULT 0,
  budget             Decimal(18,4) DEFAULT 0,
  currency           String DEFAULT '',
  budget_type        String DEFAULT '',           -- daily/lifetime
  utm_campaign       String DEFAULT '',
  utm_source         String DEFAULT '',
  utm_medium         String DEFAULT '',
  started_at         DateTime DEFAULT toDateTime(0),
  ended_at           DateTime DEFAULT toDateTime(0)
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(started_at))
ORDER BY (tenant_id, connection_id, marketing_event_id);

-- ============================================================================
-- SHOPIFY PAYMENTS  (scopes: read_shopify_payments_payouts / _disputes — granted)
-- Not enabled on the test dev store (payouts/disputes empty) — DDL ready for prod.
-- ============================================================================

-- Bank payouts (settlement batches). The bridge from gross sales to money-in-bank.
CREATE TABLE IF NOT EXISTS connext.shopify_payouts (
  tenant_id            String,
  connection_id        String,
  ingested_at          DateTime DEFAULT now(),
  raw                  String,
  payout_id            String,
  status               String DEFAULT '',         -- scheduled/in_transit/paid/failed/cancelled
  currency             String DEFAULT '',
  amount               Decimal(18,4) DEFAULT 0,    -- net deposited
  charges_gross        Decimal(18,4) DEFAULT 0,    -- summary.charges_gross_amount
  charges_fee          Decimal(18,4) DEFAULT 0,
  refunds_gross        Decimal(18,4) DEFAULT 0,
  refunds_fee          Decimal(18,4) DEFAULT 0,
  adjustments_gross    Decimal(18,4) DEFAULT 0,
  adjustments_fee      Decimal(18,4) DEFAULT 0,
  payout_date          Date
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(payout_date))
ORDER BY (tenant_id, connection_id, payout_id);

-- Disputes / chargebacks.
CREATE TABLE IF NOT EXISTS connext.shopify_disputes (
  tenant_id        String,
  connection_id    String,
  ingested_at      DateTime DEFAULT now(),
  raw              String,
  dispute_id       String,
  order_id         String DEFAULT '',
  type             String DEFAULT '',             -- chargeback/inquiry
  amount           Decimal(18,4) DEFAULT 0,
  currency         String DEFAULT '',
  reason           String DEFAULT '',
  status           String DEFAULT '',             -- needs_response/under_review/won/lost/...
  evidence_due_by  DateTime DEFAULT toDateTime(0),
  initiated_at     DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY (tenant_id, toYYYYMM(initiated_at))
ORDER BY (tenant_id, connection_id, dispute_id);

-- ============================================================================
-- STORE REFERENCE  (scope: none / read_locales — granted)
-- ============================================================================

-- Single-row-per-connection store snapshot. Currency/timezone/plan context every
-- other table's money & timestamps are interpreted against. Re-pulled each sync.
CREATE TABLE IF NOT EXISTS connext.shopify_shop (
  tenant_id         String,
  connection_id     String,
  ingested_at       DateTime DEFAULT now(),
  raw               String,
  shop_id           String,
  name              String,
  domain            String DEFAULT '',
  myshopify_domain  String,
  plan_name         String DEFAULT '',            -- basic/shopify/advanced/plus/...
  currency          String DEFAULT '',
  country_code      String DEFAULT '',
  iana_timezone     String DEFAULT '',
  primary_locale    String DEFAULT '',
  multi_location    UInt8 DEFAULT 0,
  created_at        DateTime
) ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY tenant_id
ORDER BY (tenant_id, connection_id);

-- ============================================================================
-- ALSO GRANTED, DDL DEFERRED (enumerated for completeness — add when a use case
-- needs them; all reachable with the current token):
--   • Content: read_content → blogs, articles, pages, comments, redirects
--   • Metafields/Metaobjects: read_metaobjects → custom structured data on any resource
--   • Order edits: read_order_edits ;  Store credit: read_store_credit_accounts
--   • Markets/i18n: read_markets, read_translations, read_locales
--   • Publications/listings: read_publications, read_product_listings, read_product_feeds
--   • Script tags / customer events (pixels): read_script_tags, read_customer_events
--   • Audit log: read_audit_events ;  Shipping: read_shipping
--
-- NOT granted on the test token (would need re-consent with the scope added):
--   • read_draft_orders  (draft_orders.json → 403)
--   • read_gift_cards    (gift_cards.json → 403;  gift_card *transactions* ARE granted)
--   • any write_* scope  (connext is read-only by design)
-- ============================================================================
