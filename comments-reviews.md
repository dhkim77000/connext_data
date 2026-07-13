# Comments & reviews — can we pull them? (Instagram · TikTok · Shopify)

Survey of pulling **user text** — social comments and product reviews — as a data source for
review/CS text-mining (master plan 1.1.13 채널톡, 1.1.14 리뷰 data_type, 3.6.5 `derived_review_signals`).
Short answer per platform: **Instagram ✅ clean · TikTok ⚠️ gated · Shopify ⚠️ lives in a review app,
not Shopify itself.**

| Source | Can we read comments/reviews? | Path | Gate |
|---|---|---|---|
| **Instagram** | ✅ Yes — comments + replies | IG Graph API (same Meta app 2094) | `instagram_manage_comments` scope + Advanced Access app review |
| **TikTok** | ⚠️ Hard — organic comment reading is gated | Research API (vetted only) / Business API (moderation, ad-oriented) | Research eligibility, or Business API tied to ad account |
| **Shopify** | ⚠️ Not native — product reviews live in a 3rd-party app | Review-app API (Judge.me / Yotpo / Loox / Okendo) | Depends which app the merchant runs |

---

## 1. Instagram — the clean one ✅

We already have the IG connector + the Python Graph client (`connext_pipeline.graph`). Comments are a
direct extension of it, same app (2094), same rate-limit discipline (`CLAUDE.md`).

- **List comments on a post:** `GET /{ig-media-id}/comments` → id, text, username, timestamp, like_count.
- **Replies to a comment:** `GET /{ig-comment-id}/replies`.
- **Scope:** `instagram_manage_comments` (read comments, plus reply/hide/delete — we only need read).
- **Access level:** **Advanced Access** for accounts we don't own/manage → **app review required**
  (same review track as the insights permissions we already carry).
- **Real-time:** webhooks fire on new comments → feeds the "오늘 실시간" widget (1.2.8) and lets us
  ingest incrementally instead of re-scanning every post.

**⚠️ CLAUDE.md rate-limit rule applies** — comment reads count against the same
`X-Business-Use-Case-Usage` bucket as insight calls. Pull comments per-post on the existing sync
cadence, never in a burst. Prefer webhooks for freshness over polling.

Data model (E2.2 tree): comments are **events** → `instagram_comments_history`
(media_id, comment_id, parent_id, text, username, like_count, timestamp). Join back to
`instagram_media`. Feeds 3.6.5 text mining (topics/sentiment) → `derived_review_signals`.

---

## 2. TikTok — gated, no clean organic path ⚠️

Three developer surfaces, none of which cleanly gives a brand its own organic comment stream:

1. **Research API** — `query_video_comments` (by `video_id` for comments, or `comment_id` for replies;
   returns text, author `display_name`, engagement, timestamps). **BUT vetted-researcher only** —
   academic/research eligibility, an application and approval that a commerce SaaS won't qualify for.
2. **TikTok API for Business** — supports **comment moderation** (hide/reply/"update comment status"),
   oriented at **ad comments** and tied to an ad/business account. It's a management surface, not a
   clean "read all organic comments on my videos" analytics feed.
3. **Display API** (Login with TikTok) — profile + a user's own video list/metadata. **Does not expose
   comment lists.**

**Net:** reading TikTok comments at analytics scale is **not practical through official APIs** for our
use case. Options, worst trade-offs noted:
- **Business API moderation** — usable if the merchant runs TikTok ads and we only need ad-comment
  moderation signals (narrow).
- **Third-party wrappers** (Ayrshare, SocialKit, etc.) — resell comment access; add a vendor
  dependency, cost, and **ToS/ban risk** (many are effectively scraping). Legal/ToS gate before use,
  same bar as the competitor-scraping item (master plan 1.5.2).
- **Scraping** — against TikTok ToS; do not.

**Recommendation:** treat TikTok comments as **out of scope for v1**. Track TikTok for *ads/performance*
(the existing 1.1.8 connector), not organic comment mining, until a supported path exists.

---

## 3. Shopify — "reviews" isn't a Shopify feature ⚠️

- Shopify's **native Product Reviews app was discontinued (2024)** — old reviews still render, no new
  collection, deprecated. There is no product-reviews object in the Admin API.
- What the Admin API *does* have: **blog article `Comment`s** and **order notes/timeline comments** —
  neither is a product review.
- Real product reviews live in whatever **review app** the merchant installed. The big five: **Judge.me,
  Yotpo, Loox, Okendo, Stamped.** So "pull Shopify reviews" = "pull from the merchant's review app."

Practical path — **ask which app, integrate that app's API:**
- **Judge.me** — the most API-friendly and has a generous free tier; clean public REST API
  (reviews by product, rating, body, reviewer, photos). Best default to support first.
- **Yotpo / Okendo / Stamped** — have APIs too (Yotpo enterprise-oriented; Okendo/Judge.me ship clean
  per-product review JSON-LD).
- Fallback with zero app dependency: **review JSON-LD on the storefront** (Judge.me/Okendo/Junip emit
  it) can be parsed from product pages — brittle, use only if no API access.

Data model: `shopify_product_reviews_history` already earmarked in master plan 2.3.3 — but the *source*
is the review app, so the connector is "Judge.me" (etc.), keyed back to `shopify_products.product_id`.

---

## 4. Where this plugs in

All three feed the same downstream: **3.6.5 리뷰·CS 텍스트 마이닝 → `derived_review_signals`** (LLM
topic + sentiment → cards like "상품 X 배송 불만 급증"). Priority order by effort/payoff:

1. **Instagram comments** — cheapest (connector exists), highest-signal for a social-led brand. **P1.**
2. **Shopify reviews via Judge.me** — high commercial value (product-level sentiment), one app API. **P1.**
3. **TikTok comments** — blocked by platform; revisit only if a supported path opens. **P2 / hold.**

Master plan: extends 1.1.14 (review data_type) with a **source split** — IG Graph vs review-app API —
and adds a hold note on TikTok organic comments.

---

## Sources

- IG comments endpoint — https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/comments/ · IG Comment object: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-comment/
- IG `instagram_manage_comments` + Advanced Access — https://developers.facebook.com/docs/instagram-platform/overview/
- TikTok Research API video comments (vetted only) — https://developers.tiktok.com/doc/research-api-specs-query-video-comments
- TikTok Business API comment status management — https://business-api.tiktok.com/portal/docs?id=1738086844585985 · webhooks: https://developers.tiktok.com/doc/webhooks-overview/
- Shopify native reviews sunset + review-app landscape — https://craftshift.com/best-shopify-review-apps-2026/ · https://siteoptimizr.com/best-shopify-reviews-app/
- Judge.me (API-friendly, free tier) — https://apps.shopify.com/judgeme
