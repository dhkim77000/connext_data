# Coupang — WING OpenAPI (Seller)

Connect to a Coupang seller (vendor) for **products, orders (PO), shipping, returns/cancellations, settlements**.

- **Base:** `https://api-gateway.coupang.com`
- **Path:** `/v2/providers/openapi/apis/api/v{N}/vendors/{vendorId}/...` (version `N` differs per resource: orders v4/v5, returns v6, settlement v1).
- **Docs:** https://developers.coupangcorp.com

---

## 1. Authentication — HMAC-SHA256 signature

```python
import hmac, hashlib, time, requests

def authorization(method, path, query, access_key, secret_key):
    # datetime: GMT, format yymmddTHHMMSSZ
    dt = time.strftime("%y%m%dT%H%M%SZ", time.gmtime())
    message = dt + method + path + query          # query has NO leading '?'
    signature = hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).hexdigest()
    return (f"CEA algorithm=HmacSHA256, access-key={access_key}, "
            f"signed-date={dt}, signature={signature}")

method = "GET"
path   = f"/v2/providers/openapi/apis/api/v4/vendors/{VENDOR_ID}/ordersheets"
query  = "createdAtFrom=2026-05-01&createdAtTo=2026-05-31&status=ACCEPT"
headers = {
    "Authorization": authorization(method, path, query, ACCESS_KEY, SECRET_KEY),
    "X-Requested-By": VENDOR_ID,
    "Content-Type": "application/json;charset=UTF-8",
}
r = requests.get(f"https://api-gateway.coupang.com{path}?{query}", headers=headers)
```

The signed `datetime` must be GMT and match what's in the header — **sync your server clock**.

---

## 2. Key endpoints / data (JSON responses)

| Domain | Example endpoint |
| --- | --- |
| Products | `.../v2/providers/seller_api/apis/api/v1/marketplace/seller-products` (create/update/price/quantity) |
| Orders (PO) | `.../api/v4/vendors/{vendorId}/ordersheets` (by date) · `.../api/v5/vendors/{vendorId}/ordersheets/{shipmentBoxId}` |
| Shipping | `.../ordersheets/acknowledgement` (mark in-preparation), invoice upload, `.../{shipmentBoxId}/history` |
| Returns/Cancel | `.../api/v6/vendors/{vendorId}/returnRequests` |
| Settlement | `.../v2/providers/marketplace_openapi/apis/api/v1/settlement-histories` |
| Inquiry | customer inquiry by product |

Also: inventory (quantity), category recommendation, auto-pricing, and a separate **RG Order API** for Rocket Growth.

---

## 3. Rate limits

- **5 requests/sec per vendorId** (reduced from 10 on 2026-03-17). Over-limit → `429`; resume after a few minutes. Excessive repeated product-API calls can be blocked immediately.

---

## 4. Setup & gotchas

- Join **WING (seller center)** + complete business authentication → `Seller info → Additional seller info → Open API Key`. Issuance can take 24h+.
- **API key validity = 180 days** (re-issue before expiry; email reminders sent).
- PII: recipient phone is a **safety (virtual) number**; `BuyerEmail` removed from customer-inquiry responses (2026-03-15).
- 2026 product-info policy requires brand, GTIN/MPN or model number, and category-required option attributes — include them in product payloads.
- No public ad/campaign OpenAPI confirmed (ads run in a separate center).
