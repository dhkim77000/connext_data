# Kakao Moment API

Connect for **Kakao ad campaigns, ad groups, creatives, and performance reports** (KakaoTalk channel/display/message ads).

- **Host:** `https://apis.moment.kakao.com`, paths `/openapi/v4/...` (message ads partly `/openapi/message/v2/...`). REST/JSON only.
- **Docs:** https://developers.kakao.com/docs/latest/ko/kakaomoment/common
- **Access is gated:** granted to official Kakao ad agencies and pre-arranged advertisers (advertisers apply via their Kakao marketer).

---

## 1. Authentication — Business token (not regular Kakao Login)

1. Register an app in **Kakao Developers** and convert it to a **Biz App** with business authentication.
2. Request a **business authorization** including the required **business consent items**; the user (with master/member role on the ad account) consents.
3. Receive a **Business Token** (proves access to the business assets: ad account, KakaoTalk channel). Admin key is **not** used for Moment calls.

```bash
curl -G "https://apis.moment.kakao.com/openapi/v4/campaigns" \
  --data-urlencode "adAccountId=${AD_ACCOUNT_ID}" \
  -H "Authorization: Bearer ${BUSINESS_TOKEN}"
```

---

## 2. Structure & data

Hierarchy: **Ad Account → Campaign → Ad Group → Creative** (`adAccountId`, `campaignId`, `adGroupId`, `creativeId`).

- **Ad account:** list/detail, real-time balance, KakaoTalk channel, pixel & SDK list, status changes.
- **Campaign / Ad group / Creative:** CRUD, daily budget, bid, on/off, targeting (region, placement, pixel events, customer files, friend groups, audiences).

### Performance reports (4 endpoints)

```bash
curl -G "https://apis.moment.kakao.com/openapi/v4/campaigns/report" \
  --data-urlencode "adAccountId=${AD_ACCOUNT_ID}" \
  --data-urlencode "campaignId=${CAMPAIGN_ID}" \
  --data-urlencode "metricsGroup=BASIC" \
  --data-urlencode "start=2026-05-01" --data-urlencode "end=2026-05-31" \
  -H "Authorization: Bearer ${BUSINESS_TOKEN}"
```

Report endpoints: `/adAccounts/report`, `/campaigns/report`, `/adGroups/report`, `/creatives/report`. `metricsGroup` ∈ `BASIC`, `ADDITION`, `MESSAGE`, `MESSAGE_ADDITION`, `MESSAGE_CLICK`. Metrics: impressions, clicks, CTR, reach, plays, CPC, cost-per-reach, etc.

---

## 3. Rate limits (per-endpoint, per-second)

- Account/creative reports: **1 call / 5 sec**. Ad-group report: **1 call / sec**. Create/update ops: 1 call per 1–5 sec. Over-limit → `429`.
- Reports cover **max 31 days**; same-day data is provisional (real-time) until ~08:00 next morning.

---

## 4. Setup & gotchas

- Convert app to Biz App → apply for Moment OpenAPI usage permission. Grant is **agency / arranged-advertiser only**.
- Requires an identity-verified Kakao account with master/member role on the ad account.
- Not all campaign types/objectives are creatable via API — only the supported subset.
