import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { metaAdsConnector } from '@/lib/connectors/meta-ads'
import type { FetchJob } from '@/lib/connectors/types'

const baseJob: FetchJob = {
  tenantId: 'tenant-1',
  connectorId: 'meta_ads',
  credentials: {
    accessToken: 'EAAtest123',
    extra: { account_id: 'act_123456789' },
  },
  dataType: 'campaigns',
  since: new Date('2024-01-01T00:00:00Z'),
  until: new Date('2024-01-02T00:00:00Z'),
}

describe('metaAdsConnector', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('has id "meta_ads" and authType "oauth2"', () => {
    expect(metaAdsConnector.id).toBe('meta_ads')
    expect(metaAdsConnector.authType).toBe('oauth2')
  })

  it('maps campaigns to meta_ads_campaigns table', () => {
    expect(metaAdsConnector.targetTable('campaigns')).toBe('meta_ads_campaigns')
  })

  it('maps insights to meta_ads_insights table', () => {
    expect(metaAdsConnector.targetTable('insights')).toBe('meta_ads_insights')
  })

  it('fetches campaigns and returns normalized rows with raw field', async () => {
    const apiCampaign = {
      id: 'cmp_1',
      account_id: 'act_123456789',
      name: 'Test Campaign',
      status: 'ACTIVE',
      objective: 'LINK_CLICKS',
      created_time: '2024-01-01T00:00:00+0000',
      updated_time: '2024-01-01T12:00:00+0000',
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [apiCampaign], paging: {} }),
    })

    const result = await metaAdsConnector.fetch(baseJob)

    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.campaign_id).toBe('cmp_1')
    expect(row.tenant_id).toBe('tenant-1')
    expect(row.raw).toBe(JSON.stringify(apiCampaign))
    expect(result.nextCursor).toBeUndefined()
  })

  it('extracts next cursor from paging.cursors.after when paging.next exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        paging: { cursors: { after: 'cursor_xyz' }, next: 'https://graph.facebook.com/...' },
      }),
    })

    const result = await metaAdsConnector.fetch(baseJob)
    expect(result.nextCursor).toBe('cursor_xyz')
  })

  it('throws when Meta API returns an error object', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: { message: 'Invalid OAuth token', code: 190 } }),
    })
    await expect(metaAdsConnector.fetch(baseJob)).rejects.toThrow('Meta API error 190: Invalid OAuth token')
  })

  it('throws when account_id is missing from credentials', async () => {
    const badJob: FetchJob = { ...baseJob, credentials: { accessToken: 'tok' } }
    await expect(metaAdsConnector.fetch(badJob)).rejects.toThrow('account_id')
  })
})
