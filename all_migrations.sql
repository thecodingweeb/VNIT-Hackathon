-- =============================================================================
-- Migration 00001: Enable Required PostgreSQL Extensions
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Supabase natively supports these extensions. This migration activates them
-- for the project database.
-- =============================================================================

-- UUID generation (gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;

-- PostGIS 3.4 — Geospatial queries (ST_Within, ST_DWithin, ST_Intersects, KDE polygons)
CREATE EXTENSION IF NOT EXISTS "postgis" SCHEMA public;

-- pgvector 0.5+ — 512-dimensional stripe pattern embedding similarity search
CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA public;

-- pg_trgm — Trigram text search for tiger_id / station_code fuzzy matching
CREATE EXTENSION IF NOT EXISTS "pg_trgm" SCHEMA public;
-- =============================================================================
-- Migration 00002: Custom ENUM Types
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================

-- 5-role RBAC system (maps to Supabase Auth user_metadata.role)
CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'BIOLOGIST',
    'RANGE_OFFICER',
    'FIELD_STAFF',
    'VIEWER'
);

-- Processing pipeline stage status
CREATE TYPE public.run_status AS ENUM (
    'ingesting',
    'filtering',
    'detecting',
    'matching',
    'analyzing',
    'alerting',
    'completed',
    'failed',
    'cancelled'
);

-- Alert severity classification
CREATE TYPE public.alert_confidence AS ENUM (
    'HIGH',
    'MEDIUM',
    'LOW'
);

-- Alert lifecycle status
CREATE TYPE public.alert_status AS ENUM (
    'new',
    'acknowledged',
    'resolved',
    'false_positive'
);

-- Alert type classification (4 behavioural deviation types)
CREATE TYPE public.alert_type AS ENUM (
    'RANGE_SHIFT',
    'NOVEL_STATION',
    'BUFFER_APPROACH',
    'PROLONGED_ABSENCE'
);

-- Individual tiger status
CREATE TYPE public.individual_status AS ENUM (
    'active',
    'absent',
    'provisional',
    'deceased'
);

-- Station deployment status
CREATE TYPE public.deployment_status AS ENUM (
    'active',
    'inactive',
    'malfunction',
    'decommissioned'
);

-- Capture review status
CREATE TYPE public.review_status AS ENUM (
    'auto',
    'verified',
    'pending',
    'rejected'
);

-- Camera trap station zone classification
CREATE TYPE public.station_zone AS ENUM (
    'core',
    'buffer',
    'village_adjacent'
);

-- Flank side for stripe pattern matching
CREATE TYPE public.flank_side AS ENUM (
    'L',
    'R',
    'unknown'
);
-- =============================================================================
-- Migration 00003: User Profiles (Supabase Auth Integration)
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Replaces the custom `users` table with a `profiles` table that references
-- Supabase's `auth.users`. Authentication (password hashing, JWT issuance,
-- refresh tokens, rate limiting) is fully handled by Supabase Auth.
-- =============================================================================

