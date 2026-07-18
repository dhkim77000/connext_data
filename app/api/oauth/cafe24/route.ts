// app/api/oauth/cafe24/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/base-url'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const url = new URL(request.url)
  const mall = url.searchParams.get('mall')
  if (!mall) return NextResponse.redirect(new URL('/channels/connect/cafe24', request.url))

  const nonce = crypto.randomUUID()
  const redirectUri = `${getBaseUrl(request)}/api/oauth/cafe24/callback`
  const authUrl = `https://${mall}.cafe24api.com/api/v2/oauth/authorize?` + new URLSearchParams({
    response_type: 'code',
    client_id: process.env.CAFE24_CLIENT_ID!,
    state: nonce,
    redirect_uri: redirectUri,
    scope: 'mall.read_order,mall.read_product,mall.read_customer,mall.read_store,mall.read_shipping',
  })

  const res = NextResponse.redirect(authUrl)
  res.cookies.set('cafe24_oauth_state', JSON.stringify({ nonce, mallId: mall }), { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  return res
}
