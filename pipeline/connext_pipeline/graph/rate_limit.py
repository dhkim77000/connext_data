"""Meta Graph API rate-limit handling.

Meta enforces several independent rate-limit buckets and advertises live usage in
response headers. This module parses those headers, decides when to slow down, and
provides an exponential-backoff helper for transient throttle errors.

Buckets
-------
Platform (app-level)
    Header ``X-App-Usage`` -> ``{"call_count", "total_cputime", "total_time"}``, each an
    integer percentage (0-100) of the app's limit.
Business Use Case (BUC)
    Header ``X-Business-Use-Case-Usage`` -> an object keyed by business id, each value a
    list of per-use-case objects with ``call_count`` / ``total_cputime`` / ``total_time``
    (percentages) and ``estimated_time_to_regain_access`` (minutes until a hit limit
    clears). Ads and Instagram *insight* reads are metered here, **not** in
    ``X-App-Usage`` -- so a 0 % ``X-App-Usage`` never means "no rate limit" on its own.
    (This is exactly why an earlier diagnosis misread a real throttle as "not rate
    limited": it looked only at ``X-App-Usage``.)

Notes
-----
The Graph error ``code 200`` / ``access_denied`` ("API access blocked") is an
app-*state* restriction (e.g. a pending Data Use Checkup) that requires a manual action
in the App Dashboard. It is deliberately **excluded** from the retryable set below: silently
retrying it does nothing and, on dev-tier apps, extends the block window.
"""

from __future__ import annotations

import json
import random
import time
from dataclasses import dataclass, field
from typing import Callable, Mapping

#: Graph API error codes that denote a *transient* rate-limit / throttle condition and are
#: therefore safe to retry after a backoff.
RATE_LIMIT_ERROR_CODES: frozenset = frozenset(
    {
        4,  # Application request limit reached (platform / X-App-Usage)
        17,  # User request limit reached
        32,  # Page request limit reached
        613,  # Custom-level rate limit
        # Business Use Case (ads / IG insights) limits
        80001, 80002, 80003, 80004, 80005, 80006, 80007, 80008, 80009, 80014,
    }
)


@dataclass(frozen=True)
class RateLimitUsage:
    """A snapshot of Graph API rate-limit consumption parsed from response headers.

    All percentages are in ``0.0``-``100.0`` and represent the *highest* consumed
    dimension within their bucket (Meta blocks the moment any single dimension reaches
    100).

    Attributes
    ----------
    app_pct : float
        Peak usage of the platform (app-level) bucket, from ``X-App-Usage``.
    buc_pct : float
        Peak usage across every business use case in ``X-Business-Use-Case-Usage``.
    regain_minutes : float
        Largest ``estimated_time_to_regain_access`` (minutes) reported by any BUC bucket,
        or ``0.0`` when nothing is currently throttled.
    """

    app_pct: float = 0.0
    buc_pct: float = 0.0
    regain_minutes: float = 0.0

    @property
    def peak_pct(self) -> float:
        """float: The greater of the app-level and business-use-case usage percentages."""
        return max(self.app_pct, self.buc_pct)


def _max_pct(obj: Mapping[str, object]) -> float:
    """Return the largest known rate-limit percentage held in one usage object.

    Parameters
    ----------
    obj : Mapping[str, object]
        A usage object, e.g. ``{"call_count": 10, "total_cputime": 3, "total_time": 7}``.

    Returns
    -------
    float
        The maximum of the three percentage fields; missing fields count as 0.
    """
    keys = ("call_count", "total_cputime", "total_time")
    return float(max((float(obj.get(k, 0) or 0) for k in keys), default=0.0))


def parse_usage(headers: Mapping[str, str]) -> RateLimitUsage:
    """Parse Meta rate-limit headers into a :class:`RateLimitUsage` snapshot.

    Inspects both buckets that matter for connext's reads. Because ads/IG insight calls
    are metered in ``X-Business-Use-Case-Usage`` rather than ``X-App-Usage``, both are
    read; a 0 % ``X-App-Usage`` alone never implies headroom.

    Parameters
    ----------
    headers : Mapping[str, str]
        HTTP response headers (e.g. ``httpx.Response.headers``, which is case-insensitive).

    Returns
    -------
    RateLimitUsage
        Parsed peak usage. Malformed or absent headers yield zeros rather than raising, so
        a header-parse failure never blocks a request.

    Examples
    --------
    >>> parse_usage({"x-app-usage": '{"call_count": 80, "total_time": 12}'}).app_pct
    80.0
    >>> parse_usage({}).peak_pct
    0.0
    """
    app_pct = 0.0
    buc_pct = 0.0
    regain = 0.0

    raw_app = headers.get("x-app-usage")
    if raw_app:
        try:
            app_pct = _max_pct(json.loads(raw_app))
        except (ValueError, TypeError):
            pass

    raw_buc = headers.get("x-business-use-case-usage")
    if raw_buc:
        try:
            for entries in json.loads(raw_buc).values():
                for entry in entries:
                    buc_pct = max(buc_pct, _max_pct(entry))
                    regain = max(regain, float(entry.get("estimated_time_to_regain_access", 0) or 0))
        except (ValueError, TypeError, AttributeError):
            pass

    return RateLimitUsage(app_pct=app_pct, buc_pct=buc_pct, regain_minutes=regain)


