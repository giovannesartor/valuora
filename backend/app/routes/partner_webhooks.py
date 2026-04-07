"""
Partner webhook management endpoints.
Allows partners to register, list, update, and delete webhook URLs.
"""
import secrets
import uuid
from typing import Optional

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import (
    User, Partner, PartnerWebhook, PartnerWebhookDelivery,
    PartnerWebhookEventType,
)
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/partner/webhooks", tags=["Partner Webhooks"])


class WebhookCreate(BaseModel):
    url: str
    events: list[str] = ["analysis.completed", "payment.confirmed", "pitch_deck.ready"]


class WebhookUpdate(BaseModel):
    url: Optional[str] = None
    events: Optional[list[str]] = None
    is_active: Optional[bool] = None


async def _get_partner(db, user: User) -> Partner:
    result = await db.execute(select(Partner).where(Partner.user_id == user.id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Partner access only.")
    return partner


@router.get("")
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all webhooks for the current partner."""
    partner = await _get_partner(db, current_user)
    result = await db.execute(
        select(PartnerWebhook)
        .where(PartnerWebhook.partner_id == partner.id)
        .order_by(PartnerWebhook.created_at.desc())
    )
    webhooks = result.scalars().all()
    return [
        {
            "id": str(wh.id),
            "url": wh.url,
            "events": wh.events,
            "is_active": wh.is_active,
            "secret": wh.secret[:8] + "..." if wh.secret else None,
            "created_at": wh.created_at.isoformat() if wh.created_at else None,
        }
        for wh in webhooks
    ]


@router.post("")
async def create_webhook(
    body: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new webhook URL."""
    partner = await _get_partner(db, current_user)

    valid_events = {e.value for e in PartnerWebhookEventType}
    for evt in body.events:
        if evt not in valid_events:
            raise HTTPException(status_code=400, detail=f"Invalid event: {evt}")

    count = (await db.execute(
        select(PartnerWebhook).where(PartnerWebhook.partner_id == partner.id)
    )).scalars().all()
    if len(count) >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 webhooks per partner.")

    secret = secrets.token_hex(32)
    wh = PartnerWebhook(
        partner_id=partner.id,
        url=body.url,
        secret=secret,
        events=body.events,
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)

    return {
        "id": str(wh.id),
        "url": wh.url,
        "events": wh.events,
        "secret": secret,
        "is_active": wh.is_active,
        "message": "Webhook created. Save the secret — it will not be shown again.",
    }


@router.patch("/{webhook_id}")
async def update_webhook(
    webhook_id: uuid.UUID,
    body: WebhookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update webhook URL, events, or active status."""
    partner = await _get_partner(db, current_user)
    wh = (await db.execute(
        select(PartnerWebhook).where(
            PartnerWebhook.id == webhook_id,
            PartnerWebhook.partner_id == partner.id,
        )
    )).scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found.")

    if body.url is not None:
        wh.url = body.url
    if body.events is not None:
        valid_events = {e.value for e in PartnerWebhookEventType}
        for evt in body.events:
            if evt not in valid_events:
                raise HTTPException(status_code=400, detail=f"Invalid event: {evt}")
        wh.events = body.events
    if body.is_active is not None:
        wh.is_active = body.is_active

    await db.commit()
    return {"message": "Webhook updated.", "id": str(wh.id)}


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a webhook."""
    partner = await _get_partner(db, current_user)
    wh = (await db.execute(
        select(PartnerWebhook).where(
            PartnerWebhook.id == webhook_id,
            PartnerWebhook.partner_id == partner.id,
        )
    )).scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    await db.delete(wh)
    await db.commit()
    return {"message": "Webhook removed."}


@router.get("/{webhook_id}/deliveries")
async def list_deliveries(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent delivery attempts for a webhook."""
    partner = await _get_partner(db, current_user)
    wh = (await db.execute(
        select(PartnerWebhook).where(
            PartnerWebhook.id == webhook_id,
            PartnerWebhook.partner_id == partner.id,
        )
    )).scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found.")

    result = await db.execute(
        select(PartnerWebhookDelivery)
        .where(PartnerWebhookDelivery.webhook_id == webhook_id)
        .order_by(PartnerWebhookDelivery.created_at.desc())
        .limit(50)
    )
    deliveries = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "event_type": d.event_type,
            "status_code": d.status_code,
            "success": d.success,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in deliveries
    ]
