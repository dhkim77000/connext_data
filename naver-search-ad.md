# Naver Search Ad API

Connect for **search-ad campaigns, ad groups, keywords, bids, and performance stats**.

- **Base:** `https://api.searchad.naver.com`
- **Docs:** https://naver.github.io/searchad-apidoc/ (GitHub: `naver/searchad-apidoc`)
- Self-service: an advertiser (or delegated agency) issues keys directly — no partner review.

---

## 1. Authentication — HMAC-SHA256 signature (not OAuth)

Every request needs 4 headers. The signature covers `timestamp.METHOD.path`.

```python
import hmac, hashlib, base64, time, requests

def headers(method, path, api_key, secret_key, customer_id):
    ts = str(int(time.time() * 1000))
    message = f"{ts}.{method}.{path}"            # path only, no query string
    sign = base64.b64encode(
        hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).digest()
    ).decode()
    return {
        "X-Timestamp": ts,
        "X-API-KEY": api_key,                    # access license
        "X-Customer": str(customer_id),          # CUSTOMER_ID
        "X-Signature": sign,
    }

path = "/ncc/campaigns"
r = requests.get("https://api.searchad.naver.com" + path,
                 headers=headers("GET", path, API_KEY, SECRET_KEY, CUSTOMER_ID))
```

`X-Timestamp` and the timestamp used in the signature must be identical, and the server clock must be in sync — clock skew is the #1 cause of invalid-signature errors.

Get credentials at **searchad.naver.com → 도구 (Tools) → API 사용 관리**: CUSTOMER_ID, access license (API key), secret key.

---

## 2. Resources & data

Hierarchy: **Campaign (`/ncc/campaigns`) → AdGroup (`/ncc/adgroups`) → Keyword (`/ncc/keywords`) / Ad (`/ncc/ads`)**. Business channels at `/ncc/channels`.

```bash
# performance stats
curl -G "https://api.searchad.naver.com/stats" \
  --data-urlencode 'ids=["nccKeyword..."]' \
  --data-urlencode 'fields=["impCnt","clkCnt","salesAmt","ccnt","cpc","ctr","avgRnk","convAmt","ror"]' \
  --data-urlencode 'timeRange={"since":"2026-05-01","until":"2026-05-31"}'
  # + the 4 auth headers
```

**Stat fields:** `impCnt` (impressions), `clkCnt` (clicks), `salesAmt` (cost), `ccnt` (conversions), `cpc`, `ctr`, `avgRnk` (avg rank), `convAmt` (conversion value), `ror` (ROAS). Plus a Keyword Tool (`/keywordstool`) for monthly search volume & competition.

### Large reports (recommended over polling `/stats`)

- **MasterReport** (`/master-reports`) — structure data as async TSV.
- **StatReport** (`/stat-reports`) — performance data as async TSV. Create a job → poll → download the file URL.

---

## 3. Rate limits & gotchas

- Official RPS not published; over-limit → `429`. For bulk, use Master/StatReport instead of looping `/stats`.
- Bid changes (`bidAmt`) at keyword/ad-group level via PUT.
- For multi-account agencies, specify the target `CUSTOMER_ID` per call.

> Naver GFA (performance display ads) is a **separate** API: OAuth 2.0 via Naver Login, base `https://openapi.naver.com/v1/ad-api/{version}`, **beta + official partners only**. Not covered here.
