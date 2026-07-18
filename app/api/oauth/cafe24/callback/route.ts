// app/api/oauth/cafe24/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const cookieStore = await cookies()
  const oauthState = cookieStore.get('cafe24_oauth_state')?.value
  let nonce: string | undefined
  let mallId: string | undefined

  try {
    if (oauthState) {
      const parsed = JSON.parse(oauthState)
      nonce = parsed.nonce
      mallId = parsed.mallId
    }
  } catch {
    return NextResponse.json({ error: 'Invalid OAuth state cookie' }, { status: 400 })
  }

  if (!code || !state || state !== nonce || !mallId) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const redirectUri = `${getBaseUrl(request)}/api/oauth/cafe24/callback`
  const basicAuth = Buffer.from(`${process.env.CAFE24_CLIENT_ID}:${process.env.CAFE24_CLIENT_SECRET}`).toString('base64')

  const tokenRes = await fetch(`https://${mallId}.cafe24api.com/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    mall_id?: string
    shop_no?: number
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
      connector_id: 'cafe24',
      display_name: tokenData.mall_id ?? mallId,
      extra: { mall_id: tokenData.mall_id ?? mallId, shop_no: tokenData.shop_no ?? 1 },
    })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service.from('channel_credentials').insert({
    connection_id: connection.id,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
  })

  const redirect = NextResponse.redirect(new URL('/channels', request.url))
  redirect.cookies.delete('cafe24_oauth_state')
  return redirect
}
