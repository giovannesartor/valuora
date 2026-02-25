"""
Notifications endpoint — derives user notifications from analyses and
payments without a dedicated table. Returns at most 20 items, newest first.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import User, Analysis, Payment, AnalysisStatus, PaymentStatus
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

    events: list[dict] = []

    for a in analyses:
        if a.status == AnalysisStatus.COMPLETED:
            events.append({
                "id": f"analysis-done-{a.id}",
                "type": "analysis_completed",
                "title": "Análise concluída",
                "text": f"O valuation de {a.company_name} foi concluído com sucesso.",
                "timestamp": (a.updated_at or a.created_at).isoformat(),
                "time": _ago(a.updated_at or a.created_at),
                "analysis_id": str(a.id),
                "unread": True,
            })
        elif a.status == AnalysisStatus.PROCESSING:
            events.append({
                "id": f"analysis-proc-{a.id}",
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
            events.append({
                "id": f"payment-ok-{p.id}",
                "type": "payment_confirmed",
                "title": "Pagamento confirmado",
                "text": f"Seu pagamento de R$ {p.amount:.2f} foi confirmado. Relatório enviado por e-mail.",
                "timestamp": (p.paid_at or p.created_at).isoformat(),
                "time": _ago(p.paid_at or p.created_at),
                "analysis_id": str(p.analysis_id),
                "unread": True,
            })
        elif status in ("pending", "PENDING"):
            events.append({
                "id": f"payment-pending-{p.id}",
                "type": "payment_pending",
                "title": "Pagamento pendente",
                "text": f"Aguardando confirmação do pagamento de R$ {p.amount:.2f}.",
                "timestamp": p.created_at.isoformat(),
                "time": _ago(p.created_at),
                "analysis_id": str(p.analysis_id),
                "unread": False,
            })

    # Sort by timestamp descending, return newest 20
    events.sort(key=lambda e: e["timestamp"], reverse=True)
    return events[:20]
