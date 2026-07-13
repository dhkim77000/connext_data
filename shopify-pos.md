# Shopify POS — retail sales via the Admin API (there is no separate "POS sales API")

Connect for **in-store (offline) sales, store-location attribution, payment-method breakdown
(cash vs card), staff attribution, and register/cash-drawer sessions**.

**The one fact that shapes everything:** Shopify POS transactions are **ordinary Shopify
orders**. They land in the same Orders API/webhooks as online sales, tagged with
`source_name: "pos"` and a retail location. "Connecting POS" therefore does NOT mean a new
OAuth flow or a new connector — it means **widening what our existing Shopify connector
extracts** (+ a few optional POS-only objects). The separate "POS" developer surface
(POS UI Extensions) is for building apps *inside* the POS device app — irrelevant for
analytics ingestion.

- **API:** same Admin GraphQL API as `shopify.md` (`POST /admin/api/2026-04/graphql.json`).
- **REST is legacy** (since 2024-10; new public apps must be GraphQL-only since 2025-04).
  Our connector still calls REST `2024-01` — POS work should be done GraphQL-first.
- **Docs:** https://shopify.dev/docs/api/admin-graphql/latest/objects/Order

---

## 1. Reading POS sales — filter, don't integrate

POS orders come back from the normal orders query. Filter (or classify) by `source_name`:

```graphql
{
  orders(first: 100, query: "source_name:pos", sortKey: UPDATED_AT) {
    edges {
      node {
        id
        name
        createdAt
        sourceName            # "pos" | "web" | "shopify_draft_order" | app name…
        retailLocation { id name }   # the store where the sale rang up
        staffMember { id firstName lastName }
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        displayFinancialStatus
        test
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

- `source_name` values seen in practice: `web`, `pos`, `shopify_draft_order`, `iphone`,
  `android`, or a third-party app name. **Classify, don't special-case**: `pos` = retail,
  everything else = online/other.
- The value is protected — external API clients cannot *write* `source_name: "pos"` on
  created orders, which makes it a trustworthy read-side discriminator.
- **Everything else about the order is identical** to online orders: line items, refunds,
  transactions, customers, discounts. Our whole `_history` pipeline applies unchanged.

### What we already capture today

| Piece | Status in connext |
|---|---|
| `source_name` column | ✅ already in v2 `shopify_orders_history` (`String DEFAULT ''` — "web/pos/…") |
| `source_name` mapping in TS connector | ⬜ **not mapped** — the REST fetch keeps it only inside `raw` JSON |
| Store location on the order | ⬜ no column (`retailLocation.id` / REST `location_id`) |
| `shopify_locations` snapshot table | ✅ in v2 and live (empty until we fetch locations) |
| Payment method (cash/card) | ✅ table exists — `shopify_transactions_history` has `gateway`; POS cash shows up as gateway `cash` |
| Staff / register objects | ⬜ nothing (see §4–5) |

Backfill bonus: because we store the full order payload in `raw`, **already-ingested rows
contain `source_name` and `location_id`** — a one-off ClickHouse backfill
(`JSONExtractString(raw, 'source_name')`) can populate new columns without re-calling Shopify.

---

## 2. Store-location attribution

Two complementary sources:

1. **On each POS order:** GraphQL `Order.retailLocation` (added specifically for this;
   the older `physicalLocation` is deprecated). REST equivalent: `order.location_id`.
   Caveat: can be **null** on non-POS orders (always) and on some old/test orders — treat
   null as "online/unknown", don't crash joins.
2. **Locations master list:** `locations` query → feeds our existing `shopify_locations`
   snapshot table (id, name, address, active). Fetch it as a new `data_type: locations`
   so per-store dashboards can label stores by name.

```graphql
{ locations(first: 50, includeInactive: true) {
    edges { node { id name isActive address { city country } } } } }
