"""DB-backed sliding window rate limiter.

Uses PostgreSQL rate_limits table for persistence across restarts.
Falls back to in-memory if DB is unavailable.
"""

import logging
import time
from collections import defaultdict
from threading import Lock

import psycopg2
from fastapi import HTTPException, Request

from config.settings import DATABASE_URL

logger = logging.getLogger("athenaeum.rate_limit")

# Per-tier limits: requests per window
LIMITS = {
    "search": {"anonymous": 10, "authenticated": 60, "admin": None},
    "chat": {"anonymous": 5, "authenticated": 30, "admin": None},
}

WINDOW_SECONDS = 60

# In-memory fallback (used if DB is unavailable)
_fallback_windows: dict[str, list[float]] = defaultdict(list)
_fallback_lock = Lock()


def _get_tier(request: Request) -> str:
    if not request.state.remote_user:
        return "anonymous"
    if "admins" in request.state.remote_groups:
        return "admin"
    return "authenticated"


def _get_key(request: Request) -> str:
    user = request.state.remote_user
    if user:
        return f"user:{user}"
    forwarded = request.headers.get("X-Forwarded-For", "")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return f"ip:{ip}"


def _check_db(key: str, limit: int) -> bool:
    """Check and record rate limit in DB. Returns True if limit exceeded."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        try:
            with conn.cursor() as cur:
                # Clean old entries (older than window)
                cur.execute(
                    "DELETE FROM rate_limits WHERE key = %s AND timestamp < NOW() - INTERVAL '%s seconds'",
                    (key, WINDOW_SECONDS)
                )
                # Count current window
                cur.execute(
                    "SELECT COUNT(*) FROM rate_limits WHERE key = %s AND timestamp >= NOW() - INTERVAL '%s seconds'",
                    (key, WINDOW_SECONDS)
                )
                count = cur.fetchone()[0]

                if count >= limit:
                    conn.commit()
                    return True

                # Record this request
                cur.execute(
                    "INSERT INTO rate_limits (key, timestamp) VALUES (%s, NOW())",
                    (key,)
                )
                conn.commit()
                return False
        finally:
            conn.close()
    except Exception as e:
        logger.warning("rate_limit_db_fallback", extra={"extra": {"error": str(e)[:100]}})
        return _check_fallback(key, limit)


def _check_fallback(key: str, limit: int) -> bool:
    """In-memory fallback rate limiter."""
    now = time.monotonic()
    cutoff = now - WINDOW_SECONDS
    with _fallback_lock:
        _fallback_windows[key] = [t for t in _fallback_windows[key] if t > cutoff]
        if len(_fallback_windows[key]) >= limit:
            return True
        _fallback_windows[key].append(now)
        return False


def check_rate_limit(request: Request, action: str):
    """Check rate limit for action. Raises 429 if exceeded."""
    tier = _get_tier(request)
    limit = LIMITS.get(action, {}).get(tier)
    if limit is None:
        return  # Unlimited

    key = f"{action}:{_get_key(request)}"
    exceeded = _check_db(key, limit)

    if exceeded:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {WINDOW_SECONDS}s.",
            headers={"Retry-After": str(WINDOW_SECONDS)},
        )
