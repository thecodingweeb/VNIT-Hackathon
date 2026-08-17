"""
Auth Router — 3 endpoints for Supabase Auth.

POST /auth/login    → sign_in_with_password()
POST /auth/refresh  → refresh session
POST /auth/logout   → sign_out()
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, status

from app.database import get_supabase
from app.middleware.rate_limit import UNAUTH_LIMIT, limiter
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, TokenResponse, AuthUser

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login with email and password",
)
@limiter.limit(UNAUTH_LIMIT)
async def login(request: Request, body: LoginRequest):
    """Authenticate via Supabase Auth. Returns access + refresh tokens."""
    try:
        sb = get_supabase()
        result = sb.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })

        session = result.session
        user = result.user

        if not session or not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "AUTH_FAILED",
                    "message": "Invalid email or password.",
                },
            )

        # Fetch role from users table
        user_record = (
            sb.table("users")
            .select("role, is_active")
            .eq("id", user.id)
            .maybe_single()
            .execute()
        )

        role = "VIEWER"
        if user_record.data:
            if not user_record.data.get("is_active", True):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "code": "ACCOUNT_DISABLED",
                        "message": "Your account has been disabled.",
                    },
                )
            role = user_record.data.get("role", "VIEWER")

        return TokenResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            token_type="bearer",
            expires_in=session.expires_in or 3600,
            user=AuthUser(
                id=user.id,
                email=user.email or "",
                role=role,
                is_active=True,
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTH_FAILED",
                "message": "Invalid email or password.",
            },
        )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
@limiter.limit(UNAUTH_LIMIT)
async def refresh(request: Request, body: RefreshRequest):
    """Refresh an expired access token using a valid refresh token.

    Frontend calls this automatically on any 401 response.
    """
    try:
        sb = get_supabase()
        result = sb.auth.refresh_session(body.refresh_token)

        session = result.session
        user = result.user

        if not session or not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "REFRESH_FAILED",
                    "message": "Refresh token is invalid or expired. Please login again.",
                },
            )

        # Fetch role
        user_record = (
            sb.table("users")
            .select("role")
            .eq("id", user.id)
            .maybe_single()
            .execute()
        )
        role = user_record.data.get("role", "VIEWER") if user_record.data else "VIEWER"

        return TokenResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            token_type="bearer",
            expires_in=session.expires_in or 3600,
            user=AuthUser(
                id=user.id,
                email=user.email or "",
                role=role,
            ),
        )

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "REFRESH_FAILED",
                "message": "Refresh token is invalid or expired.",
            },
        )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout and invalidate session",
)
async def logout(request: Request):
    """Sign out the current user. Invalidates the session server-side."""
    try:
        sb = get_supabase()
        sb.auth.sign_out()
        return {"message": "Logged out successfully."}
    except Exception:
        # Even if sign_out fails, return success — client should clear tokens
        return {"message": "Logged out."}
