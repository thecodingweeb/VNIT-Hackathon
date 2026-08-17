"""
Pipeline Orchestration — BackgroundTask that chains 5 pipeline stages.

Stage chain: ingest → filter → detect → match → analyze
Each stage updates processing_runs in Supabase and broadcasts via WebSocket.

Checkpointing: last_checkpoint stores last processed image ID.
Progress: WebSocket updates every 100 images.
Error: error_callback marks run as failed and logs.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

from app.database import get_supabase_admin
from app.services.filtering_service import get_filtering_service
from app.routers.websocket import broadcast_run_progress


async def run_pipeline(
    run_id: str,
    station_ids: Optional[list] = None,
    threshold: float = 0.20,
) -> None:
    """Execute the full 5-stage pipeline as a BackgroundTask.

    This is the entry point called from POST /filtering/run.
    Each stage is a separate function that:
      1. Updates its stage status in processing_runs
      2. Broadcasts progress via WebSocket every 100 images
      3. Calls the next stage on completion
    """
    svc = get_filtering_service()
    sb = get_supabase_admin()

    try:
        # --- Stage 1: Ingestion ---
        await svc.update_run_stage(run_id, "ingest", "running")
        await _stage_ingest(run_id, station_ids)
        await svc.update_run_stage(run_id, "ingest", "complete")

        # --- Stage 2: Blank Filtering ---
        await svc.update_run_stage(run_id, "filter", "running")
        await _stage_filter(run_id, threshold)
        await svc.update_run_stage(run_id, "filter", "complete")

        # --- Stage 3: Tiger Detection ---
        await svc.update_run_stage(run_id, "detect", "running")
        await _stage_detect(run_id)
        await svc.update_run_stage(run_id, "detect", "complete")

        # --- Stage 4: Identity Matching ---
        await svc.update_run_stage(run_id, "match", "running")
        await _stage_match(run_id)
        await svc.update_run_stage(run_id, "match", "complete")

        # --- Stage 5: Analytics & Alerting ---
        await svc.update_run_stage(run_id, "analyze", "running")
        await _stage_analyze(run_id)
        await svc.update_run_stage(run_id, "analyze", "complete")

        # Mark run as complete
        await svc.complete_run(run_id)

    except Exception as e:
        await svc.complete_run(run_id, error=str(e))


async def _stage_ingest(run_id: str, station_ids: Optional[list] = None) -> None:
    """Stage 1: Scan SD cards / ZIP uploads, parse EXIF, deduplicate.

    In production, this would:
      - Recursively scan source directory
      - Parse EXIF (DateTimeOriginal, GPS, Make/Model)
      - Assign nearest station within 100m
      - Deduplicate via pHash (Hamming distance 0 = skip, ≤5 = flag)
      - Upload to raw-images/ bucket
    """
    # Placeholder — actual ML code runs in Phase 3
    await broadcast_run_progress(run_id, 0, 0, 0, "ingest")


async def _stage_filter(run_id: str, threshold: float) -> None:
    """Stage 2: MegaDetector V6 blank filtering.

    In production:
      - Load MegaDetector V6 (YOLOv9-C, 1280×1280)
      - Classify each image: BLANK / SUBJECT / BOUNDARY
      - Blanks → quarantine table + quarantine/ bucket
      - Subjects → proceed to Stage 3
      - Performance target: ≥1000 images/min (GPU)
    """
    await broadcast_run_progress(run_id, 0, 0, 0, "filter")


async def _stage_detect(run_id: str) -> None:
    """Stage 3: YOLOv8-L tiger detection & crop.

    In production:
      - Run fine-tuned YOLOv8-L (classes: animal, person, vehicle, tiger)
      - Only tiger detections proceed to Stage 4
      - Crop: bbox + 15% padding → 448×448 → crops/ bucket
      - Classify flank L/R from detection geometry
      - Quality scoring (blur detection, occlusion)
      - Performance target: ≥500 images/min (GPU)
    """
    await broadcast_run_progress(run_id, 0, 0, 0, "detect")


async def _stage_match(run_id: str) -> None:
    """Stage 4: Siamese CNN identity matching.

    In production:
      - DenseNet-169 backbone → L2-normalized 512-d vector
      - pgvector cosine similarity search (same-flank only)
      - Route by threshold: AUTO_MATCH / REVIEW / NEW_INDIVIDUAL
      - Performance target: <5s per image
    """
    await broadcast_run_progress(run_id, 0, 0, 0, "match")


async def _stage_analyze(run_id: str) -> None:
    """Stage 5: Analytics & alerting.

    In production:
      - KDE gaussian_kde → 95% and 50% isopleths
      - MCP (Minimum Convex Polygon) as secondary metric
      - Compute centroids, VI and BA overlap indices
      - Evaluate 4 alert rules
      - Store GeoJSON polygons in PostGIS
    """
    await broadcast_run_progress(run_id, 0, 0, 0, "analyze")
