"""
Common schemas — error responses, pagination, base models.

These are used across ALL 45 endpoints for consistent error handling
and pagination. The frontend expects this exact error shape.
"""

from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Error Responses — frontend parses these exact shapes
# ---------------------------------------------------------------------------

class FieldErrors(BaseModel):
    """Per-field validation errors for 400 responses."""
    # Dynamic keys, so we use a dict
    pass


class ErrorDetail(BaseModel):
    """Standard error body returned in all error responses."""
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    field_errors: Optional[Dict[str, str]] = Field(
        None,
        description="Per-field errors for validation failures (400 only)",
    )


class ErrorResponse(BaseModel):
    """Top-level error envelope. Frontend checks `detail.code`."""
    detail: ErrorDetail


# ---------------------------------------------------------------------------
# Pagination — used by catalogue, captures, alerts, stations, runs
# ---------------------------------------------------------------------------

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response. Frontend uses total + page for SWR keys."""
    items: List[T]
    total: int
    page: int = 1
    page_size: int = 20


class PaginationParams(BaseModel):
    """Query parameters for paginated endpoints."""
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


# ---------------------------------------------------------------------------
# Timestamps mixin
# ---------------------------------------------------------------------------

class TimestampMixin(BaseModel):
    """Shared timestamp fields for DB records."""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Health / Ready
# ---------------------------------------------------------------------------

class HealthCheck(BaseModel):
    """Response for GET /health."""
    status: str = "ok"
    supabase: str = "ok"
    redis: str = "ok"
    timestamp: datetime


class ReadyCheck(BaseModel):
    """Response for GET /ready."""
    ready: bool = True
    version: str
