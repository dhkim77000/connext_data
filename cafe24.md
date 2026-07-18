# Cafe24 — Admin API

Connect to a Cafe24 mall for **orders, products, customers, shipping, promotions, sales reports**. RESTful, JSON, HTTPS only.

- **Base:** `https://{mallid}.cafe24api.com/api/v2/admin/...` (multi-store via `shop_no`).
- **Version:** date-based, latest `2026-03-01`, sent via header `X-Cafe24-Api-Version`. Each version valid ~1 year from release.
- **Docs:** https://developers.cafe24.com/docs/en/api/admin/

---

## 1. Authentication — OAuth 2.0 Authorization Code

```
GET https://{mallid}.cafe24api.com/api/v2/oauth/authorize
    ?response_type=code
    &client_id={client_id}
    &state={state}
    &redirect_uri={redirect_uri}
    &scope=mall.read_order,mall.read_product,mall.read_customer
```

The authorization **code expires in 1 minute and is single-use**. Exchange it:

```bash
curl -X POST "https://${MALLID}.cafe24api.com/api/v2/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n ${CLIENT_ID}:${CLIENT_SECRET} | base64)" \
  -d "grant_type=authorization_code" \
  -d "code=${CODE}" \
  -d "redirect_uri=${REDIRECT_URI}"
# -> { access_token, refresh_token, expires_at, refresh_token_expires_at, scopes[], mall_id, shop_no }
```

- **access_token: 2 hours** · **refresh_token: 2 weeks (14 days)**.
- Refresh:

```bash
curl -X POST "https://${MALLID}.cafe24api.com/api/v2/oauth/token" \
  -H "Authorization: Basic $(echo -n ${CLIENT_ID}:${CLIENT_SECRET} | base64)" \
  -d "grant_type=refresh_token" -d "refresh_token=${REFRESH_TOKEN}"
```

### Calling

```bash
curl "https://${MALLID}.cafe24api.com/api/v2/admin/orders?start_date=2026-05-01&end_date=2026-05-31&limit=100" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "X-Cafe24-Api-Version: 2026-03-01"
```

---

## 2. Scopes

Format `mall.{read|write}_{resource}` — e.g. `mall.read_order`, `mall.write_product`, `mall.read_customer`, `mall.read_store`, `mall.read_shipping`. Personal/privacy data uses separate resources & scopes.

---

## 3. Key resources / data

`Store`, `Product` (products/inventory/variants), `Order`, `Customer`, `Category`, `Shipping`/`Carriers`, `Promotion`/`Benefits`, `Mileage` (points), `Boards` (community/Q&A), `Salesreport` (sales stats), `Analytics` (traffic), plus privacy-specific `Personal` / `Privacy` / `Customersprivacy` resources.

```python
import requests
def get_orders(mall, token, start, end):
    return requests.get(
        f"https://{mall}.cafe24api.com/api/v2/admin/orders",
        headers={"Authorization": f"Bearer {token}", "X-Cafe24-Api-Version": "2026-03-01"},
        params={"start_date": start, "end_date": end, "limit": 100, "embed": "items,receivers"},
    ).json()
```

---

## 4. Rate limits (Leaky Bucket)

- Bucket drains **2 calls/sec** (≤2/sec ⇒ effectively unlimited). Over-limit → `429`.
- Same IP exceeding ~10 req/sec may be treated as malicious.
- Headers: `X-Api-Call-Limit` (e.g. `1/40`), usage-based `X-Cafe24-Call-Usage`, `X-Cafe24-Time-Usage`, and `*-Remain` (returned only when usage hits 100%).

---

## 5. Setup & gotchas

- Register at **developers.cafe24.com** → create app → set `client_id`/`client_secret`, Redirect URI, version, scopes.
- App Store distribution requires security review (revenue split: dev 80% / Cafe24 20%).
- Single-mall data only (own-store), not a multi-marketplace aggregator. HTTPS required.
- Webhooks are supported (register event URLs, e.g. order events) — useful instead of polling.
