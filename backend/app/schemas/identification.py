"""
Identification schemas — tiger detection + identity matching (Stages 3 & 4).

Handles YOLOv8-L detections, Siamese CNN embeddings, cosine similarity
matching, review queue, and identity merging.
Threshold actions: AUTO_MATCH (≥0.85), REVIEW (0.60-0.85), NEW (<0.60).
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class FlankSide(str, Enum):
    LEFT = "L"
    RIGHT = "R"


class IdentificationStatus(str, Enum):
    CONFIRMED = "confirmed"
    PROVISIONAL = "provisional"
    UNDER_REVIEW = "under_review"


class ReviewAction(str, Enum):
    """Actions from the review queue (Page 11)."""
    CONFIRM = "confirm"
    NEW_INDIVIDUAL = "new_individual"
    SKIP = "skip"


# --- Run & Results ---

class IdentificationRunCreate(BaseModel):
    """POST /identification/run — trigger YOLOv8 + Siamese CNN."""
    run_id: str = Field(..., description="Processing run to identify")
    min_confidence: float = Field(0.40, ge=0.0, le=1.0)


class IdentificationRunResponse(BaseModel):
    """Response for identification trigger."""
    run_id: str
    status: str = "queued"
    message: str = "Identification pipeline started"


class DetectionResult(BaseModel):
    """Single detection from GET /identification/{run_id}/results."""
    capture_id: str
    image_url: str
    thumbnail_url: Optional[str] = None
    bbox: Dict[str, float]  # {x, y, width, height}
    confidence: float
    detection_class: str  # animal, person, vehicle, tiger
    flank_side: Optional[FlankSide] = None
    individual_id: Optional[str] = None
    match_score: Optional[float] = None
    match_action: Optional[str] = None  # AUTO_MATCH, REVIEW_QUEUE, NEW_INDIVIDUAL


# --- Catalogue ---

class CatalogueEntry(BaseModel):
    """Single tiger in GET /identification/catalogue (Page 6)."""
    tiger_id: str  # PTR-T-042
    thumbnail_url: Optional[str] = None
    name: Optional[str] = None
    status: IdentificationStatus
    last_seen: Optional[datetime] = None
    capture_count: int = 0
    sex: Optional[str] = None


class CatalogueCreate(BaseModel):
    """POST /identification/catalogue — manually add new individual."""
    name: Optional[str] = None
    status: IdentificationStatus = IdentificationStatus.PROVISIONAL
    notes: Optional[str] = None


class CatalogueCreateResponse(BaseModel):
    """Response after creating a new individual."""
    tiger_id: str  # auto-generated PTR-T-{NNN}
    status: IdentificationStatus


# --- Review Queue (Page 11) ---

class ReviewCandidate(BaseModel):
    """A similarity candidate shown in the review queue slider."""
    individual_id: str
    score: float
    thumbnail_url: Optional[str] = None
    name: Optional[str] = None
    last_seen: Optional[datetime] = None


class ReviewQueueItem(BaseModel):
    """Current capture being reviewed."""
    capture_id: str
    image_url: str
    flank_side: FlankSide
    station: str
    date: Optional[datetime] = None
    quality_score: float
    candidates: List[ReviewCandidate]  # top-5 ranked by cosine similarity


class ReviewQueueResponse(BaseModel):
    """GET /identification/review/queue — full review queue state."""
    total_pending: int
    reviewed: int
    current: Optional[ReviewQueueItem] = None


class ReviewSubmit(BaseModel):
    """PUT /identification/review/{id} — submit review decision."""
    action: ReviewAction
    individual_id: Optional[str] = Field(
        None, description="Required when action=confirm"
    )
    notes: Optional[str] = None


# --- Merge ---

class MergeRequest(BaseModel):
    """POST /identification/merge — merge two tiger identities."""
    source_tiger_id: str = Field(..., description="Tiger to merge FROM (will be archived)")
    target_tiger_id: str = Field(..., description="Tiger to merge INTO (keeps ID)")
    reason: Optional[str] = None


class MergeResponse(BaseModel):
    """Response after merging identities."""
    merged_tiger_id: str
    captures_reassigned: int
    embeddings_updated: int
