"""
Dashboard Router — ~5 endpoints for aggregated KPIs.

GET /dashboard/stats     → main KPI response (Page 3, auto-refreshes 60s)
GET /dashboard/recent    → recent activity feed
GET /dashboard/heatmap   → capture density heatmap points
GET /dashboard/trends    → weekly/monthly detection counts
GET /dashboard/system    → system status for admin
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request, status

from app.database import get_supabase_admin
from app.middleware.auth import CurrentUser
from app.middleware.rbac import require_permission, require_admin
from app.schemas.dashboard import (
    ActivityItem,
    DashboardStats,
    HeatmapPoint,
    MonthlyTrend,
    RecentRun,
    SystemStatus,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/stats",
    response_model=DashboardStats,
    summary="Aggregated KPIs for dashboard (Page 3)",
)
async def get_stats(
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Main dashboard response. Auto-refreshed every 60s by SWR.

    Feeds: KPI cards, D3 trend chart, recent runs table.
    """
    sb = get_supabase_admin()

    # Total tigers (confirmed + provisional)
    tigers = (
        sb.table("individuals")
        .select("tiger_id", count="exact")
        .in_("status", ["confirmed", "provisional"])
        .execute()
    ).count or 0

    # Images this month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()
    images_month = (
        sb.table("captures")
        .select("id", count="exact")
        .gte("captured_at", month_start)
        .execute()
    ).count or 0

    # Active alerts (open)
    active_alerts = (
        sb.table("alerts")
        .select("id", count="exact")
        .eq("status", "open")
        .execute()
    ).count or 0

    # Stations online
    stations_total = (
        sb.table("stations")
        .select("id", count="exact")
        .execute()
    ).count or 0

    stations_online = (
        sb.table("stations")
        .select("id", count="exact")
        .eq("is_active", True)
        .execute()
    ).count or 0

    # Monthly trend (12 months) — count captures per month
    monthly_trend = []
    now = datetime.now(timezone.utc)
    for i in range(11, -1, -1):
        month_date = now - timedelta(days=i * 30)
        month_str = month_date.strftime("%Y-%m")
        m_start = month_date.replace(day=1, hour=0, minute=0, second=0).isoformat()
        # Approximate next month
        if month_date.month == 12:
            m_end = month_date.replace(year=month_date.year + 1, month=1, day=1).isoformat()
        else:
            m_end = month_date.replace(month=month_date.month + 1, day=1).isoformat()

        count = (
            sb.table("captures")
            .select("id", count="exact")
            .gte("captured_at", m_start)
            .lt("captured_at", m_end)
            .execute()
        ).count or 0

        monthly_trend.append(MonthlyTrend(month=month_str, count=count))

    # Recent 5 runs
    recent_runs_data = (
        sb.table("processing_runs")
        .select("*")
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    ).data or []

    recent_runs = [
        RecentRun(
            run_id=r.get("id", ""),
            date=r.get("created_at", "")[:10],
            status=r.get("status", "unknown"),
            image_count=r.get("total_images", 0),
            tigers_found=r.get("tigers_detected", 0),
            alerts=r.get("alerts_generated", 0),
        )
        for r in recent_runs_data
    ]

    return DashboardStats(
        total_tigers=tigers,
        images_this_month=images_month,
        active_alerts=active_alerts,
        stations_online=stations_online,
        stations_total=stations_total,
        monthly_trend=monthly_trend,
        recent_runs=recent_runs,
    )


