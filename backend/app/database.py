"""
TigerWatch Backend — Supabase Client

Provides a singleton async Supabase client used by all services and routers.
Two clients are exposed:
  • `get_supabase()`       — uses the anon key (respects RLS policies)
  • `get_supabase_admin()` — uses the service-role key (bypasses RLS)
"""

from supabase import create_client, Client

from app.config import get_settings

# ---------------------------------------------------------------------------
# Module-level singletons (created on first import)
# ---------------------------------------------------------------------------
_supabase_client: Client | None = None
_supabase_admin_client: Client | None = None


def get_supabase() -> Client:
    """Return the anon-key Supabase client (RLS-enforced)."""
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_anon_key,
        )
    return _supabase_client


def get_supabase_admin() -> Client:
    """Return the service-role Supabase client (bypasses RLS)."""
    global _supabase_admin_client
    if _supabase_admin_client is None:
        settings = get_settings()
        _supabase_admin_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _supabase_admin_client
