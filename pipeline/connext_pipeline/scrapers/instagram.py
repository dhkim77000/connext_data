"""Instagram scraper (Instagram Graph API, via Facebook Login).

Pulls the *organic* surface of an Instagram Business/Creator account: a profile snapshot,
daily account insights, follower demographics, media (posts/reels), and per-media
insights. Paid/ad performance is intentionally out of scope -- it belongs to the Meta Ads
(Marketing API) scraper, where Instagram results are isolated with the
``publisher_platform`` breakdown and joined back here via ``effective_instagram_media_id``.

Every metric name below was verified live against a real Business account before being
committed (account ``reach``/``accounts_engaged``/... require ``metric_type=total_value``;
``follower_demographics`` is a lifetime breakdown; reels expose extra video metrics).
"""

from __future__ import annotations

import datetime as _dt
from typing import Iterator

from ..graph.errors import GraphAPIError
from .base import BaseScraper

#: Account-level daily metrics; the modern API serves these only with ``metric_type=total_value``.
_ACCOUNT_METRICS = (
    "reach", "accounts_engaged", "total_interactions", "likes",
    "comments", "saves", "shares", "profile_links_taps", "views",
)
_PROFILE_FIELDS = "username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url"
_MEDIA_FIELDS = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url"
#: Per-media insight metrics. Reels expose extra video metrics on top of the common set.
_MEDIA_METRICS = ("reach", "likes", "comments", "saved", "shares", "total_interactions", "views")
_MEDIA_METRICS_REELS = _MEDIA_METRICS + ("ig_reels_avg_watch_time", "ig_reels_video_view_total_time")
#: Audience breakdowns available on ``follower_demographics``.
_DEMOGRAPHIC_BREAKDOWNS = ("age", "gender", "city", "country")


class InstagramScraper(BaseScraper):
    """Scrape the organic data of one Instagram Business/Creator account.

    The account is identified by its Instagram user id (``ig_user_id``), which connext
    stores on ``channel_connections.extra.ig_user_id``.
    """

    connector_id = "instagram"
    data_types = ("profile", "account_insights", "audience_demographics", "media", "media_insights")

    def scrape(self, data_type: str, *, ig_user_id: str | None = None, **_: object) -> Iterator[dict]:
        """Yield records for one ``data_type`` of one Instagram account.

        Parameters
        ----------
        data_type : str
            One of :attr:`data_types`.
        ig_user_id : str
            The Instagram Business account id.

        Yields
        ------
        dict
            One flattened record.

        Raises
        ------
        ValueError
            When ``ig_user_id`` is missing or ``data_type`` is unsupported.
        """
        if not ig_user_id:
            raise ValueError("InstagramScraper.scrape requires ig_user_id=")
        dispatch = {
            "profile": self._profile,
            "account_insights": self._account_insights,
            "audience_demographics": self._demographics,
            "media": self._media,
            "media_insights": self._media_insights,
        }
        if data_type not in dispatch:
            raise ValueError(f"unsupported data_type {data_type!r}; expected one of {self.data_types}")
        yield from dispatch[data_type](ig_user_id)

    def _profile(self, ig_user_id: str) -> Iterator[dict]:
        """Yield a single profile snapshot (followers, following, media count, bio)."""
        body = self.client.get(ig_user_id, {"fields": _PROFILE_FIELDS})
        body["ig_user_id"] = ig_user_id
        body["snapshot_date"] = _dt.date.today().isoformat()
        yield body

    def _account_insights(self, ig_user_id: str) -> Iterator[dict]:
        """Yield one row of the day's account totals (reach, engaged, interactions, ...)."""
        body = self.client.get(
            f"{ig_user_id}/insights",
            {"metric": ",".join(_ACCOUNT_METRICS), "period": "day", "metric_type": "total_value"},
        )
        row: dict = {"ig_user_id": ig_user_id, "date": _dt.date.today().isoformat()}
        for metric in body.get("data", []):
            row[metric["name"]] = (metric.get("total_value") or {}).get("value", 0)
        yield row

    def _demographics(self, ig_user_id: str) -> Iterator[dict]:
        """Yield one row per follower-demographic bucket, across all breakdowns.

        Each row is ``{breakdown, dimension_value, value}`` -- e.g.
        ``{"breakdown": "age", "dimension_value": "25-34", "value": 4316}``.
        """
        today = _dt.date.today().isoformat()
        for breakdown in _DEMOGRAPHIC_BREAKDOWNS:
            body = self.client.get(
                f"{ig_user_id}/insights",
                {"metric": "follower_demographics", "period": "lifetime",
                 "metric_type": "total_value", "breakdown": breakdown},
            )
            for metric in body.get("data", []):
                for bd in (metric.get("total_value") or {}).get("breakdowns", []):
                    for result in bd.get("results", []):
                        values = result.get("dimension_values") or []
                        yield {
                            "ig_user_id": ig_user_id,
                            "snapshot_date": today,
                            "breakdown": breakdown,
                            "dimension_value": values[0] if values else "",
                            "value": result.get("value", 0),
                        }

    def _media(self, ig_user_id: str) -> Iterator[dict]:
        """Yield every media object (post/reel/carousel) with its public counters."""
        for page in self.client.get_all(f"{ig_user_id}/media", {"fields": _MEDIA_FIELDS, "limit": 100}):
            for media in page.get("data", []):
                media["ig_user_id"] = ig_user_id
                yield media

    def _media_insights(self, ig_user_id: str) -> Iterator[dict]:
        """Yield per-media insights, choosing the metric set by media product type.

        A media that does not support insights (some older or AD-type media) yields a row
        carrying an ``error`` field instead of aborting the whole batch.
        """
        for page in self.client.get_all(
            f"{ig_user_id}/media", {"fields": "id,media_product_type,timestamp", "limit": 100}
        ):
            for media in page.get("data", []):
                media_id = media["id"]
                is_reels = media.get("media_product_type") == "REELS"
                metrics = _MEDIA_METRICS_REELS if is_reels else _MEDIA_METRICS
                try:
                    body = self.client.get(f"{media_id}/insights", {"metric": ",".join(metrics)})
                except GraphAPIError as exc:
                    yield {"ig_user_id": ig_user_id, "media_id": media_id, "error": str(exc)}
                    continue
                row: dict = {
                    "ig_user_id": ig_user_id,
                    "media_id": media_id,
                    "media_product_type": media.get("media_product_type", ""),
                    "timestamp": media.get("timestamp"),
                }
                for metric in body.get("data", []):
                    values = metric.get("values") or []
                    row[metric["name"]] = (
                        values[0].get("value", 0) if values else (metric.get("total_value") or {}).get("value", 0)
                    )
                yield row
