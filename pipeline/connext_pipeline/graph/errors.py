"""A structured Graph API error that preserves the full diagnostic surface.

The earlier TypeScript connector kept only ``code`` and ``message`` and truncated the
body, which made the "API access blocked" incident impossible to triage. :class:`GraphAPIError`
keeps everything Meta returns: HTTP status, error sub-code, the user-facing strings, the
trace id, the ``WWW-Authenticate`` challenge and the ``debug-link`` -- so the next
incident is diagnosable in one line of logs.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Optional


@dataclass
class GraphAPIError(Exception):
    """A Meta Graph API error carrying every field useful for diagnosis.

    Attributes
    ----------
    status : int
        HTTP status code.
    code : int or None
        ``error.code``.
    subcode : int or None
        ``error.error_subcode``.
    message : str
        ``error.message``.
    user_title : str or None
        ``error.error_user_title`` (safe to surface to an end user).
    user_msg : str or None
        ``error.error_user_msg`` (safe to surface to an end user).
    fbtrace_id : str or None
        ``error.fbtrace_id`` -- quote this to Meta support.
    www_authenticate : str or None
        The ``WWW-Authenticate`` response header, e.g.
        ``OAuth "Facebook Platform" "access_denied" "API access blocked."``.
    debug_link : str or None
        The ``debug-link`` response header pointing at Meta's debug page for the request.
    is_transient : bool
        ``error.is_transient`` -- when ``True`` an immediate retry may succeed.
    """

    status: int
    code: Optional[int] = None
    subcode: Optional[int] = None
    message: str = ""
    user_title: Optional[str] = None
    user_msg: Optional[str] = None
    fbtrace_id: Optional[str] = None
    www_authenticate: Optional[str] = None
    debug_link: Optional[str] = None
    is_transient: bool = False

    def __str__(self) -> str:
        parts = [f"HTTP {self.status}", f"code={self.code}"]
        if self.subcode:
            parts.append(f"subcode={self.subcode}")
        parts.append(f"msg={self.message!r}")
        if self.user_msg:
            parts.append(f"user_msg={self.user_msg!r}")
        if self.www_authenticate:
            parts.append(f"www-authenticate={self.www_authenticate!r}")
        if self.fbtrace_id:
            parts.append(f"fbtrace={self.fbtrace_id}")
        if self.debug_link:
            parts.append(f"debug={self.debug_link}")
        return "GraphAPIError(" + ", ".join(parts) + ")"

    @classmethod
    def from_response(
        cls, status: int, body: Mapping[str, Any], headers: Mapping[str, str]
    ) -> "GraphAPIError":
        """Build a :class:`GraphAPIError` from a raw Graph API response.

        Parameters
        ----------
        status : int
            HTTP status code.
        body : Mapping[str, Any]
            Parsed JSON body, expected to look like ``{"error": {...}}``.
        headers : Mapping[str, str]
            Response headers, read for ``www-authenticate`` and ``debug-link``.

        Returns
        -------
        GraphAPIError
            A fully-populated error (fields default to ``None``/``""`` when absent).
        """
        err = body.get("error", {}) if isinstance(body, Mapping) else {}
        return cls(
            status=status,
            code=err.get("code"),
            subcode=err.get("error_subcode"),
            message=str(err.get("message", "")),
            user_title=err.get("error_user_title"),
            user_msg=err.get("error_user_msg"),
            fbtrace_id=err.get("fbtrace_id"),
            www_authenticate=headers.get("www-authenticate"),
            debug_link=headers.get("debug-link"),
            is_transient=bool(err.get("is_transient", False)),
        )
