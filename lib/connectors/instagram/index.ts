import type { Connector, FetchJob, FetchResult } from '@/lib/connectors/types'

const GRAPH_API = 'https://graph.facebook.com/v19.0'

async function callGraph(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Instagram HTTP error: ${response.status}`)
  const body = (await response.json()) as Record<string, unknown>
  if (body.error) {
    const err = body.error as Record<string, unknown>
    throw new Error(`Instagram API error ${err.code}: ${err.message}`)
  }
  return body
}

function getNextCursor(paging: Record<string, unknown> | undefined): string | undefined {
  if (!paging?.next) return undefined
  return (paging.cursors as Record<string, string> | undefined)?.after
}

export const instagramConnector: Connector = {
  id: 'instagram',
  displayName: 'Instagram',
  authType: 'oauth2',

  targetTable(dataType: string): string {
    return `instagram_${dataType}`
  },

  async fetch(job: FetchJob): Promise<FetchResult> {
    const igUserId = job.credentials.extra?.ig_user_id
    if (!igUserId) throw new Error('Instagram connector requires credentials.extra.ig_user_id')
    const token = job.credentials.accessToken

    // Organic posts with engagement (likes/comments).
    if (job.dataType === 'media') {
      const params = new URLSearchParams({
        access_token: token,
        fields: 'id,caption,media_type,permalink,timestamp,like_count,comments_count',
        limit: '100',
      })
      if (job.cursor) params.set('after', job.cursor)

      const body = await callGraph(`${GRAPH_API}/${igUserId}/media?${params}`)
      const data = (body.data as Record<string, unknown>[]) ?? []
      const paging = body.paging as Record<string, unknown> | undefined

      return {
        rows: data.map((m) => ({
          tenant_id: job.tenantId,
          raw: JSON.stringify(m),
          media_id: m.id,
          ig_user_id: igUserId,
          media_type: m.media_type ?? '',
          caption: m.caption ?? '',
          permalink: m.permalink ?? '',
          like_count: Number(m.like_count ?? 0),
          comments_count: Number(m.comments_count ?? 0),
          timestamp: m.timestamp,
        })),
        nextCursor: getNextCursor(paging),
      }
    }

    // Daily account insights — reach, impressions, follower_count, profile_views.
    // The API returns one entry per metric, each holding a values[] time series;
    // pivot them into one row per day.
    if (job.dataType === 'account_insights') {
      const params = new URLSearchParams({
        access_token: token,
        metric: 'reach,impressions,follower_count,profile_views',
        period: 'day',
        since: String(Math.floor(job.since.getTime() / 1000)),
        until: String(Math.floor(job.until.getTime() / 1000)),
      })

      const body = await callGraph(`${GRAPH_API}/${igUserId}/insights?${params}`)
      const data = (body.data as Record<string, unknown>[]) ?? []

      const byDate = new Map<string, Record<string, number>>()
      for (const metric of data) {
        const name = metric.name as string
        const values = (metric.values as Record<string, unknown>[]) ?? []
        for (const v of values) {
          const date = String(v.end_time).split('T')[0]
          if (!byDate.has(date)) byDate.set(date, {})
          byDate.get(date)![name] = Number(v.value ?? 0)
        }
      }

      return {
        rows: [...byDate.entries()].map(([date, m]) => ({
          tenant_id: job.tenantId,
          raw: JSON.stringify(m),
          ig_user_id: igUserId,
          date,
          reach: m.reach ?? 0,
          impressions: m.impressions ?? 0,
          follower_count: m.follower_count ?? 0,
          profile_views: m.profile_views ?? 0,
        })),
        // Insights are a bounded time series — no cursor pagination.
        nextCursor: undefined,
      }
    }

    throw new Error(`Instagram connector: unsupported dataType "${job.dataType}"`)
  },
}
