// app/api/oauth/meta/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const nonce = cookieStore.get('meta_oauth_nonce')?.value
  if (!code || !state || state !== nonce) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  // Instrumented so any failure surfaces as readable JSON (status 200) instead of a bare 500.
  let step = 'start'
  try {
    const redirectUri = `${getBaseUrl(request)}/api/oauth/meta/callback`

    step = 'token_exchange'
    const tokenRes = await fetch(
      'https://graph.facebook.com/v19.0/oauth/access_token?' +
        new URLSearchParams({
          client_id: process.env.META_APP_ID!,
          client_secret: process.env.META_APP_SECRET!,
          redirect_uri: redirectUri,
          code,
        }),
    )
    const tokenText = await tokenRes.text()
    if (!tokenRes.ok) {
      return NextResponse.json({ step, error: 'Token exchange failed', detail: tokenText }, { status: 200 })
    }
    const { access_token } = JSON.parse(tokenText) as { access_token: string }

    step = 'fetch_adaccounts'
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?access_token=${access_token}&fields=id,name`,
    )
    const { data: adAccounts } = (await accountsRes.json()) as { data: Array<{ id: string; name: string }> }
    const firstAccount = adAccounts?.[0]

    step = 'auth_user'
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', request.url))

    step = 'get_tenant'
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('owner_auth_id', user.id)
      .single()
    if (!tenant) return NextResponse.redirect(new URL('/dashboard', request.url))

    step = 'insert_connection'
    const { data: connection, error } = await supabase
      .from('channel_connections')
      .insert({
        tenant_id: tenant.id,
        connector_id: 'meta_ads',
        display_name: firstAccount?.name ?? 'Meta Ads',
        extra: { account_id: firstAccount?.id ?? '' },
      })
      .select()
      .single()
    if (error || !connection) {
      return NextResponse.json({ step, error: 'Failed to create connection', detail: error }, { status: 200 })
    }

    step = 'insert_credential'
    await supabase.from('channel_credentials').insert({ connection_id: connection.id, access_token })

    const redirect = NextResponse.redirect(new URL('/channels', request.url))
    redirect.cookies.delete('meta_oauth_nonce')
    return redirect
  } catch (e) {
    const err = e as Error
    return NextResponse.json(
      { step, error: 'Callback crashed', message: String(err?.message ?? err), stack: String(err?.stack ?? '').slice(0, 600) },
      { status: 200 },
    )
  }
}