CREATE TABLE public.profiles (
    -- Links to Supabase's auth.users(id) — CASCADE on user deletion
    id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    role          public.user_role NOT NULL DEFAULT 'VIEWER',
    is_active     BOOLEAN      DEFAULT true,
    last_login    TIMESTAMPTZ,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE public.profiles IS 'User profiles linked to Supabase Auth. Stores role and display metadata.';
COMMENT ON COLUMN public.profiles.role IS '5-role RBAC: ADMIN, BIOLOGIST, RANGE_OFFICER, FIELD_STAFF, VIEWER';

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-create profile on Supabase Auth signup
-- ─────────────────────────────────────────────────────────────────────────────
-- When a new user signs up via Supabase Auth, this trigger automatically
-- creates a corresponding profile row. The role can be passed via
-- raw_user_meta_data during signup (admin-only signup flow).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'username',
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            'TigerWatch User'
        ),
        COALESCE(
            (NEW.raw_user_meta_data ->> 'role')::public.user_role,
            'VIEWER'
        )
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Sync profile update timestamp
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
-- =============================================================================
-- Migration 00004: Core Domain Tables
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- 6 Core entities: individuals, stations, processing_runs, captures,
-- embeddings, alerts
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. individuals — Tiger Identity Catalogue
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.individuals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tiger_id         VARCHAR(20)  UNIQUE NOT NULL,          -- e.g., PTR-T-001
    assigned_name    VARCHAR(100),                           -- Optional staff-assigned name
    sex              VARCHAR(10)  DEFAULT 'unknown',         -- male / female / unknown
    first_captured   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_captured    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    total_captures   INTEGER      DEFAULT 0,
    status           public.individual_status DEFAULT 'active',
    baseline_range   GEOMETRY(POLYGON, 4326),                -- KDE 95% isopleth
    baseline_core    GEOMETRY(POLYGON, 4326),                -- KDE 50% isopleth
    centroid         GEOMETRY(POINT, 4326),                  -- Weighted activity centroid
    range_area_sqkm  FLOAT,
    station_profile  JSONB,                                  -- Historical station visitation
    metadata         JSONB,
    color_slot       INTEGER CHECK (color_slot >= 1 AND color_slot <= 20),
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE public.individuals IS 'Tiger identity catalogue. Each row = one uniquely identified individual.';
COMMENT ON COLUMN public.individuals.tiger_id IS 'Human-readable ID format: PTR-T-NNN';
COMMENT ON COLUMN public.individuals.baseline_range IS 'KDE 95% isopleth — established home range polygon';
COMMENT ON COLUMN public.individuals.baseline_core IS 'KDE 50% isopleth — core activity area polygon';
COMMENT ON COLUMN public.individuals.color_slot IS 'Persistent map color assignment (1-20 from UI design palette)';

CREATE TRIGGER individuals_updated_at
    BEFORE UPDATE ON public.individuals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. stations — Camera Trap Station Registry
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.stations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_code       VARCHAR(20)  UNIQUE NOT NULL,         -- e.g., ST-05
    station_name       VARCHAR(100),
    location           GEOMETRY(POINT, 4326) NOT NULL,
    zone               public.station_zone NOT NULL,         -- core / buffer / village_adjacent
    nearest_village    VARCHAR(100),
    village_dist_km    FLOAT,
    deployment_status  public.deployment_status DEFAULT 'active',
    last_maintenance   TIMESTAMPTZ,
    camera_serial      VARCHAR(50),
    metadata           JSONB,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.stations IS 'Camera trap station registry with GPS coordinates and zone classification.';
