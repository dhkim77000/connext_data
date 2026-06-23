// lib/base-url.ts
// Resolves the app's public base URL across environments (local dev + Vercel).
// OAuth redirect URIs and internal server-to-server fetches are built on this,
// so it must yield the SAME stable origin for a given deployment.
export function getBaseUrl(request?: Request): string {
  // 1. Explicit override — set in local .env.local; optionally pin a custom domain on Vercel.
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL

  // 2. Vercel's stable production domain (auto-provided at build + runtime in production).
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // 3. Derive from the incoming request host.
  const host = request?.headers.get('host')
  if (host) return `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`

  // 4. Local fallback.
  return 'http://localhost:3000'
}
