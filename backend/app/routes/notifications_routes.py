"""
Notifications endpoint — derives user notifications from analyses and
payments without a dedicated table. Returns at most 20 items, newest first.
Includes SSE streaming for real-time toast notifications.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import redis_client
from app.models.models import User, Analysis, Payment, AnalysisStatus, PaymentStatus, NotificationRead, PitchDeck, PitchDeckStatus
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ─── SSE helpers ───────────────────────────────────────────────
NOTIFICATION_CHANNEL = "valuora:notifications"


async def publish_notification(user_id: str, event_type: str, title: str, text: str, extra: dict | None = None):
    """Publish a notification event via Redis pub/sub for real-time SSE delivery."""
    payload = {
        "user_id": str(user_id),
        "type": event_type,
        "title": title,
        "text": text,
        **(extra or {}),
    }
    try:
        await redis_client.publish(NOTIFICATION_CHANNEL, json.dumps(payload))
    except Exception:
        logger.warning("Failed to publish notification event", exc_info=True)


async def _sse_generator(user_id: str):
    """Async generator that yields SSE events for a specific user."""
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(NOTIFICATION_CHANNEL)
    try:
        # Send a heartbeat so the client knows the connection is live
        yield "event: connected\ndata: {}\n\n"
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if msg and msg["type"] == "message":
                try:
                    data = json.loads(msg["data"])
                    # Only forward events for this specific user
                    if data.get("user_id") == user_id:
                        yield f"event: notification\ndata: {json.dumps(data)}\n\n"
                except (json.JSONDecodeError, KeyError):
                    pass
            else:
                # Heartbeat every ~15 seconds to keep connection alive
                yield ": heartbeat\n\n"
                await asyncio.sleep(15)
    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.unsubscribe(NOTIFICATION_CHANNEL)
        await pubsub.close()


@router.get("/stream")
async def notification_stream(
    token: str = Query(..., description="Bearer token for authentication"),
    db: AsyncSession = Depends(get_db),
):
    """SSE endpoint for real-time notifications. Pass auth token as query param."""
    from app.core.security import decode_token
    payload = decode_token(token)
    if not payload:
        from fastapi import HTTPException
        raise HTTPException(401, "Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        from fastapi import HTTPException
        raise HTTPException(401, "Invalid token")

    return StreamingResponse(
        _sse_generator(str(user_id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _ago(dt: datetime) -> str:
    """Human-readable relative time string (EN)."""
    if dt is None:
        return ""
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = int((now - dt).total_seconds())
    if diff < 60:
        return "just now"
    if diff < 3600:
        return f"{diff // 60}m ago"
    if diff < 86400:
        return f"{diff // 3600}h ago"
    if diff < 604800:
        return f"{diff // 86400}d ago"
    return dt.strftime("%Y-%m-%d")


@router.get("")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a derived list of real events:
      - analyses that completed recently  (AnalysisStatus.completed)
      - analyses still processing         (AnalysisStatus.processing)
      - successful (paid) payments        (PaymentStatus.paid / received)
      - pending payments                  (PaymentStatus.pending)
    Merges server-side read state from notification_reads table.
    """
    # --- Analyses ---
    result = await db.execute(
        select(Analysis)
        .where(
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
        )
        .order_by(Analysis.updated_at.desc())
        .limit(30)
    )
    analyses = result.scalars().all()

    # --- Payments ---
    pay_result = await db.execute(
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .limit(20)
    )
    payments = pay_result.scalars().all()

    # --- Pitch Decks ---
    pitch_result = await db.execute(
        select(PitchDeck)
        .where(PitchDeck.user_id == current_user.id)
        .order_by(PitchDeck.updated_at.desc())
        .limit(10)
    )
    pitch_decks = pitch_result.scalars().all()

    # --- Read keys ---
    read_result = await db.execute(
        select(NotificationRead.notification_key)
        .where(NotificationRead.user_id == current_user.id)
    )
    read_keys = set(read_result.scalars().all())

    events: list[dict] = []

    for a in analyses:
        if a.status == AnalysisStatus.COMPLETED:
            key = f"analysis-done-{a.id}"
            events.append({
                "id": key,
                "type": "analysis_completed",
                "title": "Analysis completed",
                "text": f"The valuation of {a.company_name} has been completed successfully.",
                "timestamp": (a.updated_at or a.created_at).isoformat(),
                "time": _ago(a.updated_at or a.created_at),
                "analysis_id": str(a.id),
                "unread": key not in read_keys,
            })
        elif a.status == AnalysisStatus.PROCESSING:
            key = f"analysis-proc-{a.id}"
            events.append({
                "id": key,
                "type": "analysis_processing",
                "title": "Analysis processing",
                "text": f"The valuation of {a.company_name} is being calculated.",
                "timestamp": (a.updated_at or a.created_at).isoformat(),
                "time": _ago(a.updated_at or a.created_at),
                "analysis_id": str(a.id),
                "unread": False,
            })

    for p in payments:
        status = p.status.value if p.status else ""
        if status in ("paid", "received", "CONFIRMED", "RECEIVED"):
            key = f"payment-ok-{p.id}"
            events.append({
                "id": key,
                "type": "payment_confirmed",
                "title": "Payment confirmed",
                "text": f"Your payment of $ {p.amount:.2f} has been confirmed. Report sent by email.",
                "timestamp": (p.paid_at or p.created_at).isoformat(),
                "time": _ago(p.paid_at or p.created_at),
                "analysis_id": str(p.analysis_id),
                "unread": key not in read_keys,
            })
        elif status == PaymentStatus.PENDING.value:
            key = f"payment-pending-{p.id}"
            events.append({
                "id": key,
                "type": "payment_pending",
                "title": "Payment pending",
                "text": f"Awaiting payment confirmation of $ {p.amount:.2f}.",
                "timestamp": p.created_at.isoformat(),
                "time": _ago(p.created_at),
                "analysis_id": str(p.analysis_id),
                "unread": False,
            })

    for pd in pitch_decks:
        if pd.status == PitchDeckStatus.COMPLETED:
            key = f"pitchdeck-done-{pd.id}"
            events.append({
                "id": key,
                "type": "pitchdeck_completed",
                "title": "📄 Pitch Deck ready!",
                "text": f"The Pitch Deck for {pd.company_name} has been generated successfully. Click to download.",
                "timestamp": (pd.updated_at or pd.created_at).isoformat(),
                "time": _ago(pd.updated_at or pd.created_at),
                "pitch_deck_id": str(pd.id),
                "unread": key not in read_keys,
            })
        elif pd.status == PitchDeckStatus.FAILED:
            key = f"pitchdeck-error-{pd.id}"
            events.append({
                "id": key,
                "type": "pitchdeck_error",
                "title": "Pitch Deck Error",
                "text": f"Could not generate the PDF for {pd.company_name}. Please try again.",
                "timestamp": (pd.updated_at or pd.created_at).isoformat(),
                "time": _ago(pd.updated_at or pd.created_at),
                "pitch_deck_id": str(pd.id),
                "unread": key not in read_keys,
            })

    # Sort by timestamp descending, return newest 20
    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return events[:20]


