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
