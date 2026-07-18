// app/api/oauth/shopify/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const shop = searchParams.get('shop')

  const cookieStore = await cookies()
  const nonce = cookieStore.get('shopify_oauth_nonce')?.value
  const savedShop = cookieStore.get('shopify_oauth_shop')?.value

  if (!code || !state || !shop || state !== nonce || shop !== savedShop) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
      code,
      // Public apps must use expiring offline tokens (Shopify, from 2026-04-01).
      // Returns access_token (1h) + refresh_token (90d).
      expiring: '1',
    }),
  })
  if (!tokenRes.ok) {
    const detail = await tokenRes.text()
    return NextResponse.json({ error: 'Token exchange failed', status: tokenRes.status, detail }, { status: 200 })
  }
  const token = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    refresh_token_expires_in?: number
  }
  const access_token = token.access_token

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.redirect(new URL('/dashboard', request.url))

  const { data: connection, error } = await supabase
    .from('channel_connections')
    .insert({ tenant_id: tenant.id, connector_id: 'shopify', display_name: shop, extra: { shop_url: shop } })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  const nowSec = Math.floor(Date.now() / 1000)
  await supabase.from('channel_credentials').insert({
    connection_id: connection.id,
    access_token,
    refresh_token: token.refresh_token,
    expires_at: token.expires_in ? nowSec + token.expires_in : undefined,
    extra: token.refresh_token_expires_in
      ? { refresh_token_expires_at: nowSec + token.refresh_token_expires_in }
      : {},
  })

  const redirect = NextResponse.redirect(new URL('/channels', request.url))
  redirect.cookies.delete('shopify_oauth_nonce')
  redirect.cookies.delete('shopify_oauth_shop')
  return redirect
}
