"""
Auth schemas — login, refresh, logout, token responses.

Maps to Supabase Auth endpoints.
"""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """POST /auth/login body."""
    email: EmailStr
    password: str = Field(..., min_length=12)


class RefreshRequest(BaseModel):
    """POST /auth/refresh body."""
    refresh_token: str


class TokenResponse(BaseModel):
    """Returned by login and refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Seconds until access token expires")
    user: "AuthUser"


class AuthUser(BaseModel):
    """Embedded user info in token response."""
    id: str
    email: str
    role: str
    is_active: bool = True


class LogoutRequest(BaseModel):
    """POST /auth/logout — token in header, optional body."""
    pass


# Rebuild for forward ref
TokenResponse.model_rebuild()
