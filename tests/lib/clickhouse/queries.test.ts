import { describe, it, expect, vi } from 'vitest'

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({}),
    query: vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue([{ order_id: '1' }]),
    }),
  })),
}))

import { insertRows, queryRows } from '@/lib/clickhouse/queries'

describe('insertRows', () => {
  it('inserts rows into a ClickHouse table without throwing', async () => {
    const rows = [{ tenant_id: 'abc', order_id: '1', raw: '{}' }]
    await expect(insertRows('shopify_orders', rows)).resolves.not.toThrow()
  })

  it('is a no-op when rows array is empty', async () => {
    await expect(insertRows('shopify_orders', [])).resolves.not.toThrow()
  })
})

describe('queryRows', () => {
  it('returns typed rows from a query', async () => {
    type Row = { order_id: string }
    const result = await queryRows<Row>(
      'SELECT order_id FROM shopify_orders WHERE tenant_id = {tenantId:String}',
      { tenantId: 'abc' }
    )
    expect(result).toEqual([{ order_id: '1' }])
  })
})
