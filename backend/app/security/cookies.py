import secrets

from fastapi import Response

from ..config import settings
from .deps import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE

_SECURE = settings.app_base_url.startswith("https")


def _common(max_age: int) -> dict:
    return {
        "max_age": max_age,
        "secure": _SECURE,
        "samesite": "lax",
        "path": "/",
    }


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> str:
    """Set access/refresh (httpOnly) and CSRF (readable) cookies. Returns csrf token."""
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        httponly=True,
        **_common(settings.access_token_ttl_min * 60),
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        httponly=True,
        **_common(settings.refresh_token_ttl_days * 24 * 3600),
    )
    csrf = secrets.token_urlsafe(32)
    response.set_cookie(
        CSRF_COOKIE,
        csrf,
        httponly=False,
        **_common(settings.refresh_token_ttl_days * 24 * 3600),
    )
    return csrf


def clear_auth_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE):
        response.delete_cookie(name, path="/")
