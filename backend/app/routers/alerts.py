"""
Alerts Router — 7 endpoints for alert management.

POST /alerts/generate    → evaluate 4 alert type rules
GET  /alerts             → list (filterable by type, status, priority, individual, date)
GET  /alerts/{id}        → alert detail with full evidence JSONB
PUT  /alerts/{id}        → acknowledge/resolve/escalate
POST /alerts/config      → update system_config thresholds
GET  /alerts/trends      → alert frequency over time grouped by type + priority
GET  /alerts/digest      → daily/weekly digest payload
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.database import get_supabase_admin
from app.middleware.auth import CurrentUser
from app.middleware.rbac import require_permission
from app.middleware.rate_limit import HEAVY_LIMIT, limiter
from app.middleware.audit_log import log_audit_event
from app.services.alert_service import get_alert_service
from app.schemas.common import PaginatedResponse
from app.schemas.alerts import (
    AlertConfigResponse,
    AlertConfigUpdate,
    AlertDigest,
    AlertGenerateRequest,
    AlertGenerateResponse,
    AlertResponse,
    AlertTrend,
    AlertUpdate,
    AlertEvidence,
)

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.post(
    "/generate",
    response_model=AlertGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate alerts by evaluating threshold rules",
)
@limiter.limit(HEAVY_LIMIT)
async def generate_alerts(
    request: Request,
    body: AlertGenerateRequest,
    user: CurrentUser = Depends(require_permission("alerts", "R/W")),
):
    """Evaluate 4 alert type rules and create alert records.

    Dispatches: WebSocket push + email digest + SMS for BUFFER_APPROACH.
    """
    svc = get_alert_service()
    results = await svc.generate_alerts(run_id=body.run_id, force=body.force)

    await log_audit_event(
        request, "GENERATE", "alerts", notes=f"Created {sum(results.values())} alerts",
    )

    return AlertGenerateResponse(
        alerts_created=sum(results.values()),
        by_type=results,
    )


@router.get(
    "",
    response_model=PaginatedResponse[AlertResponse],
    summary="List all alerts (filterable)",
)
async def list_alerts(
    page: int = 1,
    page_size: int = 20,
    alert_type: str | None = Query(None, alias="alert_type"),
    status_filter: str | None = Query(None, alias="status"),
    priority: str | None = None,
    individual_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    user: CurrentUser = Depends(require_permission("alerts", "View")),
):
    """List alerts with comprehensive filtering.

    Frontend SWR key = '/alerts?status=open&...'
    """
    sb = get_supabase_admin()
    offset = (page - 1) * page_size

    query = sb.table("alerts").select("*", count="exact")

    if alert_type:
        query = query.eq("alert_type", alert_type)
    if status_filter:
        query = query.eq("status", status_filter)
    if priority:
        query = query.eq("priority", priority)
    if individual_id:
        query = query.eq("individual_id", individual_id)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)

    result = (
        query
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    items = []
    for a in result.data or []:
        evidence = a.get("evidence")
        if isinstance(evidence, dict):
            evidence = AlertEvidence(**evidence)
        else:
            evidence = None

        items.append(AlertResponse(
            id=a.get("id", ""),
            alert_type=a.get("alert_type", "RANGE_SHIFT"),
            priority=a.get("priority", "MEDIUM"),
            status=a.get("status", "open"),
            individual_id=a.get("individual_id"),
            tiger_name=a.get("tiger_name"),
            confidence=a.get("confidence", 0.0),
            evidence=evidence,
            station_id=a.get("station_id"),
            message=a.get("message", ""),
            created_at=a.get("created_at"),
            acknowledged_at=a.get("acknowledged_at"),
            resolved_at=a.get("resolved_at"),
        ))

    return PaginatedResponse(
        items=items, total=result.count or 0, page=page, page_size=page_size,
    )


@router.get(
    "/trends",
    response_model=list[AlertTrend],
    summary="Alert frequency over time",
)
async def get_trends(
    days: int = Query(30, ge=7, le=365),
    user: CurrentUser = Depends(require_permission("alerts", "View")),
):
    """Get alert frequency grouped by type and priority over time."""
    sb = get_supabase_admin()

    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = (
        sb.table("alerts")
        .select("alert_type, priority, created_at")
        .gte("created_at", since)
        .order("created_at", desc=False)
        .execute()
    ).data or []

    # Group by date + type + priority
    trend_map: dict[tuple, int] = {}
    for a in result:
        date_str = (a.get("created_at", "")[:10]) or "unknown"
        key = (date_str, a.get("alert_type", ""), a.get("priority", ""))
        trend_map[key] = trend_map.get(key, 0) + 1

    return [
        AlertTrend(date=k[0], alert_type=k[1], priority=k[2], count=v)
        for k, v in sorted(trend_map.items())
    ]


@router.get(
    "/digest",
    response_model=AlertDigest,
    summary="Daily/weekly alert digest",
)
async def get_digest(
    period: str = Query("daily", pattern="^(daily|weekly)$"),
    user: CurrentUser = Depends(require_permission("alerts", "View")),
):
    """Get alert digest summary for email dispatch."""
    sb = get_supabase_admin()

    from datetime import timedelta
    days = 1 if period == "daily" else 7
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = (
        sb.table("alerts")
        .select("alert_type, priority, individual_id")
        .gte("created_at", since)
        .execute()
    ).data or []

    by_type: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    ind_counts: dict[str, int] = {}

    for a in result:
        at = a.get("alert_type", "unknown")
        by_type[at] = by_type.get(at, 0) + 1

        p = a.get("priority", "unknown")
        by_priority[p] = by_priority.get(p, 0) + 1

        ind = a.get("individual_id")
        if ind:
            ind_counts[ind] = ind_counts.get(ind, 0) + 1

    # Top 5 individuals by alert count
    top_individuals = sorted(ind_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return AlertDigest(
        period=period,
        total_alerts=len(result),
        by_type=by_type,
        by_priority=by_priority,
        top_individuals=[
            {"tiger_id": tid, "alert_count": count}
            for tid, count in top_individuals
        ],
        generated_at=datetime.now(timezone.utc),
    )


@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
    summary="Get alert detail with full evidence",
)
async def get_alert(
    alert_id: str,
    user: CurrentUser = Depends(require_permission("alerts", "View")),
):
    """Get full alert detail including evidence JSONB with image URLs."""
    sb = get_supabase_admin()

    result = (
        sb.table("alerts")
        .select("*")
        .eq("id", alert_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ALERT_NOT_FOUND", "message": f"Alert {alert_id} not found."},
        )

    a = result.data
    evidence = a.get("evidence")
    if isinstance(evidence, dict):
        evidence = AlertEvidence(**evidence)
    else:
        evidence = None

    return AlertResponse(
        id=a.get("id", ""),
        alert_type=a.get("alert_type", "RANGE_SHIFT"),
        priority=a.get("priority", "MEDIUM"),
        status=a.get("status", "open"),
        individual_id=a.get("individual_id"),
        tiger_name=a.get("tiger_name"),
        confidence=a.get("confidence", 0.0),
        evidence=evidence,
        station_id=a.get("station_id"),
        message=a.get("message", ""),
        created_at=a.get("created_at"),
        acknowledged_at=a.get("acknowledged_at"),
        resolved_at=a.get("resolved_at"),
    )


@router.put(
    "/{alert_id}",
    response_model=AlertResponse,
    summary="Update alert status",
)
async def update_alert(
    request: Request,
    alert_id: str,
    body: AlertUpdate,
    user: CurrentUser = Depends(require_permission("alerts", "R/W")),
):
    """Acknowledge, resolve, or escalate an alert."""
    sb = get_supabase_admin()

    before = sb.table("alerts").select("*").eq("id", alert_id).maybe_single().execute()
    if not before.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ALERT_NOT_FOUND", "message": f"Alert {alert_id} not found."},
        )

    update_data = {"status": body.status.value}
    if body.status.value == "acknowledged":
        update_data["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    elif body.status.value == "resolved":
        update_data["resolved_at"] = datetime.now(timezone.utc).isoformat()

    sb.table("alerts").update(update_data).eq("id", alert_id).execute()

    await log_audit_event(
        request, "UPDATE", "alert", alert_id,
        before={"status": before.data.get("status")},
        after=update_data,
    )

    # Re-fetch updated record
    return await get_alert(alert_id, user)


@router.post(
    "/config",
    response_model=AlertConfigResponse,
    summary="Update alert thresholds",
)
async def update_config(
    request: Request,
    body: AlertConfigUpdate,
    user: CurrentUser = Depends(require_permission("settings", "Yes")),
):
    """Update alert thresholds in system_config table."""
    sb = get_supabase_admin()

    config_updates = body.model_dump(exclude_none=True)
    for key, value in config_updates.items():
        sb.table("system_config").upsert({
            "key": key,
            "value": value,
            "description": f"Alert config: {key}",
        }).execute()

    await log_audit_event(
        request, "UPDATE", "system_config", notes=f"Updated alert config: {list(config_updates.keys())}",
    )

    # Return current config
    result = (
        sb.table("system_config")
        .select("key, value")
        .in_("key", [
            "range_shift_core_km2", "range_shift_buffer_km",
            "novel_station_distance_km", "absence_window_days",
            "notification_email", "notification_sms",
        ])
        .execute()
    ).data or []

    config = {r["key"]: r["value"] for r in result}
    return AlertConfigResponse(**config)
