import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/connectors/registry', () => ({
  getConnector: vi.fn(),
}))
vi.mock('@/lib/clickhouse/queries', () => ({
  insertRows: vi.fn().mockResolvedValue(undefined),
}))

import { processJob } from '@/lib/worker/processor'
import { getConnector } from '@/lib/connectors/registry'
import { insertRows } from '@/lib/clickhouse/queries'
import type { FetchJob } from '@/lib/connectors/types'

const baseJob: FetchJob = {
  tenantId: 'tenant-1',
  connectorId: 'shopify',
  credentials: { accessToken: 'tok', extra: { shop_url: 'x.myshopify.com' } },
  dataType: 'orders',
  since: new Date('2024-01-01'),
  until: new Date('2024-01-02'),
}

describe('processJob', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls insertRows with fetched rows', async () => {
    const rows = [{ order_id: '1', raw: '{}', tenant_id: 'tenant-1' }]
    vi.mocked(getConnector).mockReturnValue({
      id: 'shopify',
      displayName: 'Shopify',
      authType: 'oauth2',
      fetch: vi.fn().mockResolvedValue({ rows, nextCursor: undefined }),
      targetTable: () => 'shopify_orders',
    })

    const result = await processJob(baseJob)

    expect(insertRows).toHaveBeenCalledWith('shopify_orders', rows)
    expect(result.rowsIngested).toBe(1)
    expect(result.pages).toBe(1)
  })

  it('paginates until nextCursor is undefined', async () => {
    const page1 = [{ order_id: '1', raw: '{}', tenant_id: 'tenant-1' }]
    const page2 = [{ order_id: '2', raw: '{}', tenant_id: 'tenant-1' }]
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ rows: page1, nextCursor: 'cursor-abc' })
      .mockResolvedValueOnce({ rows: page2, nextCursor: undefined })

    vi.mocked(getConnector).mockReturnValue({
      id: 'shopify', displayName: 'Shopify', authType: 'oauth2',
      fetch: mockFetch,
      targetTable: () => 'shopify_orders',
    })

    const result = await processJob(baseJob)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.rowsIngested).toBe(2)
    expect(result.pages).toBe(2)
  })

  it('skips insertRows when fetch returns no rows', async () => {
    vi.mocked(getConnector).mockReturnValue({
      id: 'shopify', displayName: 'Shopify', authType: 'oauth2',
      fetch: vi.fn().mockResolvedValue({ rows: [], nextCursor: undefined }),
      targetTable: () => 'shopify_orders',
    })

    await processJob(baseJob)
    expect(insertRows).not.toHaveBeenCalled()
  })
})
