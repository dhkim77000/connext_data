"""A rate-limit-aware HTTP client for the Meta Graph API.

One :class:`GraphClient` is bound to a single access token. Every call is throttled ahead
of time from the latest usage headers, retried with exponential backoff on transient
rate-limit errors, and -- on any other failure -- raises a fully-populated
:class:`~connext_pipeline.graph.errors.GraphAPIError`.
"""

from __future__ import annotations

import logging
from typing import Any, Iterator, Mapping, Optional

import httpx

from .errors import GraphAPIError
from .rate_limit import RateLimiter, is_rate_limit_error

logger = logging.getLogger("connext_pipeline.graph")

#: Pinned Graph API version. Bump deliberately; metric availability changes between versions.
GRAPH_VERSION = "v19.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_VERSION}"


def _safe_json(resp: httpx.Response) -> dict:
    """Parse a response body to ``dict``, never raising on malformed JSON.

    Parameters
    ----------
    resp : httpx.Response
        The HTTP response.

    Returns
    -------
    dict
        The parsed object; a list body is wrapped as ``{"data": [...]}`` and a
        non-JSON body becomes a synthetic ``{"error": {...}}``.
    """
    try:
        data = resp.json()
    except ValueError:
        return {"error": {"message": resp.text[:500], "code": None}}
    return data if isinstance(data, dict) else {"data": data}


class GraphClient:
    """A thin, rate-limit-aware wrapper over the Meta Graph API.

    Parameters
    ----------
    access_token : str
        A Graph API access token (a long-lived user token, for connext).
    limiter : RateLimiter, optional
        Shared limiter; a fresh one is created when omitted.
    base_url : str, optional
        Graph base URL. Defaults to the pinned :data:`GRAPH_BASE`.
    timeout : float, optional
        Per-request timeout in seconds. Default 30.

    Examples
    --------
    >>> with GraphClient(token) as gc:          # doctest: +SKIP
    ...     me = gc.get("me", {"fields": "id,name"})
    """

    def __init__(
        self,
        access_token: str,
        limiter: Optional[RateLimiter] = None,
        base_url: str = GRAPH_BASE,
        timeout: float = 30.0,
    ) -> None:
        self._token = access_token
        self.limiter = limiter or RateLimiter()
        self._base = base_url.rstrip("/")
        self._http = httpx.Client(timeout=timeout)

    def __enter__(self) -> "GraphClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        """Close the underlying HTTP connection pool."""
        self._http.close()

    def get(self, path: str, params: Optional[Mapping[str, Any]] = None) -> dict:
        """GET a Graph edge, returning the parsed JSON ``dict``.

        Proactively throttles, transparently retries throttled calls with backoff, and
        raises on any other error.

        Parameters
        ----------
        path : str
            Edge path with or without a leading slash (e.g. ``"17841.../media"``).
        params : Mapping[str, Any], optional
            Query parameters; ``access_token`` is injected automatically.

        Returns
        -------
        dict
            Parsed JSON response body.

        Raises
        ------
        GraphAPIError
            On any non-retryable error, or once ``limiter.max_retries`` is exhausted.
        """
        url = f"{self._base}/{path.lstrip('/')}"
        query = dict(params or {})
        query["access_token"] = self._token

        attempt = 0
        while True:
            self.limiter.throttle()
            resp = self._http.get(url, params=query)
            self.limiter.observe(resp.headers)
            body = _safe_json(resp)

            if resp.is_success and "error" not in body:
                return body

            err = GraphAPIError.from_response(resp.status_code, body, resp.headers)
            if is_rate_limit_error(err.code, err.subcode) and attempt < self.limiter.max_retries:
                slept = self.limiter.backoff(attempt)
                logger.warning(
                    "rate-limited (code=%s) -> backoff %.1fs [retry %d/%d]; usage app=%.0f%% buc=%.0f%%",
                    err.code, slept, attempt + 1, self.limiter.max_retries,
                    self.limiter.usage.app_pct, self.limiter.usage.buc_pct,
                )
                attempt += 1
                continue

            logger.error("graph error on GET %s: %s", path, err)
            raise err

    def get_all(
        self, path: str, params: Optional[Mapping[str, Any]] = None, max_pages: int = 1000
    ) -> Iterator[dict]:
        """Yield every page of a cursor-paginated edge.

        Parameters
        ----------
        path : str
            Edge path.
        params : Mapping[str, Any], optional
            Initial query parameters.
        max_pages : int, optional
            Safety cap on pages fetched. Default 1000.

        Yields
        ------
        dict
            One response body per page, in order.
        """
        query = dict(params or {})
        pages = 0
        while True:
            body = self.get(path, query)
            yield body
            pages += 1
            paging = body.get("paging") or {}
            after = (paging.get("cursors") or {}).get("after")
            if not paging.get("next") or not after or pages >= max_pages:
                return
            query["after"] = after
