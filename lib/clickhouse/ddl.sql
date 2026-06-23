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

CREATE TABLE IF NOT EXISTS connext.instagram_media (
  tenant_id      String,
  ingested_at    DateTime DEFAULT now(),
  raw            String,
  media_id       String,
  ig_user_id     String,
  media_type     String,
  caption        String DEFAULT '',
  permalink      String DEFAULT '',
  like_count     Int64 DEFAULT 0,
  comments_count Int64 DEFAULT 0,
  timestamp      DateTime
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(timestamp))
ORDER BY (tenant_id, timestamp, media_id);

CREATE TABLE IF NOT EXISTS connext.instagram_account_insights (
  tenant_id      String,
  ingested_at    DateTime DEFAULT now(),
  raw            String,
  ig_user_id     String,
  date           Date,
  reach          Int64 DEFAULT 0,
  impressions    Int64 DEFAULT 0,
  follower_count Int64 DEFAULT 0,
  profile_views  Int64 DEFAULT 0
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(date))
ORDER BY (tenant_id, date, ig_user_id);
