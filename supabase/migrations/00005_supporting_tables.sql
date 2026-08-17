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
