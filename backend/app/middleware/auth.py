"""
Auth Middleware — Supabase token validation.

Extracts JWT from Authorization header or httpOnly cookie,
validates via Supabase Auth, and injects current_user into request state.

CRITICAL CONTRACT: Returns 401 for expired tokens, 403 for permission denied.
Frontend auto-calls POST /auth/refresh on 401.
"""

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import get_supabase
from app.schemas.user import RoleEnum

# ---------------------------------------------------------------------------
# Bearer token extractor (optional — allows unauthenticated access)
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser:
    """Authenticated user context injected into request state."""

    def __init__(
        self,
        id: str,
        email: str,
        role: RoleEnum,
        is_active: bool = True,
        metadata: Optional[dict] = None,
    ):
        self.id = id
        self.email = email
        self.role = role
        self.is_active = is_active
        self.metadata = metadata or {}


async def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[str]:
    """Extract JWT from Authorization header or cookie."""
    # 1. Try Authorization: Bearer <token>
    if credentials and credentials.credentials:
        return credentials.credentials

    # 2. Try httpOnly cookie
    token = request.cookies.get("access_token")
    if token:
        return token

    return None


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(_extract_token),
) -> CurrentUser:
    """Validate token via Supabase and return CurrentUser.

    Returns 401 for expired/invalid tokens (frontend retries with refresh).
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "TOKEN_MISSING",
                "message": "Authentication required. Provide a Bearer token or login.",
            },
        )

    try:
        sb = get_supabase()
        user_response = sb.auth.get_user(token)
        user = user_response.user

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "TOKEN_INVALID",
                    "message": "Token is invalid or expired.",
                },
            )

        # Fetch role from our users table (Supabase Auth doesn't store roles)
        user_record = (
            sb.table("users")
            .select("role, is_active")
            .eq("id", user.id)
            .maybe_single()
            .execute()
        )

        if not user_record.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "USER_NOT_FOUND",
                    "message": "User account not found in database.",
                },
            )

        if not user_record.data.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ACCOUNT_DISABLED",
                    "message": "Your account has been disabled. Contact an administrator.",
                },
            )

        role_str = user_record.data.get("role", "VIEWER")
        try:
            role = RoleEnum(role_str)
        except ValueError:
            role = RoleEnum.VIEWER

        current = CurrentUser(
            id=user.id,
            email=user.email or "",
            role=role,
            is_active=user_record.data.get("is_active", True),
            metadata=user.user_metadata or {},
        )

        # Attach to request state for downstream use
        request.state.current_user = current
        return current

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "TOKEN_INVALID",
                "message": "Token validation failed.",
            },
        )


async def get_optional_user(
    request: Request,
    token: Optional[str] = Depends(_extract_token),
) -> Optional[CurrentUser]:
    """Same as get_current_user but returns None instead of 401.

    Used for endpoints that work differently when authenticated vs not.
    """
    if not token:
        return None
    try:
        return await get_current_user(request, token)
    except HTTPException:
        return None
