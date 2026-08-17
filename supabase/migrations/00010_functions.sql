-- =============================================================================
-- Migration 00010: Helper SQL Functions
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Utility functions for:
--   1. Automatic audit trail generation
--   2. Individual capture count maintenance
--   3. Tiger ID auto-generation (PTR-T-NNN)
--   4. Expired quarantine cleanup
--   5. Dashboard statistics aggregation
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Automatic Audit Trail Trigger
-- ─────────────────────────────────────────────────────────────────────────────
-- Attach to any table that needs audit logging.
-- Records INSERT/UPDATE/DELETE with before/after snapshots.

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role public.user_role;
BEGIN
    -- Get current user info (may be NULL for service_role operations)
    SELECT id, role INTO v_user_id, v_user_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_log (user_id, user_role, action, resource_type, resource_id, after_value)
        VALUES (v_user_id, v_user_role, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_log (user_id, user_role, action, resource_type, resource_id, before_value, after_value)
        VALUES (v_user_id, v_user_role, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_log (user_id, user_role, action, resource_type, resource_id, before_value)
        VALUES (v_user_id, v_user_role, TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Attach audit triggers to critical tables
CREATE TRIGGER audit_individuals
    AFTER INSERT OR UPDATE OR DELETE ON public.individuals
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_captures
    AFTER INSERT OR UPDATE OR DELETE ON public.captures
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_alerts
    AFTER INSERT OR UPDATE OR DELETE ON public.alerts
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_stations
    AFTER INSERT OR UPDATE OR DELETE ON public.stations
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_models
    AFTER INSERT OR UPDATE OR DELETE ON public.models
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Auto-update Individual Capture Statistics
-- ─────────────────────────────────────────────────────────────────────────────
-- When a new capture is assigned to an individual, automatically update
-- total_captures, last_captured on the individual record.

CREATE OR REPLACE FUNCTION public.update_individual_capture_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.individual_id IS NOT NULL THEN
        UPDATE public.individuals
        SET
            total_captures = (
                SELECT COUNT(*) FROM public.captures
                WHERE individual_id = NEW.individual_id
            ),
            last_captured = GREATEST(
                last_captured,
                NEW.captured_at
            ),
            updated_at = NOW()
        WHERE id = NEW.individual_id;
    END IF;

    -- Handle re-assignment: decrement old individual if changed
    IF TG_OP = 'UPDATE' AND OLD.individual_id IS NOT NULL AND OLD.individual_id <> NEW.individual_id THEN
        UPDATE public.individuals
        SET
            total_captures = (
                SELECT COUNT(*) FROM public.captures
                WHERE individual_id = OLD.individual_id
            ),
            updated_at = NOW()
        WHERE id = OLD.individual_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER captures_update_individual_stats
    AFTER INSERT OR UPDATE OF individual_id ON public.captures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_individual_capture_stats();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tiger ID Auto-Generation Function
-- ─────────────────────────────────────────────────────────────────────────────
-- Generates the next PTR-T-NNN identifier for new individual enrollment.

CREATE OR REPLACE FUNCTION public.generate_tiger_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    max_num INTEGER;
    new_id TEXT;
BEGIN
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(tiger_id FROM 'PTR-T-(\d+)')
            AS INTEGER
        )
    ), 0) INTO max_num
    FROM public.individuals
    WHERE tiger_id ~ '^PTR-T-\d+$';

    new_id := 'PTR-T-' || LPAD((max_num + 1)::TEXT, 3, '0');
    RETURN new_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Expired Quarantine Cleanup Function
-- ─────────────────────────────────────────────────────────────────────────────
-- Called periodically (e.g., via pg_cron or Supabase Edge Function)
-- to permanently delete quarantined images past their expiry date.

CREATE OR REPLACE FUNCTION public.cleanup_expired_quarantine()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH expired AS (
        DELETE FROM public.quarantine
        WHERE expires_at < NOW()
        AND restored = false
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM expired;

    -- Log cleanup action
    INSERT INTO public.audit_log (action, resource_type, after_value)
    VALUES (
        'QUARANTINE_CLEANUP',
        'quarantine',
        jsonb_build_object('deleted_count', deleted_count, 'cleaned_at', NOW())
    );

    RETURN deleted_count;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Dashboard Statistics Aggregation Function
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns key metrics for the dashboard overview in a single DB round-trip.

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_individuals', (SELECT COUNT(*) FROM public.individuals WHERE status = 'active'),
        'total_captures', (SELECT COUNT(*) FROM public.captures),
        'total_stations', (SELECT COUNT(*) FROM public.stations WHERE deployment_status = 'active'),
        'active_alerts', (SELECT COUNT(*) FROM public.alerts WHERE status IN ('new', 'acknowledged')),
        'recent_runs', (
            SELECT COUNT(*) FROM public.processing_runs
            WHERE started_at > NOW() - INTERVAL '30 days'
        ),
        'storage_saved_mb', (
            SELECT COALESCE(SUM(storage_saved_mb), 0) FROM public.processing_runs
        ),
        'total_blanks_removed', (
            SELECT COALESCE(SUM(blanks_removed), 0) FROM public.processing_runs
        ),
        'pending_reviews', (
            SELECT COUNT(*) FROM public.captures WHERE review_status = 'pending'
        ),
        'alert_breakdown', (
            SELECT jsonb_object_agg(alert_type, cnt)
            FROM (
                SELECT alert_type, COUNT(*) as cnt
                FROM public.alerts
                WHERE status IN ('new', 'acknowledged')
                GROUP BY alert_type
            ) sub
        )
    ) INTO result;

    RETURN result;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Vector Similarity Search Helper
-- ─────────────────────────────────────────────────────────────────────────────
-- Performs cosine similarity search against the embeddings table,
-- filtered by flank side. Returns top-K matches with similarity scores.

CREATE OR REPLACE FUNCTION public.find_similar_tigers(
    query_vector vector(512),
    query_flank public.flank_side,
    top_k INTEGER DEFAULT 10,
    min_similarity FLOAT DEFAULT 0.0
)
RETURNS TABLE (
    individual_id UUID,
    tiger_id VARCHAR(20),
    assigned_name VARCHAR(100),
    similarity FLOAT,
    embedding_id UUID,
    is_reference BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Set IVFFlat probes for recall/speed tradeoff
    SET LOCAL ivfflat.probes = 10;

    RETURN QUERY
    SELECT
        i.id AS individual_id,
        i.tiger_id,
        i.assigned_name,
        (1.0 - (e.vector <=> query_vector))::FLOAT AS similarity,
        e.id AS embedding_id,
        e.is_reference
    FROM public.embeddings e
    JOIN public.individuals i ON i.id = e.individual_id
    WHERE e.flank_side = query_flank
    AND (1.0 - (e.vector <=> query_vector)) >= min_similarity
    ORDER BY e.vector <=> query_vector
    LIMIT top_k;
END;
$$;
