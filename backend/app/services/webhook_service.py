"""
Partner Webhook delivery service — sends HTTP POST to partner-registered URLs
when events occur (analysis completed, payment confirmed, etc.).
Signs payloads with HMAC-SHA256 using the partner's webhook secret.
"""
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.models import PartnerWebhook, PartnerWebhookDelivery

logger = logging.getLogger(__name__)

DELIVERY_TIMEOUT = 10  # seconds


def _sign_payload(secret: str, payload_bytes: bytes) -> str:
    """Create an HMAC-SHA256 hex digest for the payload."""
    return hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()


async def deliver_webhook(
    partner_id: str,
    event_type: str,
    payload: dict,
) -> None:
    """Find all active webhooks for a partner subscribed to event_type, and POST."""
    try:
        async with async_session_maker() as db:
            result = await db.execute(
                select(PartnerWebhook).where(
                    PartnerWebhook.partner_id == partner_id,
                    PartnerWebhook.is_active.is_(True),
                )
            )
            webhooks = result.scalars().all()

            for wh in webhooks:
                if event_type not in (wh.events or []):
                    continue

                body = json.dumps({
                    "event": event_type,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data": payload,
                }, default=str)
                body_bytes = body.encode()
                signature = _sign_payload(wh.secret, body_bytes)

                delivery = PartnerWebhookDelivery(
                    webhook_id=wh.id,
                    event_type=event_type,
                    payload=payload,
                )

                try:
                    async with httpx.AsyncClient(timeout=DELIVERY_TIMEOUT) as client:
                        resp = await client.post(
                            wh.url,
                            content=body_bytes,
                            headers={
                                "Content-Type": "application/json",
                                "X-Valuora-Signature": f"sha256={signature}",
                                "X-Valuora-Event": event_type,
                            },
                        )
                    delivery.status_code = resp.status_code
                    delivery.response_body = resp.text[:1000]
                    delivery.success = 200 <= resp.status_code < 300
                except Exception as e:
                    delivery.status_code = 0
                    delivery.response_body = str(e)[:1000]
                    delivery.success = False
                    logger.warning(f"[WEBHOOK] Delivery failed for {wh.url}: {e}")

                db.add(delivery)
            await db.commit()
    except Exception as e:
        logger.error(f"[WEBHOOK] deliver_webhook error: {e}")
