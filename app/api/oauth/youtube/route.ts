import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const nonce = crypto.randomUUID()
  const redirectUri = `${getBaseUrl(request)}/api/oauth/youtube/callback`
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
    state: nonce,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
  })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('youtube_oauth_nonce', nonce, { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  return res
}
