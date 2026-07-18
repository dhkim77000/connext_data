# YouTube — Data API v3 + Analytics API v2

Connect for **channel/video metadata, statistics, and analytics (views, watch time, demographics, revenue)**.

- **Data API v3** base: `https://www.googleapis.com/youtube/v3/`
- **Analytics API v2** base: `https://youtubeanalytics.googleapis.com/v2/`
- **Reporting API v1** (bulk CSV) base: `https://youtubereporting.googleapis.com/v1/`
- **Docs:** https://developers.google.com/youtube/v3 , https://developers.google.com/youtube/analytics

---

## 1. Authentication

- **Public reads** (public videos, channels, search) → **API key only**.
- **Private data / writes / analytics** → **OAuth 2.0** (YouTube data is user-owned; service accounts generally don't work).

Scopes:
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/youtube` (manage)
- `https://www.googleapis.com/auth/youtube.upload`
- `https://www.googleapis.com/auth/youtube.force-ssl` (comments / full manage)
- `https://www.googleapis.com/auth/yt-analytics.readonly` (analytics)
- `https://www.googleapis.com/auth/yt-analytics-monetary.readonly` (revenue)

### OAuth flow

```
GET https://accounts.google.com/o/oauth2/v2/auth
    ?client_id={client-id}
    &redirect_uri={redirect-uri}
    &response_type=code
    &access_type=offline
    &prompt=consent
    &scope=https://www.googleapis.com/auth/youtube.readonly%20https://www.googleapis.com/auth/yt-analytics.readonly
```

```bash
# exchange code (access_type=offline returns a refresh_token)
curl -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "code=${CODE}" \
  -d "redirect_uri=${REDIRECT_URI}" \
  -d "grant_type=authorization_code"

# refresh
curl -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=${CLIENT_ID}" -d "client_secret=${CLIENT_SECRET}" \
  -d "refresh_token=${REFRESH_TOKEN}" -d "grant_type=refresh_token"
```

---

## 2. Data API v3 — metadata & stats

Public read with API key:

```bash
curl -G "https://www.googleapis.com/youtube/v3/videos" \
  --data-urlencode "part=snippet,statistics,contentDetails" \
  --data-urlencode "id=${VIDEO_ID}" \
  --data-urlencode "key=${API_KEY}"
```

Authenticated — your channel's uploads:

```bash
curl -G "https://www.googleapis.com/youtube/v3/channels" \
  --data-urlencode "part=snippet,statistics,contentDetails" \
  --data-urlencode "mine=true" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

`part` is **required** and drives the response shape. Data: title, description, tags, category, `statistics` (viewCount, likeCount, commentCount), subscriber count, playlists, comments, live broadcasts.

---

## 3. Analytics API v2 — performance

```bash
curl -G "https://youtubeanalytics.googleapis.com/v2/reports" \
  --data-urlencode "ids=channel==MINE" \
  --data-urlencode "startDate=2026-05-01" \
  --data-urlencode "endDate=2026-05-31" \
  --data-urlencode "metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,likes,comments,shares" \
  --data-urlencode "dimensions=day" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

Python:

```python
import requests
def yt_analytics(token, start, end):
    return requests.get(
        "https://youtubeanalytics.googleapis.com/v2/reports",
        headers={"Authorization": f"Bearer {token}"},
        params={
            "ids": "channel==MINE",
            "startDate": start, "endDate": end,
            "metrics": "views,estimatedMinutesWatched,averageViewPercentage,subscribersGained",
            "dimensions": "country,deviceType",
            "sort": "-views",
        },
    ).json()
```

**Metrics:** `views`, `estimatedMinutesWatched`, `averageViewDuration`, `averageViewPercentage`, `subscribersGained/Lost`, `likes`, `comments`, `shares`, `estimatedRevenue` (needs monetary scope). **Dimensions:** `day`/`month`, `video`, `playlist`, `country`, `deviceType`, `trafficSource`, `ageGroup`, `gender`.

**Reporting API v1** (`youtubereporting`) is for bulk, scheduled CSV exports — create a `job`, poll, download. Use it for large historical/data-warehouse pulls.

---

## 4. Quota & limits

- Data API v3: default **10,000 units/day** (resets midnight PT). Costs: `list` = 1, `search.list` = **100**, `videos.insert` = 100, most write ops = 50. Each result page costs again.
- Analytics API v2: 1 unit/request; project quota in Cloud Console.

```python
# search.list is expensive — cache results, avoid polling search in loops
```

---

## 5. Access requirements & gotchas

- Exceeding 10,000 units/day requires passing the **YouTube API Compliance Audit** (Audit & Quota Extension Form).
- Uploads from an **unverified client are locked to private** until the audit/verification passes.
- OAuth consent screen must be verified for sensitive scopes before public release.
- Revenue (`yt-analytics-monetary`) returns meaningful data only for eligible/owner channels.
