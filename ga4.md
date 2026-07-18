# Google Analytics 4 — Data API (v1)

Connect for **report data: sessions, users, events, conversions, revenue, traffic source** — at the property level.

- **Base:** `https://analyticsdata.googleapis.com/v1beta/`
- **Admin (config) API:** `https://analyticsadmin.googleapis.com/v1beta/`
- **Docs:** https://developers.google.com/analytics/devguides/reporting/data/v1

---

## 1. Authentication

OAuth 2.0 **or** a **service account** (recommended for server-to-server). API key alone does not work.

Scopes: `https://www.googleapis.com/auth/analytics.readonly` (recommended) or `.../analytics`.

### Service account (server jobs)

1. Create a service account in Google Cloud → download the JSON key.
2. In GA4 **Admin → Property → Property Access Management**, add the service-account email (`...@...iam.gserviceaccount.com`) as a **Viewer**.
3. Authenticate with the JSON key:

```python
# pip install google-analytics-data
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Dimension, Metric
import os
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account.json"

client = BetaAnalyticsDataClient()
req = RunReportRequest(
    property=f"properties/{PROPERTY_ID}",
    date_ranges=[DateRange(start_date="2026-05-01", end_date="2026-05-31")],
    dimensions=[Dimension(name="sessionSource"), Dimension(name="country")],
    metrics=[Metric(name="sessions"), Metric(name="activeUsers"), Metric(name="conversions")],
)
print(client.run_report(req))
```

### REST (with an OAuth access token)

```bash
curl -X POST \
  "https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "dateRanges": [{"startDate": "2026-05-01", "endDate": "2026-05-31"}],
    "dimensions": [{"name": "deviceCategory"}, {"name": "sessionDefaultChannelGroup"}],
    "metrics": [{"name": "sessions"}, {"name": "totalRevenue"}, {"name": "conversions"}]
  }'
```

---

## 2. Key dimensions & metrics

- **Metrics:** `activeUsers`, `newUsers`, `totalUsers`, `sessions`, `engagedSessions`, `eventCount`, `conversions`, `screenPageViews`, `bounceRate`, `averageSessionDuration`, `totalRevenue`.
- **Dimensions:** `country`, `city`, `deviceCategory`, `eventName`, `pagePath`, `sessionSource` / `sessionMedium` / `sessionCampaignName` (traffic source), `date`, `sessionDefaultChannelGroup`.
- Event- and user-scoped **custom dimensions/metrics** are supported. Discover what a property exposes:

```bash
curl "https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}/metadata" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

Useful methods: `runReport`, `runRealtimeReport`, `batchRunReports`, `runPivotReport`, `checkCompatibility`.

---

## 3. Rate limits / quotas (per property, token-based, Standard tier)

- Core tokens: **200,000/property/day**, **40,000/property/hour**; concurrent requests **10/property**. (360 = 10×.)
- Each response includes remaining quota when you set `"returnPropertyQuota": true`:

```python
req = RunReportRequest(property=..., return_property_quota=True, ...)
resp = client.run_report(req)
print(resp.property_quota.tokens_per_hour.remaining)
```

- Thresholded requests are limited to 120/hour.

---

## 4. Access & gotchas

- No app review, but `analytics.readonly` is a **sensitive scope** → external published apps need OAuth consent-screen verification.
- **GA4 only** — Universal Analytics is not supported.
- Data is per-property; sampling and date-range limits apply to large/cardinal queries.
- The **Admin API** manages config (properties, data streams, custom dimensions, conversion events, audience links) — separate from reporting. Quota: 1,200 req/min.
