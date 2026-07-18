import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const cookieStore = await cookies()
  const nonce = cookieStore.get('google_ads_oauth_nonce')?.value
  if (!code || !state || state !== nonce) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const redirectUri = `${getBaseUrl(request)}/api/oauth/google-ads/callback`
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  const { access_token, refresh_token } = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
  }

  let displayName = 'Google Ads'
  const customersRes = await fetch(
    'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'developer-token': process.env.GOOGLE_ADS_DEV_TOKEN!,
      },
    }
  )
  if (customersRes.ok) {
    const { resourceNames } = (await customersRes.json()) as { resourceNames?: string[] }
    if (resourceNames && resourceNames.length > 0) {
      displayName = `Google Ads - ${resourceNames[0]}`
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: tenant } = await supabase
    .from('tenants').select('id').eq('owner_auth_id', user.id).single()
  if (!tenant) return NextResponse.redirect(new URL('/dashboard', request.url))

  const service = await createServiceClient()
  const customersRes2 = await fetch(
    'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'developer-token': process.env.GOOGLE_ADS_DEV_TOKEN!,
      },
    }
  )
  let customerId = ''
  if (customersRes2.ok) {
    const { resourceNames } = (await customersRes2.json()) as { resourceNames?: string[] }
    customerId = resourceNames?.[0] ?? ''
  }

  const { data: connection, error } = await service
    .from('channel_connections')
    .insert({
      tenant_id: tenant.id,
      connector_id: 'google_ads',
      display_name: displayName,
      extra: { customer_id: customerId },
    })
    .select().single()

  if (error || !connection) {
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }

  await service
    .from('channel_credentials')
    .insert({ connection_id: connection.id, access_token, refresh_token })

  const redirect = NextResponse.redirect(new URL('/channels', request.url))
  redirect.cookies.delete('google_ads_oauth_nonce')
  return redirect
}
