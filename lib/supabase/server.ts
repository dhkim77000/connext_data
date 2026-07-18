// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component render — cookies can't be set there.
            // Safe to ignore: middleware.ts refreshes the session and sets cookies.
          }
        },
      },
    }
  )
}

export async function createServiceClient() {
  // Supabase's new key naming = SUPABASE_SECRET_KEY (sb_secret_…); fall back to the
  // legacy SUPABASE_SERVICE_ROLE_KEY. Either is the secret key that bypasses RLS.
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
