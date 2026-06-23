// app/api/sync/process/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processJob } from '@/lib/worker/processor'
import { registerConnector } from '@/lib/connectors/registry'
import { shopifyConnector } from '@/lib/connectors/shopify'
import { metaAdsConnector } from '@/lib/connectors/meta-ads'
import type { FetchJob } from '@/lib/connectors/types'

registerConnector(shopifyConnector)
registerConnector(metaAdsConnector)

export async function POST(request: Request) {
  const { jobId } = (await request.json()) as { jobId: string }
  const service = await createServiceClient()

  const { data: syncJob } = await service
    .from('sync_jobs')
    .select('*, channel_connections(extra)')
    .eq('id', jobId)
    .single()
  if (!syncJob) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  await service
    .from('sync_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId)

  const { data: cred } = await service
    .from('channel_credentials')
    .select('access_token, refresh_token, expires_at, extra')
    .eq('connection_id', syncJob.connection_id)
    .single()

  if (!cred) {
    await service.from('sync_jobs').update({ status: 'error', error_message: 'Credentials not found' }).eq('id', jobId)
    return NextResponse.json({ error: 'Credentials not found' }, { status: 500 })
  }

  const connExtra = (syncJob.channel_connections as unknown as Record<string, unknown> | null)
    ?.extra as Record<string, string> | undefined

  const job: FetchJob = {
    tenantId: syncJob.tenant_id,
    connectorId: syncJob.connector_id,
    credentials: {
      accessToken: cred.access_token,
      refreshToken: cred.refresh_token ?? undefined,
      expiresAt: cred.expires_at ?? undefined,
      extra: { ...connExtra, ...(cred.extra as Record<string, string>) },
    },
    dataType: syncJob.data_type,
    since: new Date(syncJob.since!),
    until: new Date(syncJob.until!),
  }

  try {
    const result = await processJob(job)
    await service.from('sync_jobs').update({
      status: 'done',
      rows_ingested: result.rowsIngested,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)
    await service.from('channel_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', syncJob.connection_id)
    return NextResponse.json({ rowsIngested: result.rowsIngested })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await service.from('sync_jobs').update({ status: 'error', error_message: message }).eq('id', jobId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
