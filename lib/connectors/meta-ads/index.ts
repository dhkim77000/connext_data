import type { Connector, FetchJob, FetchResult } from '@/lib/connectors/types'

const META_API = 'https://graph.facebook.com/v19.0'

async function callMeta(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Meta HTTP error: ${response.status}`)
  const body = (await response.json()) as Record<string, unknown>
  if (body.error) {
    const err = body.error as Record<string, unknown>
    throw new Error(`Meta API error ${err.code}: ${err.message}`)
  }
  return body
}

function getNextCursor(paging: Record<string, unknown> | undefined): string | undefined {
  if (!paging?.next) return undefined
  return (paging.cursors as Record<string, string> | undefined)?.after
}

export const metaAdsConnector: Connector = {
  id: 'meta_ads',
  displayName: 'Meta Ads',
  authType: 'oauth2',

  targetTable(dataType: string): string {
    return `meta_ads_${dataType}`
  },

  async fetch(job: FetchJob): Promise<FetchResult> {
    const accountId = job.credentials.extra?.account_id
    if (!accountId) throw new Error('Meta Ads connector requires credentials.extra.account_id')
    const token = job.credentials.accessToken

    if (job.dataType === 'campaigns') {
      const params = new URLSearchParams({
        access_token: token,
        fields: 'id,account_id,name,status,objective,created_time,updated_time',
        limit: '200',
      })
      if (job.cursor) params.set('after', job.cursor)

      const body = await callMeta(`${META_API}/${accountId}/campaigns?${params}`)
      const data = (body.data as Record<string, unknown>[]) ?? []
      const paging = body.paging as Record<string, unknown> | undefined

      return {
        rows: data.map((c) => ({
          tenant_id: job.tenantId,
          raw: JSON.stringify(c),
          campaign_id: c.id,
          account_id: c.account_id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          created_time: c.created_time,
          updated_time: c.updated_time,
        })),
        nextCursor: getNextCursor(paging),
      }
    }

    if (job.dataType === 'insights') {
      const params = new URLSearchParams({
        access_token: token,
        fields: 'ad_id,account_id,campaign_id,adset_id,date_start,impressions,clicks,spend,reach',
        level: 'ad',
        time_range: JSON.stringify({
          since: job.since.toISOString().split('T')[0],
          until: job.until.toISOString().split('T')[0],
        }),
        limit: '200',
      })
      if (job.cursor) params.set('after', job.cursor)

      const body = await callMeta(`${META_API}/${accountId}/insights?${params}`)
      const data = (body.data as Record<string, unknown>[]) ?? []
      const paging = body.paging as Record<string, unknown> | undefined

      return {
        rows: data.map((i) => ({
          tenant_id: job.tenantId,
          raw: JSON.stringify(i),
          ad_id: i.ad_id,
          account_id: i.account_id,
          campaign_id: i.campaign_id,
          adset_id: i.adset_id,
          date_start: i.date_start,
          impressions: Number(i.impressions ?? 0),
          clicks: Number(i.clicks ?? 0),
          spend: Number(i.spend ?? 0),
          reach: Number(i.reach ?? 0),
        })),
        nextCursor: getNextCursor(paging),
      }
    }

    throw new Error(`Meta Ads connector: unsupported dataType "${job.dataType}"`)
  },
}
