# Offline POS integration — direct per-vendor APIs (global: US/EU + Korea)

**Goal:** collect a store's **offline sales** (transaction-level + SKU-level) by having each store
**delegate read access** to us — not by buying data from an aggregator.

**Model — delegation, not purchase:**
```
Store (owns its POS account)
  → grants "read my sales data" on an OAuth consent screen (or issues an API key)
Our app (registered as a developer/partner with each POS vendor)
  → receives an access token / key, scoped to that merchant
POS vendor API (Orders / Transactions / Line items)
  → our pipeline
```
Prereq per vendor: **we register as a developer or partner**, and **the store installs/approves our app**.
We build **direct connectors per POS** (no unified-API middleware — see §7 for why).

> Companion: `shopify-pos.md` is the Shopify-POS deep-dive (POS = ordinary Shopify orders). This doc
> is the cross-vendor survey. Reconciled with the connext warehouse in §5.

---

## 1. Per-platform summary

| POS | Region | Auth | Partner approval | SKU | History | Difficulty |
|---|---|---|---|---|---|---|
| **Square** | Global (US/CA/JP/AU/UK/IE/FR/ES) | OAuth 2.0 (code / PKCE) | **None** — self-serve dev dashboard | ✅ line items | ✅ | 🟢 low |
| **Shopify POS** | Global | OAuth 2.0 (Partner app) | scope-gated | ✅ | ⚠️ 60-day default; full needs approval | 🟡 med |
| **Clover** | US/CA (+some intl) | OAuth 2.0 | dev + App Market listing | ✅ | ✅ | 🟡 med |
| **Lightspeed** | Global (NA/EU/AU) | OAuth 2.0 | dev account | ✅ | ✅ | 🟡 med (multi-product, see note) |
| **Toast** | US/CA/UK/IE | Partner auth | ❗ required 3-step review | ✅ | ✅ | 🔴 high |
| **Toss Place (토스플레이스)** | Korea | API key pair | dev-center signup | ✅ | ✅ | 🟢 low |
| **OK/NICE/KIS Pos (전통 국내 POS)** | Korea | per-contract | individual B2B contract | — | — | 🔴 very high |

### Square — the fast PoC path 🟢
- OAuth 2.0 (code or PKCE). **No partner approval** — create an app in the developer dashboard and start.
- **Scopes:** `ORDERS_READ` (orders + line items = SKU-level), `PAYMENTS_READ`, `MERCHANT_PROFILE_READ`,
  `ITEMS_READ` (catalog).
- **Endpoints:** Orders API (revenue, line items) · Payments API · Catalog API · Merchants/Locations API.
- **Tokens (verified):** access token **expires in 30 days**. Refresh differs by flow —
  **code flow: the refresh token doesn't rotate and stays valid until revoked**; **PKCE flow: single-use,
  rotates, 90-day expiry.** Square recommends renewing **every ≤7 days** regardless of activity → a
  scheduled refresh job is mandatory (ties to master plan 1.3.x token lifecycle).
- **Offline caveat:** offline-mode payments sync after reconnect → **transaction time ≠ time it's
  queryable via API**; polling by `created_at` alone drops rows (see §5.2).

### Shopify POS 🟡
- POS sales = ordinary Shopify orders (`source_name: pos`), same Admin API. See `shopify-pos.md`.
- **`read_orders` returns only the last 60 days.** Full history needs **`read_all_orders`**, which is a
  **separate Shopify review** (Partner Dashboard → API access → request, justify the use case). File
  early if backfill matters.

### Toast — highest barrier 🔴
- **Partner review required** (as in `pos-platforms` earlier): (1) accept API License Agreement,
  (2) access docs, (3) submit the Integration Partner application, (4) await Toast review.
- **Partners API** lists the restaurants that have added our integration (a store adds us from Toast
  Web "Browse & purchase integrations"; needs their `Account Admin > Manage Integrations`).
