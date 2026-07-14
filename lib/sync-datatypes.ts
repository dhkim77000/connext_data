// Client-safe list of the dataTypes each connector can sync, mirroring the
// connectors' targetTable() maps (lib/connectors/*). Drives the "Sync now" UI.
// Keep in sync with the connector when adding a dataType.
export const SYNC_DATA_TYPES: Record<string, { key: string; label: string }[]> = {
  shopify: [
    { key: 'orders', label: 'Orders' },
    { key: 'order_line_items', label: 'Line items' },
    { key: 'products', label: 'Products' },
    { key: 'product_variants', label: 'Variants' },
    { key: 'customers', label: 'Customers' },
    { key: 'price_rules', label: 'Price rules' },
    { key: 'discount_codes', label: 'Discount codes' },
    { key: 'marketing_events', label: 'Marketing events' },
    { key: 'abandoned_checkouts', label: 'Abandoned checkouts' },
  ],
  meta_ads: [
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'insights', label: 'Insights' },
  ],
  instagram: [
    { key: 'media', label: 'Media' },
    { key: 'account_insights', label: 'Account insights' },
  ],
}