@router.patch("/{notification_key}/read")
async def mark_notification_read(
    notification_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a derived notification as read (persisted in notification_reads table)."""
    existing = (await db.execute(
        select(NotificationRead).where(
            NotificationRead.user_id == current_user.id,
            NotificationRead.notification_key == notification_key,
        )
    )).scalar_one_or_none()

    if not existing:
        nr = NotificationRead(
            user_id=current_user.id,
            notification_key=notification_key,
        )
        db.add(nr)
        await db.commit()
    return {"read": True, "notification_key": notification_key}


@router.post("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark ALL current notifications as read (derived from get_notifications)."""
    # Re-derive current notification keys
    analyses = (await db.execute(
        select(Analysis)
        .where(Analysis.user_id == current_user.id, Analysis.deleted_at.is_(None))
        .order_by(Analysis.updated_at.desc()).limit(30)
    )).scalars().all()
    payments = (await db.execute(
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc()).limit(20)
    )).scalars().all()
    pitch_decks = (await db.execute(
        select(PitchDeck)
        .where(PitchDeck.user_id == current_user.id)
        .order_by(PitchDeck.updated_at.desc()).limit(10)
    )).scalars().all()

    read_result = await db.execute(
        select(NotificationRead.notification_key)
        .where(NotificationRead.user_id == current_user.id)
    )
    existing_keys = set(read_result.scalars().all())

    new_keys = []
    for a in analyses:
        if a.status == AnalysisStatus.COMPLETED:
            new_keys.append(f"analysis-done-{a.id}")
    for p in payments:
        status = p.status.value if p.status else ""
        if status in (PaymentStatus.PAID.value, PaymentStatus.RECEIVED.value):
            new_keys.append(f"payment-ok-{p.id}")
    for pd in pitch_decks:
        if pd.status == PitchDeckStatus.COMPLETED:
            new_keys.append(f"pitchdeck-done-{pd.id}")
        elif pd.status == PitchDeckStatus.FAILED:
            new_keys.append(f"pitchdeck-error-{pd.id}")

    for key in new_keys:
        if key not in existing_keys:
            db.add(NotificationRead(user_id=current_user.id, notification_key=key))

    await db.commit()
    return {"read_count": len(new_keys)}
