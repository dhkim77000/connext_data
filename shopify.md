# Shopify — Admin API (GraphQL primary, REST legacy)

Connect for **orders, products/variants, inventory, customers, fulfillments, transactions**.

- **Current version:** `2026-04` (latest stable; quarterly date-based, each supported ≥12 months).
- **GraphQL:** `POST https://{shop}.myshopify.com/admin/api/2026-04/graphql.json` (primary, actively developed).
- **REST (legacy):** `https://{shop}.myshopify.com/admin/api/2026-04/{resource}.json`.
- **Docs:** https://shopify.dev/docs/api/admin-graphql/latest

---

## 1. Authentication

### A. Custom app (single merchant) — simplest

Merchant creates the app in **Settings → Apps and sales channels → Develop apps**, installs it, and copies the **Admin API access token** (`shpat_...`). No OAuth flow. Use it as the **`X-Shopify-Access-Token`** header. Token doesn't expire unless uninstalled.

```bash
curl -X POST "https://${SHOP}.myshopify.com/admin/api/2026-04/graphql.json" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ shop { name myshopifyDomain currencyCode } }"}'
```

### B. Public/custom app via OAuth 2.0 (multi-merchant)

1. **Install request** hits your App URL with `shop,timestamp,hmac`. Verify the HMAC (hex digest over the sorted query string, keyed by client secret).

2. **Authorize redirect:**
```
https://{shop}/admin/oauth/authorize
   ?client_id={api_key}
   &scope=read_orders,write_products,read_customers,read_inventory
   &redirect_uri={redirect_uri}
   &state={nonce}
   &grant_options[]=                     # empty = offline token; "per-user" = online token
```

3. **Callback** arrives with `code,hmac,host,shop,state`. Verify `state` and `hmac`, confirm `shop` matches `^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$`.

4. **Exchange code for token:**
```bash
curl -X POST "https://${SHOP}.myshopify.com/admin/oauth/access_token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${API_KEY}" -d "client_secret=${API_SECRET}" -d "code=${CODE}"
# -> { "access_token": "shpat_...", "scope": "read_orders,write_products" }
```

Offline tokens are non-expiring by default (add `-d 'expiring=1'` for a refreshable one). Embedded apps should prefer **Shopify managed installation + token exchange** (session-token JWT → access token) over manual OAuth.

### HMAC verification (OAuth callback — hex)

```python
import hmac, hashlib, urllib.parse
def verify_oauth(query: dict, secret: str) -> bool:
    received = query.pop("hmac")
    msg = "&".join(f"{k}={query[k]}" for k in sorted(query))
    digest = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, received)
```

---

## 2. Scopes

`read_orders`, `write_orders`, `read_products`, `write_products`, `read_customers`, `read_inventory`, `write_inventory`, `read_fulfillments`, `write_fulfillments`, `read_draft_orders`, `read_shipping`. Write implies read. Customer PII is **protected customer data** with extra app requirements.

---

## 3. Reading data

### GraphQL — products with pagination

```bash
curl -X POST "https://${SHOP}.myshopify.com/admin/api/2026-04/graphql.json" \
  -H "X-Shopify-Access-Token: ${TOKEN}" -H "Content-Type: application/json" \
  -d '{"query":"{ products(first: 50) { edges { cursor node { id title totalInventory variants(first:10){edges{node{id sku price inventoryQuantity}}} } } pageInfo { hasNextPage endCursor } } }"}'
```

### Bulk operations (large datasets — no per-second/cost limit, returns JSONL)

```graphql
mutation {
  bulkOperationRunQuery(query: """
    { orders { edges { node { id name createdAt totalPriceSet { shopMoney { amount currencyCode } }
      lineItems { edges { node { title quantity } } } } } } }
  """) {
    bulkOperation { id status }
    userErrors { field message }
  }
}
```

Poll `currentBulkOperation { status url }` until `COMPLETED`, then download the JSONL `url`.

**Data:** orders, products & variants, inventory (levels/items/locations), customers, fulfillments & fulfillment orders, transactions/payouts, draft orders, metafields.

---

## 4. Rate limits

- **GraphQL — calculated cost (leaky bucket of points):** bucket **1,000 points**; single query ≤ 1,000. Restore: **Standard 100 pts/sec**, Advanced 200, **Plus 1,000**. Read `extensions.cost`:
```json
"extensions":{"cost":{"requestedQueryCost":101,"actualQueryCost":46,
  "throttleStatus":{"maximumAvailable":1000,"currentlyAvailable":954,"restoreRate":100}}}
```
Field costs: scalar 0, object 1, connection = sized by `first`/`last`, mutation 10. Add header `Shopify-GraphQL-Cost-Debug: 1` for a breakdown.
- **REST — request count:** 40 burst, restoring **2 req/sec** (Standard; ×10 Plus). Header `X-Shopify-Shop-Api-Call-Limit: 32/40`. Over-limit → `429` + `Retry-After`.

---

## 5. Webhooks

Subscribe to topics (`orders/create`, `orders/paid`, `products/update`, `customers/create`, `fulfillments/create`, `app/uninstalled`). Verify each delivery with the **`X-Shopify-Hmac-SHA256`** header — base64 HMAC-SHA256 of the **raw body**, keyed by client secret:

```python
import hmac, hashlib, base64
def verify_webhook(raw_body: bytes, header_hmac: str, secret: str) -> bool:
    digest = base64.b64encode(hmac.new(secret.encode(), raw_body, hashlib.sha256).digest())
    return hmac.compare_digest(digest, header_hmac.encode())
```

> ⚠️ Two different HMAC encodings: **OAuth callback = hex over sorted query string**; **webhook = base64 over raw body**. Use the raw body (verify before any JSON parser). Respond `200` within 5s; deliveries can duplicate → process idempotently via `X-Shopify-Webhook-Id`.

---

## 6. Approval

Public (App Store) apps need Shopify review. Custom (single-merchant) apps don't. Apps touching protected customer data face extra requirements regardless.
