"""
User schemas — CRUD operations on the `users` table.

5-role RBAC system: ADMIN, BIOLOGIST, RANGE_OFFICER, FIELD_STAFF, VIEWER.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RoleEnum(str, Enum):
    """Five roles from the RBAC permission matrix."""
    ADMIN = "ADMIN"
    BIOLOGIST = "BIOLOGIST"
    RANGE_OFFICER = "RANGE_OFFICER"
    FIELD_STAFF = "FIELD_STAFF"
    VIEWER = "VIEWER"


class UserCreate(BaseModel):
    """POST /users body."""
    email: EmailStr
    password: str = Field(..., min_length=12)
    full_name: str = Field(..., min_length=1, max_length=200)
    role: RoleEnum = RoleEnum.VIEWER


class UserUpdate(BaseModel):
    """PUT /users/{id} body — all fields optional."""
    full_name: Optional[str] = Field(None, max_length=200)
    role: Optional[RoleEnum] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """Response shape for user endpoints."""
    id: str
    email: str
    full_name: str
    role: RoleEnum
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
