"""
Station schemas — camera trap station management.

Maps to the `stations` table with PostGIS GEOMETRY location.
Supports CRUD + bulk CSV import.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class StationZone(str, Enum):
    CORE = "core"
    BUFFER = "buffer"
    VILLAGE = "village"


class StationCreate(BaseModel):
    """POST /stations — create a new camera trap station."""
    station_code: str = Field(..., min_length=1, max_length=50)
    name: Optional[str] = None
    zone: StationZone
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    elevation_m: Optional[float] = None
    is_active: bool = True
    notes: Optional[str] = None


class StationUpdate(BaseModel):
    """PUT /stations/{id} — update station. All fields optional."""
    name: Optional[str] = None
    zone: Optional[StationZone] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    elevation_m: Optional[float] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class StationResponse(BaseModel):
    """Response shape for station endpoints."""
    id: str
    station_code: str
    name: Optional[str] = None
    zone: StationZone
    latitude: float
    longitude: float
    location: Optional[Dict[str, Any]] = None  # GeoJSON Point for map pins
    elevation_m: Optional[float] = None
    is_active: bool = True
    recent_captures: int = 0
    last_capture_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BulkImportResponse(BaseModel):
    """POST /stations/bulk — CSV import result."""
    imported: int
    skipped: int
    errors: List[Dict[str, str]] = []  # [{row: "3", error: "missing station_code"}]
