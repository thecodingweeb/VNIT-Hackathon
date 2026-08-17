"""
Rate Limiting Middleware — Upstash Redis sliding window.

Limits:
  • Authenticated: 100 req/min
  • Unauthenticated: 20 req/min
  • Heavy ops (ML runs, exports): 5 req/min
  • Account lockout: 5 failed logins in 15 min → 30-min block

Uses SlowAPI with a custom key function that differentiates
authenticated vs unauthenticated users.
"""

from typing import Optional

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _get_rate_limit_key(request: Request) -> str:
    """Key function for SlowAPI.

    Authenticated users: keyed by user ID (higher limit).
    Unauthenticated: keyed by IP address (lower limit).
    """
    # Check if we have a current_user from auth middleware
    user = getattr(request.state, "current_user", None)
    if user is not None:
        return f"user:{user.id}"
    return f"ip:{get_remote_address(request)}"


# ---------------------------------------------------------------------------
# Create the SlowAPI limiter instance
# ---------------------------------------------------------------------------
# Default limit for authenticated users; override per-route for heavy ops.
# Storage backend configured in main.py lifespan with Redis URL.

limiter = Limiter(
    key_func=_get_rate_limit_key,
    default_limits=["100/minute"],
    storage_uri=None,  # Set in main.py from settings.upstash_redis_url
)


# ---------------------------------------------------------------------------
# Decorators for route-level limits
# ---------------------------------------------------------------------------
# Usage:
#   @router.post("/filtering/run")
#   @limiter.limit("5/minute")   # heavy ops
#   async def trigger_run(request: Request, ...):
#       ...

# For unauthenticated endpoints (auth routes):
UNAUTH_LIMIT = "20/minute"
# For heavy operations (ML pipeline triggers, exports):
HEAVY_LIMIT = "5/minute"
# Standard authenticated limit:
AUTH_LIMIT = "100/minute"


# ---------------------------------------------------------------------------
# Account lockout helper (uses Redis directly)
# ---------------------------------------------------------------------------

async def check_account_lockout(
    redis_client,
    email: str,
) -> Optional[int]:
    """Check if an account is locked out.

    Returns remaining lockout seconds if locked, None otherwise.
    """
    if redis_client is None:
        return None

    lockout_key = f"lockout:{email}"
    try:
        ttl = await redis_client.ttl(lockout_key)
        if ttl and ttl > 0:
            return ttl
    except Exception:
        pass
    return None


async def record_failed_login(
    redis_client,
    email: str,
    max_attempts: int = 5,
    window_seconds: int = 900,      # 15 minutes
    lockout_seconds: int = 1800,     # 30 minutes
) -> bool:
    """Record a failed login attempt. Returns True if account is now locked."""
    if redis_client is None:
        return False

    attempts_key = f"login_attempts:{email}"
    lockout_key = f"lockout:{email}"

    try:
        # Increment attempt counter
        count = await redis_client.incr(attempts_key)

        # Set expiry on first attempt
        if count == 1:
            await redis_client.expire(attempts_key, window_seconds)

        # Check if threshold exceeded
        if count >= max_attempts:
            await redis_client.setex(lockout_key, lockout_seconds, "locked")
            await redis_client.delete(attempts_key)
            return True

    except Exception:
        pass

    return False


async def clear_login_attempts(redis_client, email: str) -> None:
    """Clear failed login attempts after successful login."""
    if redis_client is None:
        return
    try:
        await redis_client.delete(f"login_attempts:{email}")
    except Exception:
        pass