- Orders API (bulk, custom-reporting use case) · Menus API · Restaurants API. **File the application
  first — approval lead time is the schedule risk.**

### Clover / Lightspeed 🟡
- Clover: OAuth 2.0, store installs from the Clover App Market. More open than Toast, more steps than Square.
- Lightspeed: OAuth 2.0, dev account. ⚠️ **product lines have different APIs** (Retail X-Series ex-Vend,
  Retail R-Series, Restaurant K-Series) — confirm which the merchant runs before scoping.

### Toss Place (토스플레이스) — the Korea path 🟢 (verified)
- **A real developer Open API exists** (`docs.tossplace.com`): **server-to-server data sync + external
  system integration**, **API key pair issued from the developer center** (key-based, not OAuth),
  **webhook event registration** for real-time store events. Explicitly supports ERP/CRM integration.
- Provides orders / payments / product (SKU + category) / store info in real time.
- **⚠️ Open item:** the docs center on a merchant integrating **its own** Toss POS. Whether one
  registered app can read **many** merchants' data under delegated consent (the multi-tenant model we
  need) is **not confirmed from docs** — verify with Toss during dev-center signup before committing.

### Traditional Korean POS (OK/NICE/KIS 등) 🔴
- **No standardized public API.** Proprietary terminals + private DBs, per-vendor custom APIs, no
  developer portal or OAuth. Access only via individual B2B contracts and custom integration.
- Practical options: direct B2B contract + custom work · a domestic data-integration broker
  (e.g. datapuree.io) as a bridge · manual CSV export if store count is small. **Separate track** —
  do not block the global build on it.

---

## 2. Recommended execution order

1. **Survey the target stores' POS mix first.** Without knowing which POS how many stores use, priority
   is guesswork (also the top risk in §6).
2. **File the Toast partner application immediately** (longest approval).
3. **Request Shopify `read_all_orders`** (review needed for historical backfill).
4. **Build the PoC on Square** — no approval, fastest path to prove OAuth → Orders API → SKU-level end
   to end. Lock the normalization contract here.
5. Extend to the other POS with an **adapter pattern** against the Square-validated schema.
6. **Korea:** start with Toss Place; put traditional POS on a separate track.

---

## 3. Common fields across vendors (the adapter maps to these)

| Concept | Square | Shopify | Toast | Toss Place |
|---|---|---|---|---|
| Transaction id | `order.id` | `order.id` | `order.guid` | order id |
| Store id | `location_id` | `location_id` | `restaurantGuid` | store id |
| Line items | `line_items[]` | `line_items[]` | `selections[]` | items[] |
| Product id | `catalog_object_id` | `variant_id` | `item.guid` | product id |
| Quantity | `quantity` | `quantity` | `quantity` | quantity |
| Amount | `total_money` | `total_price` | `amount` | amount |
| Timestamp | `created_at` | `created_at` | `openedDate` | order time |

---

## 4. Common engineering issues

- **Token management (biggest):** Square access token 30-day, renew ≤7 days on a background job; on
  401/403 flip the connection to `reauth_needed` (1.3.2) and prompt re-consent. Tokens are per-merchant.
- **Offline-payment delay:** transaction time ≠ queryable time → don't watermark on `created_at` alone;
  re-poll a trailing window by `updated_at` (exactly the incremental-watermark rule in 1.2.3).
- **Historical backfill:** chunk + resume under rate limits, as a separate job (1.2.4). Shopify needs
  `read_all_orders` first.
- **Webhook + reconciliation:** Square/Shopify/Toss Place support webhooks; pair with periodic polling
  to catch missed deliveries (webhook intake = 1.2.8).
- **Per-merchant rate-limit lanes:** limits vary and become the bottleneck as store count grows →
  per-merchant queues/throttle (1.2.6). Korean lanes stay slow (2 RPS convention).

---

## 5. Data model — reconcile with the connext warehouse

