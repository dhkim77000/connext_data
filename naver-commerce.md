# Naver Commerce API (SmartStore / Window)

Connect to a Naver seller account for **orders, products, claims (return/exchange/cancel), settlements**.

- **Base:** `https://api.commerce.naver.com`, paths `/external/v1/...` (some `/external/v2/...`).
- **Docs / API Center:** https://apicenter.commerce.naver.com/docs (GitHub: `commerce-api-naver/commerce-api`).

---

## 1. Authentication — OAuth `client_credentials` + bcrypt signature

The secret is never sent directly; each token request is signed with bcrypt.

### Signature

`client_secret_sign = Base64( bcrypt( client_id + "_" + timestamp, client_secret ) )`

The `timestamp` (ms, 13 digits) must match the value sent in the request.

```python
import bcrypt, base64, time, requests

def get_token(client_id, client_secret):
    ts = str(int(time.time() * 1000))
    pwd = f"{client_id}_{ts}".encode()
    hashed = bcrypt.hashpw(pwd, client_secret.encode())          # client_secret is the bcrypt salt
    sign = base64.b64encode(hashed).decode()
    r = requests.post("https://api.commerce.naver.com/external/v1/oauth2/token", data={
        "client_id": client_id,
        "timestamp": ts,
        "grant_type": "client_credentials",
        "client_secret_sign": sign,
        "type": "SELF",          # SELF = seller's own app; SELLER = solution/agency issuing on behalf of a seller
    })
    return r.json()["access_token"]
```

```bash
curl "https://api.commerce.naver.com/external/v1/pay-order/seller/orders?from=2026-05-01T00:00:00.000+09:00" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

- No refresh-token flow — **re-issue** the token when it expires. Expired token → `401` with error code `GW.AUTHN`.
- `type=SELLER` is for solutions/agencies issuing tokens on behalf of multiple sellers (subject to extra **Quota limit**).

---

## 2. Data (register all 5 API groups when creating the app)

- **Product** — create/update/inventory/options/category.
- **Pay-Order** — paid-order lookup, order confirmation (`발주확인`), dispatch, delivery tracking. e.g. `GET /external/v1/pay-order/seller/orders`.
- **Claim** — returns / exchanges / cancellations.
- **Settlement** — sales & settlement records.
- **Inquiry / Talk-Talk / Store management.**

---

## 3. Rate limits (Token Bucket, 3 layers)

1. **API capacity** (platform-wide, undisclosed).
2. **Rate limit** — per-app, per-API RPS.
3. **Quota limit** — per SELLER token (only for solution/agency apps; not for own-store apps).

Over-limit → `429`. Burst Max allows 2× temporarily (non-consecutive). **Own-store apps are fixed at 2 RPS** for all APIs. Headers: `GNCP-GW-RateLimit-Replenish-Rate`, `-Burst-Capacity`, `-Remaining`.

---

## 4. Setup & gotchas

- Apply at the **Commerce API Center** (`apicenter.commerce.naver.com`) with a 통합매니저 (integrated manager) account.
- On app registration: register up to **3 caller IPs** (calls only allowed from them) and add the **5 API groups**. **Max 1 app per store.**
- External channels receive **masked buyer PII** (broader masking than the SmartStore center UI).
- HTTPS only.
