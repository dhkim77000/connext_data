# Meta — Graph API, Marketing API, Pages & Conversions API

Connect to Meta for **ad performance, account/business data, page insights, and server-side conversions**.

- **Current version:** Graph API `v25.0` / Marketing API `v25.0` (released 2026-02-18). ~2-year lifecycle per version.
- **Base host:** `https://graph.facebook.com/v25.0/{node-id}/{edge}` (FB, Marketing, Pages, and IG-with-FB-Login). Video uploads use `https://graph-video.facebook.com`.
- **Docs:** https://developers.facebook.com/docs/graph-api , https://developers.facebook.com/docs/marketing-api

---

## 0. Developer-side setup — what WE do first (one-time, dashboard UI, not an API)

There is **no public API to register an app, set URLs, or do business verification** — all of this is manual in the Meta dashboard. Do it once per app.

1. **Create a Meta developer account** at https://developers.facebook.com → verify with phone/email.
2. **Create an App** → type **Business**. You get an **App ID** + **App Secret** (App Settings → Basic). These are *our* credentials, not the customer's.
3. **App Settings → Basic:** set App Domain, Privacy Policy URL, Terms URL, App Icon, Category. (Required before going Live / App Review.)
4. **Add products** the integration needs:
   - *Facebook Login for Business* — for OAuth user tokens.
   - *Instagram* (Instagram Graph API) — for IG data.
   - *Marketing API* — for ads.
5. **Configure OAuth redirect URIs:** Facebook Login → Settings → **Valid OAuth Redirect URIs** (must be HTTPS; localhost allowed for dev). Our callback endpoint goes here.
6. **Connect a Meta Business Manager** (business.facebook.com) and complete **Business Verification** (upload business docs). Required to get **Advanced Access** / serve accounts we don't own.
7. **App Review:** request **Advanced Access** for each permission (e.g. `instagram_manage_insights`, `ads_read`) with a screencast + use-case description. Needed only to act on accounts that have **no role** on our app.
8. **App Mode — Development vs Live:**
   - **Development mode:** we can access data for users who have a **role** on the app (admins/developers/testers) **without any review**. → This is how we test our own accounts.
   - **Live mode + Advanced Access:** required to serve real customers at scale.

> Practical takeaway: to *test with our own accounts*, stay in Development mode and skip App Review. To *onboard customers*, we need Business Verification + App Review for the permissions.

---

## 1. Authentication

All Graph API calls require an **access token**. Pick the token type by use case.

| Token type | Use case | Lifetime | Rate-limit regime |
| --- | --- | --- | --- |
| User access token | Acting as a logged-in user | short (1–2h) → long-lived ~60d | Platform |
| Page access token | Managing a Page | derived from user token | BUC |
| App access token | App-level, public data | non-expiring | Platform |
| **System User token** | **Server-to-server, ad automation (recommended for production)** | long-lived / non-expiring | BUC |

### 1a. OAuth (Facebook Login) — get a user token

```
GET https://www.facebook.com/v25.0/dialog/oauth
    ?client_id={app-id}
    &redirect_uri={redirect-uri}
    &state={csrf-token}
    &scope=ads_read,read_insights,pages_read_engagement,business_management
```

User approves → redirect to `redirect_uri?code={code}&state=...`. Exchange the code:

```bash
curl -G "https://graph.facebook.com/v25.0/oauth/access_token" \
  --data-urlencode "client_id=${APP_ID}" \
  --data-urlencode "client_secret=${APP_SECRET}" \
  --data-urlencode "redirect_uri=${REDIRECT_URI}" \
  --data-urlencode "code=${CODE}"
# -> { "access_token": "EAAB...", "token_type": "bearer", "expires_in": 5183999 }
```

Exchange a short-lived token for a **long-lived** (~60-day) token:

```bash
curl -G "https://graph.facebook.com/v25.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=${APP_ID}" \
  --data-urlencode "client_secret=${APP_SECRET}" \
  --data-urlencode "fb_exchange_token=${SHORT_LIVED_TOKEN}"
```

### 1b. System User token (recommended for agencies / server jobs)

Create a System User in **Business Manager → Business Settings → System Users**, assign it to the ad account / Page assets, then **Generate Token** selecting the app and scopes (`ads_read`, `ads_management`, etc.). The token is long-lived and not tied to a person. Use it exactly like any access token.

### 1c. Calling the API

Pass the token as a query param or `Authorization` header:

```bash
curl -G "https://graph.facebook.com/v25.0/me/adaccounts" \
  --data-urlencode "fields=id,name,currency,account_status" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

Always send `appsecret_proof` (HMAC-SHA256 of the token keyed by app secret) for server calls to harden against token theft:

```python
import hashlib, hmac
proof = hmac.new(APP_SECRET.encode(), ACCESS_TOKEN.encode(), hashlib.sha256).hexdigest()
# add &appsecret_proof={proof} to requests
```

---

## 2. Permissions & access tiers

- Request scopes in the OAuth `scope` param. Common: `ads_read`, `ads_management`, `read_insights`, `pages_show_list`, `pages_read_engagement`, `business_management`, `instagram_basic`, `instagram_manage_insights`.
- **Standard Access** (default): only accounts/assets you own or that have a role on your app.
- **Advanced Access**: required to serve businesses you don't own → **App Review + Business Verification**.
- Marketing API has its own tier: new apps start at `development_access` (low limits) → apply for **Advanced Access to "Ads Management Standard Access"** to reach `standard_access`.

---

## 3. Marketing API — ad performance & account data

Object hierarchy: **Ad Account (`act_<id>`) → Campaign → Ad Set → Ad → Ad Creative**. `insights` is an edge at every level.

### List campaigns

```bash
curl -G "https://graph.facebook.com/v25.0/act_${AD_ACCOUNT_ID}/campaigns" \
  --data-urlencode "fields=id,name,objective,status,daily_budget" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Pull insights (spend, impressions, clicks, ROAS)