COMMENT ON COLUMN public.stations.zone IS 'Station zone: core, buffer, or village_adjacent';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. processing_runs — Pipeline Execution Records
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.processing_runs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status           public.run_status DEFAULT 'ingesting',
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ,
    source_dir       TEXT,
    total_images     INTEGER DEFAULT 0,
    blanks_removed   INTEGER DEFAULT 0,
    tigers_detected  INTEGER DEFAULT 0,
    auto_matched     INTEGER DEFAULT 0,
    review_queued    INTEGER DEFAULT 0,
    new_enrolled     INTEGER DEFAULT 0,
    alerts_generated INTEGER DEFAULT 0,
    storage_saved_mb FLOAT   DEFAULT 0,
    operator_id      UUID REFERENCES public.profiles(id),
    config           JSONB,                                  -- Run configuration (thresholds, options)
    error_log        TEXT,
    last_checkpoint  TEXT,                                    -- Last processed image ID for resumability
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.processing_runs IS 'Pipeline execution records. Each row = one complete processing run.';
COMMENT ON COLUMN public.processing_runs.status IS 'Pipeline stage: ingesting→filtering→detecting→matching→analyzing→alerting→completed/failed';
COMMENT ON COLUMN public.processing_runs.last_checkpoint IS 'Last processed image ID — enables run resumability after crash';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. captures — Camera Trap Image Records
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.captures (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id    UUID REFERENCES public.individuals(id) ON DELETE SET NULL,
    station_id       UUID NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
    run_id           UUID REFERENCES public.processing_runs(id) ON DELETE SET NULL,
    image_path       TEXT NOT NULL,                          -- Supabase Storage key (raw-images bucket)
    thumbnail_path   TEXT,                                   -- 256×256 WebP thumbnail
    crop_path        TEXT,                                   -- Tiger flank crop
    location         GEOMETRY(POINT, 4326) NOT NULL,
    captured_at      TIMESTAMPTZ NOT NULL,
    flank_side       public.flank_side,
    match_confidence FLOAT,                                  -- Cosine similarity (0.0–1.0)
    review_status    public.review_status DEFAULT 'auto',
    reviewer_id      UUID REFERENCES public.profiles(id),
    reviewed_at      TIMESTAMPTZ,
    quality_score    FLOAT,                                  -- Crop quality (blur, resolution, occlusion)
    detection_class  VARCHAR(20),                             -- animal / person / vehicle / tiger
    phash            BIGINT,                                 -- Perceptual hash for deduplication
    metadata         JSONB,                                  -- EXIF data, camera model, burst info
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.captures IS 'Camera trap image records. Each row = one captured image with its classification.';
COMMENT ON COLUMN public.captures.image_path IS 'Supabase Storage object key in raw-images bucket';
COMMENT ON COLUMN public.captures.phash IS '64-bit perceptual hash for deduplication (Hamming distance 0 = exact duplicate)';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. embeddings — Stripe Pattern Feature Vectors (pgvector)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id   UUID NOT NULL REFERENCES public.individuals(id) ON DELETE CASCADE,
    flank_side      public.flank_side NOT NULL,              -- L or R (same-side matching only)
    vector          vector(512) NOT NULL,                    -- 512-d L2-normalized stripe embedding
    source_image    TEXT NOT NULL,                           -- Source crop image path in Supabase Storage
    is_reference    BOOLEAN DEFAULT false,                   -- Primary reference embedding flag
    confidence      FLOAT,                                   -- Quality/confidence of this embedding
    model_version   VARCHAR(50),                             -- Model that generated this embedding
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.embeddings IS 'Tiger stripe pattern 512-d feature vectors for cosine similarity matching via pgvector.';
COMMENT ON COLUMN public.embeddings.vector IS '512-d L2-normalized DenseNet-169 Siamese CNN output';
COMMENT ON COLUMN public.embeddings.is_reference IS 'If true, this is the primary reference embedding for matching';


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. alerts — Behavioural Deviation Alerts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type          public.alert_type NOT NULL,
    individual_id       UUID REFERENCES public.individuals(id) ON DELETE CASCADE,
    run_id              UUID REFERENCES public.processing_runs(id) ON DELETE SET NULL,
    confidence          public.alert_confidence NOT NULL,
    status              public.alert_status DEFAULT 'new',
    title               TEXT NOT NULL,
    description         TEXT,
    evidence            JSONB NOT NULL,                      -- Images, locations, measurements, direction
    recommended_action  TEXT,
    assigned_to         UUID REFERENCES public.profiles(id),
    acknowledged_at     TIMESTAMPTZ,
    resolved_at         TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.alerts IS 'Behavioural deviation alerts: RANGE_SHIFT, NOVEL_STATION, BUFFER_APPROACH, PROLONGED_ABSENCE';
COMMENT ON COLUMN public.alerts.evidence IS 'JSONB containing trigger images, GPS coords, displacement measurements, bearing';
-- =============================================================================
-- Migration 00005: Supporting Tables
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- overlap_pairs, audit_log, models, system_config, quarantine
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. overlap_pairs — Territorial Overlap Matrix (N:M between individuals)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.overlap_pairs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tiger_a_id    UUID NOT NULL REFERENCES public.individuals(id) ON DELETE CASCADE,
    tiger_b_id    UUID NOT NULL REFERENCES public.individuals(id) ON DELETE CASCADE,
    vi_index      FLOAT,                                     -- Volume of Intersection (0–1)
    ba_index      FLOAT,                                     -- Bhattacharyya's Affinity (0–1)
    overlap_geom  GEOMETRY(POLYGON, 4326),                   -- Intersection polygon
    run_id        UUID REFERENCES public.processing_runs(id) ON DELETE SET NULL,
    computed_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_overlap_pair UNIQUE (tiger_a_id, tiger_b_id, run_id),
    CONSTRAINT different_tigers CHECK (tiger_a_id <> tiger_b_id)
);

