"""
Occupancy schemas — spatial occupancy analysis (Stage 5).

Handles KDE/MCP range computation, overlap indices, GeoJSON layer
exports, and the occupancy map page (/map) with its time slider.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class LayerType(str, Enum):
    """Supported map layer types for GET /occupancy/layers?type=."""
    KDE95 = "kde95"
    KDE50 = "kde50"
    CENTROIDS = "centroids"
    OVERLAP = "overlap"
    BUFFER = "buffer"
    VILLAGES = "villages"
    STATIONS = "stations"


class ExportFormat(str, Enum):
    CSV = "csv"
    GEOJSON = "geojson"
    SHAPEFILE = "shapefile"


# --- Compute ---

class OccupancyComputeRequest(BaseModel):
    """POST /occupancy/compute — trigger occupancy model."""
    run_id: str
    model_type: str = Field("kde", description="kde or mcp")


class OccupancyComputeResponse(BaseModel):
    """Response after triggering compute."""
    run_id: str
    status: str = "computing"
    individuals_queued: int


# --- Individual Occupancy ---

class IndividualOccupancy(BaseModel):
    """GET /occupancy/individual — per-tiger stats."""
    tiger_id: str
    name: Optional[str] = None
    range_area_km2: float
    core_area_km2: float
    centroid: Dict[str, float]  # {lat, lng}
    capture_count: int
    last_computed: Optional[datetime] = None


# --- Overlap ---

class OverlapPair(BaseModel):
    """Single row from overlap_pairs table."""
    tiger_a_id: str
    tiger_b_id: str
    vi_index: float = Field(..., description="Volume of Intersection")
    ba_index: float = Field(..., description="Bhattacharyya Affinity")


class OverlapResponse(BaseModel):
    """GET /occupancy/overlap — matrix of overlap pairs."""
    pairs: List[OverlapPair]
    total_individuals: int


# --- Layers (GeoJSON for map) ---

class GeoJSONLayer(BaseModel):
    """GET /occupancy/layers — GeoJSON FeatureCollection wrapper."""
    type: LayerType
    run_id: Optional[str] = None
    geojson: Dict[str, Any]  # standard GeoJSON FeatureCollection


# --- Export ---

class ExportRequest(BaseModel):
    """GET /occupancy/export query params."""
    format: ExportFormat = ExportFormat.GEOJSON
    run_id: Optional[str] = None
    individual_ids: Optional[List[str]] = None


class ExportResponse(BaseModel):
    """Response with download URL."""
    download_url: str
    format: ExportFormat
    expires_at: datetime


# --- Summary ---

class OccupancySummary(BaseModel):
    """GET /occupancy/summary — aggregated KPIs."""
    total_individuals: int
    avg_range_area_km2: float
    total_core_area_km2: float
    overlap_pair_count: int
    last_computed: Optional[datetime] = None
