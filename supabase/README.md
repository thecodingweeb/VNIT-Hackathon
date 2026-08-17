# TigerWatch Platform — Phase 1: Infrastructure & Database (Supabase)

## Overview

This directory contains the complete **Supabase infrastructure** for the TigerWatch Platform — replacing the original Docker Compose stack (PostgreSQL, MinIO, Redis, custom JWT) with Supabase's managed ecosystem.

## Architecture Mapping

| Original (Docker) | Supabase Replacement |
|---|---|
| PostgreSQL 16 container | **Supabase PostgreSQL** (managed) |
| PostGIS 3.4 extension | **Supabase PostGIS** (`CREATE EXTENSION postgis`) |
| pgvector 0.5+ extension | **Supabase pgvector** (`CREATE EXTENSION vector`) |
| Custom JWT + bcrypt auth | **Supabase Auth** (`auth.users` + `profiles` table) |
| Custom RBAC middleware | **PostgreSQL Row Level Security (RLS)** policies |
| MinIO S3 object storage | **Supabase Storage** (6 buckets) |
| Redis + WebSocket + LISTEN/NOTIFY | **Supabase Realtime** (postgres_changes) |
| Celery + Redis task queue | **Python ML Worker** with `supabase-py` SDK |
| Nginx reverse proxy | Supabase API Gateway (built-in) |
| Prometheus + Grafana | Supabase Dashboard metrics (or external) |

## Directory Structure

```
supabase/
├── config.toml                         # Supabase CLI local dev config
└── migrations/
    ├── 00001_extensions.sql            # Enable postgis, vector, uuid-ossp, pg_trgm
    ├── 00002_enums_and_types.sql       # Custom ENUM types (9 types)
    ├── 00003_profiles.sql              # Supabase Auth-linked profiles + auto-create trigger
    ├── 00004_core_tables.sql           # 6 core tables: individuals, stations, runs, captures, embeddings, alerts
    ├── 00005_supporting_tables.sql     # 5 supporting: overlap_pairs, audit_log, models, system_config, quarantine
    ├── 00006_indexes.sql               # 25+ indexes: B-Tree, Composite, Partial, BRIN, GiST, IVFFlat
    ├── 00007_rls_policies.sql          # Row Level Security for all 12 tables + GPS masking views
    ├── 00008_storage_buckets.sql       # 6 Supabase Storage buckets + access policies
    ├── 00009_realtime.sql              # Enable Realtime on alerts + processing_runs
    ├── 00010_functions.sql             # Helper functions: audit, stats, tiger_id gen, vector search
    └── 00011_seed.sql                  # Seed: system config, 10 sample stations, 4 AI models
```

## Setup Instructions

### Option A: Supabase Cloud

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Copy credentials** to `.env`:
   ```bash
   cp .env.example .env
   # Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   ```
3. **Run migrations** via Supabase SQL Editor:
   - Execute each migration file in order (00001 → 00011)
   - Or use the Supabase CLI:
     ```bash
     npx supabase db push
     ```
4. **Create the first admin user**:
   - Via Supabase Dashboard → Authentication → Users → "Add User"
   - Set `raw_user_meta_data`:
     ```json
     {
       "username": "admin",
       "full_name": "System Administrator",
       "role": "ADMIN"
     }
     ```

### Option B: Supabase CLI (Local Development)

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```
2. **Start local Supabase**:
   ```bash
   cd supabase
   supabase start
   ```
3. **Apply migrations**:
   ```bash
   supabase db reset   # Drops and re-creates with all migrations
   ```
4. **Access locally**:
   - API: `http://127.0.0.1:54321`
   - Studio: `http://127.0.0.1:54323`
   - Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## Database Schema Summary

| Table | Purpose | Key Columns |
|---|---|---|
| `profiles` | User profiles (linked to `auth.users`) | role, username, full_name |
| `individuals` | Tiger identity catalogue | tiger_id, baseline_range (GEOMETRY), centroid |
| `stations` | Camera trap station registry | station_code, location (GEOMETRY), zone |
| `processing_runs` | Pipeline execution records | status, total_images, blanks_removed |
| `captures` | Camera trap image records | individual_id FK, station_id FK, image_path |
| `embeddings` | 512-d stripe pattern vectors | vector(512), flank_side, is_reference |
| `alerts` | Behavioural deviation alerts | alert_type, confidence, evidence JSONB |
| `overlap_pairs` | Territorial overlap matrix | tiger_a_id, tiger_b_id, vi_index |
| `audit_log` | Immutable audit trail | action, before/after JSONB |
| `models` | AI model weight registry | model_name, weights_path, is_active |
| `system_config` | Runtime configuration KV | key, value JSONB |
| `quarantine` | Quarantined blank images | expires_at, restored |

## Storage Buckets

| Bucket | Access | Max Size | Purpose |
|---|---|---|---|
| `raw-images` | Private | 50 MB | Original camera trap captures |
| `thumbnails` | **Public** | 512 KB | 256×256 WebP previews |
| `crops` | Private | 10 MB | Tiger flank crops (448×448) |
| `quarantine` | Admin/Bio | 50 MB | Quarantined blank images |
| `models` | Admin only | 1 GB | AI model weights (.pt, .onnx) |
| `exports` | Private | 100 MB | GeoJSON, Shapefile, PDF reports |

## RLS Security Model

All tables have Row Level Security enabled. The 5-role permission matrix:

| Role | Dashboard | Catalogue | Upload | Review | Alerts | Map/GPS | Settings |
|---|---|---|---|---|---|---|---|
| **ADMIN** | ✅ | R/W | ✅ | ✅ | R/W | Full GPS | ✅ |
| **BIOLOGIST** | ✅ | R/W | ✅ | ✅ | R/W | Full GPS | Partial |
| **RANGE_OFFICER** | ✅ | Read | ✅ | — | R/W | ~111m | — |
| **FIELD_STAFF** | Limited | — | ✅ | — | View | — | — |
| **VIEWER** | ✅ | Read | — | — | View | ~111m | — |

## Integration with Phase 2 (Backend API)

The Phase 2 FastAPI backend connects to this Supabase infrastructure via:
- **`supabase-py`** SDK for auth, storage, and realtime
- **Direct PostgreSQL connection** (via `DATABASE_URL`) for heavy queries and ML pipeline operations
- **Service Role Key** for operations that bypass RLS (ML worker, system admin)

---

*TigerWatch Platform — Pench Tiger Reserve*
*Confidential — August 2026*
