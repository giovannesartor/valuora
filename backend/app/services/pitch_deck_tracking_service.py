"""
Pitch Deck Invite Tracking Service

Responsibilities:
- Record funnel events (append-only) in pitch_deck_invite_events.
- Compute progress, dwell time and inactivity metrics for real-time tracking.
- IP hashing for GDPR-friendly tracking (no raw IP stored).
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Iterable, Optional
from uuid import UUID

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import (
    PitchDeckInvite,
    PitchDeckInviteEvent,
    PitchDeckInviteEventType,
    PitchDeckInviteStatus,
)

logger = logging.getLogger(__name__)


# Canonical funnel stage order
STAGE_ORDER = [
    "created",
    "email_sent",
    "opened",
    "draft_started",
    "draft_saved",
    "submitted",
    "reviewed",
    "converted",
]

# Weights for progress % (sum to 100)
STAGE_WEIGHTS = {
    "created": 5,
    "email_sent": 10,
    "opened": 20,
    "draft_started": 35,
    "draft_saved": 55,
    "submitted": 80,
    "reviewed": 95,
    "converted": 100,
}

# Status → minimum stage reached (for old invites without events)
STATUS_TO_STAGE = {
    PitchDeckInviteStatus.PENDING: "created",
    PitchDeckInviteStatus.SUBMITTED: "submitted",
    PitchDeckInviteStatus.IN_REVIEW: "reviewed",
    PitchDeckInviteStatus.CONVERTED: "converted",
    PitchDeckInviteStatus.REJECTED: "rejected",
    PitchDeckInviteStatus.EXPIRED: "expired",
}


def _hash_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None
    salt = (settings.APP_SECRET_KEY or "valuora").encode("utf-8")
    return hashlib.sha256(salt + ip.encode("utf-8")).hexdigest()[:32]


def _extract_request_meta(request: Optional[Request]) -> tuple[Optional[str], Optional[str]]:
    if request is None:
        return None, None
    ip = None
    try:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            ip = fwd.split(",")[0].strip()
        elif request.client:
            ip = request.client.host
    except Exception:
        ip = None
    ua = (request.headers.get("user-agent") or "")[:255] or None
    return _hash_ip(ip), ua


async def record_event(
    db: AsyncSession,
    invite_id: UUID,
    event_type: PitchDeckInviteEventType,
    payload: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
    actor_admin_id: Optional[UUID] = None,
    flush: bool = False,
) -> PitchDeckInviteEvent:
    """Append-only. Does not commit (caller controls the transaction)."""
    ip_hash, ua = _extract_request_meta(request)
    ev = PitchDeckInviteEvent(
        invite_id=invite_id,
        event_type=event_type,
        payload=payload,
        ip_hash=ip_hash,
        user_agent=ua,
        actor_admin_id=actor_admin_id,
    )
    db.add(ev)
    if flush:
        try:
            await db.flush()
        except Exception as exc:
            logger.warning(f"[tracking] flush event failed: {exc}")
    return ev


async def record_event_safe(
    db: AsyncSession,
    invite_id: UUID,
    event_type: PitchDeckInviteEventType,
    payload: Optional[dict[str, Any]] = None,
    request: Optional[Request] = None,
    actor_admin_id: Optional[UUID] = None,
) -> None:
    """Silent version: never breaks the main flow if tracking fails."""
    try:
        await record_event(db, invite_id, event_type, payload, request, actor_admin_id, flush=False)
    except Exception as exc:
        logger.warning(f"[tracking] record_event failed for {invite_id}/{event_type}: {exc}")


# ─── Progress calculation ─────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def compute_progress(
    invite: PitchDeckInvite,
    events: Optional[Iterable[PitchDeckInviteEvent]] = None,
) -> dict[str, Any]:
    """Computes current stage, %, last activity, dwell per stage, etc."""
    events_list = list(events) if events is not None else []
    events_list.sort(key=lambda e: _aware(e.created_at) or _now())

    stages_seen: dict[str, datetime] = {}
    for e in events_list:
        et = e.event_type.value if hasattr(e.event_type, "value") else str(e.event_type)
        if et in STAGE_WEIGHTS and et not in stages_seen:
            stages_seen[et] = _aware(e.created_at) or _now()

    # Fallback via invite timestamps (backward compat)
    fallback_map = {
        "created": _aware(invite.created_at),
        "email_sent": _aware(invite.last_email_sent_at),
        "opened": _aware(invite.opened_at),
        "draft_saved": _aware(invite.last_draft_saved_at),
        "submitted": _aware(invite.submitted_at),
        "reviewed": _aware(invite.reviewed_at),
        "converted": _aware(invite.converted_at),
    }
    for stage, ts in fallback_map.items():
        if ts and stage not in stages_seen:
            stages_seen[stage] = ts

    terminal: Optional[str] = None
    if invite.rejected_at:
        terminal = "rejected"
    elif invite.status == PitchDeckInviteStatus.EXPIRED:
        terminal = "expired"

    current_stage = "created"
    current_weight = 0
    for stage, weight in STAGE_WEIGHTS.items():
        if stage in stages_seen and weight >= current_weight:
            current_stage = stage
            current_weight = weight

    if terminal:
        current_stage = terminal

    progress_pct = STAGE_WEIGHTS.get(current_stage, current_weight)
    if terminal == "rejected":
        progress_pct = max(progress_pct, 100)

    # Dwell time per stage
    dwell: dict[str, float] = {}
    ordered = [(s, stages_seen[s]) for s in STAGE_ORDER if s in stages_seen]
    for i, (s, ts) in enumerate(ordered):
        if i + 1 < len(ordered):
            next_ts = ordered[i + 1][1]
            dwell[s] = max(0.0, (next_ts - ts).total_seconds())
        else:
            if not terminal and current_stage not in ("converted", "rejected", "expired"):
                dwell[s] = max(0.0, (_now() - ts).total_seconds())

    last_activity_ts = None
    if events_list:
        last_activity_ts = _aware(events_list[-1].created_at)
    candidates = [
        last_activity_ts,
        _aware(invite.updated_at),
        _aware(invite.last_draft_saved_at),
        _aware(invite.submitted_at),
        _aware(invite.opened_at),
    ]
    candidates = [c for c in candidates if c]
    last_activity_ts = max(candidates) if candidates else _aware(invite.created_at)

    created_ts = _aware(invite.created_at) or _now()
    total_seconds = max(0.0, ((last_activity_ts or _now()) - created_ts).total_seconds())
    inactive_seconds = max(0.0, (_now() - (last_activity_ts or created_ts)).total_seconds())

    return {
        "current_stage": current_stage,
        "is_terminal": terminal is not None or current_stage in ("converted", "rejected", "expired"),
        "progress_pct": int(progress_pct),
        "stages_reached": sorted(
            [{"stage": s, "at": ts.isoformat()} for s, ts in stages_seen.items()],
            key=lambda x: x["at"],
        ),
        "dwell_seconds": dwell,
        "last_activity_at": (last_activity_ts.isoformat() if last_activity_ts else None),
        "total_funnel_seconds": total_seconds,
        "inactive_seconds": inactive_seconds,
        "inactive_days": int(inactive_seconds // 86400),
    }


async def list_events(db: AsyncSession, invite_id: UUID) -> list[PitchDeckInviteEvent]:
    res = await db.execute(
        select(PitchDeckInviteEvent)
        .where(PitchDeckInviteEvent.invite_id == invite_id)
        .order_by(PitchDeckInviteEvent.created_at.asc())
    )
    return list(res.scalars().all())
