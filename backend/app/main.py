"""
TigerWatch Backend — FastAPI Application Entry Point

Registers:
  • CORS middleware (Next.js frontend on :3000)
  • Rate limiting via SlowAPI + Upstash Redis
  • 9 API routers (45 endpoints total)
  • 1 WebSocket router (3 muxed channels)
  • Health/ready probes
  • Startup event for storage bucket initialization
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.middleware.rate_limit import limiter

# Import all routers
from app.routers import (
    auth,
    users,
    filtering,
    identification,
    occupancy,
    alerts,
    stations,
    runs,
    dashboard,
    websocket,
)


# ---------------------------------------------------------------------------
# Lifespan — startup and shutdown logic
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    settings = get_settings()

    # Configure rate limiter storage (Upstash Redis)
    if settings.upstash_redis_url:
        limiter._storage_uri = settings.upstash_redis_url

    # Ensure Supabase Storage buckets exist
    try:
        from app.services.storage_service import get_storage_service
        storage = get_storage_service()
        created = storage.ensure_buckets_exist()
        if created:
            print(f"[OK] Created storage buckets: {created}")
    except Exception as e:
        print(f"[WARN] Storage bucket setup skipped: {e}")

    print(f"[TIGER] {settings.app_name} v{settings.app_version} started")
    print(f"[CORS] Origins: {settings.cors_origin_list}")

    yield

    print("[SHUTDOWN] TigerWatch API shutting down")


# ---------------------------------------------------------------------------
# Create FastAPI app
# ---------------------------------------------------------------------------

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Backend API for the TigerWatch camera trap monitoring platform. "
        "Manages tiger identity catalogues, processing pipelines, spatial "
        "occupancy analysis, and real-time alert systems."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

# CORS — allow frontend on :3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---------------------------------------------------------------------------
# Global exception handler — consistent error shape for frontend
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all handler ensuring the frontend always gets the expected error shape."""
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again.",
            }
        },
    )


# ---------------------------------------------------------------------------
# Register routers (45 endpoints + 3 WS channels)
# ---------------------------------------------------------------------------

# Auth — 3 endpoints
app.include_router(auth.router)

# Users — 5 endpoints
app.include_router(users.router)

# Filtering — 6 endpoints
app.include_router(filtering.router)

# Identification — 8 endpoints
app.include_router(identification.router)

# Occupancy — 6 endpoints
app.include_router(occupancy.router)

# Alerts — 7 endpoints
app.include_router(alerts.router)

# Stations — 5+1 endpoints
app.include_router(stations.router)

# Runs & Health — 5 endpoints
app.include_router(runs.router)

# Dashboard — 5 endpoints
app.include_router(dashboard.router)

# WebSocket — 1 endpoint (3 muxed channels)
app.include_router(websocket.router)


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/", tags=["Root"])
async def root():
    """API root — basic info."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
    }
