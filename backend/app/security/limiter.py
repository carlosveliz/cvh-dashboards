from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _key(request: Request) -> str:
    """Rate-limit per real client IP. nginx forwards it in X-Forwarded-For."""
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else get_remote_address(request)


# In-memory storage: correct for a single backend worker. Scaling to multiple
# workers would need a shared store (e.g. Redis).
limiter = Limiter(key_func=_key, default_limits=[])
