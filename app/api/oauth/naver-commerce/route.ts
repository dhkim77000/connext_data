import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const clientSecret = searchParams.get('clientSecret')

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/channels/connect/naver_commerce', request.url))
  }

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.redirect(new URL('/dashboard', request.url))

  const service = await createServiceClient()
  const { data: connection, error } = await service
    .from('channel_connections')
    .insert({
      tenant_id: tenant.id,
      connector_id: 'naver_commerce',
      display_name: '네이버 스마트스토어',
      extra: {},
    })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service.from('channel_credentials').insert({
    connection_id: connection.id,
    access_token: clientId,
    extra: { secret_key: clientSecret },
  })

  return NextResponse.redirect(new URL('/channels', request.url))
}
