// app/api/sync/process/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { processJob } from '@/lib/worker/processor'
import { registerConnector, getConnector } from '@/lib/connectors/registry'
import { shopifyConnector } from '@/lib/connectors/shopify'
import { metaAdsConnector } from '@/lib/connectors/meta-ads'
import { instagramConnector } from '@/lib/connectors/instagram'
import type { ConnectorCredentials, FetchJob } from '@/lib/connectors/types'

registerConnector(shopifyConnector)
registerConnector(metaAdsConnector)
registerConnector(instagramConnector)

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

  let credentials: ConnectorCredentials = {
    accessToken: cred.access_token,
    refreshToken: cred.refresh_token ?? undefined,
    expiresAt: cred.expires_at ?? undefined,
    extra: { ...connExtra, ...(cred.extra as Record<string, string>) },
  }

  try {
    // Refresh the access token if it's expired or within 2 min of expiring, so it can't
    // die mid-sync. Persist the rotated creds BEFORE fetching — Shopify rotates the
    // refresh_token on each refresh, and losing the new one orphans the connection.
    const connector = getConnector(syncJob.connector_id)
    const nowSec = Math.floor(Date.now() / 1000)
    if (
      connector.refreshCredentials &&
      credentials.refreshToken &&
      credentials.expiresAt &&
      credentials.expiresAt < nowSec + 120
    ) {
      credentials = await connector.refreshCredentials(credentials)
      await service.from('channel_credentials').update({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken ?? null,
        expires_at: credentials.expiresAt ?? null,
        // keep channel_credentials.extra token-scoped (shop_url lives on the connection)
        extra: credentials.extra?.refresh_token_expires_at
          ? { refresh_token_expires_at: credentials.extra.refresh_token_expires_at }
          : {},
      }).eq('connection_id', syncJob.connection_id)
    }

    const job: FetchJob = {
      tenantId: syncJob.tenant_id,
      connectionId: syncJob.connection_id,
      connectorId: syncJob.connector_id,
      credentials,
      dataType: syncJob.data_type,
      since: new Date(syncJob.since!),
      until: new Date(syncJob.until!),
    }

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
