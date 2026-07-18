# connext — agent notes

Multi-tenant SaaS data platform (Next.js + Supabase + ClickHouse). The Python data
pipeline (scraping / cleaning / analysis) lives in `pipeline/` on the `data-pipeline`
branch; the web app stays in TypeScript.

## ⚠️ Meta Graph API — do NOT burst calls when testing

Meta meters reads in **two** buckets: app-level (`X-App-Usage`) and **business use case**
(`X-Business-Use-Case-Usage`, where ads / Instagram **insight** calls are counted). On a
**development-mode** app these limits are low. A burst of rapid test calls trips the limit
and returns **`code 200` / `access_denied` — "API access blocked"** for the *entire app*
(every token at once). That block is **not** a normal auto-expiring rate limit: it needs a
**manual action in the App Dashboard** to clear, and calling again while blocked extends it.
(This happened once already, from over-eager live testing.)

When testing the Graph / Marketing API:
- **Prefer the unit tests** — `cd pipeline && pytest` (pure logic, no network).
- For live checks, make **1–2 targeted calls**, never a sweep. Put a short `sleep` between calls.
- Go through `connext_pipeline.graph.GraphClient` — it throttles before each call and backs
  off on throttle errors automatically.
- A 0 % `X-App-Usage` does **NOT** mean "no rate limit" — always check
  `X-Business-Use-Case-Usage` too (insight calls live there).
- Never auto-retry `code 200 / access_denied`; it requires a dashboard action, not a retry.

## Key facts (non-secret)

- Meta app **2094** ("connext", Facebook Login for Business). OAuth scope: **`ads_read` only**
  (do NOT add `read_insights` — it is rejected as "Invalid Scopes" and blocks the whole flow).
  The Instagram connector reuses the same app via `META_APP_*` env fallback.
- **Instagram organic** data → Instagram Graph API. **Instagram *ad* performance** → Meta
  Marketing API with `breakdowns=publisher_platform` (filter `instagram`); join boosted posts
  back to organic via the ad creative's `effective_instagram_media_id`.
- IG Business account id is stored on `channel_connections.extra.ig_user_id`.
- Live site: `connext-snowy.vercel.app`. Deploy with `vercel --prod --yes` (git auto-deploy is
  broken; CLI deploy is the workaround). Node 20 required.
- Secrets (tokens, test login, service keys) are NOT in this file — see the agent memory.

## Pipeline (`pipeline/`)

- `connext_pipeline/graph/` — Graph client, `rate_limit.py` util, `GraphAPIError` (full capture).
- `connext_pipeline/scrapers/` — `BaseScraper` + per-channel scrapers (Instagram done).
- Run: `python -m connext_pipeline.cli instagram --ig-user-id <id> --token <tok>`.
