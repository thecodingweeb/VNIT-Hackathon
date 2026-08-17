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
