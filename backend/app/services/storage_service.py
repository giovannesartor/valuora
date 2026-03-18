"""
storage_service.py — file storage abstraction.

If R2_* environment variables are configured, uploads to
Cloudflare R2 (S3-compatible). Otherwise, saves to local filesystem
(comportamento legado, quebra em Railway sem volume persistente).
"""
import logging
import uuid
from pathlib import Path as FilePath
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _r2_configured() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET_NAME
    )


def _get_s3_client():
    """Returns a boto3 client pointing to the R2 endpoint."""
    import boto3  # lazy import — only needed when R2 is configured
    endpoint = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


async def save_logo(content: bytes, analysis_id: uuid.UUID, ext: str) -> str:
    """
    Saves analysis logo and returns URL or relative path.

    - With R2 configured: uploads to bucket and returns public URL.
    - Without R2: saves to local disk and returns relative path `logos/<id>.<ext>`.
    """
    filename = f"{analysis_id}.{ext}"

    if _r2_configured():
        key = f"logos/{filename}"
        content_type_map = {
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "svg": "image/svg+xml",
            "webp": "image/webp",
        }
        content_type = content_type_map.get(ext, "image/png")
        try:
            client = _get_s3_client()
            import asyncio
            await asyncio.to_thread(
                client.put_object,
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=content,
                ContentType=content_type,
                CacheControl="public, max-age=31536000",
            )
            public_base = settings.R2_PUBLIC_URL.rstrip("/")
            url = f"{public_base}/{key}"
            logger.info(f"[storage] Logo uploaded to R2: {url}")
            return url
        except Exception as e:
            logger.error(f"[storage] R2 upload failed, falling back to local: {e}")
            # Fall through to local save

    # Local filesystem fallback
    logo_dir = FilePath(settings.UPLOADS_DIR) / "logos"
    logo_dir.mkdir(parents=True, exist_ok=True)
    filepath = logo_dir / filename
    with open(filepath, "wb") as f:
        f.write(content)
    logger.info(f"[storage] Logo saved locally: {filepath}")
    return f"logos/{filename}"


def get_logo_url(logo_path: Optional[str], base_url: str) -> Optional[str]:
    """
    Converts the `logo_path` field to an accessible URL.
    If already a full URL (R2), returns as-is.
    Otherwise, builds local URL from the base_url.
    """
    if not logo_path:
        return None
    if logo_path.startswith("http://") or logo_path.startswith("https://"):
        return logo_path  # R2 URL already absolute
    return f"{base_url.rstrip('/')}/uploads/{logo_path}"
