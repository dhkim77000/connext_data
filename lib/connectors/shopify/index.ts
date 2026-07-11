import type { Connector, ConnectorCredentials, FetchJob, FetchResult } from '@/lib/connectors/types'

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

function customersUrl(shopUrl: string, cursor?: string): string {
  const params = new URLSearchParams({ limit: '250' })
  if (cursor) params.set('page_info', cursor)
  return `https://${shopUrl}/admin/api/${SHOPIFY_API_VERSION}/customers.json?${params}`
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
    // v2 warehouse naming: suffix encodes time semantics (docs/specs/2026-07-05-warehouse-schema-v2.sql)
    const map: Record<string, string> = {
      orders: 'shopify_orders_history',                        // event stream
      order_line_items: 'shopify_order_line_items_history',    // event (per order line)
      products: 'shopify_products',                            // current-state snapshot
      product_variants: 'shopify_product_variants',            // snapshot
      customers: 'shopify_customers',                          // snapshot
    }
    const table = map[dataType]
    if (!table) throw new Error(`Shopify connector: no target table for dataType "${dataType}"`)
    return table
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
          connection_id: job.connectionId,
          raw: JSON.stringify(order),
          order_id: String(order.id),
          created_at: order.created_at,
          updated_at: order.updated_at,
          current_total_price: Number(order.total_price ?? 0),   // v2 column name
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
          connection_id: job.connectionId,
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

    if (job.dataType === 'customers') {
      const url = customersUrl(shopUrl, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const customers = (body.customers as Record<string, unknown>[]) ?? []
      return {
        rows: customers.map((c) => {
          const addr = (c.default_address as Record<string, unknown> | null) ?? {}
          const emc = (c.email_marketing_consent as Record<string, unknown> | null) ?? {}
          const tags = typeof c.tags === 'string' && c.tags ? c.tags.split(', ') : []
          return {
            tenant_id: job.tenantId,
            connection_id: job.connectionId,
            raw: JSON.stringify(c),
            customer_id: String(c.id),
            customer_gid: c.admin_graphql_api_id ?? '',
            email: c.email ?? '',          // usually redacted (Protected Customer Data)
            phone: c.phone ?? '',
            first_name: c.first_name ?? '',
            last_name: c.last_name ?? '',
            state: c.state ?? '',
            country_code: addr.country_code ?? '',
            province: addr.province ?? '',
            city: addr.city ?? '',
            verified_email: c.verified_email ? 1 : 0,
            tax_exempt: c.tax_exempt ? 1 : 0,
            number_of_orders: Number(c.orders_count ?? 0),
            amount_spent: Number(c.total_spent ?? 0),
            amount_spent_currency: c.currency ?? '',
            email_marketing_state: emc.state ?? '',
            tags,
            created_at: c.created_at,
            updated_at: c.updated_at,
          }
        }),
        nextCursor,
      }
    }

    // Line items live inside the orders payload — re-fetch orders and flatten one row per line.
    if (job.dataType === 'order_line_items') {
      const url = ordersUrl(shopUrl, job.since, job.until, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const orders = (body.orders as Record<string, unknown>[]) ?? []
      const rows = orders.flatMap((order) => {
        const items = (order.line_items as Record<string, unknown>[]) ?? []
        return items.map((li) => ({
          tenant_id: job.tenantId,
          connection_id: job.connectionId,
          raw: JSON.stringify(li),
          order_id: String(order.id),
          order_created_at: order.created_at,
          line_item_id: String(li.id),
          product_id: String(li.product_id ?? ''),
          variant_id: String(li.variant_id ?? ''),
          title: li.title ?? '',
          sku: li.sku ?? '',
          vendor: li.vendor ?? '',
          quantity: Number(li.quantity ?? 0),
          current_quantity: Number(li.current_quantity ?? li.quantity ?? 0),
          price: Number(li.price ?? 0),
          total_discount: Number(li.total_discount ?? 0),
          taxable: li.taxable ? 1 : 0,
          requires_shipping: li.requires_shipping ? 1 : 0,
        }))
      })
      return { rows, nextCursor }
    }

    // Variants live inside the products payload — re-fetch products and flatten one row per variant.
    if (job.dataType === 'product_variants') {
      const url = productsUrl(shopUrl, job.cursor)
      const { body, nextCursor } = await shopifyFetch(url, job.credentials.accessToken)
      const products = (body.products as Record<string, unknown>[]) ?? []
      const rows = products.flatMap((product) => {
        const variants = (product.variants as Record<string, unknown>[]) ?? []
        return variants.map((v) => ({
          tenant_id: job.tenantId,
          connection_id: job.connectionId,
          raw: JSON.stringify(v),
          variant_id: String(v.id),
          product_id: String(v.product_id ?? product.id),
          title: v.title ?? '',
          sku: v.sku ?? '',
          barcode: v.barcode ?? '',
          inventory_item_id: String(v.inventory_item_id ?? ''),
          price: Number(v.price ?? 0),
          compare_at_price: Number(v.compare_at_price ?? 0),
          position: Number(v.position ?? 0),
          inventory_quantity: Number(v.inventory_quantity ?? 0),
          inventory_policy: v.inventory_policy ?? '',
          taxable: v.taxable ? 1 : 0,
          created_at: v.created_at,
          updated_at: v.updated_at,
        }))
      })
      return { rows, nextCursor }
    }

    throw new Error(`Shopify connector: unsupported dataType "${job.dataType}"`)
  },

  // Expiring offline tokens die after ~60min. Trade the 90-day refresh_token for a
  // fresh access_token via grant_type=refresh_token. Shopify ROTATES the refresh_token
  // on each call, so the caller MUST persist the returned refreshToken atomically.
  async refreshCredentials(creds: ConnectorCredentials): Promise<ConnectorCredentials> {
    const shopUrl = creds.extra?.shop_url
    if (!shopUrl) throw new Error('Shopify refresh requires credentials.extra.shop_url')
    if (!creds.refreshToken) throw new Error('Shopify refresh requires a refresh_token')

    const res = await fetch(`https://${shopUrl}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID!,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
      }),
    })
    if (!res.ok) throw new Error(`Shopify token refresh failed: ${res.status} ${await res.text()}`)
    const token = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      refresh_token_expires_in?: number
    }
    const nowSec = Math.floor(Date.now() / 1000)
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? creds.refreshToken, // rotated — keep the new one
      expiresAt: token.expires_in ? nowSec + token.expires_in : undefined,
      extra: {
        ...creds.extra,
        ...(token.refresh_token_expires_in
          ? { refresh_token_expires_at: String(nowSec + token.refresh_token_expires_in) }
          : {}),
      },
    }
  },
}
