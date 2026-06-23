// app/api/oauth/meta/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const nonce = cookieStore.get('meta_oauth_nonce')?.value
  if (!code || !state || state !== nonce) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/meta/callback`
  const tokenRes = await fetch(
    'https://graph.facebook.com/v19.0/oauth/access_token?' +
    new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    })
  )
  if (!tokenRes.ok) return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  // Fetch the first ad account for this user
  const accountsRes = await fetch(
    `https://graph.facebook.com/v19.0/me/adaccounts?access_token=${access_token}&fields=id,name`
  )
  const { data: adAccounts } = (await accountsRes.json()) as { data: Array<{ id: string; name: string }> }
  const firstAccount = adAccounts?.[0]

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
      connector_id: 'meta_ads',
      display_name: firstAccount?.name ?? 'Meta Ads',
      extra: { account_id: firstAccount?.id ?? '' },
    })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service.from('channel_credentials').insert({ connection_id: connection.id, access_token })

  const redirect = NextResponse.redirect(new URL('/channels', request.url))
  redirect.cookies.delete('meta_oauth_nonce')
  return redirect
}
