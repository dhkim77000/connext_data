import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const nonce = crypto.randomUUID()
  const redirectUri = `${getBaseUrl(request)}/api/oauth/tiktok/callback`
  const authUrl = 'https://business-api.tiktok.com/portal/auth?' + new URLSearchParams({
    app_id: process.env.TIKTOK_APP_ID!,
    state: nonce,
    redirect_uri: redirectUri,
  })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('tiktok_oauth_nonce', nonce, { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  return res
}
