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
