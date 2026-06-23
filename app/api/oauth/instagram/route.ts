// app/api/oauth/instagram/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

// Read-only Instagram organic data: posts, engagement, account insights.
const SCOPES = 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const nonce = crypto.randomUUID()
  const redirectUri = `${getBaseUrl(request)}/api/oauth/instagram/callback`
  const authUrl = 'https://www.facebook.com/v19.0/dialog/oauth?' + new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state: nonce,
    response_type: 'code',
  })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('instagram_oauth_nonce', nonce, { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  return res
}
