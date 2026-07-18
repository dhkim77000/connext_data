import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const customerId = await searchParams.get('customerId')
  const apiKey = await searchParams.get('apiKey')
  const secretKey = await searchParams.get('secretKey')

  if (!customerId || !apiKey || !secretKey) {
    return NextResponse.redirect(new URL('/channels/connect/naver_search_ad', request.url))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.redirect(new URL('/dashboard', request.url))

  const service = await createServiceClient()
  const { data: connection, error } = await service
    .from('channel_connections')
    .insert({
      tenant_id: tenant.id,
      connector_id: 'naver_search_ad',
      display_name: `네이버 검색광고 (${customerId})`,
      extra: { customer_id: customerId },
    })
    .select()
    .single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service.from('channel_credentials').insert({
    connection_id: connection.id,
    access_token: apiKey,
    extra: { secret_key: secretKey },
  })

  return NextResponse.redirect(new URL('/channels', request.url))
}
