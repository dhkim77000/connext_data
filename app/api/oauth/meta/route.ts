// app/api/oauth/meta/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

const SCOPES = 'ads_read,ads_management,business_management,read_insights'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const nonce = crypto.randomUUID()
  const redirectUri = `${getBaseUrl(request)}/api/oauth/meta/callback`
  const authUrl = 'https://www.facebook.com/v19.0/dialog/oauth?' + new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state: nonce,
    response_type: 'code',
  })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('meta_oauth_nonce', nonce, { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  return res
}
