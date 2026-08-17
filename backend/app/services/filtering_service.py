"""
Filtering Service — blank image filtering pipeline orchestration.

Manages the Stage 2 pipeline (MegaDetector V6) via BackgroundTasks.
Enforces single-run concurrency: only 1 active run at a time.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from app.database import get_supabase_admin


class FilteringService:
    """Orchestrates filtering pipeline runs."""

    def __init__(self):
        self._sb = get_supabase_admin()

    async def check_active_run(self) -> Optional[dict]:
        """Check if there's currently an active processing run.

        Returns the active run record if one exists, None otherwise.
        """
        result = (
            self._sb.table("processing_runs")
            .select("*")
            .in_("status", ["running", "queued"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]
        return None

    async def create_run(
        self,
        station_ids: Optional[list] = None,
        threshold: float = 0.20,
        source_path: Optional[str] = None,
    ) -> dict:
        """Create a new processing run record.

        Returns the run record with run_id, status, and queue position.
        """
        run_id = str(uuid.uuid4())

        # Check if there's an active run
        active = await self.check_active_run()
        if active:
            # Queue this run
            status = "queued"
            # Count queued runs for position
            queued = (
                self._sb.table("processing_runs")
                .select("id", count="exact")
                .eq("status", "queued")
                .execute()
            )
            queue_position = (queued.count or 0) + 1
        else:
            status = "running"
            queue_position = 0

        record = {
            "id": run_id,
            "status": status,
            "total_images": 0,
            "blanks_removed": 0,
            "tigers_detected": 0,
            "threshold": threshold,
            "station_ids": station_ids,
            "source_path": source_path,
            "stages": {
                "ingest": {"status": "pending", "count": 0},
                "filter": {"status": "pending", "count": 0},
                "detect": {"status": "pending", "count": 0},
                "match": {"status": "pending", "count": 0},
                "analyze": {"status": "pending", "count": 0},
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        self._sb.table("processing_runs").insert(record).execute()

        return {
            "run_id": run_id,
            "status": status,
            "queue_position": queue_position,
        }

    async def get_run_status(self, run_id: str) -> Optional[dict]:
        """Get the current status of a processing run."""
        result = (
            self._sb.table("processing_runs")
            .select("*")
            .eq("id", run_id)
            .maybe_single()
            .execute()
        )
        return result.data

    async def update_run_stage(
        self,
        run_id: str,
        stage: str,
        stage_status: str,
        count: int = 0,
        **extra,
    ) -> None:
        """Update a specific stage within a processing run.

        Called by the pipeline as stages progress.
        """
        run = await self.get_run_status(run_id)
        if not run:
            return

        stages = run.get("stages", {})
        stages[stage] = {
            "status": stage_status,
            "count": count,
            **extra,
        }

        update_data = {
            "stages": stages,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Update aggregate counts
        if stage == "filter" and stage_status == "complete":
            update_data["blanks_removed"] = extra.get("blanks_removed", 0)
        elif stage == "detect" and stage_status == "complete":
            update_data["tigers_detected"] = extra.get("tigers_found", 0)

        self._sb.table("processing_runs").update(
            update_data
        ).eq("id", run_id).execute()

    async def complete_run(self, run_id: str, error: Optional[str] = None) -> None:
        """Mark a run as complete or failed."""
        status = "failed" if error else "complete"
        self._sb.table("processing_runs").update({
            "status": status,
            "error_message": error,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()

        # If there's a queued run, start it
        if status == "complete":
            await self._start_next_queued_run()

    async def _start_next_queued_run(self) -> None:
        """Start the next queued run if one exists."""
        queued = (
            self._sb.table("processing_runs")
            .select("id")
            .eq("status", "queued")
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        if queued.data:
            self._sb.table("processing_runs").update({
                "status": "running",
            }).eq("id", queued.data[0]["id"]).execute()


# Singleton
_filtering_service: Optional[FilteringService] = None


def get_filtering_service() -> FilteringService:
    global _filtering_service
    if _filtering_service is None:
        _filtering_service = FilteringService()
    return _filtering_service
