"""
Runs Router — 5 endpoints for processing run management.

GET /runs            → list processing_runs (paginated, filterable)
GET /runs/{id}       → run detail with per-stage breakdown (Page 5)
GET /runs/compare    → diff two run summaries side-by-side
GET /health          → Supabase + Redis health check
GET /ready           → readiness probe
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.config import get_settings
from app.database import get_supabase, get_supabase_admin
from app.middleware.auth import CurrentUser
from app.middleware.rbac import require_permission
from app.schemas.common import HealthCheck, PaginatedResponse, ReadyCheck
from app.schemas.runs import (
    RunCompareRequest,
    RunCompareResponse,
    RunDetail,
    RunListItem,
    StageStatus,
)

router = APIRouter(tags=["Runs & Health"])


@router.get(
    "/runs",
    response_model=PaginatedResponse[RunListItem],
    summary="List all processing runs",
)
async def list_runs(
    page: int = 1,
    page_size: int = 20,
    status_filter: str | None = Query(None, alias="status"),
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """List processing runs with optional status filter."""
    sb = get_supabase_admin()
    offset = (page - 1) * page_size

    query = sb.table("processing_runs").select("*", count="exact")

    if status_filter:
        query = query.eq("status", status_filter)

    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    items = [
        RunListItem(
            run_id=r.get("id", ""),
            status=r.get("status", "unknown"),
            total_images=r.get("total_images", 0),
            blanks_removed=r.get("blanks_removed", 0),
            tigers_detected=r.get("tigers_detected", 0),
            alerts_generated=r.get("alerts_generated", 0),
            started_at=r.get("created_at"),
            completed_at=r.get("completed_at"),
            duration_seconds=r.get("duration_seconds"),
        )
        for r in (result.data or [])
    ]

    return PaginatedResponse(
        items=items, total=result.count or 0, page=page, page_size=page_size,
    )


@router.get(
    "/runs/compare",
    response_model=RunCompareResponse,
    summary="Compare two runs side-by-side",
)
async def compare_runs(
    run_a: str = Query(..., description="First run ID"),
    run_b: str = Query(..., description="Second run ID"),
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Diff two processing runs for side-by-side comparison."""
    sb = get_supabase_admin()

    a_data = sb.table("processing_runs").select("*").eq("id", run_a).maybe_single().execute()
    b_data = sb.table("processing_runs").select("*").eq("id", run_b).maybe_single().execute()

    if not a_data.data or not b_data.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": "One or both runs not found."},
        )

    def _to_detail(r: dict) -> RunDetail:
        stages_raw = r.get("stages", {})
        stages = {}
        for name in ["ingest", "filter", "detect", "match", "analyze"]:
            s = stages_raw.get(name, {})
            stages[name] = StageStatus(
                status=s.get("status", "pending"),
                count=s.get("count", 0),
                blanks_removed=s.get("blanks_removed"),
                images_processed=s.get("images_processed"),
                tigers_found=s.get("tigers_found"),
            )
        return RunDetail(
            run_id=r.get("id", ""),
            status=r.get("status", "unknown"),
            total_images=r.get("total_images", 0),
            stages=stages,
            last_checkpoint=r.get("last_checkpoint"),
            eta_seconds=r.get("eta_seconds"),
            started_at=r.get("created_at"),
            completed_at=r.get("completed_at"),
            error_message=r.get("error_message"),
        )

    detail_a = _to_detail(a_data.data)
    detail_b = _to_detail(b_data.data)

    diff = {
        "images_delta": detail_a.total_images - detail_b.total_images,
        "tigers_delta": (a_data.data.get("tigers_detected", 0) - b_data.data.get("tigers_detected", 0)),
    }

    return RunCompareResponse(run_a=detail_a, run_b=detail_b, diff=diff)


@router.get(
    "/runs/{run_id}",
    response_model=RunDetail,
    summary="Get run detail with per-stage breakdown (Page 5)",
)
async def get_run(
    run_id: str,
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Get detailed run info with per-stage breakdown for the Run Monitor page.

    WS channel=runs powers the live progress stepper on this page.
    """
    sb = get_supabase_admin()

    result = (
        sb.table("processing_runs")
        .select("*")
        .eq("id", run_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": f"Run {run_id} not found."},
        )

    r = result.data
    stages_raw = r.get("stages", {})
    stages = {}
    for name in ["ingest", "filter", "detect", "match", "analyze"]:
        s = stages_raw.get(name, {})
        stages[name] = StageStatus(
            status=s.get("status", "pending"),
            count=s.get("count", 0),
            blanks_removed=s.get("blanks_removed"),
            images_processed=s.get("images_processed"),
            tigers_found=s.get("tigers_found"),
        )

    return RunDetail(
        run_id=r.get("id", ""),
        status=r.get("status", "unknown"),
        total_images=r.get("total_images", 0),
        stages=stages,
        last_checkpoint=r.get("last_checkpoint"),
        eta_seconds=r.get("eta_seconds"),
        started_at=r.get("created_at"),
        completed_at=r.get("completed_at"),
        error_message=r.get("error_message"),
    )


# ---------------------------------------------------------------------------
# Health & Readiness
# ---------------------------------------------------------------------------

@router.get(
    "/health",
    response_model=HealthCheck,
    summary="API + DB + Redis health check",
)
async def health_check():
    """Health check — pings Supabase and Redis."""
    supabase_status = "ok"
    redis_status = "ok"

    # Test Supabase
    try:
        sb = get_supabase()
        sb.table("system_config").select("key").limit(1).execute()
    except Exception:
        supabase_status = "error"

    # Test Redis (Upstash)
    try:
        settings = get_settings()
        if settings.upstash_redis_url:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{settings.upstash_redis_url}/ping",
                    headers={"Authorization": f"Bearer {settings.upstash_redis_token}"},
                    timeout=5.0,
                )
                if resp.status_code != 200:
                    redis_status = "error"
        else:
            redis_status = "not_configured"
    except Exception:
        redis_status = "error"

    overall = "ok" if supabase_status == "ok" and redis_status in ("ok", "not_configured") else "degraded"

    return HealthCheck(
        status=overall,
        supabase=supabase_status,
        redis=redis_status,
        timestamp=datetime.now(timezone.utc),
    )


@router.get(
    "/ready",
    response_model=ReadyCheck,
    summary="Readiness probe",
)
async def ready_check():
    """Readiness probe for Docker/k8s."""
    settings = get_settings()
    return ReadyCheck(
        ready=True,
        version=settings.app_version,
    )
