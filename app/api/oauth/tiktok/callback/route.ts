import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const authCode = searchParams.get('auth_code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const nonce = cookieStore.get('tiktok_oauth_nonce')?.value
  if (!authCode || !state || state !== nonce) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const tokenRes = await fetch(
    'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: process.env.TIKTOK_APP_ID!,
        secret: process.env.TIKTOK_APP_SECRET!,
        auth_code: authCode,
      }),
    }
  )
  if (!tokenRes.ok) return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  const { data } = (await tokenRes.json()) as {
    data: { access_token: string; advertiser_ids: string[] }
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
      connector_id: 'tiktok',
      display_name: data.advertiser_ids?.[0] ?? 'TikTok Ads',
      extra: { advertiser_id: data.advertiser_ids?.[0] ?? '' },
    })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service.from('channel_credentials').insert({ connection_id: connection.id, access_token: data.access_token })

  const redirect = NextResponse.redirect(new URL('/channels', request.url))
  redirect.cookies.delete('tiktok_oauth_nonce')
  return redirect
}
