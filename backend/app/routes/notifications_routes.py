"""
Notifications endpoint — derives user notifications from analyses and
payments without a dedicated table. Returns at most 20 items, newest first.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import User, Analysis, Payment, AnalysisStatus, PaymentStatus, NotificationRead, PitchDeck, PitchDeckStatus
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notificações"])


def _ago(dt: datetime) -> str:
    """Human-readable relative time string (PT-BR)."""
    if dt is None:
        return ""
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = int((now - dt).total_seconds())
    if diff < 60:
        return "agora mesmo"
    if diff < 3600:
        return f"há {diff // 60} min"
    if diff < 86400:
        return f"há {diff // 3600}h"
    if diff < 604800:
        return f"há {diff // 86400}d"
    return dt.strftime("%d/%m/%Y")


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
                "title": "Análise concluída",
                "text": f"O valuation de {a.company_name} foi concluído com sucesso.",
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
                "title": "Análise em processamento",
                "text": f"O valuation de {a.company_name} está sendo calculado.",
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
                "title": "Pagamento confirmado",
                "text": f"Seu pagamento de R$ {p.amount:.2f} foi confirmado. Relatório enviado por e-mail.",
                "timestamp": (p.paid_at or p.created_at).isoformat(),
                "time": _ago(p.paid_at or p.created_at),
                "analysis_id": str(p.analysis_id),
                "unread": key not in read_keys,
            })
        elif status in ("pending", "PENDING"):
            key = f"payment-pending-{p.id}"
            events.append({
                "id": key,
                "type": "payment_pending",
                "title": "Pagamento pendente",
                "text": f"Aguardando confirmação do pagamento de R$ {p.amount:.2f}.",
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
                "title": "📄 Pitch Deck pronto!",
                "text": f"O Pitch Deck de {pd.company_name} foi gerado com sucesso. Clique para baixar.",
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
                "title": "Erro no Pitch Deck",
                "text": f"Não foi possível gerar o PDF de {pd.company_name}. Tente novamente.",
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
        if status in ("paid", "received", "CONFIRMED", "RECEIVED"):
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
