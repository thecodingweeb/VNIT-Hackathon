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