```bash
curl -G "https://graph.facebook.com/v25.0/act_${AD_ACCOUNT_ID}/insights" \
  --data-urlencode "level=campaign" \
  --data-urlencode "fields=campaign_name,spend,impressions,clicks,cpc,cpm,ctr,actions,purchase_roas" \
  --data-urlencode "date_preset=last_30d" \
  --data-urlencode "breakdowns=age,gender" \
  -H "Authorization: Bearer ${TOKEN}"
```

Python (async report for large pulls):

```python
import requests, time
BASE = "https://graph.facebook.com/v25.0"

def run_insights(act_id, token):
    # 1. start async job
    r = requests.post(f"{BASE}/act_{act_id}/insights", params={
        "level": "ad",
        "fields": "ad_id,ad_name,spend,impressions,clicks,actions,purchase_roas",
        "time_range": '{"since":"2026-05-01","until":"2026-05-31"}',
        "access_token": token,
    })
    report_id = r.json()["report_run_id"]
    # 2. poll
    while True:
        s = requests.get(f"{BASE}/{report_id}", params={"access_token": token}).json()
        if s["async_status"] == "Job Completed":
            break
        time.sleep(3)
    # 3. fetch results
    return requests.get(f"{BASE}/{report_id}/insights", params={"access_token": token}).json()
```

**Key metrics:** `spend`, `impressions`, `reach`, `frequency`, `clicks`, `cpc`, `cpm`, `ctr`, `actions` (link_click, purchase, lead…), `cost_per_action_type`, `purchase_roas`, `conversions`. **Breakdowns:** age, gender, country, region, publisher_platform, placement, device. Supports attribution windows and `date_preset`/`time_range`.

> Since 2025-06, set `use_unified_attribution_setting=true` to match Ads Manager exactly.

---

## 4. Pages & Page Insights

```bash
curl -G "https://graph.facebook.com/v25.0/${PAGE_ID}/insights" \
  --data-urlencode "metric=page_impressions,page_post_engagements,page_fans" \
  --data-urlencode "period=day" \
  -H "Authorization: Bearer ${PAGE_TOKEN}"
```

> ⚠️ **2026-06 deprecation:** legacy reach/impressions metrics (`page_impressions_unique`, `post_impressions_*`, video impressions, story impressions) are being removed across all versions. Migrate to **Media Views / Media Viewers** metrics (`page_total_media_view_unique`, `post_total_media_view_unique`, `page_media_view`) and the new cross-platform **"Viewers"** metric.

---

## 5. Conversions API (CAPI) — server-side events

Send web/app/offline events server-side, tied to a **Dataset/Pixel ID**. **No App Review and no permissions required** — generate a token in **Events Manager** (recommended) or via a System User assigned to the Pixel.

```bash
curl -X POST "https://graph.facebook.com/v25.0/${PIXEL_ID}/events" \
  -H "Content-Type: application/json" \
  --data-urlencode "access_token=${CAPI_TOKEN}" \
  -d '{
    "data": [{
      "event_name": "Purchase",
      "event_time": 1718000000,
      "action_source": "website",
      "event_id": "order_12345",
      "user_data": {
        "em": ["<sha256-lowercased-email>"],
        "ph": ["<sha256-phone>"]
      },
      "custom_data": { "currency": "USD", "value": 49.99 }
    }]
  }'
```

Hash PII (`em`, `ph`) with SHA-256 before sending. Use a stable `event_id` to **deduplicate** against the browser Pixel.

---

## 6. Rate limits

- **Platform** (user/app tokens): `200 × number_of_users` calls/hour.
- **BUC — Ads Insights**: Standard `600 + 400×active_ads` ; Advanced `190,000 + 400×active_ads` per hour.
- **BUC — Ads Management**: Standard `300 + 40×active_ads` ; Advanced `100,000 + 40×active_ads`.
- **BUC — Pages**: `4,800 × engaged_users` per 24h.
- **Monitor headers:** `X-App-Usage` (platform %), `X-Business-Use-Case-Usage` (includes `ads_api_access_tier` + `estimated_time_to_regain_access`), `X-Ad-Account-Usage`.
- **Throttle error codes:** 4/17/32 (platform), 80000 (ads insights), 80004 (ads management), 80003 (custom audience).

```python
import json
resp = requests.get(url, params=params)
usage = json.loads(resp.headers.get("X-Business-Use-Case-Usage", "{}"))
# back off when call_count / total_cputime / total_time approach 100
```

---

## 7. Gotchas

- Versions sunset ~2 years after release — pin a version and schedule migrations (v19 removed 2026-05, v20 removed 2026-09).
- `metadata=1` query param deprecated in v25 (removed 2026-05).
- Webhooks: update your trust store with Meta's new root CA before **2026-03-31** (mTLS change).
- ASC/AAC campaign creation via Marketing API removed from v25.0 — use Advantage+.
- Instagram is reachable through the Graph API but has its own auth nuances → see [instagram.md](./instagram.md).
