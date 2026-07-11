// Query ClickHouse over the HTTP interface (fetch-based), not the node @clickhouse/client.
// Rationale: the node client's socket pool can hang on ClickHouse Cloud cold-wakes; a plain
// fetch is robust everywhere (local dev + Vercel) and streams a small result cleanly.
// Read-only: use for dashboard SELECTs. Params are bound server-side via `param_<name>`
// (never string-interpolate untrusted values into SQL).

const CH_URL = process.env.CLICKHOUSE_URL
const CH_USER = process.env.CLICKHOUSE_USERNAME ?? 'default'
const CH_PASS = process.env.CLICKHOUSE_PASSWORD ?? ''

export async function queryCH<T = Record<string, unknown>>(
  sql: string,
  params: Record<string, string | number> = {},
): Promise<T[]> {
  if (!CH_URL) throw new Error('CLICKHOUSE_URL is not set')

  const url = new URL(CH_URL.replace(/\/$/, '') + '/')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(`param_${k}`, String(v))
  const body = `${sql}\nFORMAT JSONEachRow`

  // Retry transient failures. ClickHouse Cloud idles when unused; the first request after a
  // wake can fail ("fetch failed") or stall while the service spins up. 3 attempts with
  // backoff + a per-attempt timeout keeps the dashboard resilient instead of erroring on a
  // cold hit (the failed first attempt itself nudges the service awake).
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt))
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 25_000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-ClickHouse-User': CH_USER,
          'X-ClickHouse-Key': CH_PASS,
          'Content-Type': 'text/plain',
        },
        body,
        cache: 'no-store',
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`ClickHouse ${res.status}: ${(await res.text()).slice(0, 300)}`)
      const text = (await res.text()).trim()
      return text ? text.split('\n').map((line) => JSON.parse(line) as T) : []
    } catch (e) {
      lastErr = e
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}
