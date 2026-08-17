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
