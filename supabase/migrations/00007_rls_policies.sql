-- =============================================================================
-- Migration 00007: Row Level Security (RLS) Policies
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Replaces custom FastAPI middleware RBAC with database-level security.
-- All policies enforce the 5-role permission matrix from the PRD/TRD.
--
-- Role Hierarchy:
--   ADMIN        → Full access to everything
--   BIOLOGIST    → Full data R/W, partial settings, full GPS
--   RANGE_OFFICER→ Read data, upload images, R/W alerts, GPS rounded
--   FIELD_STAFF  → Upload images, view alerts, limited dashboard
--   VIEWER       → Read-only access to dashboard, catalogue, alerts
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper Function: Get current user's role from profiles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper: Check if current user has one of the specified roles
CREATE OR REPLACE FUNCTION public.has_role(allowed_roles public.user_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role = ANY(allowed_roles)
        AND is_active = true
    );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE RLS ON ALL TABLES
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individuals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captures        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overlap_pairs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarantine      ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────────────────────

-- All authenticated users can read profiles
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Users can update their own non-role fields
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Only ADMIN can insert/update/delete any profile (including role changes)
CREATE POLICY "profiles_admin_all"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- INDIVIDUALS (Tiger Catalogue)
-- ─────────────────────────────────────────────────────────────────────────────

-- All authenticated users can read individuals
CREATE POLICY "individuals_select_all"
    ON public.individuals FOR SELECT
    TO authenticated
    USING (true);

-- ADMIN and BIOLOGIST can insert/update/delete
CREATE POLICY "individuals_write_admin_bio"
    ON public.individuals FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "individuals_update_admin_bio"
    ON public.individuals FOR UPDATE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]))
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "individuals_delete_admin"
    ON public.individuals FOR DELETE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- STATIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- All authenticated users can read stations
CREATE POLICY "stations_select_all"
    ON public.stations FOR SELECT
    TO authenticated
    USING (true);

-- ADMIN can manage stations
CREATE POLICY "stations_write_admin"
    ON public.stations FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(ARRAY['ADMIN']::public.user_role[]));

CREATE POLICY "stations_update_admin_bio"
    ON public.stations FOR UPDATE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]))
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "stations_delete_admin"
    ON public.stations FOR DELETE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- PROCESSING RUNS
-- ─────────────────────────────────────────────────────────────────────────────

-- All authenticated can read runs
CREATE POLICY "runs_select_all"
    ON public.processing_runs FOR SELECT
    TO authenticated
    USING (true);

-- ADMIN, BIOLOGIST, RANGE_OFFICER, FIELD_STAFF can create runs (upload images)
CREATE POLICY "runs_insert_operators"
    ON public.processing_runs FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST', 'RANGE_OFFICER', 'FIELD_STAFF']::public.user_role[]));

-- ADMIN and BIOLOGIST can update runs (cancel, modify)
CREATE POLICY "runs_update_admin_bio"
    ON public.processing_runs FOR UPDATE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]))
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- CAPTURES
-- ─────────────────────────────────────────────────────────────────────────────

-- All authenticated can read captures
CREATE POLICY "captures_select_all"
    ON public.captures FOR SELECT
    TO authenticated
    USING (true);

-- ADMIN, BIOLOGIST can write captures (ML pipeline results)
CREATE POLICY "captures_insert_admin_bio"
    ON public.captures FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

-- ADMIN, BIOLOGIST can update captures (review workflow)
CREATE POLICY "captures_update_admin_bio"
    ON public.captures FOR UPDATE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]))
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- EMBEDDINGS
-- ─────────────────────────────────────────────────────────────────────────────

-- All authenticated can read embeddings (needed for identification UI)
CREATE POLICY "embeddings_select_all"
    ON public.embeddings FOR SELECT
    TO authenticated
    USING (true);

-- ADMIN, BIOLOGIST can write embeddings (ML pipeline)
CREATE POLICY "embeddings_write_admin_bio"
    ON public.embeddings FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "embeddings_update_admin_bio"
    ON public.embeddings FOR UPDATE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]))
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "embeddings_delete_admin"
    ON public.embeddings FOR DELETE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- ALERTS