```

Join key: `orders.retail_location_id` ↔ `shopify_locations.location_id`.

---

## 3. Payment methods — cash vs card (two options)

- **Cheapest (already modeled):** order-level `transactions` carry `gateway`
  (`cash`, `shopify_payments`, `manual`, gift card…). Our v2
  `shopify_transactions_history` already has the `gateway` column — implementing the
  `transactions` data_type covers "how did in-store customers pay" with zero schema work.
- **Shop-level alternative:** `tenderTransactions` — a flat, shop-wide money-movement
  feed (amount, `processedAt`, payment method, `user` = staff, `remoteReference`).
  Convenient for reconciliation-style reports, but redundant if we ingest per-order
  transactions. Skip for v1.

---

## 4. Staff attribution ("who rang it up")

- `Order.staffMember` (GraphQL) / REST `order.user_id` = the staff account logged into the
  register when the order was created. Needs the **`read_users`** scope.
- Community-reported caveat: staff on *order transactions* reflects who was **logged in**,
  and full staff objects via API are **Shopify Plus**-gated in places — and POS's in-app
  "attribute sale to staff" (commission-style attribution) is a different concept that is
  poorly exposed via the public API. → Treat staff analytics as **best-effort, verify on a
  real POS store during implementation**; don't promise commission reporting.

---

## 5. Register sessions & cash drawer — `CashTrackingSession` (optional, later)

Shopify rebuilt POS cash management (2026 "cash management foundations"): register
sessions, reason codes, a cash-drawer + ledger model, multi-device drawers, and Admin
GraphQL APIs to open/close sessions and pull reports.

- Object: `CashTrackingSession` (GraphQL Admin) — drawer balance over a shift: opening/
  closing float, expected vs counted, discrepancies, per-drawer/device/location.
- **Requires POS Pro** subscription on the location.
- Value for connext: "drawer discrepancy" anomaly cards, shift-level cash reports — nice
  **P2** add-on once a real POS-Pro merchant exists. Scope name for this object isn't
  documented on the object page — confirm the required access scope at implementation time.

POS UI Extensions (`pos-ui-extensions`) remain out of scope: they run inside the POS app
itself (e.g. custom register screens) and are not a data-read surface.

---

## 6. Webhooks — POS sales stream through the same topics

`orders/create`, `orders/updated`, `refunds/create` fire for POS orders exactly like web
orders; payloads include `source_name` and `location_id`. The planned webhook intake
(master plan 1.2.8) therefore gives the "오늘 실시간" widget offline sales for free —
worth including a small "online vs in-store today" split when 1.2.8 lands.

---

## 7. Requirements & scopes summary

| Need | Scope / requirement |
|---|---|
| POS orders (read) | `read_orders` (already have) + Protected Customer Data approval (already tracked). **⚠️ `read_orders` returns only the last 60 days** |
| POS orders — full history | **`read_all_orders`** — a **separate Shopify review** (Partner Dashboard → API access → request, justify the use case). Required for historical backfill; file early (lead time) |
| Locations | `read_locations` (add at next OAuth scope bump) |
| Staff names | `read_users` (+ Plus caveats, §4) |
| Cash tracking sessions | POS Pro location + scope TBD (§5) |
| Merchant prerequisites | Store actually uses Shopify POS app; locations defined in Admin → Settings → Locations |

No extra app review is needed beyond what online-order access already requires; POS data
rides on the same token. (Custom-app/single-merchant setups: just tick the extra scopes.)

---

## 8. connext integration plan (smallest-first)

| Step | Work | Size |
|---|---|---|
| 1 | Connector: map `source_name` (+ `location_id` → new column, E2.2 tree → `shopify_orders_history.retail_location_id String DEFAULT ''`) in the orders fetch; backfill old rows from `raw` | S |
| 2 | Connector: `locations` data_type → `shopify_locations` (table already exists) | S |
| 3 | Dashboard: Shopify tab "Online vs In-store" split (revenue/orders by `source_name`), per-location breakdown via BarRow | S–M |
| 4 | Connector: `transactions` data_type → payment-method (cash/card) mix per channel | M |
| 5 | (later, P2) staff attribution + `CashTrackingSession` for POS-Pro merchants | M |
| — | Cross-channel play candidate (E3.8): **P-23 매장↔온라인 고객 교차** — customers whose first purchase was in-store vs online: repeat rate, LTV, channel migration | (analysis) |

Steps 1–3 make POS visible end-to-end with **no new auth, no new tables** (one column).

---

## Sources

- Orders query / filtering — https://shopify.dev/docs/api/admin-graphql/latest/queries/orders
- `retailLocation` added to Order — https://shopify.dev/changelog/graphql-admin-api-retaillocation-field-added-to-order-object
- `source_name` discussion (protected value, filter usage) — https://community.shopify.com/t/pos-orders-api/66821 · https://community.shopify.com/c/shopify-apis-and-sdks/where-can-i-find-the-order-source-name-in-the-graphql-api/m-p/901888
- `retailLocation`/`physicalLocation` null caveat — https://community.shopify.dev/t/orders-retaillocation-physicallocation-are-always-null/9983
- TenderTransaction — https://shopify.dev/docs/api/admin-graphql/latest/objects/TenderTransaction · https://shopify.dev/docs/api/admin-graphql/latest/queries/tendertransactions
- OrderTransaction (gateway, staff caveats) — https://shopify.dev/docs/api/admin-graphql/latest/objects/OrderTransaction
- POS staff attribution limits — https://community.shopify.com/c/customers-discounts-and-orders/how-to-fetch-pos-staff-attribution-data-from-api/m-p/2762202
- StaffMember — https://shopify.dev/docs/api/admin-graphql/latest/objects/staffmember
- CashTrackingSession — https://shopify.dev/docs/api/admin-graphql/latest/objects/cashtrackingsession
- New cash management foundations (2026) — https://changelog.shopify.com/posts/new-cash-management-foundations-for-shopify-pos
- Register sessions (Admin/POS help) — https://help.shopify.com/en/manual/sell-in-person/shopify-pos/cash-register-management/register-sessions-in-shopify-admin
- POS UI Extensions (out of scope for ingestion) — https://shopify.dev/docs/api/pos-ui-extensions/latest/targets/register-details
