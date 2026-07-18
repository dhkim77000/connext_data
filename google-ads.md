# Google Ads API

Connect for **campaign structure and performance (spend, clicks, conversions)** via GAQL.

- **Latest version:** `v23` / `v23.1` (2026); ~3–4 major releases/year, each sunset ~1 year later.
- **Transport:** gRPC (primary) + REST. REST base: `https://googleads.googleapis.com/v{N}/customers/{customer-id}/...`
- **Docs:** https://developers.google.com/google-ads/api

---

## 1. Authentication (3 things required)

1. **OAuth 2.0** with the single scope `https://www.googleapis.com/auth/adwords` → access + refresh token.
2. **Developer token** — issued in your Google Ads **Manager (MCC) account** → API Center. Has an access level (Test / Basic / Standard).
3. **`login-customer-id`** header — the MCC id when calling through a manager account.

```bash
# OAuth: get refresh token (one-time, offline)
curl -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=${CLIENT_ID}" -d "client_secret=${CLIENT_SECRET}" \
  -d "code=${CODE}" -d "redirect_uri=${REDIRECT_URI}" \
  -d "grant_type=authorization_code"
```

### Python (official client library — recommended over raw gRPC)

```python
# pip install google-ads
from google.ads.googleads.client import GoogleAdsClient

client = GoogleAdsClient.load_from_dict({
    "developer_token": DEV_TOKEN,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "refresh_token": REFRESH_TOKEN,
    "login_customer_id": MCC_ID,          # manager account, digits only
    "use_proto_plus": True,
})

ga_service = client.get_service("GoogleAdsService")
query = """
  SELECT campaign.id, campaign.name,
         metrics.impressions, metrics.clicks, metrics.cost_micros,
         metrics.conversions, metrics.ctr, metrics.average_cpc
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
  ORDER BY metrics.cost_micros DESC
"""
for batch in ga_service.search_stream(customer_id=CLIENT_CUSTOMER_ID, query=query):
    for row in batch.results:
        print(row.campaign.name, row.metrics.cost_micros / 1_000_000, row.metrics.clicks)
```

### REST equivalent

```bash
curl -X POST \
  "https://googleads.googleapis.com/v23/customers/${CUSTOMER_ID}/googleAds:searchStream" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "developer-token: ${DEV_TOKEN}" \
  -H "login-customer-id: ${MCC_ID}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT campaign.name, metrics.clicks FROM campaign WHERE segments.date DURING LAST_7_DAYS"}'
```

---

## 2. Data model (GAQL)

- **Resources:** `customer`, `campaign`, `ad_group`, `ad_group_ad` (creative), `ad_group_criterion` (keyword/targeting), `campaign_budget`, `asset`, `conversion_action`.
- **Metrics:** `metrics.impressions`, `metrics.clicks`, `metrics.cost_micros` (÷1,000,000 for currency), `metrics.conversions`, `metrics.ctr`, `metrics.average_cpc`, `metrics.conversions_value`.
- **Segments:** `segments.date`, `segments.device`, `segments.ad_network_type`.
- Mutations (`...:mutate`) create/update campaigns, ad groups, ads.

---

## 3. Rate limits

- Daily operations by access level: **Test 15,000**, **Basic 15,000**, **Standard unlimited**. Over-limit → `RESOURCE_EXHAUSTED`.
- Max **10,000 operations per mutate request**; gRPC message max **64 MB**.
- Pagination (`next_page_token`) requests don't count; one `SearchStream` request = 1 operation.

---

## 4. Access approval

1. Create an MCC account → request a developer token in API Center (starts at **Test** access — can only call test accounts).
2. Apply for **Basic Access** (15,000 ops/day on production).
3. **Standard Access** (unlimited) needs extra review — for large tools/enterprises.
4. As of early 2026, approvals are backlogged; advertiser verification is enforced.

**Gotchas:** no MCC = no developer token; cost is in micros; pin a version and migrate before sunset; comply with the Required Minimum Functionality (RMF) policy or risk token suspension.
