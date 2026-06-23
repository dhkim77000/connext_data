// app/api/oauth/shopify/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SCOPES = 'read_orders,read_products,read_customers'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { searchParams } = new URL(request.url)
  const shop = searchParams.get('shop')
  if (!shop) return NextResponse.json({ error: 'shop param required' }, { status: 400 })

  const nonce = crypto.randomUUID()
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/shopify/callback`
  const installUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: process.env.SHOPIFY_CLIENT_ID!,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: nonce,
  })

  const res = NextResponse.redirect(installUrl)
  res.cookies.set('shopify_oauth_nonce', nonce, { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  res.cookies.set('shopify_oauth_shop', shop, { httpOnly: true, maxAge: 300, sameSite: 'lax' })
  return res
}
