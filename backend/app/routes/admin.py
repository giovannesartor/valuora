"""
Admin panel routes — requires is_admin or is_superadmin.
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import (
    User, Analysis, Payment, Report,
    PaymentStatus, AnalysisStatus, PlanType,
)
from app.services.auth_service import get_current_admin
from app.schemas.auth import MessageResponse
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── Schemas ──────────────────────────────────────────────
class AdminStats(BaseModel):
    total_users: int
    verified_users: int
    total_analyses: int
    completed_analyses: int
    total_payments: int
    paid_payments: int
    total_revenue: float
    recent_users: int  # last 30 days
    # A7: Conversion funnel
    users_with_analyses: int = 0
    users_with_payments: int = 0


class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_admin: bool
    is_superadmin: bool
    created_at: datetime
    analyses_count: int = 0
    payments_total: float = 0

    class Config:
        from_attributes = True


class AdminAnalysisResponse(BaseModel):
    id: uuid.UUID
    company_name: str
    sector: str
    equity_value: Optional[float]
    status: AnalysisStatus
    plan: Optional[PlanType]
    user_email: str
    user_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminPaymentResponse(BaseModel):
    id: uuid.UUID
    user_email: str
    user_name: str
    company_name: str
    plan: PlanType
    amount: float
    status: PaymentStatus
    asaas_payment_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Dashboard Stats ─────────────────────────────────────
@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from datetime import timedelta, timezone

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    verified_users = (await db.execute(
        select(func.count(User.id)).where(User.is_verified == True)
    )).scalar() or 0
    total_analyses = (await db.execute(select(func.count(Analysis.id)))).scalar() or 0
    completed_analyses = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.status == AnalysisStatus.COMPLETED)
    )).scalar() or 0
    total_payments = (await db.execute(select(func.count(Payment.id)))).scalar() or 0
    paid_payments = (await db.execute(
        select(func.count(Payment.id)).where(Payment.status == PaymentStatus.PAID)
    )).scalar() or 0
    total_revenue = (await db.execute(
        select(func.sum(Payment.amount)).where(Payment.status == PaymentStatus.PAID)
    )).scalar() or 0
    recent_users = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= thirty_days_ago)
    )).scalar() or 0

    # A7: Conversion funnel
    users_with_analyses = (await db.execute(
        select(func.count(func.distinct(Analysis.user_id)))
    )).scalar() or 0
    users_with_payments = (await db.execute(
        select(func.count(func.distinct(Payment.user_id))).where(Payment.status == PaymentStatus.PAID)
    )).scalar() or 0

    return AdminStats(
        total_users=total_users,
        verified_users=verified_users,
        total_analyses=total_analyses,
        completed_analyses=completed_analyses,
        total_payments=total_payments,
        paid_payments=paid_payments,
        total_revenue=float(total_revenue),
        recent_users=recent_users,
        users_with_analyses=users_with_analyses,
        users_with_payments=users_with_payments,
    )


# ─── Users ───────────────────────────────────────────────

# A1: Revenue timeline
@router.get("/revenue-timeline")
async def revenue_timeline(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from datetime import timedelta, timezone
    now = datetime.now(timezone.utc)
    results = []
    for i in range(months - 1, -1, -1):
        start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i > 0:
            end = (start + timedelta(days=32)).replace(day=1)
        else:
            end = now
        rev = (await db.execute(
            select(func.sum(Payment.amount)).where(
                Payment.status == PaymentStatus.PAID,
                Payment.paid_at >= start,
                Payment.paid_at < end,
            )
        )).scalar() or 0
        count = (await db.execute(
            select(func.count(Payment.id)).where(
                Payment.status == PaymentStatus.PAID,
                Payment.paid_at >= start,
                Payment.paid_at < end,
            )
        )).scalar() or 0
        results.append({
            "month": start.strftime("%b/%y"),
            "revenue": float(rev),
            "count": count,
        })
    return results


# A6: Bulk approve commissions
@router.post("/bulk-approve/{partner_id}")
async def bulk_approve_commissions(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from app.models.models import PartnerCommission, CommissionStatus
    result = await db.execute(
        select(PartnerCommission).where(
            PartnerCommission.partner_id == partner_id,
            PartnerCommission.status == CommissionStatus.PENDING,
        )
    )
    commissions = result.scalars().all()
    if not commissions:
        return {"message": "Nenhuma comissão pendente.", "approved": 0}
    for c in commissions:
        c.status = CommissionStatus.APPROVED
    await db.commit()
    return {"message": f"{len(commissions)} comissão(ões) aprovada(s).", "approved": len(commissions)}


@router.get("/users", response_model=List[AdminUserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    # Fix N+1: Use subqueries for analyses_count and payments_total
    from sqlalchemy.orm import aliased
    analyses_sub = (
        select(Analysis.user_id, func.count(Analysis.id).label("cnt"))
        .group_by(Analysis.user_id)
        .subquery()
    )
    payments_sub = (
        select(Payment.user_id, func.sum(Payment.amount).label("total"))
        .where(Payment.status == PaymentStatus.PAID)
        .group_by(Payment.user_id)
        .subquery()
    )

    query = (
        select(User, analyses_sub.c.cnt, payments_sub.c.total)
        .outerjoin(analyses_sub, User.id == analyses_sub.c.user_id)
        .outerjoin(payments_sub, User.id == payments_sub.c.user_id)
        .order_by(desc(User.created_at))
        .offset(skip).limit(limit)
    )
    if search:
        query = query.where(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )
    result = await db.execute(query)
    rows = result.all()

    return [
        AdminUserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            company_name=user.company_name,
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_admin=user.is_admin,
            is_superadmin=user.is_superadmin,
            created_at=user.created_at,
            analyses_count=int(cnt or 0),
            payments_total=float(total or 0),
        )
        for user, cnt, total in rows
    ]


@router.patch("/users/{user_id}/toggle-active", response_model=MessageResponse)
async def toggle_user_active(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Não é possível desativar o superadmin.")
    user.is_active = not user.is_active
    await db.commit()
    status = "ativado" if user.is_active else "desativado"
    return MessageResponse(message=f"Usuário {status} com sucesso.")


@router.patch("/users/{user_id}/verify", response_model=MessageResponse)
async def verify_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    user.is_verified = True
    await db.commit()
    return MessageResponse(message="Usuário verificado com sucesso.")


# ─── Analyses ────────────────────────────────────────────
@router.get("/analyses", response_model=List[AdminAnalysisResponse])
async def list_all_analyses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(Analysis, User.email, User.full_name)
        .join(User, Analysis.user_id == User.id)
        .order_by(desc(Analysis.created_at))
        .offset(skip).limit(limit)
    )
    rows = result.all()

    return [
        AdminAnalysisResponse(
            id=a.id,
            company_name=a.company_name,
            sector=a.sector,
            equity_value=float(a.equity_value) if a.equity_value else None,
            status=a.status,
            plan=a.plan,
            user_email=email,
            user_name=name,
            created_at=a.created_at,
        )
        for a, email, name in rows
    ]


# ─── Payments ────────────────────────────────────────────
@router.get("/payments", response_model=List[AdminPaymentResponse])
async def list_all_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(Payment, User.email, User.full_name, Analysis.company_name)
        .join(User, Payment.user_id == User.id)
        .join(Analysis, Payment.analysis_id == Analysis.id)
        .order_by(desc(Payment.created_at))
        .offset(skip).limit(limit)
    )
    rows = result.all()

    return [
        AdminPaymentResponse(
            id=p.id,
            user_email=email,
            user_name=name,
            company_name=company,
            plan=p.plan,
            amount=float(p.amount),
            status=p.status,
            asaas_payment_id=p.asaas_payment_id,
            paid_at=p.paid_at,
            created_at=p.created_at,
        )
        for p, email, name, company in rows
    ]