COMMENT ON TABLE public.overlap_pairs IS 'Pairwise territorial overlap matrix between tiger home ranges.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. audit_log — Immutable Audit Trail (Append-Only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.audit_log (
    id             BIGSERIAL PRIMARY KEY,
    timestamp      TIMESTAMPTZ  DEFAULT NOW(),
    user_id        UUID REFERENCES public.profiles(id),
    user_role      public.user_role,
    action         VARCHAR(50)  NOT NULL,                    -- e.g., REVIEW_APPROVE, ALERT_ACK
    resource_type  VARCHAR(30),                              -- individual, capture, alert, station, etc.
    resource_id    UUID,
    before_value   JSONB,
    after_value    JSONB,
    ip_address     INET,
    request_hash   VARCHAR(64)                               -- SHA-256 of request body
);

COMMENT ON TABLE public.audit_log IS 'Immutable append-only audit trail. No UPDATE or DELETE permitted. 2-year retention.';

-- Enforce append-only policy via trigger
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only. UPDATE and DELETE operations are prohibited.';
    RETURN NULL;
END;
$$;

CREATE TRIGGER audit_log_immutable
    BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_modification();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. models — AI Model Registry
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.models (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name     VARCHAR(100) NOT NULL,                    -- e.g., megadetector_v6, tiger_yolov8l
    version        VARCHAR(50)  NOT NULL,
    weights_path   TEXT NOT NULL,                            -- Supabase Storage key in models bucket
    is_active      BOOLEAN DEFAULT false,
    input_size     INTEGER,                                  -- Expected input dimension (e.g., 1280, 448)
    output_dim     INTEGER,                                  -- Output dimension (e.g., 512 for embeddings)
    metrics        JSONB,                                    -- Training/validation metrics
    description    TEXT,
    uploaded_by    UUID REFERENCES public.profiles(id),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_model_version UNIQUE (model_name, version)
);

COMMENT ON TABLE public.models IS 'AI model weight registry. Tracks MegaDetector, YOLOv8-L, and Siamese CNN versions.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. system_config — Runtime Configuration Key-Value Store
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.system_config (
    key          VARCHAR(100) PRIMARY KEY,
    value        JSONB NOT NULL,
    description  TEXT,
    updated_by   UUID REFERENCES public.profiles(id),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.system_config IS 'Runtime configuration KV store. Alert thresholds, ML parameters, system settings.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. quarantine — Quarantined Blank Images
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.quarantine (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_path     TEXT NOT NULL,                            -- Original Supabase Storage key
    quarantine_path TEXT NOT NULL,                           -- Key in quarantine bucket
    confidence     FLOAT NOT NULL,                           -- MegaDetector blank confidence
    run_id         UUID REFERENCES public.processing_runs(id) ON DELETE SET NULL,
    station_id     UUID REFERENCES public.stations(id),
    original_metadata JSONB,                                 -- Preserved EXIF and capture data
    expires_at     TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    restored       BOOLEAN DEFAULT false,
    restored_at    TIMESTAMPTZ,
    restored_by    UUID REFERENCES public.profiles(id),
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.quarantine IS 'Quarantined blank images. Auto-expires after 30 days unless restored.';
COMMENT ON COLUMN public.quarantine.expires_at IS 'Default 30-day auto-expiry. Configurable via system_config.';
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
-- =============================================================================
-- Migration 00008: Supabase Storage Buckets & Access Policies
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Replaces MinIO S3-compatible object storage with Supabase Storage.
-- 6 dedicated buckets with granular RLS-based access policies.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- CREATE STORAGE BUCKETS
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. raw-images — Full-resolution original camera trap captures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'raw-images',
    'raw-images',
    false,
    52428800,  -- 50 MB per file
    ARRAY['image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp']
);

-- 2. thumbnails — 256x256 WebP quick-loading thumbnails (public for caching)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'thumbnails',
    'thumbnails',
    true,      -- Public access for fast CDN caching
    524288,    -- 512 KB per file
    ARRAY['image/webp', 'image/jpeg']
);

