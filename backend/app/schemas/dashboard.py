"""
Dashboard schemas — aggregated KPIs, trends, and activity feed.

Dashboard auto-refreshes every 60s via SWR. Response shapes are
optimized for the 4-col bento grid, D3 trend chart, and Leaflet minimap.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class MonthlyTrend(BaseModel):
    """Single data point for the D3 population trend line chart."""
    month: str  # "2024-01"
    count: int


class RecentRun(BaseModel):
    """Run summary for the dashboard's recent-runs table."""
    run_id: str
    date: str
    status: str
    image_count: int
    tigers_found: int
    alerts: int


class DashboardStats(BaseModel):
    """GET /dashboard/stats — main response shape for Page 3.

    Feeds: KPI cards (total_tigers, images_this_month, active_alerts,
    stations_online), D3 trend chart (monthly_trend), recent runs table.
    """
    total_tigers: int
    images_this_month: int
    active_alerts: int
    stations_online: int
    stations_total: int
    monthly_trend: List[MonthlyTrend]  # 12 months for D3 chart
    recent_runs: List[RecentRun]  # last 5


class ActivityItem(BaseModel):
    """Single item in GET /dashboard/recent activity feed."""
    id: str
    type: str  # capture | alert | run | review
    message: str
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None


class HeatmapPoint(BaseModel):
    """Single point in GET /dashboard/heatmap."""
    lat: float
    lng: float
    intensity: float


class SystemStatus(BaseModel):
    """GET /dashboard/system — admin system overview."""
    gpu_utilization: Optional[float] = None
    memory_used_gb: float
    memory_total_gb: float
    disk_free_gb: float
    active_runs: int
    queued_runs: int
    uptime_hours: float