@router.get(
    "/recent",
    response_model=list[ActivityItem],
    summary="Recent activity feed",
)
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Recent captures, alerts, and runs as a unified activity feed."""
    sb = get_supabase_admin()
    activities = []

    # Recent captures
    captures = (
        sb.table("captures")
        .select("id, station_id, individual_id, captured_at")
        .order("captured_at", desc=True)
        .limit(limit // 3)
        .execute()
    ).data or []

    for c in captures:
        activities.append(ActivityItem(
            id=c.get("id", ""),
            type="capture",
            message=f"Capture at station {c.get('station_id', 'unknown')}",
            timestamp=c.get("captured_at", datetime.now(timezone.utc).isoformat()),
            metadata={"individual_id": c.get("individual_id")},
        ))

    # Recent alerts
    alerts = (
        sb.table("alerts")
        .select("id, alert_type, individual_id, message, created_at")
        .order("created_at", desc=True)
        .limit(limit // 3)
        .execute()
    ).data or []

    for a in alerts:
        activities.append(ActivityItem(
            id=a.get("id", ""),
            type="alert",
            message=a.get("message", "Alert triggered"),
            timestamp=a.get("created_at", datetime.now(timezone.utc).isoformat()),
            metadata={"alert_type": a.get("alert_type"), "individual_id": a.get("individual_id")},
        ))

    # Recent runs
    runs = (
        sb.table("processing_runs")
        .select("id, status, total_images, created_at")
        .order("created_at", desc=True)
        .limit(limit // 3)
        .execute()
    ).data or []

    for r in runs:
        activities.append(ActivityItem(
            id=r.get("id", ""),
            type="run",
            message=f"Processing run ({r.get('total_images', 0)} images) - {r.get('status', 'unknown')}",
            timestamp=r.get("created_at", datetime.now(timezone.utc).isoformat()),
        ))

    # Sort by timestamp descending
    activities.sort(key=lambda x: x.timestamp or datetime.min, reverse=True)
    return activities[:limit]


@router.get(
    "/heatmap",
    response_model=list[HeatmapPoint],
    summary="Capture density heatmap",
)
async def get_heatmap(
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Get capture locations as heatmap intensity points for Leaflet."""
    sb = get_supabase_admin()

    # Get station locations with capture counts
    stations = sb.table("stations").select("latitude, longitude").execute().data or []

    points = []
    for s in stations:
        lat = s.get("latitude", 0)
        lng = s.get("longitude", 0)
        if lat and lng:
            # Count captures at this station
            points.append(HeatmapPoint(
                lat=lat, lng=lng, intensity=1.0,
            ))

    return points


@router.get(
    "/trends",
    response_model=list[MonthlyTrend],
    summary="Weekly/monthly detection counts",
)
async def get_trends(
    period: str = Query("monthly", pattern="^(weekly|monthly)$"),
    months: int = Query(12, ge=1, le=24),
    user: CurrentUser = Depends(require_permission("dashboard", "Read")),
):
    """Detection count trends for D3 charts."""
    sb = get_supabase_admin()
    trends = []
    now = datetime.now(timezone.utc)

    if period == "monthly":
        for i in range(months - 1, -1, -1):
            month_date = now - timedelta(days=i * 30)
            month_str = month_date.strftime("%Y-%m")
            m_start = month_date.replace(day=1, hour=0, minute=0, second=0).isoformat()
            if month_date.month == 12:
                m_end = month_date.replace(year=month_date.year + 1, month=1, day=1).isoformat()
            else:
                m_end = month_date.replace(month=month_date.month + 1, day=1).isoformat()

            count = (
                sb.table("captures")
                .select("id", count="exact")
                .gte("captured_at", m_start)
                .lt("captured_at", m_end)
                .execute()
            ).count or 0
            trends.append(MonthlyTrend(month=month_str, count=count))
    else:
        for i in range(months * 4 - 1, -1, -1):
            week_start = now - timedelta(weeks=i)
            week_str = week_start.strftime("%Y-W%U")
            w_start = week_start.isoformat()
            w_end = (week_start + timedelta(weeks=1)).isoformat()

            count = (
                sb.table("captures")
                .select("id", count="exact")
                .gte("captured_at", w_start)
                .lt("captured_at", w_end)
                .execute()
            ).count or 0
            trends.append(MonthlyTrend(month=week_str, count=count))

    return trends


@router.get(
    "/system",
    response_model=SystemStatus,
    summary="System status (ADMIN only)",
)
async def get_system_status(
    user: CurrentUser = Depends(require_admin()),
):
    """GPU utilization, memory, disk, and queue status for admin."""
    sb = get_supabase_admin()

    active = (
        sb.table("processing_runs")
        .select("id", count="exact")
        .eq("status", "running")
        .execute()
    ).count or 0

    queued = (
        sb.table("processing_runs")
        .select("id", count="exact")
        .eq("status", "queued")
        .execute()
    ).count or 0

    return SystemStatus(
        gpu_utilization=None,  # Would come from GPU monitoring agent
        memory_used_gb=0.0,
        memory_total_gb=0.0,
        disk_free_gb=0.0,
        active_runs=active,
        queued_runs=queued,
        uptime_hours=0.0,
    )
