# TikTok — Marketing API, Display API & Shop API

⚠️ TikTok has **three separate developer platforms** with different portals, hosts, auth, and review. Don't conflate them.

| Platform | Portal | Base host | Purpose |
| --- | --- | --- | --- |
| Marketing API | business-api.tiktok.com | `https://business-api.tiktok.com` | Ads, reporting |
| Login Kit / Display / Content Posting | developers.tiktok.com | `https://open.tiktokapis.com/v2` | Organic content & user data |
| TikTok Shop | partner.tiktokshop.com | `https://open-api.tiktokglobalshop.com` | Commerce / orders |

---

## 1. Marketing API (ads)

### Auth — advertiser OAuth

```
GET https://business-api.tiktok.com/portal/auth?app_id={app_id}&state={state}&redirect_uri={redirect_uri}
```

```bash
# exchange auth_code -> long-lived access token
curl -X POST "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/" \
  -H "Content-Type: application/json" \
  -d '{"app_id":"'"${APP_ID}"'","secret":"'"${SECRET}"'","auth_code":"'"${AUTH_CODE}"'"}'
# -> { "data": { "access_token": "...", "advertiser_ids": ["..."] } }
```

Pass the token in the **`Access-Token`** header on every call.

### Pull a performance report

```bash
curl -G "https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/" \
  -H "Access-Token: ${ACCESS_TOKEN}" \
  --data-urlencode "advertiser_id=${ADV_ID}" \
  --data-urlencode "report_type=BASIC" \
  --data-urlencode "data_level=AUCTION_CAMPAIGN" \
  --data-urlencode 'dimensions=["campaign_id"]' \
  --data-urlencode 'metrics=["spend","impressions","clicks","cpc","cpm","ctr","conversion","cost_per_conversion"]' \
  --data-urlencode "start_date=2026-05-01" \
  --data-urlencode "end_date=2026-05-31"
```

**Metrics:** `spend`, `impressions`, `clicks`, `cpc`, `cpm`, `ctr`, `conversion`, `cost_per_conversion`, `reach`, `frequency`, `video_play_actions`, `video_views_p25`…`p100`, `likes`, `comments`, `shares`, `follows`. Full CRUD over campaigns/ad groups/ads/creatives/audiences/pixels.

**Rate limit:** ~600 req/min/endpoint (429 + `rate_limit_exceeded`); higher tiers (~20 QPS) on approval. **Access:** app registration + advertiser OAuth + app review/data-security check. Sandbox available.

---

## 2. Login Kit + Display API + Content Posting API (organic)

### Auth — OAuth 2.0 + PKCE

```
GET https://www.tiktok.com/v2/auth/authorize/
    ?client_key={client_key}
    &scope=user.info.basic,user.info.stats,video.list
    &response_type=code
    &redirect_uri={redirect_uri}
    &state={state}
    &code_challenge={challenge}&code_challenge_method=S256
```

```bash
curl -X POST "https://open.tiktokapis.com/v2/oauth/token/" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_key=${CLIENT_KEY}" -d "client_secret=${CLIENT_SECRET}" \
  -d "code=${CODE}" -d "grant_type=authorization_code" \
  -d "redirect_uri=${REDIRECT_URI}" -d "code_verifier=${VERIFIER}"
# -> { access_token, expires_in (~24h), refresh_token, refresh_expires_in (~365d), open_id }
```

### Scopes
`user.info.basic` (open_id, avatar, name), `user.info.profile`, `user.info.stats` (likes/follower/following/video counts), `video.list` (read public videos), `video.publish` (direct post), `video.upload` (draft).

### Read profile + video stats

```bash
curl -X POST "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,likes_count,video_count" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"

curl -X POST "https://open.tiktokapis.com/v2/video/list/?fields=id,title,view_count,like_count,comment_count,share_count,share_url" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" -d '{"max_count":20}'
```

**Rate limit:** 600/min each for `/user/info/`, `/video/list/`, `/video/query/`. **Access:** per-product app review; `video.publish` is forced private until an extra audit passes. Display API returns only the authorizing user's own public content.

> There is **no public "business account insights" API**. Organic analytics are in-app (Business Suite) or limited to the user's own data via `user.info.stats`. The Research API (large-scale public data) is restricted to vetted academics/non-profits.

---

## 3. TikTok Shop API (commerce)

### Auth — OAuth + HMAC-SHA256 request signing on every call

```python
import hashlib, hmac, time

def sign(path, params, app_secret, body=""):
    # sort params, concat key+value, wrap with path, prefix/suffix app_secret
    keys = sorted(k for k in params if k not in ("sign", "access_token"))
    base = "".join(f"{k}{params[k]}" for k in keys)
    base = f"{path}{base}{body}"
    base = f"{app_secret}{base}{app_secret}"
    return hmac.new(app_secret.encode(), base.encode(), hashlib.sha256).hexdigest()

params = {"app_key": APP_KEY, "timestamp": int(time.time()), "shop_cipher": SHOP_CIPHER}
params["sign"] = sign("/order/202309/orders/search", params, APP_SECRET)
# send Bearer access_token in header, params in query
```

- **Base/version:** `https://open-api.tiktokglobalshop.com`, date-based major version `202309` (`/order/202309/...`, `/product/202309/...`).
- Each request carries `app_key`, `timestamp`, `sign_method=HmacSHA256`, computed `sign`, Bearer access token, and `shop_cipher` (identifies the target shop).
- **Data/ops:** products (create/update/inventory/category), orders (list/detail/process), logistics (labels/tracking/split), finance/settlements, returns/refunds, promotions, **webhooks** (new order, inventory, fulfillment).
- **Rate limit:** ~100/min per store (Standard) up to ~500/min (Partner). Availability & scopes vary by market (US/UK/SEA).
- **Access:** create app in Partner Center, seller approves per-domain scopes, production review.
