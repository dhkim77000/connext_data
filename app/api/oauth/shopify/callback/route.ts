// app/api/oauth/shopify/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
    }),
  })
  if (!tokenRes.ok) return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.redirect(new URL('/dashboard', request.url))

  const service = await createServiceClient()
  const { data: connection, error } = await service
    .from('channel_connections')
    .insert({ tenant_id: tenant.id, connector_id: 'shopify', display_name: shop, extra: { shop_url: shop } })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service
    .from('channel_credentials')
    .insert({ connection_id: connection.id, access_token })

  const redirect = NextResponse.redirect(new URL('/channels', request.url))
  redirect.cookies.delete('shopify_oauth_nonce')
  redirect.cookies.delete('shopify_oauth_shop')
  return redirect
}