-- 3. crops — Tiger flank bounding-box crops (448x448)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'crops',
    'crops',
    false,
    10485760,  -- 10 MB per file
    ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- 4. quarantine — Quarantined blank/empty images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'quarantine',
    'quarantine',
    false,
    52428800,  -- 50 MB per file
    ARRAY['image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/webp']
);

-- 5. models — AI model weight files (.pt, .onnx, .pth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'models',
    'models',
    false,
    1073741824,  -- 1 GB per file (large model weights)
    NULL         -- Allow any mime type for model weights
);

-- 6. exports — Generated reports (GeoJSON, Shapefile, PDF)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'exports',
    'exports',
    false,
    104857600,  -- 100 MB per file
    NULL        -- Allow any mime type for exports
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE ACCESS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────

-- ===== RAW-IMAGES =====

-- Authenticated users can view raw images
CREATE POLICY "raw_images_select_authenticated"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'raw-images');

-- ADMIN, BIOLOGIST, RANGE_OFFICER, FIELD_STAFF can upload raw images
CREATE POLICY "raw_images_insert_operators"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'raw-images'
        AND public.has_role(ARRAY['ADMIN', 'BIOLOGIST', 'RANGE_OFFICER', 'FIELD_STAFF']::public.user_role[])
    );

-- Only ADMIN can delete raw images
CREATE POLICY "raw_images_delete_admin"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'raw-images'
        AND public.has_role(ARRAY['ADMIN']::public.user_role[])
    );


-- ===== THUMBNAILS (Public bucket — no auth policies needed for SELECT) =====

-- Service role handles thumbnail generation (no user-facing upload)
CREATE POLICY "thumbnails_insert_service"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'thumbnails'
        AND public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[])
    );


-- ===== CROPS =====

-- Authenticated users can view crops (needed for identification UI)
CREATE POLICY "crops_select_authenticated"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'crops');

-- Service role / ADMIN / BIOLOGIST can upload crops (ML pipeline output)
CREATE POLICY "crops_insert_admin_bio"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'crops'
        AND public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[])
    );


-- ===== QUARANTINE =====

-- Only ADMIN and BIOLOGIST can access quarantined images
CREATE POLICY "quarantine_select_admin_bio"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'quarantine'
        AND public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[])
    );

CREATE POLICY "quarantine_insert_admin_bio"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'quarantine'
        AND public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[])
    );

CREATE POLICY "quarantine_delete_admin"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'quarantine'
        AND public.has_role(ARRAY['ADMIN']::public.user_role[])
    );


-- ===== MODELS =====

-- All authenticated can download model weights (for ML worker)
CREATE POLICY "models_select_authenticated"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'models');

-- Only ADMIN can upload/delete model weights
CREATE POLICY "models_insert_admin"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'models'
        AND public.has_role(ARRAY['ADMIN']::public.user_role[])
    );

CREATE POLICY "models_delete_admin"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'models'
        AND public.has_role(ARRAY['ADMIN']::public.user_role[])
    );


-- ===== EXPORTS =====

-- Authenticated users can download exports
CREATE POLICY "exports_select_authenticated"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'exports');

-- ADMIN and BIOLOGIST can create exports
CREATE POLICY "exports_insert_admin_bio"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'exports'
        AND public.has_role(ARRAY['ADMIN', 'BIOLOGIST']::public.user_role[])
    );

-- Exports auto-cleanup (7-day expiry handled by application layer)
CREATE POLICY "exports_delete_admin"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'exports'
        AND public.has_role(ARRAY['ADMIN']::public.user_role[])
    );
