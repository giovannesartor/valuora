"""
Email drip campaign service — automated email sequences triggered by user events.
Campaigns are defined in DRIP_CAMPAIGNS and scheduled via the analysis lifecycle.
Uses Redis sorted sets for scheduling with deduplication and TTL.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.core.redis import redis_client
from app.services.email_service import send_templated_email

logger = logging.getLogger(__name__)

# ─── Campaign definitions ─────────────────────────────────
DRIP_CAMPAIGNS = {
    "post_signup": {
        "description": "Welcome sequence after signup",
        "steps": [
            {"delay_hours": 24, "template": "drip_day1", "subject": "Tip: create your first analysis in 5 minutes"},
            {"delay_hours": 72, "template": "drip_day3", "subject": "Did you know? 87% of businesses are undervalued"},
            {"delay_hours": 168, "template": "drip_day7", "subject": "Special offer: 20% off your first valuation"},
        ],
    },
    "analysis_abandoned": {
        "description": "User started analysis but didn't complete payment",
        "steps": [
            {"delay_hours": 2, "template": "analysis_abandoned", "subject": "Your {{ company_name }} analysis is waiting"},
            {"delay_hours": 48, "template": "drip_abandoned_48h", "subject": "Last chance: {{ company_name }} results at a special price"},
        ],
    },
    "post_purchase": {
        "description": "After purchasing a report",
        "steps": [
            {"delay_hours": 48, "template": "drip_post_purchase", "subject": "How to interpret your valuation report"},
            {"delay_hours": 168, "template": "drip_upsell", "subject": "Want to go deeper? Check out the Fundraising plan"},
        ],
    },
}


async def enqueue_drip(
    campaign_id: str,
    user_email: str,
    user_name: str,
    context: dict = None,
) -> None:
    """Enqueue a drip campaign for a user.
    
    Uses Redis sorted sets with scores = send_at timestamp.
    Key: vl:drip:{campaign_id}:{user_email}
    """
    campaign = DRIP_CAMPAIGNS.get(campaign_id)
    if not campaign:
        logger.warning(f"[DRIP] Unknown campaign: {campaign_id}")
        return

    now = datetime.now(timezone.utc)
    ctx = {
        "name": user_name,
        "email": user_email,
        **(context or {}),
    }

    for i, step in enumerate(campaign["steps"]):
        send_at = now + timedelta(hours=step["delay_hours"])
        step_key = f"vl:drip:{campaign_id}:{user_email}:step{i}"

        try:
            already_sent = await redis_client.get(step_key)
            if already_sent:
                continue

            import json
            payload = json.dumps({
                "campaign_id": campaign_id,
                "step_index": i,
                "template": step["template"],
                "subject": step["subject"],
                "user_email": user_email,
                "context": ctx,
                "step_key": step_key,
            })
            await redis_client.zadd(
                "vl:drip:queue",
                {payload: send_at.timestamp()},
            )
            logger.info(f"[DRIP] Enqueued {campaign_id} step {i} for {user_email} at {send_at}")
        except Exception as e:
            logger.warning(f"[DRIP] Failed to enqueue: {e}")


async def process_drip_queue() -> int:
    """Process due drip emails. Call periodically (e.g., every 5 min via cron).
    
    Returns the number of emails sent.
    """
    import json
    now = datetime.now(timezone.utc).timestamp()
    sent_count = 0

    try:
        items = await redis_client.zrangebyscore("vl:drip:queue", "-inf", str(now), start=0, num=50)

        for item_bytes in items:
            item = json.loads(item_bytes)
            try:
                already = await redis_client.get(item["step_key"])
                if already:
                    await redis_client.zrem("vl:drip:queue", item_bytes)
                    continue

                await send_templated_email(
                    template=item["template"],
                    to=item["user_email"],
                    subject=item["subject"],
                    context=item["context"],
                )

                await redis_client.set(item["step_key"], "sent", ex=86400 * 90)  # 90 day TTL
                await redis_client.zrem("vl:drip:queue", item_bytes)
                sent_count += 1
                logger.info(f"[DRIP] Sent {item['campaign_id']} step {item['step_index']} to {item['user_email']}")

            except Exception as e:
                logger.warning(f"[DRIP] Failed to send drip email: {e}")

    except Exception as e:
        logger.error(f"[DRIP] Queue processing error: {e}")

    return sent_count


async def cancel_drip(campaign_id: str, user_email: str) -> None:
    """Cancel pending drip emails for a campaign+user (e.g., when they complete payment)."""
    import json
    try:
        items = await redis_client.zrangebyscore("vl:drip:queue", "-inf", "+inf")
        for item_bytes in items:
            item = json.loads(item_bytes)
            if item.get("campaign_id") == campaign_id and item.get("user_email") == user_email:
                await redis_client.zrem("vl:drip:queue", item_bytes)

        campaign = DRIP_CAMPAIGNS.get(campaign_id, {})
        for i in range(len(campaign.get("steps", []))):
            await redis_client.set(f"vl:drip:{campaign_id}:{user_email}:step{i}", "cancelled", ex=86400 * 90)

        logger.info(f"[DRIP] Cancelled {campaign_id} for {user_email}")
    except Exception as e:
        logger.warning(f"[DRIP] Cancel failed: {e}")
