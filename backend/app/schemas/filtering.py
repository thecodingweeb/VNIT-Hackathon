"""
Filtering schemas — blank image filtering pipeline (Stage 2).

Handles MegaDetector V6 classification: BLANK, SUBJECT, BOUNDARY.
Maps to `processing_runs`, `quarantine`, and `captures` tables.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class FilterClassification(str, Enum):
    """MegaDetector V6 classification output."""
    BLANK = "BLANK"
    SUBJECT = "SUBJECT"
    BOUNDARY = "BOUNDARY"


class FilteringRunCreate(BaseModel):
    """POST /filtering/run — triggers a new filtering pipeline run."""
    station_ids: Optional[List[str]] = Field(
        None, description="Filter to specific stations. Null = all."
    )
    threshold: float = Field(
        0.20, ge=0.0, le=1.0,
        description="Confidence threshold for blank classification."
    )
    source_path: Optional[str] = Field(
        None, description="SD card path or ZIP upload path."
    )


class FilteringRunResponse(BaseModel):
    """Response when a run is triggered or queued."""
    run_id: str
    status: str = "queued"
    queue_position: int = 0
    estimated_start: Optional[datetime] = None


class FilteringStatus(BaseModel):
    """GET /filtering/{run_id}/status — polled by Phase 3."""
    run_id: str
    status: str  # queued | running | complete | failed
    total_images: int = 0
    processed: int = 0
    blanks_removed: int = 0
    subjects_found: int = 0
    last_checkpoint: Optional[str] = None
    eta_seconds: Optional[int] = None
    error_message: Optional[str] = None


class FilteringReport(BaseModel):
    """GET /filtering/{run_id}/report — summary statistics."""
    run_id: str
    total_images: int
    blanks_removed: int
    subjects_found: int
    boundary_flagged: int
    confidence_distribution: dict  # histogram buckets
    duration_seconds: int
    completed_at: Optional[datetime] = None


class FilteredCapture(BaseModel):
    """Single item in GET /filtering/{run_id}/results."""
    capture_id: str
    image_path: str
    thumbnail_url: Optional[str] = None
    classification: FilterClassification
    confidence: float
    station_id: str
    captured_at: Optional[datetime] = None


class RestoreRequest(BaseModel):
    """POST /filtering/restore — restore false-positive blank."""
    capture_ids: List[str] = Field(..., min_length=1)


class PurgeResponse(BaseModel):
    """DELETE /filtering/purge — cleanup response."""
    deleted_count: int
    freed_bytes: int