-- ─────────────────────────────────────────────────────────────────────────────

-- All authenticated can read alerts
CREATE POLICY "alerts_select_all"
    ON public.alerts FOR SELECT
    TO authenticated
    USING (true);

-- System/ADMIN can create alerts (auto-generated by pipeline)
CREATE POLICY "alerts_insert_admin_bio"
    ON public.alerts FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

-- ADMIN, BIOLOGIST, RANGE_OFFICER can update alerts (acknowledge, resolve)
CREATE POLICY "alerts_update_officers"
    ON public.alerts FOR UPDATE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST', 'RANGE_OFFICER']::public.user_role[]))
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST', 'RANGE_OFFICER']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- OVERLAP PAIRS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "overlap_select_all"
    ON public.overlap_pairs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "overlap_write_admin_bio"
    ON public.overlap_pairs FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "overlap_update_admin_bio"
    ON public.overlap_pairs FOR UPDATE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]))
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOG (Read-only for ADMIN, Insert via service role)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "audit_select_admin"
    ON public.audit_log FOR SELECT
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN']::public.user_role[]));

-- INSERT is done via service_role key (bypasses RLS), no user-facing insert policy needed

-- ─────────────────────────────────────────────────────────────────────────────
-- MODELS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "models_select_all"
    ON public.models FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "models_write_admin"
    ON public.models FOR ALL
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- SYSTEM CONFIG
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "config_select_admin_bio"
    ON public.system_config FOR SELECT
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "config_write_admin"
    ON public.system_config FOR ALL
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- QUARANTINE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "quarantine_select_admin_bio"
    ON public.quarantine FOR SELECT
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "quarantine_write_admin_bio"
    ON public.quarantine FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "quarantine_update_admin_bio"
    ON public.quarantine FOR UPDATE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]))
    WITH CHECK (public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[]));

CREATE POLICY "quarantine_delete_admin"
    ON public.quarantine FOR DELETE
    TO authenticated
    USING (public.has_role(ARRAY['ADMIN']::public.user_role[]));

-- ─────────────────────────────────────────────────────────────────────────────
-- GPS Privacy Masking View
-- ─────────────────────────────────────────────────────────────────────────────
-- ADMIN and BIOLOGIST see full GPS precision.
-- All other roles see coordinates rounded to 3 decimal places (~111m precision).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.stations_masked AS
SELECT
    id,
    station_code,
    station_name,
    zone,
    nearest_village,
    village_dist_km,
    deployment_status,
    last_maintenance,
    camera_serial,
    CASE
        WHEN public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[])
        THEN location
        ELSE ST_SetSRID(
            ST_MakePoint(
                ROUND(ST_X(location)::numeric, 3)::float,
                ROUND(ST_Y(location)::numeric, 3)::float
            ),
            4326
        )
    END AS location,
    created_at
FROM public.stations;

COMMENT ON VIEW public.stations_masked IS 'GPS-privacy-masked station view. Full precision for ADMIN/BIO, ~111m for others.';

-- Similar masked view for captures
CREATE OR REPLACE VIEW public.captures_masked AS
SELECT
    c.id,
    c.individual_id,
    c.station_id,
    c.run_id,
    c.image_path,
    c.thumbnail_path,
    c.crop_path,
    CASE
        WHEN public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[])
        THEN c.location
        ELSE ST_SetSRID(
            ST_MakePoint(
                ROUND(ST_X(c.location)::numeric, 3)::float,
                ROUND(ST_Y(c.location)::numeric, 3)::float
            ),
            4326
        )
    END AS location,
    c.captured_at,
    c.flank_side,
    c.match_confidence,
    c.review_status,
    c.reviewer_id,
    c.quality_score,
    c.detection_class,
    c.created_at
FROM public.captures c;

COMMENT ON VIEW public.captures_masked IS 'GPS-privacy-masked captures view for non-ADMIN/BIO users.';