def is_rate_limit_error(code: int | None, subcode: int | None = None) -> bool:
    """Return whether a Graph API error code denotes a retryable rate-limit condition.

    Parameters
    ----------
    code : int or None
        The ``error.code`` from a Graph API error payload.
    subcode : int or None, optional
        The ``error.error_subcode`` -- accepted for forward compatibility, unused today.

    Returns
    -------
    bool
        ``True`` for the known throttle codes (see :data:`RATE_LIMIT_ERROR_CODES`).
    """
    return code in RATE_LIMIT_ERROR_CODES


@dataclass
class RateLimiter:
    """Adaptive throttle + exponential backoff for a stream of Graph API calls.

    One instance is shared across every request made with a single credential. After each
    response, feed its headers to :meth:`observe`; before each request call
    :meth:`throttle` to proactively slow down as usage approaches the ceiling. Staying
    *below* the hard limit matters on dev-tier apps because Meta extends the block window
    every time you call while already throttled.

    Parameters
    ----------
    soft_threshold : float, optional
        Peak-usage percentage above which proactive sleeping begins. Default 75.
    hard_threshold : float, optional
        Peak-usage percentage above which the limiter sleeps for the full reported
        ``regain_minutes`` (or :attr:`cooldown_seconds`). Default 90.
    cooldown_seconds : float, optional
        Fallback sleep when usage is past ``hard_threshold`` but no regain time was
        reported. Default 60.
    base_backoff : float, optional
        Base delay (seconds) for exponential backoff on rate-limit errors. Default 2.
    max_backoff : float, optional
        Ceiling for a single backoff sleep. Default 300 (Meta's dev-tier block window).
    max_retries : int, optional
        Retries allowed for a throttled call before the error propagates. Default 5.
    sleep : Callable[[float], None], optional
        Sleep function, injectable for tests. Defaults to :func:`time.sleep`.

    Attributes
    ----------
    usage : RateLimitUsage
        The most recently observed usage snapshot.
    """

    soft_threshold: float = 75.0
    hard_threshold: float = 90.0
    cooldown_seconds: float = 60.0
    base_backoff: float = 2.0
    max_backoff: float = 300.0
    max_retries: int = 5
    sleep: Callable[[float], None] = time.sleep
    usage: RateLimitUsage = field(default_factory=RateLimitUsage)

    def observe(self, headers: Mapping[str, str]) -> RateLimitUsage:
        """Record the rate-limit usage advertised by one response's headers.

        Parameters
        ----------
        headers : Mapping[str, str]
            Response headers to parse.

        Returns
        -------
        RateLimitUsage
            The freshly parsed usage, also stored on :attr:`usage`.
        """
        self.usage = parse_usage(headers)
        return self.usage

    def throttle(self) -> float:
        """Sleep proportionally to current usage to stay clear of the hard limit.

        Below ``soft_threshold`` this is a no-op. Between the soft and hard thresholds the
        sleep ramps linearly from 0 to ``cooldown_seconds``. At or above ``hard_threshold``
        it sleeps for the reported regain time (or ``cooldown_seconds`` as a fallback).

        Returns
        -------
        float
            Seconds slept (``0.0`` when below ``soft_threshold``).
        """
        peak = self.usage.peak_pct
        if peak >= self.hard_threshold:
            delay = self.usage.regain_minutes * 60.0 or self.cooldown_seconds
        elif peak >= self.soft_threshold:
            span = max(self.hard_threshold - self.soft_threshold, 1e-9)
            delay = (peak - self.soft_threshold) / span * self.cooldown_seconds
        else:
            delay = 0.0
        if delay > 0:
            self.sleep(delay)
        return delay

    def backoff(self, attempt: int) -> float:
        """Sleep for an exponentially increasing, jittered interval.

        Parameters
        ----------
        attempt : int
            Zero-based retry attempt number.

        Returns
        -------
        float
            Seconds slept (capped at ``max_backoff``, plus up to ``base_backoff`` jitter).
        """
        delay = min(self.base_backoff * (2 ** attempt), self.max_backoff)
        delay += random.uniform(0, self.base_backoff)  # de-sync concurrent workers
        self.sleep(delay)
        return delay
