"""
Storage Service — Supabase Storage wrapper.

Manages uploads, signed URLs, and deletions across all 6 buckets:
  raw-images, thumbnails, crops, quarantine, models, exports.
"""

from datetime import datetime, timezone
from typing import Optional

from app.config import get_settings
from app.database import get_supabase_admin


class StorageService:
    """Wraps Supabase Storage operations for all buckets."""

    def __init__(self):
        self.settings = get_settings()
        self._sb = get_supabase_admin()

    # ---------------------------------------------------------------------------
    # Upload
    # ---------------------------------------------------------------------------

    def upload_file(
        self,
        bucket: str,
        path: str,
        file_data: bytes,
        content_type: str = "image/jpeg",
    ) -> str:
        """Upload a file to a Supabase Storage bucket.

        Args:
            bucket: Bucket name (e.g. 'raw-images', 'crops').
            path: Object path within bucket (e.g. 'run_id/station_id/file.jpg').
            file_data: Raw bytes of the file.
            content_type: MIME type.

        Returns:
            The storage path of the uploaded file.
        """
        self._sb.storage.from_(bucket).upload(
            path=path,
            file=file_data,
            file_options={"content-type": content_type},
        )
        return f"{bucket}/{path}"

    # ---------------------------------------------------------------------------
    # Download / Signed URL
    # ---------------------------------------------------------------------------

    def get_signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = 3600,
    ) -> str:
        """Generate a time-limited signed URL for a stored object.

        Args:
            bucket: Bucket name.
            path: Object path within bucket.
            expires_in: URL validity in seconds (default 1 hour).

        Returns:
            Signed URL string.
        """
        result = self._sb.storage.from_(bucket).create_signed_url(
            path=path,
            expires_in=expires_in,
        )
        return result.get("signedURL", "")

    def get_public_url(self, bucket: str, path: str) -> str:
        """Get the public URL for a stored object (if bucket is public)."""
        result = self._sb.storage.from_(bucket).get_public_url(path)
        return result

    # ---------------------------------------------------------------------------
    # Delete
    # ---------------------------------------------------------------------------

    def delete_file(self, bucket: str, path: str) -> bool:
        """Delete a single file from storage."""
        try:
            self._sb.storage.from_(bucket).remove([path])
            return True
        except Exception:
            return False

    def delete_files(self, bucket: str, paths: list[str]) -> int:
        """Delete multiple files from storage. Returns count deleted."""
        try:
            self._sb.storage.from_(bucket).remove(paths)
            return len(paths)
        except Exception:
            return 0

    # ---------------------------------------------------------------------------
    # List
    # ---------------------------------------------------------------------------

    def list_files(
        self,
        bucket: str,
        prefix: str = "",
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        """List files in a bucket with optional prefix filter."""
        result = self._sb.storage.from_(bucket).list(
            path=prefix,
            options={"limit": limit, "offset": offset},
        )
        return result or []

    # ---------------------------------------------------------------------------
    # Bucket management
    # ---------------------------------------------------------------------------

    def ensure_buckets_exist(self) -> list[str]:
        """Create all required buckets if they don't exist.

        Called during app startup to ensure storage is ready.
        """
        buckets = [
            self.settings.bucket_raw_images,
            self.settings.bucket_thumbnails,
            self.settings.bucket_crops,
            self.settings.bucket_quarantine,
            self.settings.bucket_models,
            self.settings.bucket_exports,
        ]
        created = []
        for bucket_name in buckets:
            try:
                self._sb.storage.create_bucket(
                    bucket_name,
                    options={"public": False},
                )
                created.append(bucket_name)
            except Exception:
                # Bucket likely already exists
                pass
        return created


# Singleton
_storage_service: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    """Get the storage service singleton."""
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
