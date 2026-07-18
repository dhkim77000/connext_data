# Instagram — Graph API / Instagram Platform

Connect to Instagram **professional (Business/Creator) accounts** for account & media insights, comments, mentions, and content publishing. Personal accounts are not supported.

- **Current version:** Graph API `v25.0`.
- **Docs:** https://developers.facebook.com/docs/instagram-platform

---

## 1. Two configurations (pick first — it determines everything)

| | **Instagram API with Instagram Login** | **Instagram API with Facebook Login** |
| --- | --- | --- |
| Token type | Instagram User token | Facebook User / Page token |
| Host | `https://graph.instagram.com` | `https://graph.facebook.com` |
| Linked FB Page required | No | **Yes** |
| Hashtag search / mentions / product tagging | Not available | Available |
| Best for | IG-only presence | Businesses already on FB + need hashtag/mention |

---

## 2. Authentication (OAuth 2.0)

### Instagram Login flow

```
GET https://www.instagram.com/oauth/authorize
    ?client_id={instagram-app-id}
    &redirect_uri={redirect-uri}
    &response_type=code
    &scope=instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages,instagram_business_content_publish
```

Exchange code → short-lived token → long-lived token:

```bash
# 1. code -> short-lived token
curl -X POST "https://api.instagram.com/oauth/access_token" \
  -F "client_id=${IG_APP_ID}" \
  -F "client_secret=${IG_APP_SECRET}" \
  -F "grant_type=authorization_code" \
  -F "redirect_uri=${REDIRECT_URI}" \
  -F "code=${CODE}"
# -> { "access_token": "IGQ...", "user_id": 178... }

# 2. short-lived -> long-lived (60 days)
curl -G "https://graph.instagram.com/access_token" \
  --data-urlencode "grant_type=ig_exchange_token" \
  --data-urlencode "client_secret=${IG_APP_SECRET}" \
  --data-urlencode "access_token=${SHORT_LIVED}"
# -> { "access_token": "IGQ...", "token_type": "bearer", "expires_in": 5183944 }

# 3. refresh before expiry (extends another 60 days)
curl -G "https://graph.instagram.com/refresh_access_token" \
  --data-urlencode "grant_type=ig_refresh_token" \
  --data-urlencode "access_token=${LONG_LIVED}"
```

**Facebook Login flow:** use the standard FB OAuth (see [meta.md](./meta.md)) with scopes `instagram_basic,instagram_manage_insights,instagram_manage_comments,pages_show_list,pages_read_engagement`, then resolve the IG user id from the linked Page:

```bash
curl -G "https://graph.facebook.com/v25.0/${PAGE_ID}" \
  --data-urlencode "fields=instagram_business_account" \
  -H "Authorization: Bearer ${PAGE_TOKEN}"
```

---

## 3. Key data

### Account insights

```bash
curl -G "https://graph.instagram.com/v25.0/${IG_USER_ID}/insights" \
  --data-urlencode "metric=reach,profile_views,follower_count" \
  --data-urlencode "period=day" \
  --data-urlencode "access_token=${TOKEN}"
```

Available: `reach`, `impressions`, `profile_views`, follower count & demographics. (Some metrics need ≥100 followers.)

### Media list + per-media insights

```bash
# media list
curl -G "https://graph.instagram.com/v25.0/${IG_USER_ID}/media" \
  --data-urlencode "fields=id,caption,media_type,timestamp,permalink,like_count,comments_count" \
  --data-urlencode "access_token=${TOKEN}"

# insights for one media
curl -G "https://graph.instagram.com/v25.0/${MEDIA_ID}/insights" \
  --data-urlencode "metric=reach,likes,comments,saved,shares,views" \
  --data-urlencode "access_token=${TOKEN}"
```

### Comments — read & reply

```bash
curl -X POST "https://graph.instagram.com/v25.0/${COMMENT_ID}/replies" \
  -F "message=Thanks!" -F "access_token=${TOKEN}"
```

### Publishing (2-step: create container → publish)

```python
import requests
BASE = "https://graph.instagram.com/v25.0"

def publish_image(ig_user_id, image_url, caption, token):
    c = requests.post(f"{BASE}/{ig_user_id}/media", data={
        "image_url": image_url, "caption": caption, "access_token": token,
    }).json()
    return requests.post(f"{BASE}/{ig_user_id}/media_publish", data={
        "creation_id": c["id"], "access_token": token,
    }).json()
```

