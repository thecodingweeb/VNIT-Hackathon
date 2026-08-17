-- =============================================================================
-- Migration 00006: Indexing Strategy
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Comprehensive index set covering:
--   B-Tree: FK joins, status filtering, tiger_id lookup
--   Composite: Capture history queries
--   Partial: Review queue optimization
--   BRIN: Time-range partition pruning
--   GiST: Spatial queries (PostGIS)
--   IVFFlat: ANN vector similarity search (pgvector)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- B-Tree Indexes (FK Joins & Filtering)
-- ─────────────────────────────────────────────────────────────────────────────

-- captures FK joins
CREATE INDEX idx_captures_individual_id ON public.captures (individual_id);
CREATE INDEX idx_captures_station_id    ON public.captures (station_id);
CREATE INDEX idx_captures_run_id        ON public.captures (run_id);

-- Composite index for efficient capture history queries
CREATE INDEX idx_captures_individual_captured
    ON public.captures (individual_id, captured_at DESC);

-- alerts filtering & FK joins
CREATE INDEX idx_alerts_alert_type     ON public.alerts (alert_type);
CREATE INDEX idx_alerts_status         ON public.alerts (status);
CREATE INDEX idx_alerts_individual_id  ON public.alerts (individual_id);
CREATE INDEX idx_alerts_created_at     ON public.alerts (created_at DESC);

-- individuals lookup
CREATE INDEX idx_individuals_tiger_id  ON public.individuals (tiger_id);
CREATE INDEX idx_individuals_status    ON public.individuals (status);

-- embeddings FK
CREATE INDEX idx_embeddings_individual ON public.embeddings (individual_id);
CREATE INDEX idx_embeddings_flank      ON public.embeddings (flank_side);

-- processing_runs
CREATE INDEX idx_runs_status           ON public.processing_runs (status);
CREATE INDEX idx_runs_started_at       ON public.processing_runs (started_at DESC);

-- overlap_pairs
CREATE INDEX idx_overlap_tiger_a       ON public.overlap_pairs (tiger_a_id);
CREATE INDEX idx_overlap_tiger_b       ON public.overlap_pairs (tiger_b_id);

-- audit_log
CREATE INDEX idx_audit_user_id         ON public.audit_log (user_id);
CREATE INDEX idx_audit_action          ON public.audit_log (action);
CREATE INDEX idx_audit_timestamp       ON public.audit_log (timestamp DESC);
CREATE INDEX idx_audit_resource        ON public.audit_log (resource_type, resource_id);

-- quarantine
CREATE INDEX idx_quarantine_run_id     ON public.quarantine (run_id);
CREATE INDEX idx_quarantine_expires    ON public.quarantine (expires_at)
    WHERE restored = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- Partial Index (Review Queue Optimization)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_captures_pending_review
    ON public.captures (created_at DESC)
    WHERE review_status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- BRIN Index (Time-Range Partition Pruning on Large Tables)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_captures_created_brin
    ON public.captures USING BRIN (created_at)
    WITH (pages_per_range = 32);

-- ─────────────────────────────────────────────────────────────────────────────
-- GiST Indexes (PostGIS Spatial Queries)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_captures_location_gist
    ON public.captures USING GIST (location);

CREATE INDEX idx_stations_location_gist
    ON public.stations USING GIST (location);

CREATE INDEX idx_individuals_baseline_range_gist
    ON public.individuals USING GIST (baseline_range);

CREATE INDEX idx_individuals_baseline_core_gist
    ON public.individuals USING GIST (baseline_core);

CREATE INDEX idx_individuals_centroid_gist
    ON public.individuals USING GIST (centroid);

CREATE INDEX idx_overlap_geom_gist
    ON public.overlap_pairs USING GIST (overlap_geom);

-- ─────────────────────────────────────────────────────────────────────────────
-- IVFFlat Index (pgvector Approximate Nearest Neighbor Search)
-- ─────────────────────────────────────────────────────────────────────────────
-- nlist = 100 (suitable for up to ~10,000 embeddings)
-- For larger catalogues, re-index with nlist = ceil(sqrt(N))
-- Search: SET ivfflat.probes = max(10, nlist/10);

CREATE INDEX idx_embeddings_vector_cosine
    ON public.embeddings USING ivfflat (vector vector_cosine_ops)
    WITH (lists = 100);
