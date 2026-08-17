"""
Identification Service — embedding thresholds and identity matching.

Handles the 3-way routing from Siamese CNN cosine similarity scores:
  ≥ 0.85 → AUTO_MATCH (assign individual, update reference embedding)
  0.60–0.85 → REVIEW_QUEUE (surface for human review)
  < 0.60 → NEW_INDIVIDUAL (create new tiger ID: PTR-T-{NNN})

Also handles identity merging and pgvector similarity search.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.database import get_supabase_admin


# Thresholds from Phase 3 spec
AUTO_MATCH_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.60
EMBEDDING_MOVING_AVG_WEIGHT = 0.10  # 10% weight for new embedding


class IdentificationService:
    """Business logic for tiger identity matching."""

    def __init__(self):
        self._sb = get_supabase_admin()

    # ---------------------------------------------------------------------------
    # Identity routing — called after Siamese CNN produces embeddings
    # ---------------------------------------------------------------------------

    async def route_identification(
        self,
        capture_id: str,
        embedding: List[float],
        flank_side: str,
    ) -> Dict[str, Any]:
        """Route a capture based on cosine similarity with existing embeddings.

        Returns action taken and details.
        """
        # Find top-5 candidates using pgvector cosine similarity
        candidates = await self._find_candidates(embedding, flank_side, limit=5)

        if not candidates:
            # No existing embeddings — create new individual
            return await self._create_new_individual(capture_id, embedding, flank_side)

        top_score = candidates[0]["score"]

        if top_score >= AUTO_MATCH_THRESHOLD:
            return await self._auto_match(
                capture_id, embedding, flank_side, candidates[0]
            )
        elif top_score >= REVIEW_THRESHOLD:
            return await self._queue_for_review(
                capture_id, candidates
            )
        else:
            return await self._create_new_individual(capture_id, embedding, flank_side)

    async def _find_candidates(
        self,
        embedding: List[float],
        flank_side: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """Find top-N candidates by cosine similarity via Supabase RPC.

        Calls a PostgreSQL function that uses pgvector <=> operator.
        Same-flank-only comparison (L vs L, R vs R).
        """
        try:
            result = self._sb.rpc(
                "match_embeddings",
                {
                    "query_embedding": embedding,
                    "query_flank_side": flank_side,
                    "match_limit": limit,
                },
            ).execute()

            return [
                {
                    "individual_id": row["individual_id"],
                    "score": 1.0 - row["distance"],  # cosine distance → similarity
                    "embedding_id": row["id"],
                    "is_reference": row.get("is_reference", False),
                }
                for row in (result.data or [])
            ]
        except Exception:
            return []

    # ---------------------------------------------------------------------------
    # AUTO_MATCH (≥ 0.85)
    # ---------------------------------------------------------------------------

    async def _auto_match(
        self,
        capture_id: str,
        embedding: List[float],
        flank_side: str,
        candidate: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Auto-assign capture to existing individual."""
        individual_id = candidate["individual_id"]

        # 1. Update capture with individual_id
        self._sb.table("captures").update({
            "individual_id": individual_id,
            "match_score": candidate["score"],
            "match_action": "AUTO_MATCH",
            "review_status": "confirmed",
        }).eq("id", capture_id).execute()

        # 2. Update reference embedding (10% moving average)
        await self._update_reference_embedding(
            individual_id, embedding, flank_side
        )

        # 3. Store the new embedding
        self._sb.table("embeddings").insert({
            "individual_id": individual_id,
            "flank_side": flank_side,
            "vector": embedding,
            "is_reference": False,
            "capture_id": capture_id,
        }).execute()

        return {
            "action": "AUTO_MATCH",
            "individual_id": individual_id,
            "score": candidate["score"],
            "capture_id": capture_id,
        }

    async def _update_reference_embedding(
        self,
        individual_id: str,
        new_embedding: List[float],
        flank_side: str,
    ) -> None:
        """Update reference embedding with 10% moving average.

        new_ref = 0.90 * old_ref + 0.10 * new_embedding
        """
        # Get current reference embedding
        ref = (
            self._sb.table("embeddings")
            .select("id, vector")
            .eq("individual_id", individual_id)
            .eq("flank_side", flank_side)
            .eq("is_reference", True)
            .limit(1)
            .execute()
        ).data

        if ref and ref[0].get("vector"):
            old_vec = ref[0]["vector"]
            # Weighted average
            updated = [
                (1 - EMBEDDING_MOVING_AVG_WEIGHT) * o + EMBEDDING_MOVING_AVG_WEIGHT * n
                for o, n in zip(old_vec, new_embedding)
            ]
            self._sb.table("embeddings").update({
                "vector": updated,
            }).eq("id", ref[0]["id"]).execute()

    # ---------------------------------------------------------------------------
    # REVIEW_QUEUE (0.60–0.85)
    # ---------------------------------------------------------------------------

    async def _queue_for_review(
        self,
        capture_id: str,
        candidates: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Surface capture for human review with top-5 candidates."""
        self._sb.table("captures").update({
            "review_status": "pending",
            "match_score": candidates[0]["score"],
            "match_action": "REVIEW_QUEUE",
            "match_candidates": [
                {"individual_id": c["individual_id"], "score": c["score"]}
                for c in candidates
            ],
        }).eq("id", capture_id).execute()

        return {
            "action": "REVIEW_QUEUE",
            "capture_id": capture_id,
            "top_score": candidates[0]["score"],
            "candidates": len(candidates),
        }

    # ---------------------------------------------------------------------------
    # NEW_INDIVIDUAL (< 0.60)
    # ---------------------------------------------------------------------------

    async def _create_new_individual(
        self,
        capture_id: str,
        embedding: List[float],
        flank_side: str,
    ) -> Dict[str, Any]:
        """Create a new tiger individual with auto-generated ID."""
        # Generate PTR-T-{NNN} ID
        tiger_id = await self._generate_tiger_id()

        # Create individual record
        self._sb.table("individuals").insert({
            "tiger_id": tiger_id,
            "status": "provisional",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        # Store embedding as reference
        self._sb.table("embeddings").insert({
            "individual_id": tiger_id,
            "flank_side": flank_side,
            "vector": embedding,
            "is_reference": True,
            "capture_id": capture_id,
        }).execute()

        # Update capture
        self._sb.table("captures").update({
            "individual_id": tiger_id,
            "match_score": 0.0,
            "match_action": "NEW_INDIVIDUAL",
            "review_status": "confirmed",
        }).eq("id", capture_id).execute()

        return {
            "action": "NEW_INDIVIDUAL",
            "individual_id": tiger_id,
            "capture_id": capture_id,
        }

    async def _generate_tiger_id(self) -> str:
        """Generate the next PTR-T-{NNN} sequential ID."""
        result = (
            self._sb.table("individuals")
            .select("tiger_id")
            .like("tiger_id", "PTR-T-%")
            .order("tiger_id", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            last_id = result.data[0]["tiger_id"]
            try:
                num = int(last_id.split("-")[-1]) + 1
            except (ValueError, IndexError):
                num = 1
        else:
            num = 1
        return f"PTR-T-{num:03d}"

    # ---------------------------------------------------------------------------
    # Merge identities
    # ---------------------------------------------------------------------------

    async def merge_individuals(
        self,
        source_id: str,
        target_id: str,
    ) -> Dict[str, int]:
        """Merge source tiger into target tiger.

        - Reassigns all captures from source → target
        - Moves embeddings from source → target
        - Archives the source individual
        - Updates overlap_pairs
        """
        # Reassign captures
        captures = self._sb.table("captures").update({
            "individual_id": target_id,
        }).eq("individual_id", source_id).execute()

        # Move embeddings
        embeddings = self._sb.table("embeddings").update({
            "individual_id": target_id,
            "is_reference": False,
        }).eq("individual_id", source_id).execute()

        # Archive source individual
        self._sb.table("individuals").update({
            "status": "archived",
            "merged_into": target_id,
        }).eq("tiger_id", source_id).execute()

        # Clean up overlap_pairs
        self._sb.table("overlap_pairs").delete().or_(
            f"tiger_a_id.eq.{source_id},tiger_b_id.eq.{source_id}"
        ).execute()

        return {
            "merged_tiger_id": target_id,
            "captures_reassigned": len(captures.data or []),
            "embeddings_updated": len(embeddings.data or []),
        }


# Singleton
_identification_service: Optional[IdentificationService] = None


def get_identification_service() -> IdentificationService:
    global _identification_service
    if _identification_service is None:
        _identification_service = IdentificationService()
    return _identification_service
