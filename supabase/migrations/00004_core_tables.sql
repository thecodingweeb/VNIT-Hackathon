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