-- =============================================================================
-- Migration 00009: Supabase Realtime Configuration
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Replaces Redis LISTEN/NOTIFY + custom WebSocket handlers with
-- Supabase Realtime postgres_changes subscriptions.
--
-- Enabled on:
--   1. alerts — Real-time alert feed on the dashboard
--   2. processing_runs — Live run progress updates
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable Realtime on specific tables
-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Realtime listens to the `supabase_realtime` publication.
-- We add only the tables that need real-time push to the frontend.

ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.processing_runs;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: Realtime subscription happens on the client side via supabase-js:
-- ─────────────────────────────────────────────────────────────────────────────
--
-- // Subscribe to new alerts (INSERT events)
-- supabase
--   .channel('realtime-alerts')
--   .on('postgres_changes', {
--     event: 'INSERT',
--     schema: 'public',
--     table: 'alerts'
--   }, (payload) => handleNewAlert(payload.new))
--   .subscribe();
--
-- // Subscribe to run progress updates (UPDATE events)
-- supabase
--   .channel('run-progress')
--   .on('postgres_changes', {
--     event: 'UPDATE',
--     schema: 'public',
--     table: 'processing_runs',
--     filter: `id=eq.${runId}`
--   }, (payload) => handleRunProgress(payload.new))
--   .subscribe();
--
-- ─────────────────────────────────────────────────────────────────────────────
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
-- =============================================================================
-- Migration 00011: Seed Data
-- TigerWatch Platform — Pench Tiger Reserve
-- =============================================================================
-- Initial seed data for:
--   1. System configuration defaults (alert thresholds, ML parameters)
--   2. Sample camera trap stations (Pench Tiger Reserve)
--   3. Default AI model registry entries
-- =============================================================================
-- NOTE: Default admin user is created via Supabase Auth signup with
--       raw_user_meta_data: { "role": "ADMIN", "username": "admin", "full_name": "System Admin" }
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. System Configuration Defaults
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.system_config (key, value, description) VALUES

-- Blank filtering thresholds
('filtering.md_confidence_threshold', '0.15',
 'MegaDetector V6 confidence threshold for blank classification. Images with max detection conf below this are quarantined.'),

('filtering.burst_logic_enabled', 'true',
 'Enable burst-mode logic: if any image in a 3-second burst has detection, retain all images in the burst.'),

('filtering.burst_window_seconds', '3',
 'Time window (seconds) for grouping images into bursts from the same station.'),

-- Tiger detection thresholds
('detection.tiger_confidence', '0.4',
 'YOLOv8-L minimum confidence for tiger detection.'),

('detection.crop_padding_percent', '15',
 'Percentage padding added to bounding box before cropping for flank extraction.'),

('detection.crop_size', '448',
 'Target crop dimension (pixels) for tiger flank crops.'),

-- Identity matching thresholds
('matching.auto_threshold', '0.85',
 'Cosine similarity >= this → AUTO_MATCH. Automatically assigned to individual.'),

('matching.review_threshold', '0.60',
 'Cosine similarity between review_threshold and auto_threshold → REVIEW_QUEUE.'),

('matching.reference_update_weight', '0.10',
 'Weight for exponential moving average update of reference embeddings on auto-match.'),

-- Alert rule thresholds
('alerts.range_shift_core_sqkm', '15',
 'Core area shift threshold (sq km) to trigger RANGE_SHIFT alert.'),

('alerts.range_shift_buffer_km', '5',
 'Buffer zone linear displacement (km) to trigger RANGE_SHIFT alert.'),

('alerts.novel_station_high_km', '5',
 'Distance from range (km) for HIGH confidence NOVEL_STATION alert.'),

('alerts.novel_station_med_km', '2',
 'Distance from range (km) for MEDIUM confidence NOVEL_STATION alert.'),

('alerts.prolonged_absence_escalation', '{"1": "LOW", "2": "MEDIUM", "3": "HIGH"}',
 'Escalation ladder for PROLONGED_ABSENCE: miss count → confidence level.'),

-- Quarantine settings
('quarantine.auto_expiry_days', '30',
 'Days before quarantined images are eligible for permanent deletion.'),

