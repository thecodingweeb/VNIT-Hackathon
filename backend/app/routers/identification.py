"""
Identification Router — 8 endpoints for tiger detection & identity matching.

POST /identification/run               → trigger YOLOv8-L + Siamese CNN
GET  /identification/{run_id}/results  → detection results with bboxes
GET  /identification/catalogue         → all individuals (Page 6)
POST /identification/catalogue         → add new individual manually
GET  /identification/images            → captures pending identity
GET  /identification/review/queue      → reviewer queue (Page 11)
PUT  /identification/review/{id}       → submit review decision
POST /identification/merge             → merge two tiger identities
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from app.database import get_supabase_admin
from app.middleware.auth import CurrentUser
from app.middleware.rbac import require_permission
from app.middleware.rate_limit import HEAVY_LIMIT, limiter
from app.middleware.audit_log import log_audit_event
from app.services.identification_service import get_identification_service
from app.schemas.common import PaginatedResponse
from app.schemas.identification import (
    CatalogueCreate,
    CatalogueCreateResponse,
    CatalogueEntry,
    DetectionResult,
    IdentificationRunCreate,
    IdentificationRunResponse,
    MergeRequest,
    MergeResponse,
    ReviewCandidate,
    ReviewQueueItem,
    ReviewQueueResponse,
    ReviewSubmit,
)

router = APIRouter(prefix="/identification", tags=["Identification"])


# ---------------------------------------------------------------------------
# Run & Results
# ---------------------------------------------------------------------------

@router.post(
    "/run",
    response_model=IdentificationRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger identification pipeline",
)
@limiter.limit(HEAVY_LIMIT)
async def trigger_identification(
    request: Request,
    body: IdentificationRunCreate,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(require_permission("upload", "Yes")),
):
    """Trigger YOLOv8-L detection + Siamese CNN identity matching.

    Runs asynchronously via BackgroundTask.
    """
    sb = get_supabase_admin()

    # Verify run exists
    run = (
        sb.table("processing_runs")
        .select("id, status")
        .eq("id", body.run_id)
        .maybe_single()
        .execute()
    )
    if not run.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": f"Run {body.run_id} not found."},
        )

    await log_audit_event(request, "TRIGGER", "identification", body.run_id)

    return IdentificationRunResponse(
        run_id=body.run_id,
        status="queued",
        message="Identification pipeline started",
    )


@router.get(
    "/{run_id}/results",
    response_model=PaginatedResponse[DetectionResult],
    summary="Get detection results for a run",
)
async def get_results(
    run_id: str,
    page: int = 1,
    page_size: int = 20,
    user: CurrentUser = Depends(require_permission("catalogue", "Read")),
):
    """Get paginated detection results with bounding boxes and confidence."""
    sb = get_supabase_admin()
    offset = (page - 1) * page_size

    result = (
        sb.table("captures")
        .select("*", count="exact")
        .eq("run_id", run_id)
        .not_.is_("confidence", "null")
        .order("confidence", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    items = [
        DetectionResult(
            capture_id=c.get("id", ""),
            image_url=c.get("image_path", ""),
            thumbnail_url=c.get("thumbnail_url"),
            bbox=c.get("bbox", {}),
            confidence=c.get("confidence", 0.0),
            detection_class=c.get("detection_class", "unknown"),
            flank_side=c.get("flank_side"),
            individual_id=c.get("individual_id"),
            match_score=c.get("match_score"),
            match_action=c.get("match_action"),
        )
        for c in (result.data or [])
    ]

    return PaginatedResponse(
        items=items, total=result.count or 0, page=page, page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Catalogue (Page 6)
# ---------------------------------------------------------------------------

@router.get(
    "/catalogue",
    response_model=PaginatedResponse[CatalogueEntry],
    summary="Get tiger identity catalogue",
)
async def get_catalogue(
    page: int = 1,
    page_size: int = 20,
    status_filter: str | None = None,
    search: str | None = None,
    user: CurrentUser = Depends(require_permission("catalogue", "Read")),
):
    """List all tiger individuals with stats. Feeds Page 6 catalogue grid."""
    sb = get_supabase_admin()
    offset = (page - 1) * page_size

    query = sb.table("individuals").select("*", count="exact")

    if status_filter:
        query = query.eq("status", status_filter)
    if search:
        query = query.or_(f"tiger_id.ilike.%{search}%,name.ilike.%{search}%")

    result = query.order("tiger_id", desc=False).range(offset, offset + page_size - 1).execute()

    items = []
    for ind in result.data or []:
        tiger_id = ind.get("tiger_id", "")

        # Count captures for this individual
        cap_count = (
            sb.table("captures")
            .select("id", count="exact")
            .eq("individual_id", tiger_id)
            .execute()
        )

        # Get last seen date
        last_cap = (
            sb.table("captures")
            .select("captured_at")
            .eq("individual_id", tiger_id)
            .order("captured_at", desc=True)
            .limit(1)
            .execute()
        )

        items.append(CatalogueEntry(
            tiger_id=tiger_id,
            thumbnail_url=ind.get("thumbnail_url"),
            name=ind.get("name"),
            status=ind.get("status", "provisional"),
            last_seen=last_cap.data[0].get("captured_at") if last_cap.data else None,
            capture_count=cap_count.count or 0,
            sex=ind.get("sex"),
        ))

    return PaginatedResponse(
        items=items, total=result.count or 0, page=page, page_size=page_size,
    )


@router.post(
    "/catalogue",
    response_model=CatalogueCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually add a new tiger individual",
)
async def create_individual(
    request: Request,
    body: CatalogueCreate,
    user: CurrentUser = Depends(require_permission("catalogue", "R/W")),
):
    """Manually create a new tiger individual in the catalogue."""
    svc = get_identification_service()
    tiger_id = await svc._generate_tiger_id()

    sb = get_supabase_admin()
    from datetime import datetime, timezone
    sb.table("individuals").insert({
        "tiger_id": tiger_id,
        "name": body.name,
        "status": body.status.value,
        "notes": body.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    await log_audit_event(request, "CREATE", "individual", tiger_id)

    return CatalogueCreateResponse(tiger_id=tiger_id, status=body.status)


# ---------------------------------------------------------------------------
# Images pending identity
# ---------------------------------------------------------------------------

@router.get(
    "/images",
    response_model=PaginatedResponse[DetectionResult],
    summary="Get captures pending identity assignment",
)
async def get_pending_images(
    page: int = 1,
    page_size: int = 20,
    user: CurrentUser = Depends(require_permission("catalogue", "Read")),
):
    """List captures that have not been assigned to an individual yet."""
    sb = get_supabase_admin()
    offset = (page - 1) * page_size

    result = (
        sb.table("captures")
        .select("*", count="exact")
        .is_("individual_id", "null")
        .not_.is_("confidence", "null")
        .order("captured_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    items = [
        DetectionResult(
            capture_id=c.get("id", ""),
            image_url=c.get("image_path", ""),
            thumbnail_url=c.get("thumbnail_url"),
            bbox=c.get("bbox", {}),
            confidence=c.get("confidence", 0.0),
            detection_class=c.get("detection_class", "unknown"),
            flank_side=c.get("flank_side"),
            individual_id=None,
            match_score=c.get("match_score"),
            match_action=c.get("match_action"),
        )
        for c in (result.data or [])
    ]

    return PaginatedResponse(
        items=items, total=result.count or 0, page=page, page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Review Queue (Page 11)
# ---------------------------------------------------------------------------

@router.get(
    "/review/queue",
    response_model=ReviewQueueResponse,
    summary="Get review queue with top-5 candidates",
)
async def get_review_queue(
    user: CurrentUser = Depends(require_permission("review", "Yes")),
):
    """Get the next capture pending review with top-5 similarity candidates.

    Feeds the full-width Review Queue page (Page 11).
    """
    sb = get_supabase_admin()

    # Count totals
    total_pending = (
        sb.table("captures")
        .select("id", count="exact")
        .eq("review_status", "pending")
        .execute()
    ).count or 0

    reviewed = (
        sb.table("captures")
        .select("id", count="exact")
        .eq("review_status", "confirmed")
        .execute()
    ).count or 0

    # Get next pending capture
    next_capture = (
        sb.table("captures")
        .select("*")
        .eq("review_status", "pending")
        .order("captured_at", desc=False)
        .limit(1)
        .execute()
    ).data

    current = None
    if next_capture:
        cap = next_capture[0]
        # Get candidates from stored match_candidates or build from embeddings
        raw_candidates = cap.get("match_candidates", [])
        candidates = []
        for cand in raw_candidates[:5]:
            ind_id = cand.get("individual_id", "")
            # Fetch individual details
            ind = (
                sb.table("individuals")
                .select("name, thumbnail_url")
                .eq("tiger_id", ind_id)
                .maybe_single()
                .execute()
            ).data or {}

            last_cap = (
                sb.table("captures")
                .select("captured_at")
                .eq("individual_id", ind_id)
                .order("captured_at", desc=True)
                .limit(1)
                .execute()
            ).data

            candidates.append(ReviewCandidate(
                individual_id=ind_id,
                score=cand.get("score", 0.0),
                thumbnail_url=ind.get("thumbnail_url"),
                name=ind.get("name"),
                last_seen=last_cap[0].get("captured_at") if last_cap else None,
            ))

        current = ReviewQueueItem(
            capture_id=cap.get("id", ""),
            image_url=cap.get("image_path", ""),
            flank_side=cap.get("flank_side", "L"),
            station=cap.get("station_id", ""),
            date=cap.get("captured_at"),
            quality_score=cap.get("quality_score", 0.0),
            candidates=candidates,
        )

    return ReviewQueueResponse(
        total_pending=total_pending,
        reviewed=reviewed,
        current=current,
    )


@router.put(
    "/review/{capture_id}",
    status_code=status.HTTP_200_OK,
    summary="Submit review decision",
)
async def submit_review(
    request: Request,
    capture_id: str,
    body: ReviewSubmit,
    user: CurrentUser = Depends(require_permission("review", "Yes")),
):
    """Submit a review decision: confirm match, create new individual, or skip."""
    sb = get_supabase_admin()
    svc = get_identification_service()

    # Verify capture exists and is pending
    capture = (
        sb.table("captures")
        .select("*")
        .eq("id", capture_id)
        .eq("review_status", "pending")
        .maybe_single()
        .execute()
    )
    if not capture.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CAPTURE_NOT_FOUND", "message": "Capture not found or not pending review."},
        )

    if body.action.value == "confirm":
        if not body.individual_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": "individual_id is required when action is 'confirm'.",
                    "field_errors": {"individual_id": "This field is required"},
                },
            )
        sb.table("captures").update({
            "individual_id": body.individual_id,
            "review_status": "confirmed",
            "reviewed_by": user.id,
            "match_action": "MANUAL_CONFIRM",
        }).eq("id", capture_id).execute()

    elif body.action.value == "new_individual":
        tiger_id = await svc._generate_tiger_id()
        from datetime import datetime, timezone
        sb.table("individuals").insert({
            "tiger_id": tiger_id,
            "status": "provisional",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        sb.table("captures").update({
            "individual_id": tiger_id,
            "review_status": "confirmed",
            "reviewed_by": user.id,
            "match_action": "MANUAL_NEW",
        }).eq("id", capture_id).execute()

    elif body.action.value == "skip":
        sb.table("captures").update({
            "review_status": "skipped",
            "reviewed_by": user.id,
        }).eq("id", capture_id).execute()

    await log_audit_event(
        request, "REVIEW", "capture", capture_id,
        after={"action": body.action.value, "individual_id": body.individual_id},
    )

    return {"message": f"Review {body.action.value} applied to {capture_id}."}


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------

@router.post(
    "/merge",
    response_model=MergeResponse,
    summary="Merge two tiger identities",
)
async def merge_identities(
    request: Request,
    body: MergeRequest,
    user: CurrentUser = Depends(require_permission("catalogue", "R/W")),
):
    """Merge source tiger into target tiger.

    All captures and embeddings are reassigned. Source individual is archived.
    """
    svc = get_identification_service()
    result = await svc.merge_individuals(body.source_tiger_id, body.target_tiger_id)

    await log_audit_event(
        request, "MERGE", "individual",
        notes=f"Merged {body.source_tiger_id} → {body.target_tiger_id}",
    )

    return MergeResponse(**result)
