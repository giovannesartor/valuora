"""
OAuth App webhook management endpoints.
Allows OAuth app owners to register webhooks for API events.
Events: valuation.completed, valuation.paid, valuation.created, pitch_deck.ready, pitch_deck.created
"""
import secrets
import uuid as _uuid
from typing import Optional, List

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import User, OAuthApp, OAuthWebhook, OAuthWebhookDelivery
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/oauth/webhooks", tags=["OAuth Webhooks"])

VALID_EVENTS = {
    "valuation.created",
    "valuation.completed",
    "valuation.paid",
    "pitch_deck.created",
    "pitch_deck.ready",
}


class WebhookCreateRequest(BaseModel):
    app_id: _uuid.UUID
    url: str = Field(..., min_length=10, max_length=500)
    events: List[str] = Field(default=["valuation.completed", "pitch_deck.ready"])


class WebhookUpdateRequest(BaseModel):
    url: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None


async def _get_user_app(db: AsyncSession, user: User, app_id: _uuid.UUID) -> OAuthApp:
    result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == app_id, OAuthApp.user_id == user.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(404, "Application not found.")
    return app


@router.get("")
async def list_webhooks(
    app_id: _uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all webhooks for an OAuth app."""
    app = await _get_user_app(db, current_user, app_id)
    result = await db.execute(
        select(OAuthWebhook)
        .where(OAuthWebhook.app_id == app.id)
        .order_by(OAuthWebhook.created_at.desc())
    )
    webhooks = result.scalars().all()
    return [
        {
            "id": str(wh.id),
            "app_id": str(wh.app_id),
            "url": wh.url,
            "events": wh.events,
            "is_active": wh.is_active,
            "secret_preview": wh.secret[:8] + "..." if wh.secret else None,
            "created_at": wh.created_at.isoformat() if wh.created_at else None,
        }
        for wh in webhooks
    ]


@router.post("", status_code=201)
async def create_webhook(
    body: WebhookCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new webhook for an OAuth app. Max 10 per app."""
    app = await _get_user_app(db, current_user, body.app_id)

    for evt in body.events:
        if evt not in VALID_EVENTS:
            raise HTTPException(400, f"Invalid event: {evt}. Valid: {', '.join(sorted(VALID_EVENTS))}")

    count_result = await db.execute(
        select(func.count(OAuthWebhook.id)).where(OAuthWebhook.app_id == app.id)
    )
    if (count_result.scalar() or 0) >= 10:
        raise HTTPException(400, "Maximum 10 webhooks per application.")

    secret = secrets.token_hex(32)
    wh = OAuthWebhook(
        app_id=app.id,
        url=body.url,
        secret=secret,
        events=body.events,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)

    return {
        "id": str(wh.id),
        "app_id": str(wh.app_id),
        "url": wh.url,
        "events": wh.events,
        "secret": secret,
        "is_active": True,
        "message": "Webhook created. Save the secret — it will not be shown again.",
    }


@router.patch("/{webhook_id}")
async def update_webhook(
    webhook_id: _uuid.UUID,
    body: WebhookUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update webhook URL, events, or active status."""
    result = await db.execute(select(OAuthWebhook).where(OAuthWebhook.id == webhook_id))
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(404, "Webhook not found.")

    app_result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == wh.app_id, OAuthApp.user_id == current_user.id)
    )
    if not app_result.scalar_one_or_none():
        raise HTTPException(404, "Webhook not found.")

    if body.url is not None:
        wh.url = body.url
    if body.events is not None:
        for evt in body.events:
            if evt not in VALID_EVENTS:
                raise HTTPException(400, f"Invalid event: {evt}")
        wh.events = body.events
    if body.is_active is not None:
        wh.is_active = body.is_active

    await db.commit()
    return {"message": "Webhook updated.", "id": str(wh.id)}


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: _uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a webhook."""
    result = await db.execute(select(OAuthWebhook).where(OAuthWebhook.id == webhook_id))
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(404, "Webhook not found.")

    app_result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == wh.app_id, OAuthApp.user_id == current_user.id)
    )
    if not app_result.scalar_one_or_none():
        raise HTTPException(404, "Webhook not found.")

    await db.delete(wh)
    await db.commit()
    return {"message": "Webhook removed."}


@router.get("/{webhook_id}/deliveries")
async def list_deliveries(
    webhook_id: _uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent delivery attempts for a webhook."""
    result = await db.execute(select(OAuthWebhook).where(OAuthWebhook.id == webhook_id))
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(404, "Webhook not found.")

    app_result = await db.execute(
        select(OAuthApp).where(OAuthApp.id == wh.app_id, OAuthApp.user_id == current_user.id)
    )
    if not app_result.scalar_one_or_none():
        raise HTTPException(404, "Webhook not found.")

    deliveries_result = await db.execute(
        select(OAuthWebhookDelivery)
        .where(OAuthWebhookDelivery.webhook_id == webhook_id)
        .order_by(OAuthWebhookDelivery.created_at.desc())
        .limit(50)
    )
    deliveries = deliveries_result.scalars().all()

    return [
        {
            "id": str(d.id),
            "event_type": d.event_type,
            "payload": d.payload,
            "status_code": d.status_code,
            "success": d.success,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in deliveries
    ]


@router.get("/events")
async def list_available_events():
    """List all available webhook event types and descriptions."""
    descriptions = {
        "valuation.created": "Fired when a valuation is created via the API",
        "valuation.completed": "Fired when a valuation is processed and results are ready",
        "valuation.paid": "Fired when valuation payment is confirmed",
        "pitch_deck.created": "Fired when a pitch deck is created via the API",
        "pitch_deck.ready": "Fired when a pitch deck is generated and ready for download",
    }
    return [
        {"event": evt, "description": descriptions.get(evt, "")}
        for evt in sorted(VALID_EVENTS)
    ]
