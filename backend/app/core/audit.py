"""
Audit Log — lightweight, Redis-backed audit trail for critical actions.
Falls back to an in-memory deque if Redis is unavailable.
Entries are capped at AUDIT_MAX_ENTRIES in the Redis list.
"""
import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from app.core.redis import redis_client

logger = logging.getLogger(__name__)

AUDIT_KEY = "qv:audit:log"
AUDIT_MAX_ENTRIES = 1000  # keep last 1 000 events

# In-memory fallback ring buffer
_fallback: deque = deque(maxlen=AUDIT_MAX_ENTRIES)


async def audit_log(
    action: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    resource_id: Optional[str] = None,
    detail: Optional[str] = None,
    ip: Optional[str] = None,
    ok: bool = True,
) -> None:
    """
    Append an audit event.

    Parameters
    ----------
    action      : Short action name, e.g. "user.login", "analysis.delete"
    user_id     : UUID string of the acting user (if authenticated)
    user_email  : E-mail of the acting user
    resource_id : ID of the affected resource (analysis, payment, etc.)
    detail      : Free-text extra context
    ip          : Client IP address
    ok          : Whether the action succeeded (False = failed attempt)
    """
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "user_id": user_id,
        "user_email": user_email,
        "resource_id": resource_id,
        "detail": detail,
        "ip": ip,
        "ok": ok,
    }
    serialized = json.dumps(entry, default=str)

    try:
        pipe = redis_client.pipeline()
        await pipe.lpush(AUDIT_KEY, serialized)
        await pipe.ltrim(AUDIT_KEY, 0, AUDIT_MAX_ENTRIES - 1)
        await pipe.execute()
    except Exception as e:
        logger.warning(f"[AUDIT] Redis unavailable, using fallback: {e}")
        _fallback.appendleft(entry)


async def get_audit_log(limit: int = 100, offset: int = 0) -> list[dict]:
    """Retrieve the most recent audit events (newest first)."""
    try:
        raw = await redis_client.lrange(AUDIT_KEY, offset, offset + limit - 1)
        return [json.loads(r) for r in raw]
    except Exception as e:
        logger.warning(f"[AUDIT] Redis read failed: {e}")
        items = list(_fallback)
        return items[offset: offset + limit]
