# POS platforms — API survey (Toast · Square · Lightspeed · Clover · Shopify POS)

Survey of third-party POS platforms for offline/retail sales ingestion, and how they'd
plug into connext. **Shopify POS is a special case** — it's not a separate platform for
us (POS sales ride the Admin API we already use); see `shopify-pos.md`.

**Market reality check (2026):** none of the US POS platforms below operate in Korea —
Square's card processing is unavailable in Korea (the app installs but can't take
payments), and Toast serves only US/CA/UK/IE. For **Korea-domestic offline retail**, the
relevant systems are Korean POS/VAN players (토스플레이스, OKPOS, 포스뱅크, KIS/NICE 계열
등) — separate research item. The platforms below matter for two tracks: **(a) Korean
brands' overseas stores/popups** (US/JP/UK), **(b) a future global-market track**.

---

## 1. Per-platform summary

| Platform | Access model | Data available | Auth | Webhooks | Dev docs |
|---|---|---|---|---|---|
| **Toast** (restaurants; US/CA/UK/IE) | ⚠️ **Gated 2-track** — see below | Orders, checks/payments, menus, stock, labor/employees, kitchen, cash entries | OAuth2 client-credentials (machine) | ✅ | doc.toasttab.com/doc/devguide · changelog: toast-api.launchnotes.io |
| **Square** (US/CA/JP/AU/UK/IE/FR/ES) | ✅ Self-serve — most developer-friendly of the group | Orders, Payments, Catalog, Inventory, Customers, Team/Labor, Locations (reporting = derive from Orders/Payments; no dedicated Reports API in v2) | OAuth2 (multi-merchant) or access token (own account) | ✅ | developer.squareup.com |
| **Lightspeed** (NA/EU/AU) | ✅ Self-serve dev account | Sales, inventory, customers, employees; strong multi-location model. ⚠️ **Multiple product lines with different APIs** (Retail X-Series ex-Vend, Retail R-Series, Restaurant K-Series) — confirm WHICH Lightspeed the merchant runs before scoping | OAuth2 | ✅ (varies by line) | developers.lightspeedhq.com |
| **Clover** (US/CA + some intl) | ✅ Self-serve sandbox; App Market for distribution | Orders, payments, inventory, customers, employees | OAuth2 | ✅ | docs.clover.com |
| **Shopify POS** | ✅ Same token as online store | Everything = normal orders (`source_name: pos`) + locations, tender, register sessions | (existing) | ✅ (same topics) | → `shopify-pos.md` |

### Toast access — the important correction

Toast API docs are open to read, but credentials are **not** open self-serve for a SaaS:

1. **Standard API access** — a *restaurant itself* (Toast RMS Essentials+ subscription, with
   Manage Integrations permission) can create client credentials for **its own locations**
   in Toast Web (Integrations → Toast API access → Manage credentials). Read-oriented,
   per-merchant — equivalent to our "키 공유" access model (like a Shopify custom app).
2. **Integration Partner program** — multi-merchant apps must apply via the Integration
   Partner Application, get approved, and be added by restaurants from Toast's partner
   marketplace. Equivalent to our "파트너 승인" model (like Kakao Moment) — **lead time
   applies; if we ever target Toast merchants, file the application early** (same rule as
   master plan §6 외부 승인 리드타임).

So: "Toast is easy to integrate" is true *per restaurant* (merchant-issued credentials),
but a productized connector needs the partner track.

---

## 2. Unified middleware — buy vs build

**POS Linker** (pos-linker.com) — white-label aggregator unifying **Toast, Clover, Square,
Heartland** behind one API: hosted OAuth, real-time sync, normalized data model, webhooks,
Stripe-billed. Fits as a middle layer if/when we want several US POS platforms at once
without four connector builds.

Diligence before adopting (unresolved):
- **Vendor risk** — niche product; check company maturity, SLA, data residency.
- **Pricing** vs building 1–2 connectors ourselves (Square alone is a small build).
- **Normalization fit** — their normalized model vs our v2 warehouse semantics
  (snapshot/`_history`/`_stat`); we'd still write one connext connector against THEIR API.
- **Coverage gap** — no Lightspeed; Toast still requires the partner relationship
  somewhere in the chain.
- Alternatives to compare: **Apideck POS API** (unified-API vendor with a POS category);
  Omnivore (the old restaurant-POS aggregator) was acquired by Olo in 2022 and is no
  longer the open option it was.

**Recommendation (current stance):** if the need is exactly one platform (most likely
Square for overseas popups), integrate **direct** — self-serve OAuth, excellent docs, no
middleware dependency. Revisit POS Linker only when 3+ US POS platforms are on the
roadmap at once.

---

## 3. Mapping onto the connext stack

The generic pipeline suggested in research
(`POS API → middleware → Airflow → ClickHouse/Snowflake → Looker/Metabase`) maps onto what
this repo already has/plans — we don't add Airflow/Snowflake/Looker:

| Generic layer | connext equivalent |
|---|---|
| POS API / POS Linker | `lib/connectors/<platform>` (or one connector against POS Linker) |
| Airflow | Sync orchestration — master plan **1.2.1/1.2.2** (Vercel Cron vs Workflow DevKit vs BullMQ, 결정 대기) + retries 1.2.5 |
| Snowflake / ClickHouse | **ClickHouse** (fixed) — new tables via the **E2.2 decision tree** (e.g. `square_orders_history`, `square_payments_history`, `square_catalog` snapshot) |
| Looker / Metabase | connext dashboards (`components/charts` kit) — offline/online split, per-location views |

Integration blueprint per platform = the standard 3박자 (E1.1): 자격증명(OAuth) → fetch
커넥터(orders/payments/catalog/locations) → v2 DDL. Webhooks slot into 1.2.8.

---

## 4. Decision gate before any build

1. **Which market are we serving offline?** Korea-domestic → this doc's platforms don't
   apply; run the Korean POS/VAN survey instead. Overseas stores of KR brands → **Square
   first** (self-serve, JP+US coverage matches K-brand popup patterns).
2. If Toast merchants matter → file the Integration Partner application first (lead time),
   build later.
3. Only at 3+ platforms simultaneously → re-evaluate POS Linker/Apideck as middleware.

Master plan: task **1.1.16** (P2 · 🧭 market-fit gate).

---

## Sources

- POS Linker — https://pos-linker.com/
- Toast standard API access requirements — https://doc.toasttab.com/doc/devguide/devApiAccessRequirements.html · credentials: https://doc.toasttab.com/doc/devguide/devApiAccessCredentials.html
- Toast partner application — https://support.toasttab.com/en/article/Customer-Requesting-API-Credentials · auth: https://doc.toasttab.com/doc/devguide/authentication.html
- Square developer docs — https://developer.squareup.com · international availability: https://developer.squareup.com/docs/international-development · Korea (no card processing): https://community.squareup.com/t5/Using-Square/Is-square-pos-system-available-in-Korea/td-p/227170
- Square countries (Wikipedia summary) — https://en.wikipedia.org/wiki/Square_(financial_services)
- Toast markets (US/CA/UK/IE; ~106k locations) — https://www.paymentsdive.com/news/lightspeed-ceo-jp-chauvet-toast-restaurant-pos-payments-european-market/699708/
- Lightspeed developers — https://developers.lightspeedhq.com
- Clover developers — https://docs.clover.com · payments integration options: https://docs.clover.com/dev/docs/paas-integration-options
- Apideck POS API — https://developers.apideck.com/apis/pos/reference
- Shopify POS — repo `shopify-pos.md`
