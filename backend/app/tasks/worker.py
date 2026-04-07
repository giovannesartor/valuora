"""
ARQ worker — async job queue backed by Redis.
Handles background tasks: webhook delivery, email sending, cleanup.

Start worker: arq app.tasks.worker.WorkerSettings
"""
import logging
from arq import cron
from arq.connections import RedisSettings

from app.core.config import settings

logger = logging.getLogger(__name__)


async def deliver_partner_webhook(ctx, partner_id: str, event_type: str, payload: dict):
    """Deliver a webhook to a partner's registered URLs."""
    from app.services.webhook_service import deliver_webhook
    await deliver_webhook(partner_id, event_type, payload)


async def deliver_oauth_webhook(ctx, app_id: str, event_type: str, payload: dict):
    """Deliver a webhook to an OAuth app's registered URLs."""
    from app.services.api_webhook_service import deliver_oauth_webhook as _deliver
    await _deliver(app_id, event_type, payload)


async def send_email_task(ctx, template: str, to: str, subject: str, context: dict):
    """Send an email using the template engine."""
    from app.services.email_service import send_templated_email
    await send_templated_email(template, to, subject, context)


async def cleanup_old_deliveries(ctx):
    """Purge webhook delivery logs older than 30 days (partner + OAuth)."""
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import delete
    from app.core.database import async_session_maker
    from app.models.models import PartnerWebhookDelivery, OAuthWebhookDelivery

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    async with async_session_maker() as db:
        await db.execute(
            delete(PartnerWebhookDelivery).where(PartnerWebhookDelivery.created_at < cutoff)
        )
        await db.execute(
            delete(OAuthWebhookDelivery).where(OAuthWebhookDelivery.created_at < cutoff)
        )
        await db.commit()
    logger.info("[ARQ] Cleaned up old webhook deliveries")


async def startup(ctx):
    """ARQ worker startup hook."""
    logger.info("[ARQ] Worker starting up")


async def shutdown(ctx):
    """ARQ worker shutdown hook."""
    logger.info("[ARQ] Worker shutting down")


def _parse_redis_url():
    """Parse the Redis URL into ARQ RedisSettings."""
    import urllib.parse
    url = settings.REDIS_URL or "redis://localhost:6379"
    parsed = urllib.parse.urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
        database=int(parsed.path.lstrip("/") or 0) if parsed.path else 0,
        ssl=parsed.scheme == "rediss",
    )


class WorkerSettings:
    """ARQ worker configuration.

    Usage: arq app.tasks.worker.WorkerSettings
    """
    functions = [
        deliver_partner_webhook,
        deliver_oauth_webhook,
        send_email_task,
    ]
    cron_jobs = [
        cron(cleanup_old_deliveries, hour=3, minute=0),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = _parse_redis_url()
    max_jobs = 20
    job_timeout = 60
    poll_delay = 0.5
