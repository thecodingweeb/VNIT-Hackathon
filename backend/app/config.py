"""
TigerWatch Backend — Application Settings

Loads configuration from environment variables / .env file.
Uses pydantic-settings for validation and type coercion.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All application configuration, loaded from .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Supabase ---
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # --- Upstash Redis ---
    upstash_redis_url: str = ""
    upstash_redis_token: str = ""

    # --- JWT ---
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # --- CORS ---
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8000"

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # --- App ---
    app_name: str = "TigerWatch API"
    app_version: str = "1.0.0"
    debug: bool = True
    log_level: str = "info"

    # --- Storage Buckets ---
    bucket_raw_images: str = "raw-images"
    bucket_thumbnails: str = "thumbnails"
    bucket_crops: str = "crops"
    bucket_quarantine: str = "quarantine"
    bucket_models: str = "models"
    bucket_exports: str = "exports"

    # --- Rate Limiting ---
    rate_limit_authenticated: int = 100     # req/min
    rate_limit_unauthenticated: int = 20    # req/min
    rate_limit_heavy: int = 5               # req/min
    lockout_attempts: int = 5               # failed logins
    lockout_window_minutes: int = 15
    lockout_duration_minutes: int = 30


@lru_cache()
def get_settings() -> Settings:
    """Cached singleton for app settings."""
    return Settings()
