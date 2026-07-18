# connext data pipeline

The Python half of connext — scrapes each connected channel's API, then (later) cleans and
analyses the data. **Instagram first**, built to extend to the other channels.

Scraping is separated from loading: a scraper only *fetches + flattens* records; the CLI
(today) or the sync worker (later) decides what to do with them. Lives on its own branch
(`data-pipeline`); the Next.js app stays in TypeScript.

## Layout

```
connext_pipeline/
  graph/             Meta Graph API access layer
    client.py          rate-limit-aware HTTP client, full error capture
    rate_limit.py      X-App-Usage + X-Business-Use-Case-Usage parsing, throttle, backoff
    errors.py          GraphAPIError (status, subcode, www-authenticate, debug-link, ...)
  scrapers/
    base.py            BaseScraper interface (subclass + register to add a channel)
    instagram.py       profile / account_insights / audience_demographics / media / media_insights
  cli.py               run a scraper, print records as JSON lines
tests/                 unit tests (pure logic, no network)
```

## Setup

```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"          # httpx + python-dotenv + pytest
cp .env.example .env             # fill IG_ACCESS_TOKEN + IG_USER_ID
```

`IG_USER_ID` is the Instagram Business account id connext stores on
`channel_connections.extra.ig_user_id`.

## Run

```bash
# every data type
python -m connext_pipeline.cli instagram --ig-user-id 17841... --token EAA...

# one type, token/id from .env, piped to jq
python -m connext_pipeline.cli instagram --data-type media | jq
```

Records print to **stdout** (one JSON object per line); progress to **stderr**.

## Test

```bash
pytest
```

## Rate limiting (why it exists)

Meta meters reads in **two** buckets: app-level (`X-App-Usage`) and business-use-case
(`X-Business-Use-Case-Usage` — where ads/IG **insight** calls live). A 0% `X-App-Usage`
therefore does *not* mean "no rate limit". `GraphClient` reads both, throttles before each
call as usage rises, and backs off on throttle errors. It never retries
`code 200 / access_denied` ("API access blocked") — that is an app-*state* block (e.g. a
pending Data Use Checkup) needing a manual dashboard action, not a retry.

## Scope

Scraper layer only. Cleaning, the warehouse DDL + load, and scheduling are deferred by
design and come next.
