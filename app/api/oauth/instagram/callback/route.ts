// app/api/oauth/instagram/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const nonce = cookieStore.get('instagram_oauth_nonce')?.value
  if (!code || !state || state !== nonce) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const redirectUri = `${getBaseUrl(request)}/api/oauth/instagram/callback`
  const tokenRes = await fetch(
    'https://graph.facebook.com/v19.0/oauth/access_token?' +
    new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    })
  )
  if (!tokenRes.ok) return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  const { access_token } = (await tokenRes.json()) as { access_token: string }

  // The IG business account lives on one of the user's Facebook Pages.
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{id,username}&access_token=${access_token}`,
  )
  const pagesBody = (await pagesRes.json()) as {
    data?: Array<{ instagram_business_account?: { id: string; username: string } }>
  }
  const igAccount = pagesBody.data?.find((p) => p.instagram_business_account)?.instagram_business_account

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
      connector_id: 'instagram',
      display_name: igAccount?.username ? `@${igAccount.username}` : 'Instagram',
      extra: { ig_user_id: igAccount?.id ?? '' },
    })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service.from('channel_credentials').insert({ connection_id: connection.id, access_token })

  const redirect = NextResponse.redirect(new URL('/channels', request.url))
  redirect.cookies.delete('instagram_oauth_nonce')
  return redirect
}
