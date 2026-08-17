"""
Alert schemas — 4 alert types from Stage 5 analytics.

RANGE_SHIFT, NOVEL_STATION, BUFFER_APPROACH, PROLONGED_ABSENCE.
Evidence stored as JSONB with image paths, GPS, distances, bearing.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AlertType(str, Enum):
    RANGE_SHIFT = "RANGE_SHIFT"
    NOVEL_STATION = "NOVEL_STATION"
    BUFFER_APPROACH = "BUFFER_APPROACH"
    PROLONGED_ABSENCE = "PROLONGED_ABSENCE"


class AlertPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class AlertStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


# --- Evidence ---

class AlertEvidence(BaseModel):
    """Structured evidence JSONB for alert detail page."""
    image_paths: List[str] = []
    gps_coordinates: Optional[Dict[str, float]] = None  # {lat, lng}
    distance_measurements: Optional[Dict[str, float]] = None
    bearing_direction: Optional[str] = None
    candidate_stations: List[str] = []


# --- Alert CRUD ---

class AlertGenerateRequest(BaseModel):
    """POST /alerts/generate — trigger threshold evaluation."""
    run_id: Optional[str] = Field(None, description="Scope to a specific run")
    force: bool = Field(False, description="Re-evaluate even if already computed")


class AlertGenerateResponse(BaseModel):
    """Response after generating alerts."""
    alerts_created: int
    by_type: Dict[str, int]  # {RANGE_SHIFT: 2, BUFFER_APPROACH: 1, ...}


class AlertResponse(BaseModel):
    """Single alert for list or detail views."""
    id: str
    alert_type: AlertType
    priority: AlertPriority
    status: AlertStatus
    individual_id: Optional[str] = None
    tiger_name: Optional[str] = None
    confidence: float
    evidence: Optional[AlertEvidence] = None
    station_id: Optional[str] = None
    message: str
    created_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class AlertUpdate(BaseModel):
    """PUT /alerts/{id} — update status."""
    status: AlertStatus
    notes: Optional[str] = None


class AlertConfigUpdate(BaseModel):
    """POST /alerts/config — update thresholds in system_config."""
    range_shift_core_km2: Optional[float] = None
    range_shift_buffer_km: Optional[float] = None
    novel_station_distance_km: Optional[float] = None
    absence_window_days: Optional[int] = None
    notification_email: Optional[bool] = None
    notification_sms: Optional[bool] = None


class AlertConfigResponse(BaseModel):
    """Current alert configuration."""
    range_shift_core_km2: float = 15.0
    range_shift_buffer_km: float = 5.0
    novel_station_distance_km: float = 5.0
    absence_window_days: int = 30
    notification_email: bool = True
    notification_sms: bool = False


class AlertTrend(BaseModel):
    """Single data point in GET /alerts/trends."""
    date: str
    alert_type: AlertType
    priority: AlertPriority
    count: int


class AlertDigest(BaseModel):
    """GET /alerts/digest — summary for email dispatch."""
    period: str  # "daily" or "weekly"
    total_alerts: int
    by_type: Dict[str, int]
    by_priority: Dict[str, int]
    top_individuals: List[Dict[str, Any]]  # [{tiger_id, name, alert_count}]
    generated_at: datetime
