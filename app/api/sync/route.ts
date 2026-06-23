// app/api/sync/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId, dataType } = (await request.json()) as {
    connectionId: string
    dataType: string
  }

  const { data: connection } = await supabase
    .from('channel_connections').select('*').eq('id', connectionId).single()
  if (!connection) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  const until = new Date()
  const since = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000)

  const { data: job, error } = await supabase
    .from('sync_jobs')
    .insert({
      tenant_id: connection.tenant_id,
      connection_id: connection.id,
      connector_id: connection.connector_id,
      data_type: dataType,
      status: 'pending',
      since: since.toISOString(),
      until: until.toISOString(),
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire and forget — async processing
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  fetch(`${appUrl}/api/sync/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: job.id }),
  }).catch(console.error)

  return NextResponse.json({ jobId: job.id }, { status: 202 })
}
