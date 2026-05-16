"""
Simple sliding-window rate limiter — no external dependencies.

Limits are applied per remote IP address. FastAPI middleware raises 429
before the request reaches any route handler.

Usage in main.py:
    from app.middleware.rate_limiter import RateLimitMiddleware
    app.add_middleware(RateLimitMiddleware)
"""
from __future__ import annotations

import time
import logging
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# ── Per-path rate-limit rules (requests, window_seconds) ─────────────────────
# More restrictive limits on expensive / abuse-prone endpoints.
_PATH_LIMITS: dict[str, tuple[int, int]] = {
    # AI / expensive endpoints
    "/api/analyze":                   (30,  60),   # 30 req / min
    "/api/analyze-image":             (20,  60),   # 20 req / min
    "/api/extract-hand":              (20,  60),   # 20 req / min
    "/api/confirm-hand":              (20,  60),   # 20 req / min
    "/api/analyze-tournament":        (10,  60),   # 10 req / min
    "/api/analyze-tournament-upload": (10,  60),   # 10 req / min
    # Stripe — guard against checkout spam
    "/api/stripe/create-checkout":    (10, 300),   # 10 req / 5 min
    "/api/stripe/customer-portal":    (10, 300),
    # Default for everything else
    "*":                              (120, 60),   # 120 req / min
}

# ip → path_prefix → deque of timestamps
_windows: dict[str, dict[str, deque]] = defaultdict(lambda: defaultdict(deque))
_lock = Lock()


def _get_ip(request: Request) -> str:
    """Best-effort client IP extraction (handles reverse proxies)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the leftmost (original client) IP; strip whitespace
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(ip: str, path: str) -> tuple[bool, int]:
    """
    Sliding-window check.

    Returns (allowed, retry_after_seconds).
    allowed=False means the request should be rejected with 429.
    """
    now = time.monotonic()

    # Find the most specific matching rule
    limit, window = _PATH_LIMITS.get("*")  # type: ignore[assignment]
    for prefix, (lim, win) in _PATH_LIMITS.items():
        if prefix != "*" and path.startswith(prefix):
            limit, window = lim, win
            break

    with _lock:
        q = _windows[ip][path]
        # Evict timestamps outside the current window
        cutoff = now - window
        while q and q[0] < cutoff:
            q.popleft()

        if len(q) >= limit:
            oldest = q[0]
            retry_after = int(window - (now - oldest)) + 1
            return False, retry_after

        q.append(now)
        return True, 0


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for health checks to avoid noise
        if request.url.path in ("/", "/api/health"):
            return await call_next(request)

        ip = _get_ip(request)
        allowed, retry_after = _check_rate_limit(ip, request.url.path)

        if not allowed:
            logger.warning(
                "Rate limit exceeded: ip=%s path=%s retry_after=%ds",
                ip, request.url.path, retry_after,
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": str(retry_after)},
            )

        return await call_next(request)
