import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const vendorId = await searchParams.get('vendorId')
  const accessKey = await searchParams.get('accessKey')
  const secretKey = await searchParams.get('secretKey')

  if (!vendorId || !accessKey || !secretKey) {
    return NextResponse.redirect(new URL('/channels/connect/coupang', request.url))
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
      connector_id: 'coupang',
      display_name: `쿠팡 WING (${vendorId})`,
      extra: { vendor_id: vendorId },
    })
    .select()
    .single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service.from('channel_credentials').insert({
    connection_id: connection.id,
    access_token: accessKey,
    extra: { secret_key: secretKey },
  })

  return NextResponse.redirect(new URL('/channels', request.url))
}
