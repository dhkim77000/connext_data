# Platform Data Integration — Developer Docs

English technical reference for connecting to each platform's API: **authentication + data access**, with practical `curl` / Python examples. Each file is self-contained and written so an AI coding assistant can implement an integration directly.

> Last verified: 2026-06. Version numbers, scopes, and rate limits drift — re-check the cited official docs before shipping.

## Files

| File | Platform | Auth model | Primary data |
| --- | --- | --- | --- |
| [meta.md](./meta.md) | Meta (Facebook Graph + Marketing + Pages + CAPI) | OAuth 2.0 / System User token | Ad spend & performance, page insights, account data, server-side conversions |
| [instagram.md](./instagram.md) | Instagram (Graph / Login) | OAuth 2.0 (IG or FB login) | Account & media insights, comments, publishing |
| [youtube.md](./youtube.md) | YouTube (Data v3 + Analytics v2) | API key + OAuth 2.0 | Video/channel metadata, views, watch time, demographics |
| [ga4.md](./ga4.md) | Google Analytics 4 (Data API) | OAuth 2.0 / Service account | Sessions, users, events, conversions, traffic source |
| [google-ads.md](./google-ads.md) | Google Ads API | OAuth 2.0 + Developer token | Campaign structure, spend, clicks, conversions (GAQL) |
| [tiktok.md](./tiktok.md) | TikTok (Marketing + Display + Shop) | OAuth 2.0 (3 separate platforms) | Ad performance, organic video stats, shop orders |
| [shopify.md](./shopify.md) | Shopify (Admin GraphQL/REST) | OAuth 2.0 / Admin token | Orders, products, inventory, customers, fulfillments |
| [cafe24.md](./cafe24.md) | Cafe24 (Admin API) | OAuth 2.0 Authorization Code | Orders, products, customers, shipping, sales reports |
| [naver-commerce.md](./naver-commerce.md) | Naver Commerce (SmartStore) | OAuth client_credentials + bcrypt signature | Orders, products, claims, settlements |
| [coupang.md](./coupang.md) | Coupang (WING OpenAPI) | HMAC-SHA256 signature | Orders, products, shipping, returns, settlements |
| [naver-search-ad.md](./naver-search-ad.md) | Naver Search Ad | HMAC-SHA256 signature | Campaigns, keywords, performance stats |
| [kakao-moment.md](./kakao-moment.md) | Kakao Moment | Business token (Biz app) | Ad campaigns, creatives, performance reports |

## Setup tutorials — what WE (the developer) do first

Reference docs above = how to *call* the API. Tutorials below = how to *register the app and get credentials* (app creation, redirect URLs, verification, review). Mostly dashboard UI work — almost none of it has an API.

| Tutorial | Covers |
| --- | --- |
| [setup-tutorial-meta-instagram.md](./setup-tutorial-meta-instagram.md) | Meta app + Business Portfolio + Page + connect Instagram, test with your own IG |
| [setup-tutorial-google.md](./setup-tutorial-google.md) | Google Cloud project, enable APIs, Google Auth Platform (OAuth consent), credentials, service account — GA4 + YouTube |
| [setup-tutorial-google-ads.md](./setup-tutorial-google-ads.md) | MCC, developer token, OAuth + refresh token, Basic/Standard access |
| [setup-tutorial-tiktok.md](./setup-tutorial-tiktok.md) | 3 separate TikTok platforms: Developers, Marketing API, Shop Partner Center |
| [setup-tutorial-shopify.md](./setup-tutorial-shopify.md) | Dev Dashboard app, CLI + managed install + token exchange (2026 changes) |
| [setup-tutorial-korea.md](./setup-tutorial-korea.md) | Cafe24, Naver Commerce, Coupang, Naver Search Ad, Kakao Moment key/app issuance |

> ⚠️ **Secrets are like passwords.** Never commit App Secret / Client Secret / Access Key to files or git. Use environment variables (`.env`, gitignored). If a secret is ever exposed, rotate it immediately in the platform dashboard.

## Three access models (how a 3rd party gets the data)

Every integration here reduces to one of three patterns. Know which one applies before you build.

1. **Delegated OAuth** — the data owner consents to your app; you receive a token scoped to their account. *GA4, YouTube, Meta, Instagram, TikTok, Google Ads, Cafe24, Shopify, Naver Commerce (SELLER type).* Most scalable; build an OAuth callback + token store.
2. **Credential sharing** — the owner issues keys/secret and hands them to you (or pastes them into your app). *Naver Search Ad, Coupang, 11st.* Simplest to start; you store the owner's keys.
3. **Registered partner/agency** — you must be pre-approved as an official partner before the owner can designate you. *Kakao Moment, Naver GFA, Korean marketplaces' OMS routes.* Highest barrier; apply for partner status first.

## Common implementation checklist

- **Token storage**: encrypt at rest. Track `expires_at` and refresh proactively (most tokens are short-lived; see each file).
- **Rate limits**: implement exponential backoff on `429`. Read the usage header each response (`X-App-Usage`, `X-Shopify-Shop-Api-Call-Limit`, GraphQL `extensions.cost`, etc.).
- **Idempotency**: webhook deliveries can be duplicated — dedupe by event/delivery id.
- **HMAC verification**: when a platform signs callbacks/webhooks, always verify with constant-time comparison before trusting the payload.
- **Sandbox first**: use test environments where offered (TikTok sandbox, Shopify dev store, Toss alpha, Google Ads test account).
- **PII**: Korean marketplaces mask buyer data (safety phone numbers, removed emails). Don't assume raw contact info is available.
