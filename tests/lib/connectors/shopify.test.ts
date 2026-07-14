import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { shopifyConnector } from '@/lib/connectors/shopify'
import type { FetchJob } from '@/lib/connectors/types'

const baseJob: FetchJob = {
  tenantId: 'tenant-1',
  connectionId: 'conn-1',
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

  const hdr = { get: () => null, has: () => false }

  it('maps referral/marketing dataTypes to their v2 tables', () => {
    expect(shopifyConnector.targetTable('price_rules')).toBe('shopify_price_rules')
    expect(shopifyConnector.targetTable('discount_codes')).toBe('shopify_discount_codes')
    expect(shopifyConnector.targetTable('marketing_events')).toBe('shopify_marketing_events')
    expect(shopifyConnector.targetTable('abandoned_checkouts')).toBe('shopify_abandoned_checkouts_history')
  })

  it('fetches marketing_events with utm fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, headers: hdr,
      json: async () => ({ marketing_events: [{ id: 55, event_type: 'ad', marketing_channel: 'social', paid: true, budget: '500.00', currency: 'USD', utm_campaign: 'summer', utm_source: 'instagram', utm_medium: 'cpc', started_at: '2024-06-01T00:00:00Z' }] }),
    })
    const { rows } = await shopifyConnector.fetch({ ...baseJob, dataType: 'marketing_events' })
    const r = rows[0]
    expect(r.marketing_event_id).toBe('55')
    expect(r.marketing_channel).toBe('social')
    expect(r.paid).toBe(1)
    expect(r.budget).toBe(500)
    expect(r.utm_campaign).toBe('summer')
    expect(r.utm_source).toBe('instagram')
    expect(r.utm_medium).toBe('cpc')
  })

  it('fetches price_rules', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, headers: hdr,
      json: async () => ({ price_rules: [{ id: 10, title: 'SUMMER', value_type: 'percentage', value: '-20.0', usage_limit: 1000, once_per_customer: true, starts_at: '2024-06-01T00:00:00Z', created_at: '2024-05-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' }] }),
    })
    const { rows } = await shopifyConnector.fetch({ ...baseJob, dataType: 'price_rules' })
    const r = rows[0]
    expect(r.price_rule_id).toBe('10')
    expect(r.title).toBe('SUMMER')
    expect(r.value_type).toBe('percentage')
    expect(r.value).toBe(-20)
    expect(r.usage_limit).toBe(1000)
    expect(r.once_per_customer).toBe(1)
  })

  it('fetches discount_codes via price-rule fan-out', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, headers: hdr, json: async () => ({ price_rules: [{ id: 10 }] }) })
      .mockResolvedValueOnce({ ok: true, headers: hdr, json: async () => ({ discount_codes: [{ id: 100, price_rule_id: 10, code: 'SUMMER20', usage_count: 412, created_at: '2024-06-01T00:00:00Z', updated_at: '2024-06-02T00:00:00Z' }] }) })
    const { rows } = await shopifyConnector.fetch({ ...baseJob, dataType: 'discount_codes' })
    const r = rows[0]
    expect(r.discount_code_id).toBe('100')
    expect(r.price_rule_id).toBe('10')
    expect(r.code).toBe('SUMMER20')
    expect(r.usage_count).toBe(412)
  })

  it('fetches abandoned_checkouts', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, headers: hdr,
      json: async () => ({ checkouts: [{ id: 77, token: 'abc', email: 'c@x.com', customer: { id: 5 }, currency: 'USD', subtotal_price: '80.00', total_tax: '8.00', total_price: '88.00', line_items: [{ id: 1 }, { id: 2 }], abandoned_checkout_url: 'https://recover', created_at: '2024-06-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z' }] }),
    })
    const { rows } = await shopifyConnector.fetch({ ...baseJob, dataType: 'abandoned_checkouts' })
    const r = rows[0]
    expect(r.checkout_id).toBe('77')
    expect(r.recovery_url).toBe('https://recover')
    expect(r.total_price).toBe(88)
    expect(r.line_items_count).toBe(2)
    expect(r.customer_id).toBe('5')
  })

  it('maps orders to shopify_orders_history table', () => {
    expect(shopifyConnector.targetTable('orders')).toBe('shopify_orders_history')
  })

  it('maps products to shopify_products table', () => {
    expect(shopifyConnector.targetTable('products')).toBe('shopify_products')
  })

  it('maps new dataTypes to their v2 tables', () => {
    expect(shopifyConnector.targetTable('order_line_items')).toBe('shopify_order_line_items_history')
    expect(shopifyConnector.targetTable('product_variants')).toBe('shopify_product_variants')
    expect(shopifyConnector.targetTable('customers')).toBe('shopify_customers')
  })

  it('fetches customers and maps geography + LTV (PII may be redacted)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        customers: [{
          id: 55, admin_graphql_api_id: 'gid://shopify/Customer/55',
          state: 'enabled', orders_count: 3, total_spent: '150.00', currency: 'USD',
          tags: 'VIP, wholesale', verified_email: true, tax_exempt: false,
          default_address: { country_code: 'US', province: 'California', city: 'LA' },
          email_marketing_consent: { state: 'subscribed' },
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
        }],
      }),
      headers: { get: () => null, has: () => false },
    })
    const row = (await shopifyConnector.fetch({ ...baseJob, dataType: 'customers' })).rows[0]
    expect(row.customer_id).toBe('55')
    expect(row.connection_id).toBe('conn-1')
    expect(row.country_code).toBe('US')
    expect(row.amount_spent).toBe(150)
    expect(row.number_of_orders).toBe(3)
    expect(row.email_marketing_state).toBe('subscribed')
    expect(row.tags).toEqual(['VIP', 'wholesale'])
    expect(row.email).toBe('') // redacted → default
  })

  it('fetches order_line_items and flattens one row per line with the parent order id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        orders: [{
          id: 900, created_at: '2026-07-04T00:00:00Z',
          line_items: [
            { id: 1, product_id: 11, variant_id: 111, title: 'A', quantity: 2, price: '10.00' },
            { id: 2, product_id: 22, variant_id: 222, title: 'B', quantity: 1, price: '5.00' },
          ],
        }],
      }),
      headers: { get: () => null, has: () => false },
    })
    const result = await shopifyConnector.fetch({ ...baseJob, dataType: 'order_line_items' })
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].order_id).toBe('900')
    expect(result.rows[0].line_item_id).toBe('1')
    expect(result.rows[0].quantity).toBe(2)
    expect(result.rows[1].line_item_id).toBe('2')
    expect(result.rows[1].price).toBe(5)
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
    expect(row.connection_id).toBe('conn-1')
    expect(row.order_id).toBe('12345')
    expect(row.raw).toBe(JSON.stringify(apiOrder))
    expect(row.current_total_price).toBe(99.99)
    expect(result.nextCursor).toBeUndefined()
  })

  it('extracts attribution / referral fields on orders (v2 columns)', async () => {
    const apiOrder = {
      id: 999,
      admin_graphql_api_id: 'gid://shopify/Order/999',
      name: '#1042',
      created_at: '2024-06-01T10:00:00Z',
      updated_at: '2024-06-02T10:00:00Z',
      processed_at: '2024-06-01T10:05:00Z',
      cancelled_at: null,
      cancel_reason: null,
      financial_status: 'paid',
      currency: 'USD',
      total_price: '120.00',
      subtotal_price: '100.00',
      total_tax: '10.00',
      total_discounts: '15.00',
      total_shipping_price_set: { shop_money: { amount: '10.00' } },
      customer: { id: 7 },
      email: 'b@x.com',
      shipping_address: { country_code: 'KR' },
      source_name: 'web',
      landing_site: '/?utm_source=instagram&utm_campaign=summer',
      referring_site: 'https://instagram.com/',
      discount_codes: [{ code: 'SUMMER20', amount: '15.00', type: 'percentage' }],
      tags: 'vip, wholesale',
      line_items: [{ id: 1 }, { id: 2 }],
      test: false,
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ orders: [apiOrder] }),
      headers: { get: () => null, has: () => false },
    })

    const { rows } = await shopifyConnector.fetch(baseJob)
    const row = rows[0]
    expect(row.order_gid).toBe('gid://shopify/Order/999')
    expect(row.name).toBe('#1042')
    expect(row.source_name).toBe('web')
    expect(row.landing_site).toBe('/?utm_source=instagram&utm_campaign=summer')
    expect(row.referring_site).toBe('https://instagram.com/')
    expect(row.discount_codes).toEqual(['SUMMER20'])
    expect(row.tags).toEqual(['vip', 'wholesale'])
    expect(row.country_code).toBe('KR')
    expect(row.subtotal_price).toBe(100)
    expect(row.total_tax).toBe(10)
    expect(row.total_shipping_price).toBe(10)
    expect(row.total_discounts).toBe(15)
    expect(row.line_items_count).toBe(2)
    expect(row.test).toBe(0)
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

  it('refreshes the access token via grant_type=refresh_token and keeps the rotated refresh_token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'shpat_new',
        refresh_token: 'shprt_new',
        expires_in: 3600,
        refresh_token_expires_in: 7776000,
      }),
    })
    process.env.SHOPIFY_CLIENT_ID = 'cid'
    process.env.SHOPIFY_CLIENT_SECRET = 'csec'

    const nowSec = Math.floor(Date.now() / 1000)
    const newCreds = await shopifyConnector.refreshCredentials!({
      accessToken: 'shpat_old',
      refreshToken: 'shprt_old',
      expiresAt: nowSec,
      extra: { shop_url: 'teststore.myshopify.com', refresh_token_expires_at: '1' },
    })

    expect(newCreds.accessToken).toBe('shpat_new')
    expect(newCreds.refreshToken).toBe('shprt_new') // rotated — new one kept
    expect(newCreds.expiresAt).toBeGreaterThan(nowSec) // ~now + 3600
    expect(newCreds.extra?.shop_url).toBe('teststore.myshopify.com') // connection extra preserved

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://teststore.myshopify.com/admin/oauth/access_token')
    const body = JSON.parse((opts as { body: string }).body)
    expect(body.grant_type).toBe('refresh_token')
    expect(body.refresh_token).toBe('shprt_old')
  })

  it('refreshCredentials throws when refresh_token is missing', async () => {
    await expect(
      shopifyConnector.refreshCredentials!({ accessToken: 't', extra: { shop_url: 's.myshopify.com' } })
    ).rejects.toThrow('refresh_token')
  })
})