The research proposes a POS-agnostic normalized schema (`pos_transaction`, `pos_line_item`,
`pos_product`, `pos_merchant`, `pos_location`, `pos_connection`). Map it onto what connext already does:

- **Ingest raw per-vendor, following the existing convention** (`<source>_<entity>` — E2.2 decision
  tree): `square_orders_history`, `square_order_line_items_history` (events → `_history`),
  `square_products` / `square_locations` (snapshots). Same for `toast_*`, `clover_*`, `tossplace_*`.
  This keeps the vendor's raw shape (audit, reprocessing) and matches every other connector.
- **Normalize at the analytics layer, not at ingest.** The unified `pos_transaction` / `pos_line_item`
  view is exactly **`unified_orders`** already planned in 3.1.1 — extend it to carry a `channel`
  = online/in-store split and a `pos_vendor` column. The adapter/normalization lives in the view, so a
  new POS = a new raw table + a `UNION` branch, not a rewrite.
- **`pos_connection` is not a warehouse table** — it's connection/credential state, i.e. the existing
  Supabase `channel_connections` + `channel_credentials` (per-merchant token, expiry). No new store
  needed; POS connections are just more `channel_connections` rows.
- New DDL still passes E2.2 and lands in the v2 spec only (2.3.1/2.3.2 already reserve TikTok/YouTube/
  Naver/Coupang DDL; add the POS vendors there).

Net: **no bespoke `pos_*` schema at ingest** — raw `<vendor>_*` tables + a `unified_orders` view is the
connext-consistent shape and avoids double-normalizing.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Partner-approval lead time (Toast, Shopify `read_all_orders`) | File at project start (§2) |
| POS fragmentation (connector count grows linearly) | Survey the store POS mix first |
| Korea coverage (only Toss Place has a real API) | Toss Place first; traditional POS a separate track |
| Store churn (merchant revokes access anytime) | Connection-health monitoring (1.3.2) + re-consent flow |
| Data consistency (tax/discount/refund modeled differently per POS) | Per-vendor adapter into the unified view (§5) |

---

## 7. Why direct, not a unified-API vendor

The direct-delegation model (this doc) is the chosen approach. Unified middleware (POS Linker,
Apideck) was evaluated and **rejected for now**: niche-vendor risk, cost vs a 1–2 connector build,
their normalized model still needs a connext connector on top, gaps (POS Linker has no Lightspeed; none
cover Toss Place / Korea). Revisit only if 3+ US POS platforms land on the roadmap simultaneously.

---

## 8. Open items (verify before build)

- **Toss Place multi-merchant delegation** — can one app read many stores' data under delegated
  consent, or is it per-merchant key issuance? (docs are first-party-focused) — confirm at dev-center signup.
- Each vendor's **exact rate limits** (often undocumented until partner-registered).
- **Toast partner-approval actual lead time.**
- The **real POS distribution of target stores** — decides connector priority.

---

## Sources

- Square OAuth tokens (30-day access; code vs PKCE refresh; renew ≤7d) — https://developer.squareup.com/docs/oauth-api/refresh-revoke-limit-scope · best practices: https://developer.squareup.com/docs/oauth-api/best-practices
- Square Orders/Catalog/Locations — https://developer.squareup.com/docs/orders-api/what-it-does
- Shopify `read_all_orders` (60-day default, approval) — https://shopify.dev/docs/api/usage/access-scopes ; POS: repo `shopify-pos.md`
- Toast partner access — https://doc.toasttab.com/doc/devguide/devApiAccessRequirements.html · https://doc.toasttab.com/doc/devguide/apiPartnersGettingAccessibleRestaurants.html
- Clover — https://docs.clover.com · Lightspeed — https://developers.lightspeedhq.com
- Toss Place Open API — https://docs.tossplace.com/reference/open-api/intro.html · getting started: https://docs.tossplace.com/guide/pos-integration/getting-started.html