Supports image, video, reels, carousel. **Hashtag search & Business Discovery** are Facebook-Login only and need the *Instagram Public Content Access* feature.

---

## 4. Rate limits

- **Business Use Case:** `calls_per_24h = 4800 × number_of_impressions` (per app+user, rolling 24h).
- Business Discovery & Hashtag Search fall under **Platform Rate Limits** instead.
- Messaging Send API: 100/sec (text), 10/sec (media).

---

## 5. Access & gotchas

- **Standard Access** = your own/managed accounts. To serve others → **Advanced Access + App Review + Business Verification**.
- User insight data retained ~90 days.
- An empty data set (not `0`) is returned when a metric is unavailable.
- Live video media is readable only while broadcasting.

---

## 6. Quickstart: pull YOUR OWN Instagram data (no App Review needed)

Use this to validate the integration with your own account. In **Development mode**, your own account (you're the app admin) is accessible without App Review.

### Prerequisites
- Your IG account must be **Business or Creator** (Settings → Account type). Personal accounts return nothing.
- The IG account must be **linked to a Facebook Page** you administer (Page → Settings → Linked accounts → Instagram). This uses the Facebook-Login path.
- A Meta app exists (see [meta.md](./meta.md) §0), in **Development mode**, with the *Instagram* + *Facebook Login* products added.

### Step 1 — get a User token via Graph API Explorer
Go to https://developers.facebook.com/tools/explorer → select your app → **Generate Access Token** → grant these scopes:
`instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `business_management`.
Copy the token (short-lived ~1h; fine for testing).

### Step 2 — find your Page and IG user id

```bash
# your pages (+ page access token)
curl -G "https://graph.facebook.com/v25.0/me/accounts" \
  --data-urlencode "fields=id,name,access_token" \
  --data-urlencode "access_token=${USER_TOKEN}"

# IG business account id linked to that page
curl -G "https://graph.facebook.com/v25.0/${PAGE_ID}" \
  --data-urlencode "fields=instagram_business_account" \
  --data-urlencode "access_token=${USER_TOKEN}"
# -> { "instagram_business_account": { "id": "1789..." } }
```

### Step 3 — pull profile, media, and insights

```bash
IG_ID=1789...   # from step 2

# profile basics
curl -G "https://graph.facebook.com/v25.0/${IG_ID}" \
  --data-urlencode "fields=username,followers_count,media_count" \
  --data-urlencode "access_token=${USER_TOKEN}"

# recent media + engagement
curl -G "https://graph.facebook.com/v25.0/${IG_ID}/media" \
  --data-urlencode "fields=id,caption,media_type,timestamp,permalink,like_count,comments_count" \
  --data-urlencode "access_token=${USER_TOKEN}"

# account insights
curl -G "https://graph.facebook.com/v25.0/${IG_ID}/insights" \
  --data-urlencode "metric=reach,profile_views,follower_count" \
  --data-urlencode "period=day" \
  --data-urlencode "access_token=${USER_TOKEN}"
```

### End-to-end Python test

```python
import requests
V = "https://graph.facebook.com/v25.0"
USER_TOKEN = "EAAB..."   # from Graph API Explorer

def ig_self_test(token):
    pages = requests.get(f"{V}/me/accounts",
                         params={"fields": "id,name,access_token", "access_token": token}).json()["data"]
    page = pages[0]
    ig = requests.get(f"{V}/{page['id']}",
                      params={"fields": "instagram_business_account", "access_token": token}).json()
    ig_id = ig["instagram_business_account"]["id"]

    profile = requests.get(f"{V}/{ig_id}",
                           params={"fields": "username,followers_count,media_count", "access_token": token}).json()
    insights = requests.get(f"{V}/{ig_id}/insights",
                            params={"metric": "reach,profile_views", "period": "day", "access_token": token}).json()
    return {"page": page["name"], "profile": profile, "insights": insights}

print(ig_self_test(USER_TOKEN))
```

If this returns your username/follower count, the pipeline works. Then swap the Explorer token for a proper OAuth flow (§2) and exchange for a 60-day long-lived token for production.

### Common errors
- `(#100) ... nonexisting field (instagram_business_account)` → IG not linked to the Page, or IG is a personal account.
- Empty `data` on insights → account has <100 followers for some metrics, or no activity in the period.
- `(#10) requires instagram_manage_insights` → re-generate the token with that scope.
