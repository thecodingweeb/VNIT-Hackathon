"""
Runs schemas — processing pipeline run tracking.

Maps to `processing_runs` table. The Run Monitor page (Page 5)
needs per-stage breakdown with live WebSocket updates.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class StageStatus(BaseModel):
    """Status of a single pipeline stage."""
    status: str  # pending | running | complete | failed
    count: int = 0
    blanks_removed: Optional[int] = None
    images_processed: Optional[int] = None
    tigers_found: Optional[int] = None
    error: Optional[str] = None


class RunDetail(BaseModel):
    """GET /runs/{id} — detailed run with per-stage breakdown (Page 5)."""
    run_id: str
    status: str  # queued | running | complete | failed
    total_images: int
    stages: Dict[str, StageStatus]  # ingest, filter, detect, match, analyze
    last_checkpoint: Optional[str] = None
    eta_seconds: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class RunListItem(BaseModel):
    """Single item in GET /runs list."""
    run_id: str
    status: str
    total_images: int
    blanks_removed: int = 0
    tigers_detected: int = 0
    alerts_generated: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None


class RunCompareRequest(BaseModel):
    """GET /runs/compare query params."""
    run_a: str
    run_b: str


class RunCompareResponse(BaseModel):
    """Side-by-side run comparison."""
    run_a: RunDetail
    run_b: RunDetail
    diff: Dict[str, Any]  # {images_delta, tigers_delta, new_individuals, ...}
