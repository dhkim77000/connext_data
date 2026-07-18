"""Unit tests for the rate-limit utilities (pure logic, no network)."""

from connext_pipeline.graph.rate_limit import (
    RateLimiter,
    RateLimitUsage,
    is_rate_limit_error,
    parse_usage,
)


def test_parse_app_usage():
    usage = parse_usage({"x-app-usage": '{"call_count": 80, "total_cputime": 10, "total_time": 12}'})
    assert usage.app_pct == 80.0
    assert usage.buc_pct == 0.0
    assert usage.peak_pct == 80.0


def test_parse_buc_usage_and_regain():
    raw = '{"123": [{"type": "ads_insights", "call_count": 95, "total_time": 40, "estimated_time_to_regain_access": 7}]}'
    usage = parse_usage({"x-business-use-case-usage": raw})
    assert usage.buc_pct == 95.0
    assert usage.regain_minutes == 7.0
    # The bug we actually hit: a hot BUC bucket must not be hidden by a 0% app-usage.
    assert usage.peak_pct == 95.0


def test_parse_usage_malformed_is_safe():
    assert parse_usage({"x-app-usage": "not json"}).peak_pct == 0.0
    assert parse_usage({}).peak_pct == 0.0


def test_is_rate_limit_error():
    assert is_rate_limit_error(4)
    assert is_rate_limit_error(80004)
    assert not is_rate_limit_error(200)  # access_denied needs a manual action, never a retry
    assert not is_rate_limit_error(None)


def test_throttle_sleeps_for_regain_above_hard_threshold():
    slept: list[float] = []
    limiter = RateLimiter(soft_threshold=75, hard_threshold=90, cooldown_seconds=60, sleep=slept.append)
    limiter.usage = RateLimitUsage(app_pct=0, buc_pct=95, regain_minutes=2)
    assert limiter.throttle() == 120.0  # regain_minutes * 60
    assert slept == [120.0]


def test_throttle_noop_below_soft_threshold():
    slept: list[float] = []
    limiter = RateLimiter(sleep=slept.append)
    limiter.usage = RateLimitUsage(app_pct=10)
    assert limiter.throttle() == 0.0
    assert slept == []


def test_backoff_is_exponential_and_capped():
    slept: list[float] = []
    limiter = RateLimiter(base_backoff=2, max_backoff=300, sleep=slept.append)
    assert 2.0 <= limiter.backoff(0) <= 4.0   # 2*2^0 + jitter[0,2]
    assert 16.0 <= limiter.backoff(3) <= 18.0  # 2*2^3 + jitter
    assert limiter.backoff(20) <= 302.0        # capped at max_backoff (+ jitter)
