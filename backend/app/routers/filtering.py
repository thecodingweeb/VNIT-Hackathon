"""
Filtering Router — 6 endpoints for blank image filtering (Stage 2).

POST   /filtering/run                → trigger blank filter pipeline
GET    /filtering/{run_id}/status    → poll run status
GET    /filtering/{run_id}/report    → filtering report
GET    /filtering/{run_id}/results   → paginated filtered captures
POST   /filtering/restore            → restore false-positive blanks
DELETE /filtering/purge              → delete expired quarantine records
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from app.database import get_supabase_admin
from app.middleware.auth import CurrentUser
from app.middleware.rbac import require_permission
from app.middleware.rate_limit import HEAVY_LIMIT, limiter
from app.middleware.audit_log import log_audit_event
from app.services.filtering_service import get_filtering_service
from app.schemas.common import PaginatedResponse
from app.schemas.filtering import (
    FilteredCapture,
    FilteringReport,
    FilteringRunCreate,
    FilteringRunResponse,
    FilteringStatus,
    PurgeResponse,
    RestoreRequest,
)

router = APIRouter(prefix="/filtering", tags=["Filtering"])


@router.post(
    "/run",
    response_model=FilteringRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger a filtering pipeline run",
)
@limiter.limit(HEAVY_LIMIT)
async def trigger_run(
    request: Request,
    body: FilteringRunCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_permission("upload", "Yes")),
):
    """Start a blank filtering pipeline run.

    Only 1 active run at a time — returns 409 if a run is in progress.
    Returns run_id immediately; pipeline runs in background.
    """
    svc = get_filtering_service()

    # Check concurrency — only 1 active run
    active = await svc.check_active_run()
    if active and active.get("status") == "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "RUN_IN_PROGRESS",
                "message": "A processing run is already in progress.",
                "active_run_id": active.get("id"),
            },
        )

    # Create the run record
    run = await svc.create_run(
        station_ids=body.station_ids,
        threshold=body.threshold,
        source_path=body.source_path,
    )

    await log_audit_event(request, "CREATE", "processing_run", run["run_id"])

    return FilteringRunResponse(
        run_id=run["run_id"],
        status=run["status"],
        queue_position=run["queue_position"],
    )


@router.get(
    "/{run_id}/status",
    response_model=FilteringStatus,
    summary="Get run status (polled by Phase 3)",
)
async def get_status(
    run_id: str,
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Poll the status of a filtering run. Used by Phase 3 pipeline."""
    svc = get_filtering_service()
    run = await svc.get_run_status(run_id)

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": f"Run {run_id} not found."},
        )

    return FilteringStatus(
        run_id=run_id,
        status=run.get("status", "unknown"),
        total_images=run.get("total_images", 0),
        processed=run.get("stages", {}).get("filter", {}).get("count", 0),
        blanks_removed=run.get("blanks_removed", 0),
        subjects_found=run.get("total_images", 0) - run.get("blanks_removed", 0),
        last_checkpoint=run.get("last_checkpoint"),
        eta_seconds=run.get("eta_seconds"),
        error_message=run.get("error_message"),
    )


@router.get(
    "/{run_id}/report",
    response_model=FilteringReport,
    summary="Get filtering report with statistics",
)
async def get_report(
    run_id: str,
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Get summary statistics for a completed filtering run."""
    svc = get_filtering_service()
    run = await svc.get_run_status(run_id)

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": f"Run {run_id} not found."},
        )

    return FilteringReport(
        run_id=run_id,
        total_images=run.get("total_images", 0),
        blanks_removed=run.get("blanks_removed", 0),
        subjects_found=run.get("total_images", 0) - run.get("blanks_removed", 0),
        boundary_flagged=0,  # computed from captures
        confidence_distribution=run.get("confidence_dist", {}),
        duration_seconds=0,
        completed_at=run.get("completed_at"),
    )


@router.get(
    "/{run_id}/results",
    response_model=PaginatedResponse[FilteredCapture],
    summary="Get filtered captures for a run",
)
async def get_results(
    run_id: str,
    page: int = 1,
    page_size: int = 20,
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Get paginated list of captures from a filtering run."""
    sb = get_supabase_admin()
    offset = (page - 1) * page_size

    result = (
        sb.table("captures")
        .select("*", count="exact")
        .eq("run_id", run_id)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    items = [
        FilteredCapture(
            capture_id=c.get("id", ""),
            image_path=c.get("image_path", ""),
            thumbnail_url=c.get("thumbnail_url"),
            classification=c.get("classification", "SUBJECT"),
            confidence=c.get("confidence", 0.0),
            station_id=c.get("station_id", ""),
            captured_at=c.get("captured_at"),
        )
        for c in (result.data or [])
    ]

    return PaginatedResponse(
        items=items,
        total=result.count or 0,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/restore",
    status_code=status.HTTP_200_OK,
    summary="Restore false-positive blanks from quarantine",
)
async def restore_captures(
    request: Request,
    body: RestoreRequest,
    user: CurrentUser = Depends(require_permission("upload", "Yes")),
):
    """Move images from quarantine back to captures table."""
    sb = get_supabase_admin()
    restored = 0

    for capture_id in body.capture_ids:
        # Get quarantine record
        qr = (
            sb.table("quarantine")
            .select("*")
            .eq("id", capture_id)
            .maybe_single()
            .execute()
        )
        if qr.data:
            # Move to captures
            sb.table("captures").insert({
                "image_path": qr.data.get("image_path"),
                "run_id": qr.data.get("run_id"),
                "confidence": qr.data.get("confidence"),
                "classification": "SUBJECT",
            }).execute()
            # Remove from quarantine
            sb.table("quarantine").delete().eq("id", capture_id).execute()
            restored += 1

    await log_audit_event(
        request, "RESTORE", "quarantine", notes=f"Restored {restored} captures"
    )

    return {"restored": restored, "requested": len(body.capture_ids)}


@router.delete(
    "/purge",
    response_model=PurgeResponse,
    summary="Delete expired quarantine records",
)
async def purge_quarantine(
    request: Request,
    user: CurrentUser = Depends(require_permission("upload", "Yes")),
):
    """Permanently delete expired quarantine records and storage files."""
    sb = get_supabase_admin()

    # Get expired quarantine records
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    expired = (
        sb.table("quarantine")
        .select("id, image_path")
        .lt("expires_at", now)
        .execute()
    ).data or []

    # Delete storage files
    from app.services.storage_service import get_storage_service
    storage = get_storage_service()
    for record in expired:
        path = record.get("image_path", "")
        if path:
            storage.delete_file("quarantine", path)

    # Delete database records
    if expired:
        ids = [r["id"] for r in expired]
        sb.table("quarantine").delete().in_("id", ids).execute()

    await log_audit_event(
        request, "PURGE", "quarantine", notes=f"Purged {len(expired)} records"
    )

    return PurgeResponse(deleted_count=len(expired), freed_bytes=0)
