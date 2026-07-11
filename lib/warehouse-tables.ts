// Single source of truth for the raw-data viewer's table list.
// Values are v2 warehouse table names (docs/specs/2026-07-05-warehouse-schema-v2.sql) —
// exactly the tables the registered connectors load today. Consumed by both the
// /api/data allowlist and the /data dropdown so the two can never drift apart.
export const DATA_VIEWER_TABLES = [
  { value: 'shopify_orders_history', label: 'Shopify Orders' },
  { value: 'shopify_order_line_items_history', label: 'Shopify Line Items' },
  { value: 'shopify_products', label: 'Shopify Products' },
  { value: 'shopify_product_variants', label: 'Shopify Variants' },
  { value: 'shopify_customers', label: 'Shopify Customers' },
  { value: 'meta_ads_campaigns', label: 'Meta Campaigns' },
  { value: 'meta_ads_insights_stat', label: 'Meta Insights' },
  { value: 'instagram_media', label: 'Instagram Media' },
  { value: 'instagram_account_insights_stat', label: 'Instagram Account Insights' },
] as const

export const DEFAULT_DATA_VIEWER_TABLE = DATA_VIEWER_TABLES[0].value
