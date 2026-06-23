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