-- KDE computation parameters
('occupancy.kde_bandwidth', '"auto"',
 'KDE bandwidth selection method: "auto" (Silverman rule), or numeric value.'),

('occupancy.kde_grid_resolution', '200',
 'Grid resolution for KDE computation.'),

('occupancy.mcp_percentile', '95',
 'Minimum Convex Polygon percentile for home range estimation.'),

-- System settings
('system.timezone_display', '"Asia/Kolkata"',
 'Display timezone for the UI (all data stored in UTC).'),

('system.thumbnail_size', '256',
 'Thumbnail dimension (pixels) for quick-loading previews.'),

('system.max_upload_size_mb', '10240',
 'Maximum ZIP archive upload size in MB (10 GB default).'),

('system.pench_reserve_boundary', '"pending"',
 'GeoJSON polygon of Pench Tiger Reserve boundary. To be loaded from official NTCA shapefile.')

ON CONFLICT (key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Sample Camera Trap Stations (Pench Tiger Reserve — Madhya Pradesh Core)
-- ─────────────────────────────────────────────────────────────────────────────
-- These are representative sample stations. Real coordinates should be loaded
-- from the official PTR station registry.

INSERT INTO public.stations (station_code, station_name, location, zone, nearest_village, village_dist_km) VALUES
('ST-01', 'Alikatta Nallah',     ST_SetSRID(ST_MakePoint(79.2340, 21.7120), 4326), 'core',             'Turia',         8.2),
('ST-02', 'Bodhanala',           ST_SetSRID(ST_MakePoint(79.2510, 21.7250), 4326), 'core',             'Turia',         6.5),
('ST-03', 'Chindimatta',         ST_SetSRID(ST_MakePoint(79.2680, 21.7380), 4326), 'core',             'Khawasa',       7.1),
('ST-04', 'Dudhgaon Nallah',     ST_SetSRID(ST_MakePoint(79.2150, 21.6950), 4326), 'core',             'Rukhad',        9.0),
('ST-05', 'Raiyakasa',           ST_SetSRID(ST_MakePoint(79.1980, 21.6800), 4326), 'core',             'Rukhad',       10.3),
('ST-06', 'Jamtara Range Post',  ST_SetSRID(ST_MakePoint(79.2850, 21.7500), 4326), 'buffer',           'Jamtara',       2.1),
('ST-07', 'Kurai Village Edge',  ST_SetSRID(ST_MakePoint(79.3020, 21.7620), 4326), 'village_adjacent', 'Kurai',         0.8),
('ST-08', 'Sitaghat Crossing',   ST_SetSRID(ST_MakePoint(79.2200, 21.7050), 4326), 'core',             'Khawasa',       5.4),
('ST-09', 'Wolf Plateau North',  ST_SetSRID(ST_MakePoint(79.2450, 21.7400), 4326), 'core',             'Turia',         7.8),
('ST-10', 'Kolitmara Buffer',    ST_SetSRID(ST_MakePoint(79.3180, 21.7700), 4326), 'buffer',           'Kolitmara',     1.5)

ON CONFLICT (station_code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Default AI Model Registry Entries
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.models (model_name, version, weights_path, is_active, input_size, output_dim, description) VALUES
('megadetector_v6',     'v6.0',     'models/megadetector_v6.pt',     true,  1280, NULL, 'MegaDetector V6 (YOLOv9-C) — Camera trap blank image filtering. Recall >95%.'),
('tiger_yolov8l',       'v1.0',     'models/tiger_yolov8l.pt',       true,  640,  NULL, 'Fine-tuned YOLOv8-L for tiger-specific detection. Min confidence: 0.4.'),
('siamese_densenet169', 'v1.0',     'models/siamese_densenet169.pt', true,  448,  512,  'Siamese CNN (DenseNet-169 backbone) — 512-d stripe pattern embedding extraction. Rank-1 >90%.'),
('flank_classifier',    'v1.0',     'models/flank_classifier.pt',    false, 224,  2,    'Left/Right flank side classifier. Binary output.')

ON CONFLICT (model_name, version) DO NOTHING;
