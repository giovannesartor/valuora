"""
Admin panel routes — requires is_admin or is_superadmin.
"""
import uuid
import logging
import string
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Body, Request
from sqlalchemy import select, func, desc, true as sa_true
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.audit import get_audit_log, audit_log
from app.core.cache import cache_get, cache_set, cache_delete_pattern
from app.models.models import (
    User, Analysis, Payment, Report, Coupon, Partner, PartnerStatus,
    PaymentStatus, AnalysisStatus, PlanType, ErrorLog, AnalysisInvite,
)
from app.services.auth_service import get_current_admin
from app.services.email_service import send_coupon_gift_email, send_templated_email
from app.schemas.auth import MessageResponse
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import asyncio

logger = logging.getLogger(__name__)
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
    # Delta vs previous period
    delta: Optional[dict] = None


class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    cpf_cnpj: Optional[str] = None
    company_name: Optional[str] = None
    plan: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_admin: bool
    is_superadmin: bool
    is_partner: bool = False
    created_at: datetime
    deleted_at: Optional[datetime] = None
    analyses_count: int = 0
    pitch_decks_count: int = 0
    payments_total: float = 0
    last_analysis_at: Optional[datetime] = None
    has_active_plan: bool = False

    class Config:
        from_attributes = True


class AdminAnalysisResponse(BaseModel):
    id: uuid.UUID
    company_name: str
    sector: str
    equity_value: Optional[float]
    status: AnalysisStatus
    plan: Optional[PlanType]
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    partner_id: Optional[uuid.UUID] = None
    # Delivery status
    has_report: bool = False
    report_created_at: Optional[datetime] = None
    payment_status: Optional[str] = None   # PAID | PENDING | FAILED | None
    payment_amount: Optional[float] = None
    payment_method: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminPaymentResponse(BaseModel):
    id: uuid.UUID
    analysis_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    company_name: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    description: Optional[str] = None
    is_orphan: bool = False
    plan: Optional[PlanType] = None
    amount: float
    net_value: Optional[float] = None
    fee_amount: Optional[float] = None
    installment_count: Optional[int] = None
    status: PaymentStatus
    payment_method: Optional[str] = None
    asaas_payment_id: Optional[str] = None
    asaas_invoice_url: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Dashboard Stats ─────────────────────────────────────
@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    period: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from datetime import timedelta, timezone

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # AD1/BUG7: Period filter — apply cutoff to all stats
    cutoff = None
    if period == "7d":
        cutoff = now - timedelta(days=7)
    elif period == "30d":
        cutoff = now - timedelta(days=30)
    elif period == "90d":
        cutoff = now - timedelta(days=90)

    def _period(col):
        """Return a where clause for period filtering."""
        if cutoff:
            return col >= cutoff
        return sa_true()  # no filter

    total_users = (await db.execute(select(func.count(User.id)).where(_period(User.created_at)))).scalar() or 0
    verified_users = (await db.execute(
        select(func.count(User.id)).where(User.is_verified == True, _period(User.created_at))
    )).scalar() or 0
    total_analyses = (await db.execute(select(func.count(Analysis.id)).where(_period(Analysis.created_at)))).scalar() or 0
    completed_analyses = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.status == AnalysisStatus.COMPLETED, _period(Analysis.created_at))
    )).scalar() or 0
    total_payments = (await db.execute(select(func.count(Payment.id)).where(_period(Payment.created_at)))).scalar() or 0
    paid_payments = (await db.execute(
        select(func.count(Payment.id)).where(Payment.status == PaymentStatus.PAID, _period(Payment.created_at))
    )).scalar() or 0
    total_revenue = (await db.execute(
        select(func.sum(Payment.amount)).where(Payment.status == PaymentStatus.PAID, _period(Payment.created_at))
    )).scalar() or 0
    recent_users = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= thirty_days_ago)
    )).scalar() or 0

    # A7: Conversion funnel
    users_with_analyses = (await db.execute(
        select(func.count(func.distinct(Analysis.user_id))).where(_period(Analysis.created_at))
    )).scalar() or 0
    users_with_payments = (await db.execute(
        select(func.count(func.distinct(Payment.user_id))).where(Payment.status == PaymentStatus.PAID, _period(Payment.created_at))
    )).scalar() or 0

    # ── Delta vs previous same-length period ──
    delta = None
    if cutoff:
        delta_dur = now - cutoff
        prev_start = cutoff - delta_dur
        prev_end = cutoff

        def _prev(col):
            return (col >= prev_start) & (col < prev_end)

        def _pct(curr, prev):
            if not prev:
                return None
            return round(((curr - prev) / prev) * 100, 1)

        prev_users = (await db.execute(select(func.count(User.id)).where(_prev(User.created_at)))).scalar() or 0
        prev_analyses = (await db.execute(select(func.count(Analysis.id)).where(_prev(Analysis.created_at)))).scalar() or 0
        prev_payments = (await db.execute(select(func.count(Payment.id)).where(_prev(Payment.created_at)))).scalar() or 0
        prev_revenue = (await db.execute(
            select(func.sum(Payment.amount)).where(Payment.status == PaymentStatus.PAID, _prev(Payment.created_at))
        )).scalar() or 0
        prev_completed = (await db.execute(
            select(func.count(Analysis.id)).where(Analysis.status == AnalysisStatus.COMPLETED, _prev(Analysis.created_at))
        )).scalar() or 0
        prev_users_with_payments = (await db.execute(
            select(func.count(func.distinct(Payment.user_id))).where(Payment.status == PaymentStatus.PAID, _prev(Payment.created_at))
        )).scalar() or 0

        delta = {
            "total_users": _pct(total_users, prev_users),
            "total_analyses": _pct(total_analyses, prev_analyses),
            "total_payments": _pct(total_payments, prev_payments),
            "total_revenue": _pct(float(total_revenue), float(prev_revenue)),
            "completed_analyses": _pct(completed_analyses, prev_completed),
            "users_with_payments": _pct(users_with_payments, prev_users_with_payments),
        }

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
        delta=delta,
    )


# ─── Activity Feed & Sidebar Counts ─────────────────────

@router.get("/activity-feed")
async def activity_feed(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Return last 10 platform events: registrations, paid payments, completed analyses."""
    users_q = (await db.execute(
        select(User.full_name, User.email, User.created_at)
        .order_by(desc(User.created_at))
        .limit(6)
    )).all()
    payments_q = (await db.execute(
        select(User.full_name, Payment.amount, Payment.paid_at)
        .join(User, Payment.user_id == User.id)
        .where(Payment.status == PaymentStatus.PAID, Payment.paid_at.isnot(None))
        .order_by(desc(Payment.paid_at))
        .limit(6)
    )).all()
    analyses_q = (await db.execute(
        select(Analysis.company_name, User.full_name, Analysis.updated_at)
        .join(User, Analysis.user_id == User.id)
        .where(Analysis.status == AnalysisStatus.COMPLETED)
        .order_by(desc(Analysis.updated_at))
        .limit(6)
    )).all()

    events = []
    for full_name, email, at in users_q:
        if at:
            events.append({"type": "user", "label": full_name or email, "sub": "se cadastrou", "at": at.isoformat()})
    for full_name, amount, at in payments_q:
        if at:
            amt_fmt = f"$ {amount:,.0f}"
            events.append({"type": "payment", "label": full_name, "sub": f"pagou {amt_fmt}", "at": at.isoformat()})
    for company_name, full_name, at in analyses_q:
        if at:
            events.append({"type": "analysis", "label": company_name, "sub": f"análise concluída · {full_name}", "at": at.isoformat()})

    events = sorted(events, key=lambda x: x["at"], reverse=True)[:12]
    return events


@router.get("/sidebar-counts")
async def sidebar_counts(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Badge counts for admin sidebar."""
    from datetime import timedelta, timezone
    from app.models.models import Commission, CommissionStatus
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    error_count = (await db.execute(
        select(func.count(ErrorLog.id)).where(ErrorLog.created_at >= week_ago)
    )).scalar() or 0
    pending_payout = (await db.execute(
        select(func.count(func.distinct(Commission.partner_id)))
        .where(Commission.status == CommissionStatus.PENDING)
    )).scalar() or 0
    return {"error_logs": int(error_count), "pending_payout": int(pending_payout)}


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

    def _month_start(dt, back):
        """First instant of the month `back` months before `dt` (calendar-accurate)."""
        y, m = dt.year, dt.month - back
        while m <= 0:
            m += 12
            y -= 1
        return dt.replace(year=y, month=m, day=1, hour=0, minute=0, second=0, microsecond=0)

    results = []
    for i in range(months - 1, -1, -1):
        start = _month_start(now, i)
        if i > 0:
            end = _month_start(now, i - 1)
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


# Revenue breakdown by plan + ticket médio
@router.get("/plan-breakdown")
async def plan_breakdown(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Receita, contagem e ticket médio por plano."""
    rows = (await db.execute(
        select(Payment.plan, func.count(Payment.id), func.sum(Payment.amount), func.avg(Payment.amount))
        .where(Payment.status == PaymentStatus.PAID)
        .group_by(Payment.plan)
    )).all()
    return [
        {
            "plan": row[0].value if row[0] else "unknown",
            "count": row[1] or 0,
            "revenue": float(row[2] or 0),
            "avg_ticket": float(row[3] or 0),
        }
        for row in rows
    ]


# A6: Bulk approve commissions
@router.post("/bulk-approve/{partner_id}")
async def bulk_approve_commissions(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from app.models.models import Commission, CommissionStatus
    result = await db.execute(
        select(Commission).where(
            Commission.partner_id == partner_id,
            Commission.status == CommissionStatus.PENDING,
        )
    )
    commissions = result.scalars().all()
    if not commissions:
        return {"message": "Nenhuma comissão pendente.", "approved": 0}
    for c in commissions:
        c.status = CommissionStatus.APPROVED
    await db.commit()
    return {"message": f"{len(commissions)} comissão(ões) aprovada(s).", "approved": len(commissions)}


@router.get("/users", response_model=None)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_verified: Optional[bool] = None,
    include_deleted: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    # B1: Try cache first (only for unfiltered first page requests)
    _cache_key = f"admin:users:{skip}:{limit}:{search or ''}:{is_active}:{is_verified}:{include_deleted}"
    if not search and is_active is None and is_verified is None and not include_deleted:
        cached = await cache_get(_cache_key)
        if cached:
            return cached
    from app.models.models import PitchDeck as _PD
    analyses_sub = (
        select(Analysis.user_id, func.count(Analysis.id).label("cnt"))
        .group_by(Analysis.user_id)
        .subquery()
    )
    last_analysis_sub = (
        select(Analysis.user_id, func.max(Analysis.created_at).label("last_at"))
        .group_by(Analysis.user_id)
        .subquery()
    )
    payments_sub = (
        select(Payment.user_id, func.sum(Payment.amount).label("pay_total"))
        .where(Payment.status == PaymentStatus.PAID)
        .group_by(Payment.user_id)
        .subquery()
    )
    has_plan_sub = (
        select(Payment.user_id)
        .where(Payment.status == PaymentStatus.PAID)
        .distinct()
        .subquery()
    )
    partner_sub = (
        select(Partner.user_id)
        .subquery()
    )
    pitch_decks_sub = (
        select(_PD.user_id, func.count(_PD.id).label("pd_cnt"))
        .where(_PD.deleted_at.is_(None))
        .group_by(_PD.user_id)
        .subquery()
    )

    base = (
        select(
            User,
            analyses_sub.c.cnt,
            payments_sub.c.pay_total,
            partner_sub.c.user_id.label("partner_uid"),
            last_analysis_sub.c.last_at,
            has_plan_sub.c.user_id.label("plan_uid"),
            pitch_decks_sub.c.pd_cnt,
        )
        .outerjoin(analyses_sub, User.id == analyses_sub.c.user_id)
        .outerjoin(last_analysis_sub, User.id == last_analysis_sub.c.user_id)
        .outerjoin(payments_sub, User.id == payments_sub.c.user_id)
        .outerjoin(has_plan_sub, User.id == has_plan_sub.c.user_id)
        .outerjoin(partner_sub, User.id == partner_sub.c.user_id)
        .outerjoin(pitch_decks_sub, User.id == pitch_decks_sub.c.user_id)
    )
    if search:
        safe_search = search.replace('%', '\\%').replace('_', '\\_')
        base = base.where(
            User.email.ilike(f"%{safe_search}%") | User.full_name.ilike(f"%{safe_search}%")
        )
    if not include_deleted:
        base = base.where(User.deleted_at.is_(None))
    if is_active is not None:
        base = base.where(User.is_active == is_active)
    if is_verified is not None:
        base = base.where(User.is_verified == is_verified)

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total_count = count_result.scalar() or 0

    result = await db.execute(base.order_by(desc(User.created_at)).offset(skip).limit(limit))
    rows = result.all()

    result_data = {
        "users": [
            AdminUserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                phone=user.phone,
                cpf_cnpj=user.cpf_cnpj,
                company_name=user.company_name,
                plan=None,  # User model has no plan attr; plan is on Analysis/Payment
                is_active=user.is_active,
                is_verified=user.is_verified,
                is_admin=user.is_admin,
                is_superadmin=user.is_superadmin,
                is_partner=partner_uid is not None,
                created_at=user.created_at,
                deleted_at=user.deleted_at,
                analyses_count=int(cnt or 0),
                pitch_decks_count=int(pd_cnt or 0),
                payments_total=float(pay_total or 0),
                last_analysis_at=last_at,
                has_active_plan=plan_uid is not None,
            ).model_dump(mode='json')
            for user, cnt, pay_total, partner_uid, last_at, plan_uid, pd_cnt in rows
        ],
        "total": total_count,
    }
    # B1: Cache 60s when no filters
    if not search and is_active is None and is_verified is None and not include_deleted:
        await cache_set(_cache_key, result_data, ttl=60)
    return result_data


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


class UserEditRequest(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None


@router.patch("/users/{user_id}/edit", response_model=MessageResponse)
async def edit_user_profile(
    user_id: uuid.UUID,
    body: UserEditRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if body.full_name is not None:
        name = body.full_name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Nome não pode ser vazio.")
        user.full_name = name

    if body.company_name is not None:
        user.company_name = body.company_name.strip() or None  # allow clearing

    await db.commit()
    await cache_delete_pattern("admin:users:*")
    return MessageResponse(message="Perfil do usuário atualizado com sucesso.")


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    import os as _os

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Não é possível excluir o superadmin.")
    if user.id == admin.id:
        raise HTTPException(status_code=403, detail="Não é possível excluir sua própria conta.")

    deleted_email = user.email
    deleted_name = user.full_name

    # ── Coletar arquivos em disco para remover depois ──────────────────────
    files_to_remove: list[str] = []

    # PDFs dos relatórios (via analyses → reports)
    report_rows = (await db.execute(
        select(Report.file_path, Report.file_path_en)
        .join(Analysis, Report.analysis_id == Analysis.id)
        .where(Analysis.user_id == user_id)
    )).all()
    for fp, fp_en in report_rows:
        if fp:
            files_to_remove.append(fp)
        if fp_en:
            files_to_remove.append(fp_en)

    # Logo do parceiro (se for parceiro)
    partner_row = (await db.execute(
        select(Partner).where(Partner.user_id == user_id)
    )).scalar_one_or_none()
    if partner_row and getattr(partner_row, "logo_path", None):
        logo = partner_row.logo_path
        if not logo.startswith("/"):
            logo = _os.path.join(settings.UPLOADS_DIR, logo)
        files_to_remove.append(logo)

    # Logos dos pitch decks
    from app.models.models import PitchDeck as _PD2
    pd_logos = (await db.execute(
        select(_PD2.logo_path).where(_PD2.user_id == user_id, _PD2.logo_path.isnot(None))
    )).scalars().all()
    for logo in pd_logos:
        if logo and not logo.startswith("/"):
            logo = _os.path.join(settings.UPLOADS_DIR, logo)
        if logo:
            files_to_remove.append(logo)

    # ── Hard delete — CASCADE no banco cuida do resto ─────────────────────
    await db.delete(user)
    await db.commit()

    # ── Limpar arquivos do disco ───────────────────────────────────────────
    for path in files_to_remove:
        try:
            if _os.path.isfile(path):
                _os.remove(path)
        except Exception:
            pass  # não bloqueia se arquivo já foi removido

    await cache_delete_pattern("admin:users:*")
    await cache_delete_pattern("admin:analyses:*")

    await audit_log(
        action="admin_delete_user",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(user_id),
        detail=f"Hard-deleted user {deleted_email} ({deleted_name}); removed {len(files_to_remove)} file(s)",
    )
    return MessageResponse(message="Usuário excluído permanentemente.")


@router.post("/users/{user_id}/promote-partner", response_model=MessageResponse)
async def promote_user_to_partner(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Check if already a partner
    existing = await db.execute(select(Partner).where(Partner.user_id == user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Este usuário já é parceiro.")

    # Generate a unique referral code matching VL-XXXX format
    chars = string.ascii_uppercase + string.digits
    referral_code = "VL-" + ''.join(secrets.choice(chars) for _ in range(8))
    # Ensure uniqueness
    while True:
        check = await db.execute(select(Partner).where(Partner.referral_code == referral_code))
        if not check.scalar_one_or_none():
            break
        referral_code = "VL-" + ''.join(secrets.choice(chars) for _ in range(8))

    partner = Partner(
        user_id=user.id,
        company_name=user.company_name,
        phone=user.phone,
        referral_code=referral_code,
        referral_link=f"{settings.FRONTEND_URL}/cadastro?ref={referral_code}",
        commission_rate=0.30,
        status=PartnerStatus.ACTIVE,
    )
    db.add(partner)
    # Ensure the user can log in: verify email and activate account
    user.is_verified = True
    user.is_active = True
    await db.commit()
    await cache_delete_pattern("admin:users:*")
    return MessageResponse(message=f"Usuário promovido a parceiro com código {referral_code}.")


@router.post("/users/{user_id}/demote-partner", response_model=MessageResponse)
async def demote_user_from_partner(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    partner_result = await db.execute(select(Partner).where(Partner.user_id == user_id))
    partner = partner_result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=400, detail="Este usuário não é parceiro.")

    await db.delete(partner)
    await db.commit()
    await cache_delete_pattern("admin:users:*")
    return MessageResponse(message="Parceiro removido com sucesso.")


@router.post("/users/{user_id}/promote-admin", response_model=MessageResponse)
async def promote_user_to_admin(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Promote a regular user to admin. Only superadmins can do this."""
    if not admin.is_superadmin:
        raise HTTPException(status_code=403, detail="Apenas superadmins podem promover usuários.")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.is_admin or user.is_superadmin:
        raise HTTPException(status_code=400, detail="Este usuário já é administrador.")

    user.is_admin = True
    await db.commit()
    await cache_delete_pattern("admin:users:*")

    await audit_log(
        action="admin_promote_admin",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(user_id),
        detail=f"Promoted {user.email} to admin",
    )
    return MessageResponse(message=f"{user.full_name} agora é administrador.")


@router.post("/users/{user_id}/demote-admin", response_model=MessageResponse)
async def demote_user_from_admin(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Remove admin privileges from a user. Only superadmins can do this."""
    if not admin.is_superadmin:
        raise HTTPException(status_code=403, detail="Apenas superadmins podem rebaixar administradores.")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Não é possível rebaixar um superadmin.")
    if not user.is_admin:
        raise HTTPException(status_code=400, detail="Este usuário não é administrador.")

    user.is_admin = False
    await db.commit()
    await cache_delete_pattern("admin:users:*")

    await audit_log(
        action="admin_demote_admin",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(user_id),
        detail=f"Demoted {user.email} from admin",
    )
    return MessageResponse(message=f"{user.full_name} não é mais administrador.")


# ─── Analyses ────────────────────────────────────────────
@router.get("/analyses", response_model=None)
async def list_all_analyses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    _cache_key = f"admin:analyses:{skip}:{limit}:{search or ''}:{status or ''}"
    if not search and not status:
        cached = await cache_get(_cache_key)
        if cached:
            return cached

    # LEFT JOIN User so guided analyses (user_id=None) still appear
    # LEFT JOIN Report to know if PDF was generated
    # LEFT JOIN Payment to know payment status
    base = (
        select(
            Analysis,
            User.email,
            User.full_name,
            Report.id.label("report_id"),
            Report.created_at.label("report_created_at"),
            Payment.status.label("pay_status"),
            Payment.amount.label("pay_amount"),
            Payment.payment_method.label("pay_method"),
        )
        .outerjoin(User, Analysis.user_id == User.id)
        .outerjoin(Report, Report.analysis_id == Analysis.id)
        .outerjoin(Payment, Payment.analysis_id == Analysis.id)
        .where(Analysis.deleted_at.is_(None))
    )
    if search:
        safe_search = search.replace('%', '\\%').replace('_', '\\_')
        base = base.where(
            Analysis.company_name.ilike(f"%{safe_search}%")
            | User.email.ilike(f"%{safe_search}%")
            | User.full_name.ilike(f"%{safe_search}%")
        )
    if status:
        base = base.where(Analysis.status == status)

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        base.order_by(desc(Analysis.created_at)).offset(skip).limit(limit)
    )
    rows = result.all()

    result_data = {
        "analyses": [
            AdminAnalysisResponse(
                id=a.id,
                company_name=a.company_name,
                sector=a.sector,
                equity_value=float(a.equity_value) if a.equity_value else None,
                status=a.status,
                plan=a.plan,
                user_email=email,
                user_name=name,
                partner_id=a.partner_id,
                has_report=report_id is not None,
                report_created_at=report_at,
                payment_status=pay_status.value if pay_status else None,
                payment_amount=float(pay_amount) if pay_amount else None,
                payment_method=pay_method,
                created_at=a.created_at,
            ).model_dump(mode='json')
            for a, email, name, report_id, report_at, pay_status, pay_amount, pay_method in rows
        ],
        "total": total,
    }
    if not search and not status:
        await cache_set(_cache_key, result_data, ttl=60)
    return result_data


# ─── Payments ────────────────────────────────────────────
@router.get("/payments", response_model=None)
async def list_all_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    base = (
        select(Payment, User.email, User.full_name, Analysis.company_name)
        .outerjoin(User, Payment.user_id == User.id)
        .outerjoin(Analysis, Payment.analysis_id == Analysis.id)
    )
    if search:
        safe_search = search.replace('%', '\\%').replace('_', '\\_')
        base = base.where(
            User.email.ilike(f"%{safe_search}%")
            | User.full_name.ilike(f"%{safe_search}%")
            | Analysis.company_name.ilike(f"%{safe_search}%")
            | Payment.customer_email.ilike(f"%{safe_search}%")
            | Payment.customer_name.ilike(f"%{safe_search}%")
            | Payment.asaas_payment_id.ilike(f"%{safe_search}%")
        )
    if status:
        base = base.where(Payment.status == status)

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(
        base.order_by(desc(Payment.created_at)).offset(skip).limit(limit)
    )
    rows = result.all()

    return {
        "payments": [
            AdminPaymentResponse(
                id=p.id,
                analysis_id=p.analysis_id,
                user_email=email,
                user_name=name,
                company_name=company,
                customer_name=p.customer_name,
                customer_email=p.customer_email,
                description=p.description,
                is_orphan=bool(p.is_orphan),
                plan=p.plan,
                amount=float(p.amount),
                net_value=float(p.net_value) if p.net_value else None,
                fee_amount=float(p.fee_amount) if p.fee_amount else None,
                installment_count=p.installment_count,
                status=p.status,
                payment_method=p.payment_method,
                asaas_payment_id=p.asaas_payment_id,
                asaas_invoice_url=p.asaas_invoice_url,
                paid_at=p.paid_at,
                created_at=p.created_at,
            ).model_dump(mode='json')
            for p, email, name, company in rows
        ],
        "total": total,
    }


# ─── Import single Asaas charge (e.g. created directly in Asaas dashboard) ──
@router.delete("/payments/{payment_id}")
async def admin_delete_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Remove um registro de pagamento do banco (apenas pending/failed/refunded)."""
    payment = (await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    if payment.status == "paid":
        raise HTTPException(status_code=400, detail="Não é possível excluir pagamentos confirmados (paid). Use reembolso.")
    await db.delete(payment)
    await db.commit()
    await audit_log(
        action="admin_delete_payment",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(payment_id),
        detail=f"status={payment.status}; amount={payment.amount}",
    )
    return {"ok": True, "message": "Pagamento excluído."}


@router.post("/payments/sync-asaas/{asaas_payment_id}")
async def sync_asaas_payment(
    asaas_payment_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Importa uma cobrança avulsa do Asaas para o admin (cria Payment órfão)."""
    existing = await db.execute(
        select(Payment).where(Payment.asaas_payment_id == asaas_payment_id)
    )
    if existing.scalar_one_or_none():
        return {"status": "exists", "asaas_payment_id": asaas_payment_id}

    from app.services.asaas_service import asaas_service
    try:
        pd = await asaas_service.get_payment(asaas_payment_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Cobrança Asaas não encontrada: {e}")

    customer_id = pd.get("customer")
    customer_name = customer_email = None
    if customer_id:
        try:
            cust = await asaas_service.get_customer(customer_id)
            customer_name = cust.get("name")
            customer_email = cust.get("email")
        except Exception:
            pass

    status_map = {
        "CONFIRMED": PaymentStatus.PAID,
        "RECEIVED": PaymentStatus.PAID,
        "RECEIVED_IN_CASH": PaymentStatus.PAID,
        "PENDING": PaymentStatus.PENDING,
        "OVERDUE": PaymentStatus.FAILED,
        "REFUNDED": PaymentStatus.REFUNDED,
        "REFUND_REQUESTED": PaymentStatus.REFUNDED,
    }
    asaas_status = pd.get("status", "PENDING")
    mapped = status_map.get(asaas_status, PaymentStatus.PENDING)
    amount = pd.get("value") or 0
    asaas_net = pd.get("netValue")

    paid_at = None
    if mapped == PaymentStatus.PAID:
        from datetime import datetime as _dt, timezone as _tz
        try:
            paid_at = _dt.fromisoformat((pd.get("paymentDate") or pd.get("clientPaymentDate") or "")[:10])
        except Exception:
            paid_at = _dt.now(_tz.utc)

    orphan = Payment(
        user_id=None,
        analysis_id=None,
        plan=None,
        amount=amount,
        status=mapped,
        payment_method=pd.get("billingType"),
        asaas_payment_id=asaas_payment_id,
        asaas_customer_id=customer_id,
        asaas_invoice_url=pd.get("invoiceUrl"),
        net_value=asaas_net,
        fee_amount=(round(float(amount) - float(asaas_net), 2) if asaas_net is not None else None),
        installment_count=pd.get("installmentCount"),
        customer_name=customer_name,
        customer_email=customer_email,
        description=pd.get("description"),
        is_orphan=True,
        paid_at=paid_at,
    )
    db.add(orphan)
    await db.commit()
    await db.refresh(orphan)
    await audit_log(
        action="admin.payment.sync_asaas",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(orphan.id),
        detail=f"asaas_id={asaas_payment_id}, status={asaas_status}, amount={amount}, customer={customer_email}",
    )
    return {"status": "ok", "payment_id": str(orphan.id), "asaas_status": asaas_status}


# ─── Sync Asaas payment by analysis UUID (externalReference) ──
@router.post("/analyses/{analysis_id}/sync-payment")
async def sync_payment_by_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Busca no Asaas cobranças com externalReference == analysis_id e importa a primeira encontrada.

    Útil quando o webhook não processou a cobrança e o admin só tem o UUID da análise.
    Se o pagamento já existe no banco (pelo asaas_payment_id), retorna 'exists'.
    Se a análise ainda não tem Payment vinculado e o Asaas retorna uma cobrança confirmada,
    linka o Payment à análise e atualiza analysis.plan.
    """
    from app.services.asaas_service import asaas_service
    from datetime import datetime as _dt, timezone as _tz

    # Check if analysis exists
    analysis = (await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    # Find payment via Asaas externalReference
    try:
        payments_data = await asaas_service.list_payments_by_reference(str(analysis_id))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar Asaas: {e}")

    if not payments_data:
        raise HTTPException(status_code=404, detail="Nenhuma cobrança encontrada no Asaas para esta análise.")

    pd = payments_data[0]  # most recent first
    asaas_pid = pd.get("id")

    # Idempotent: already imported?
    existing = (await db.execute(
        select(Payment).where(Payment.asaas_payment_id == asaas_pid)
    )).scalar_one_or_none()
    if existing:
        return {"status": "exists", "payment_id": str(existing.id), "asaas_payment_id": asaas_pid}

    # Fetch customer info
    customer_id = pd.get("customer")
    customer_name = customer_email = None
    if customer_id:
        try:
            cust = await asaas_service.get_customer(customer_id)
            customer_name = cust.get("name")
            customer_email = cust.get("email")
        except Exception:
            pass

    status_map = {
        "CONFIRMED": PaymentStatus.PAID,
        "RECEIVED": PaymentStatus.PAID,
        "RECEIVED_IN_CASH": PaymentStatus.PAID,
        "PENDING": PaymentStatus.PENDING,
        "OVERDUE": PaymentStatus.FAILED,
        "REFUNDED": PaymentStatus.REFUNDED,
        "REFUND_REQUESTED": PaymentStatus.REFUNDED,
    }
    asaas_status = pd.get("status", "PENDING")
    mapped = status_map.get(asaas_status, PaymentStatus.PENDING)
    amount = pd.get("value") or 0
    asaas_net = pd.get("netValue")

    paid_at = None
    if mapped == PaymentStatus.PAID:
        try:
            paid_at = _dt.fromisoformat((pd.get("paymentDate") or pd.get("clientPaymentDate") or "")[:10])
        except Exception:
            paid_at = _dt.now(_tz.utc)

    # Determine plan from description
    desc = (pd.get("description") or "").lower()
    plan = None
    if "profissional" in desc or "professional" in desc:
        plan = PlanType.PROFISSIONAL
    elif "estratégico" in desc or "estrategico" in desc or "estrategico" in desc:
        plan = PlanType.ESTRATEGICO

    # Check if analysis already has a Payment row
    existing_by_analysis = (await db.execute(
        select(Payment).where(Payment.analysis_id == analysis_id)
    )).scalar_one_or_none()

    if existing_by_analysis:
        # Update existing payment with Asaas data
        existing_by_analysis.asaas_payment_id = asaas_pid
        existing_by_analysis.status = mapped
        existing_by_analysis.paid_at = paid_at or existing_by_analysis.paid_at
        existing_by_analysis.net_value = asaas_net
        existing_by_analysis.fee_amount = (round(float(amount) - float(asaas_net), 2) if asaas_net is not None else None)
        if plan:
            existing_by_analysis.plan = plan
            analysis.plan = plan
        await db.commit()
        await audit_log(
            action="admin.payment.sync_by_analysis.update",
            user_id=str(admin.id),
            user_email=admin.email,
            resource_id=str(existing_by_analysis.id),
            detail=f"analysis={analysis_id} asaas_id={asaas_pid} status={asaas_status}",
        )
        return {"status": "updated", "payment_id": str(existing_by_analysis.id), "asaas_payment_id": asaas_pid}

    # Create new Payment linked to analysis
    new_payment = Payment(
        user_id=analysis.user_id,
        analysis_id=analysis_id,
        plan=plan,
        amount=amount,
        status=mapped,
        payment_method=pd.get("billingType"),
        asaas_payment_id=asaas_pid,
        asaas_customer_id=customer_id,
        asaas_invoice_url=pd.get("invoiceUrl"),
        net_value=asaas_net,
        fee_amount=(round(float(amount) - float(asaas_net), 2) if asaas_net is not None else None),
        installment_count=pd.get("installmentCount"),
        customer_name=customer_name,
        customer_email=customer_email,
        description=pd.get("description"),
        is_orphan=False,
        paid_at=paid_at,
    )
    db.add(new_payment)
    if plan:
        analysis.plan = plan
    await db.commit()
    await db.refresh(new_payment)
    await audit_log(
        action="admin.payment.sync_by_analysis.create",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(new_payment.id),
        detail=f"analysis={analysis_id} asaas_id={asaas_pid} status={asaas_status} amount={amount}",
    )
    return {"status": "ok", "payment_id": str(new_payment.id), "asaas_payment_id": asaas_pid, "asaas_status": asaas_status}


# ─── PA2: Admin mark payment as paid (manual override) ──────
class MarkPaidBody(BaseModel):
    note: Optional[str] = None


@router.post("/payments/{payment_id}/mark-paid")
async def mark_payment_as_paid(
    payment_id: uuid.UUID,
    body: MarkPaidBody = Body(default=MarkPaidBody()),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Marca um pagamento como pago manualmente (admin bypass).
    Dispara a geração do relatório em background."""
    from app.routes.payments import _generate_and_send_report
    from datetime import timezone

    result = await db.execute(
        select(Payment, Analysis)
        .join(Analysis, Payment.analysis_id == Analysis.id)
        .where(Payment.id == payment_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    payment, analysis = row

    if payment.status == PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Pagamento já está confirmado.")

    payment.status = PaymentStatus.PAID
    payment.payment_method = "admin_bypass"
    payment.paid_at = datetime.now(timezone.utc)
    analysis.plan = payment.plan

    note_text = body.note or f"Marcado como pago manualmente pelo admin {admin.email}"
    await audit_log(
        action="admin_mark_paid",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(payment_id),
        detail=f"analysis={analysis.id} plan={payment.plan} amount={payment.amount} note={note_text}",
    )

    await db.commit()
    await db.refresh(payment)
    await db.refresh(analysis)

    if background_tasks:
        background_tasks.add_task(_generate_and_send_report, str(analysis.id), str(analysis.user_id))

    return {"ok": True, "message": "Pagamento confirmado. Relatório sendo gerado.", "analysis_id": str(analysis.id)}


# ─── Admin: atribuir parceiro a uma análise (indicação por fora) ─────
class AttachPartnerBody(BaseModel):
    partner_id: uuid.UUID
    commission_status: str = "pending"  # "pending" | "approved" | "paid"
    create_client: bool = True


@router.post("/analyses/{analysis_id}/attach-partner")
async def admin_attach_partner_to_analysis(
    analysis_id: uuid.UUID,
    body: AttachPartnerBody,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Vincula um parceiro a uma análise feita 'por fora' do link de indicação.

    Faz, de forma idempotente:
    1. Seta `analyses.partner_id`
    2. Cria/atualiza `PartnerClient` correspondente (vincula via analysis_id)
    3. Se houver Payment PAID, cria `Commission` no status escolhido
       (pending → entra na previsão; approved → liberada; paid → marca paid_at)
    """
    from app.models.models import (
        Commission, CommissionStatus, PartnerClient, ClientDataStatus,
        ProductType, PaymentStatus,
    )

    valid_statuses = {"pending", "approved", "paid"}
    if body.commission_status not in valid_statuses:
        raise HTTPException(status_code=422, detail=f"commission_status deve ser um de {valid_statuses}")

    analysis = (await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    partner = (await db.execute(
        select(Partner).where(Partner.id == body.partner_id)
    )).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")

    # 1. Set partner_id on analysis
    analysis.partner_id = partner.id

    # 2. PartnerClient (CRM): create or update existing one for this analysis
    client_user = None
    if analysis.user_id:
        client_user = (await db.execute(
            select(User).where(User.id == analysis.user_id)
        )).scalar_one_or_none()

    pc = (await db.execute(
        select(PartnerClient).where(PartnerClient.analysis_id == analysis_id)
    )).scalar_one_or_none()

    if body.create_client and not pc:
        pc = PartnerClient(
            partner_id=partner.id,
            user_id=analysis.user_id,
            client_name=(client_user.full_name if client_user else analysis.company_name) or "Cliente",
            client_company=analysis.company_name,
            client_email=(client_user.email if client_user else "—"),
            data_status=ClientDataStatus.REPORT_SENT,
            plan=analysis.plan,
            analysis_id=analysis.id,
            pipeline_stage="ganho",
        )
        db.add(pc)
    elif pc:
        pc.partner_id = partner.id
        pc.data_status = ClientDataStatus.REPORT_SENT
        if analysis.plan:
            pc.plan = analysis.plan

    # 3. Commission if there is a PAID payment
    payment = (await db.execute(
        select(Payment)
        .where(Payment.analysis_id == analysis_id, Payment.status == PaymentStatus.PAID)
        .order_by(Payment.created_at.desc())
    )).scalars().first()

    commission_created = False
    commission_id = None
    if payment:
        existing = (await db.execute(
            select(Commission).where(Commission.payment_id == payment.id)
        )).scalar_one_or_none()
        if existing:
            existing.partner_id = partner.id
            commission_id = str(existing.id)
        else:
            gross = float(payment.amount)
            net = float(payment.net_value) if payment.net_value else gross
            partner_amount = round(net * float(partner.commission_rate or 0.3), 2)
            system_amount = round(net - partner_amount, 2)
            prod_type = ProductType.BUNDLE if payment.plan == PlanType.BUNDLE else ProductType.VALUATION
            status_map = {
                "pending": CommissionStatus.PENDING,
                "approved": CommissionStatus.APPROVED,
                "paid": CommissionStatus.PAID,
            }
            comm = Commission(
                partner_id=partner.id,
                payment_id=payment.id,
                client_id=pc.id if pc else None,
                product_type=prod_type,
                total_amount=net,
                gross_amount=gross,
                partner_amount=partner_amount,
                system_amount=system_amount,
                status=status_map[body.commission_status],
                paid_at=datetime.now(timezone.utc) if body.commission_status == "paid" else None,
            )
            db.add(comm)
            partner.total_sales = (partner.total_sales or 0) + 1
            if body.commission_status == "paid":
                partner.total_earnings = float(partner.total_earnings or 0) + partner_amount
            commission_created = True
            await db.flush()
            commission_id = str(comm.id)

    await db.commit()
    await audit_log(
        action="admin_attach_partner",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
        detail=f"partner_id={partner.id}; commission_status={body.commission_status}; commission_created={commission_created}",
    )
    return {
        "ok": True,
        "analysis_id": str(analysis_id),
        "partner_id": str(partner.id),
        "commission_created": commission_created,
        "commission_id": commission_id,
        "message": "Parceiro vinculado com sucesso.",
    }


# ─── Admin: alterar status de uma comissão (pending/approved/paid) ─────
class CommissionStatusBody(BaseModel):
    status: str  # "pending" | "approved" | "paid"


@router.patch("/commissions/{commission_id}/status")
async def admin_set_commission_status(
    commission_id: uuid.UUID,
    body: CommissionStatusBody,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Atualiza o status de uma comissão individual."""
    from app.models.models import Commission, CommissionStatus
    if body.status not in {"pending", "approved", "paid"}:
        raise HTTPException(status_code=422, detail="status inválido")

    comm = (await db.execute(
        select(Commission).where(Commission.id == commission_id)
    )).scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=404, detail="Comissão não encontrada.")

    new_status = {
        "pending": CommissionStatus.PENDING,
        "approved": CommissionStatus.APPROVED,
        "paid": CommissionStatus.PAID,
    }[body.status]

    was_paid = comm.status == CommissionStatus.PAID
    comm.status = new_status
    if new_status == CommissionStatus.PAID and not was_paid:
        comm.paid_at = datetime.now(timezone.utc)
        partner = (await db.execute(select(Partner).where(Partner.id == comm.partner_id))).scalar_one_or_none()
        if partner:
            partner.total_earnings = float(partner.total_earnings or 0) + float(comm.partner_amount)
    elif new_status != CommissionStatus.PAID and was_paid:
        comm.paid_at = None
        partner = (await db.execute(select(Partner).where(Partner.id == comm.partner_id))).scalar_one_or_none()
        if partner:
            partner.total_earnings = max(0.0, float(partner.total_earnings or 0) - float(comm.partner_amount))

    await db.commit()
    await audit_log(
        action="admin_set_commission_status",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(commission_id),
        detail=f"status={body.status}",
    )

    # WhatsApp: notify partner when commission is marked as paid
    if new_status == CommissionStatus.PAID and not was_paid:
        try:
            _partner = (await db.execute(select(Partner).where(Partner.id == comm.partner_id))).scalar_one_or_none()
            if _partner:
                _partner_user = (await db.execute(select(User).where(User.id == _partner.user_id))).scalar_one_or_none()
                if _partner_user and _partner_user.phone:
                    import asyncio as _asyncio
                    from app.services.whatsapp_service import send_partner_commission_paid as _wha_paid
                    _asyncio.create_task(_wha_paid(
                        phone=_partner_user.phone,
                        partner_name=_partner_user.full_name,
                        amount=float(comm.partner_amount),
                        user_id=str(_partner_user.id),
                    ))
        except Exception:
            pass

    return {"ok": True, "status": body.status}


# ─── Admin generate report (bypass payment) ─────────────
class AdminGenerateReportBody(BaseModel):
    plan: PlanType = PlanType.PROFISSIONAL
    send_email: bool = False  # optionally also email the client
    lang: str = "pt"  # "pt" or "en"


@router.post("/analyses/{analysis_id}/generate-report")
async def admin_generate_report(
    analysis_id: uuid.UUID,
    body: AdminGenerateReportBody,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin generates a valuation report for any completed analysis, bypassing payment.

    Sets the plan on the analysis (admin choice), generates the PDF and
    optionally sends the report email to the client.
    """
    from app.routes.payments import _generate_and_send_report
    from app.services.pdf_service import generate_report_pdf
    from app.core.security import create_download_token
    from app.core.config import settings
    from app.services.email_service import send_report_ready_email
    import asyncio, os

    result = await db.execute(
        select(Analysis, User)
        .outerjoin(User, Analysis.user_id == User.id)
        .where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    analysis, owner = row

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Análise ainda não está concluída.")

    # Set plan (admin bypass — no payment needed)
    analysis.plan = body.plan
    await db.commit()
    await db.refresh(analysis)

    lang = body.lang if body.lang in ("pt", "en") else "pt"

    # Delete existing report so we regenerate with the (possibly new) plan/lang
    existing = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()
    if existing:
        target_path = existing.file_path_en if lang == "en" else existing.file_path
        if target_path and os.path.exists(target_path):
            try:
                os.remove(target_path)
            except OSError:
                pass
        if lang == "en":
            existing.file_path_en = None
        else:
            existing.file_path = None
        await db.commit()

    # Generate PDF synchronously so admin can download immediately
    try:
        pdf_path = await asyncio.to_thread(generate_report_pdf, analysis, lang=lang)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao gerar PDF: {exc}")

    download_token = create_download_token(str(analysis.id))
    # Reuse existing report row if present (only one report per analysis)
    report = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()
    if report:
        if lang == "en":
            report.file_path_en = pdf_path
        else:
            report.file_path = pdf_path
        report.download_token = download_token
    else:
        report = Report(
            analysis_id=analysis.id,
            version=1,
            file_path=pdf_path if lang == "pt" else None,
            file_path_en=pdf_path if lang == "en" else None,
            download_token=download_token,
        )
        db.add(report)
    await db.commit()

    download_url = f"{settings.APP_URL}/api/v1/reports/download?token={download_token}"

    # Optionally email the client
    if body.send_email:
        # For guided analyses (no user), look up client email from AnalysisInvite
        email_target = owner.email if owner else None
        name_target = owner.full_name if owner else "Cliente"
        if not email_target:
            invite = (await db.execute(
                select(AnalysisInvite).where(AnalysisInvite.analysis_id == analysis_id)
            )).scalar_one_or_none()
            if invite:
                email_target = invite.client_email
                name_target = invite.client_name or "Cliente"
        if email_target:
            await send_report_ready_email(email_target, name_target, analysis.company_name, download_url)

    await audit_log(
        action="admin_generate_report",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
        detail=f"plan={body.plan.value} send_email={body.send_email}",
    )
    await cache_delete_pattern("admin:analyses:*")

    return {
        "ok": True,
        "message": "Relatório gerado com sucesso." + (" E-mail enviado ao cliente." if body.send_email else ""),
        "download_url": download_url,
        "plan": body.plan.value,
    }


# ─── Admin download report PDF directly ──────────────────
@router.get("/analyses/{analysis_id}/download-pdf")
async def admin_download_pdf(
    analysis_id: uuid.UUID,
    lang: str = "pt",
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin downloads the PDF for any analysis directly (PT or EN)."""
    from app.services.pdf_service import generate_report_pdf
    from app.core.security import create_download_token
    from fastapi.responses import FileResponse
    import asyncio, os

    if lang not in ("pt", "en"):
        lang = "pt"

    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Análise ainda não está concluída.")

    # Find existing report
    report = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()

    cached_path = (report.file_path_en if lang == "en" else report.file_path) if report else None

    # Generate if no cached PDF for requested lang
    if not cached_path or not os.path.exists(cached_path):
        if not analysis.plan:
            analysis.plan = PlanType.PROFISSIONAL
            await db.commit()
            await db.refresh(analysis)
        try:
            pdf_path = await asyncio.to_thread(generate_report_pdf, analysis, lang=lang)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Falha ao gerar PDF: {exc}")

        if report:
            if lang == "en":
                report.file_path_en = pdf_path
            else:
                report.file_path = pdf_path
            await db.commit()
        else:
            report = Report(
                analysis_id=analysis.id,
                version=1,
                file_path=pdf_path if lang == "pt" else None,
                file_path_en=pdf_path if lang == "en" else None,
                download_token=create_download_token(str(analysis.id)),
            )
            db.add(report)
            await db.commit()
            await db.refresh(report)
        cached_path = pdf_path

    company = (analysis.company_name or str(analysis_id)).replace(" ", "_")
    lang_suffix = "-en" if lang == "en" else ""
    return FileResponse(
        cached_path,
        media_type="application/pdf",
        filename=f"relatorio-valuora-{company}{lang_suffix}.pdf",
    )


# ─── Admin send report to client email ───────────────────
class AdminSendReportBody(BaseModel):
    custom_email: Optional[str] = None  # if set, send to this email instead of the client's


@router.post("/analyses/{analysis_id}/send-to-client")
async def admin_send_report_to_client(
    analysis_id: uuid.UUID,
    body: AdminSendReportBody = Body(default=AdminSendReportBody()),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Send the existing report to the client's email (or a custom email)."""
    from app.core.config import settings
    from app.services.email_service import send_report_ready_email

    result = await db.execute(
        select(Analysis, User)
        .outerjoin(User, Analysis.user_id == User.id)
        .where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    analysis, owner = row

    report = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=400, detail="Relatório ainda não foi gerado. Gere o relatório primeiro.")

    # Always issue a fresh download token so the link has a full 48-hour window
    from app.core.security import create_download_token
    fresh_token = create_download_token(str(analysis_id))
    report.download_token = fresh_token
    await db.commit()

    download_url = f"{settings.APP_URL}/api/v1/reports/download?token={fresh_token}"

    # Resolve target email: explicit > owner > AnalysisInvite (guided analyses)
    fallback_email: str | None = None
    fallback_name: str = "Cliente"
    if not body.custom_email and not owner:
        invite = (await db.execute(
            select(AnalysisInvite).where(AnalysisInvite.analysis_id == analysis_id)
        )).scalar_one_or_none()
        if invite:
            fallback_email = invite.client_email
            fallback_name = invite.client_name or "Cliente"

    target_email = body.custom_email or (owner.email if owner else fallback_email)
    target_name = body.custom_email and "Cliente" or (owner.full_name if owner else fallback_name)
    if not target_email:
        raise HTTPException(status_code=422, detail="E-mail do destinatário não encontrado. Informe custom_email.")

    await send_report_ready_email(target_email, target_name, analysis.company_name, download_url)

    await audit_log(
        action="admin_send_report_to_client",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
        detail=f"sent_to={target_email}",
    )

    return {"ok": True, "message": f"Relatório enviado para {target_email}."}


class AdminResendReportBody(BaseModel):
    channel: str = "email"   # "email", "whatsapp", "both"
    lang: str = "pt"          # "pt" or "en"
    custom_email: Optional[str] = None
    note: Optional[str] = None


@router.post("/analyses/{analysis_id}/resend-report")
async def resend_report(
    analysis_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    body: Optional[AdminResendReportBody] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Força o reenvio do relatório para o usuário (admin).

    Aceita channel (email/whatsapp/both), lang (pt/en), custom_email, note.
    Se o relatório já existe, reenvia com o link de download.
    Se não, gera um novo PDF e envia.
    """
    if body is None:
        body = AdminResendReportBody()
    from app.routes.payments import _generate_and_send_report
    from app.core.security import create_download_token
    from app.core.config import settings
    from app.services.email_service import send_report_ready_email

    result = await db.execute(
        select(Analysis, User)
        .outerjoin(User, Analysis.user_id == User.id)
        .where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    analysis, owner = row

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Análise ainda não foi concluída.")

    # Resolve email and name
    resend_email: str | None = body.custom_email or (owner.email if owner else None)
    resend_name: str = (owner.full_name or owner.email) if owner else "Cliente"
    if not resend_email:
        invite = (await db.execute(
            select(AnalysisInvite).where(AnalysisInvite.analysis_id == analysis_id)
        )).scalar_one_or_none()
        if invite:
            resend_email = invite.client_email
            resend_name = invite.client_name or "Cliente"
    if not resend_email and body.channel in ("email", "both"):
        raise HTTPException(status_code=422, detail="E-mail do destinatário não encontrado.")

    # Check if a report row already exists
    existing = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()

    notifications_sent = []

    if existing:
        # Issue a fresh token
        fresh_token = create_download_token(str(analysis_id))
        existing.download_token = fresh_token
        await db.commit()
        download_url = f"{settings.APP_URL}/api/v1/reports/download?token={fresh_token}"

        # E-mail
        if body.channel in ("email", "both") and resend_email:
            try:
                await send_report_ready_email(resend_email, resend_name, analysis.company_name, download_url)
                notifications_sent.append("e-mail")
            except Exception as e:
                notifications_sent.append(f"e-mail (erro: {e})")

        # WhatsApp
        if body.channel in ("whatsapp", "both"):
            try:
                from app.services.whatsapp_service import send_report_pdf as _wa_pdf
                pdf_path = existing.file_path_en if body.lang == "en" and existing.file_path_en else existing.file_path
                if pdf_path:
                    owner_phone = getattr(owner, "phone", None) if owner else None
                    if owner_phone:
                        await _wa_pdf(
                            phone=owner_phone,
                            user_name=resend_name,
                            company_name=analysis.company_name,
                            pdf_path=pdf_path,
                            report_url=download_url,
                            lang=body.lang,
                            user_id=str(owner.id) if owner else None,
                        )
                        notifications_sent.append("WhatsApp")
                    else:
                        notifications_sent.append("WhatsApp (sem telefone)")
                else:
                    notifications_sent.append("WhatsApp (PDF não encontrado)")
            except Exception as e:
                notifications_sent.append(f"WhatsApp (erro: {e})")

        sent_str = " e ".join(notifications_sent) if notifications_sent else "nenhuma notificação"
        return {"ok": True, "message": f"Relatório reenviado: {sent_str}."}

    # No report yet — generate in background
    if not analysis.plan:
        analysis.plan = PlanType.PROFISSIONAL
        await db.commit()

    if background_tasks:
        background_tasks.add_task(_generate_and_send_report, str(analysis_id), str(analysis.user_id))

    await audit_log(
        action="admin_resend_report",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
    )
    return {"ok": True, "message": "Geração do relatório iniciada. O usuário receberá o e-mail em breve."}


# ─── PA: Permanently delete analysis (admin only) ────────

@router.delete("/analyses/{analysis_id}")
async def admin_delete_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Permanently deletes an analysis and all associated data
    (reports, payments, versions, simulations) from the database.
    The client will no longer see this analysis.
    Only superadmins or admins can perform this action.
    """
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    company_name = analysis.company_name
    user_id_str = str(analysis.user_id) if analysis.user_id else "—"

    await db.delete(analysis)
    await db.commit()

    await cache_delete_pattern("admin:analyses:*")

    await audit_log(
        action="admin_delete_analysis",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
        detail=f"company={company_name} owner={user_id_str}",
    )

    return {"ok": True, "message": f'Análise "{company_name}" excluída permanentemente.'}


# ─── Reprocess (failed / stuck) analysis ─────────────────────
@router.post("/analyses/{analysis_id}/reprocess")
async def admin_reprocess_analysis(
    analysis_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Força novo processamento de análise com status failed ou presa em draft+paid."""
    from app.routes.payments import _generate_and_send_report

    result = await db.execute(
        select(Analysis, User)
        .outerjoin(User, Analysis.user_id == User.id)
        .where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    analysis, owner = row

    if analysis.status not in (AnalysisStatus.FAILED, AnalysisStatus.DRAFT, AnalysisStatus.PROCESSING):
        raise HTTPException(
            status_code=400,
            detail=f"Análise está '{analysis.status.value}' — só é possível reprocessar status failed, draft ou processing.",
        )

    if not owner or not owner.id:
        raise HTTPException(status_code=400, detail="Análise sem usuário vinculado. Não é possível reprocessar.")

    # Reset status to draft so the pipeline can rerun
    analysis.status = AnalysisStatus.DRAFT
    if not analysis.plan:
        analysis.plan = PlanType.PROFISSIONAL
    await db.commit()

    background_tasks.add_task(_generate_and_send_report, str(analysis_id), str(owner.id))

    await audit_log(
        action="admin_reprocess_analysis",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
    )
    return {"ok": True, "message": "Reprocessamento iniciado. O status será atualizado em breve."}


# ─── Force generate for draft+paid analyses ───────────────────
@router.post("/analyses/{analysis_id}/force-generate")
async def admin_force_generate(
    analysis_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Força geração de PDF em análise draft onde pagamento já foi confirmado."""
    from app.routes.payments import _generate_and_send_report

    result = await db.execute(
        select(Analysis, User)
        .outerjoin(User, Analysis.user_id == User.id)
        .where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    analysis, owner = row

    if not owner or not owner.id:
        raise HTTPException(status_code=400, detail="Análise sem usuário vinculado.")

    # Mark as completed so the PDF generator runs (payment already confirmed)
    analysis.status = AnalysisStatus.COMPLETED
    if not analysis.plan:
        analysis.plan = PlanType.PROFISSIONAL
    await db.commit()

    background_tasks.add_task(_generate_and_send_report, str(analysis_id), str(owner.id))

    await audit_log(
        action="admin_force_generate",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
    )
    return {"ok": True, "message": "Geração forçada iniciada."}


# ─── PA3: Refund a payment via Asaas ─────────────────────
@router.post("/payments/{payment_id}/refund")
async def refund_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from app.services.asaas_service import asaas_service

    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    if payment.status != PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Só é possível reembolsar pagamentos confirmados.")

    # If it has an Asaas ID, refund via API
    if payment.asaas_payment_id and payment.payment_method != "admin_bypass":
        try:
            await asaas_service.refund_payment(payment.asaas_payment_id)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Erro ao reembolsar no Asaas: {str(e)}")

    payment.status = PaymentStatus.REFUNDED
    await db.commit()
    return {"message": "Pagamento reembolsado com sucesso."}


class AdminResendChargeBody(BaseModel):
    due_days: int = 3       # 3, 7 or 15
    channel: str = "email"  # "email", "whatsapp", "both"


# ─── Resend charge (new Asaas link + reminder email/WhatsApp) ─
@router.post("/payments/{payment_id}/resend-charge")
async def resend_charge(
    payment_id: uuid.UUID,
    body: Optional[AdminResendChargeBody] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Cria uma nova cobrança no Asaas (link novo, vencimento configurável) para um
    pagamento pendente/expirado e notifica o cliente por e-mail, WhatsApp ou ambos.

    Fluxo:
    1. Busca o payment + analysis + user no banco.
    2. Cancela o payment_id antigo no Asaas (se existir), para não deixar lixo.
    3. Cria nova cobrança no Asaas com preço normal e vencimento = today + due_days.
    4. Atualiza o registro de Payment com o novo asaas_payment_id e invoice_url.
    5. Notifica conforme channel (email / whatsapp / both).
    """
    if body is None:
        body = AdminResendChargeBody()
    from app.services.asaas_service import asaas_service
    from app.core.config import settings as _settings

    # ── 1. Buscar payment ──────────────────────────────────────
    result = await db.execute(
        select(Payment, Analysis, User)
        .outerjoin(Analysis, Payment.analysis_id == Analysis.id)
        .outerjoin(User, Payment.user_id == User.id)
        .where(Payment.id == payment_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")

    payment, analysis, user = row

    if payment.status == PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Este pagamento já foi confirmado.")

    # Determine recipient email and name
    recipient_email = (
        user.email if user
        else payment.customer_email
    )
    recipient_name = (
        (user.full_name or user.email) if user
        else (payment.customer_name or payment.customer_email or "cliente")
    )

    if not recipient_email and body.channel in ("email", "both"):
        raise HTTPException(status_code=400, detail="Nenhum e-mail encontrado para este pagamento.")

    company_name = (analysis.company_name if analysis else None) or payment.description or "sua empresa"
    plan = payment.plan  # PlanType enum or None

    # ── 2. Tentar cancelar cobrança antiga no Asaas ────────────
    if payment.asaas_payment_id and payment.payment_method not in (None, "admin_bypass"):
        try:
            await asaas_service._request("DELETE", f"payments/{payment.asaas_payment_id}")
        except Exception:
            pass  # Ignora se já expirou ou não existe mais

    # ── 3. Criar nova cobrança no Asaas ───────────────────────
    # Precisamos do asaas_customer_id; se não tiver, busca/cria pelo email
    customer_id = payment.asaas_customer_id
    if not customer_id:
        cpf_cnpj = None
        if user and user.cpf_cnpj:
            cpf_cnpj = ''.join(c for c in user.cpf_cnpj if c.isdigit()) or None
        try:
            customer = await asaas_service.find_or_create_customer(
                name=recipient_name,
                email=recipient_email,
                cpf_cnpj=cpf_cnpj,
            )
            customer_id = customer["id"]
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Erro ao localizar cliente no Asaas: {e}")

    from app.schemas.analysis import PLAN_PRICES
    plan_price = float(PLAN_PRICES.get(plan, payment.amount or 0)) if plan else float(payment.amount or 0)

    plan_labels = {PlanType.PROFISSIONAL: "Profissional", PlanType.ESTRATEGICO: "Estratégico"}
    plan_label = plan_labels.get(plan, str(plan.value).capitalize() if plan else "Premium")

    from datetime import timedelta, timezone as _tz
    due_date = (datetime.now(_tz.utc) + timedelta(days=body.due_days)).strftime("%Y-%m-%d")

    try:
        new_asaas = await asaas_service.create_payment(
            customer_id=customer_id,
            value=plan_price,
            description=f"Valuora - Plano {plan_label} - {company_name}",
            external_reference=str(payment.analysis_id) if payment.analysis_id else str(payment.id),
            due_date=due_date,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao criar cobrança no Asaas: {e}")

    new_invoice_url = new_asaas.get("invoiceUrl", "")

    # ── 4. Atualizar Payment no banco ─────────────────────────
    payment.asaas_payment_id = new_asaas["id"]
    payment.asaas_customer_id = customer_id
    payment.asaas_invoice_url = new_invoice_url
    payment.status = PaymentStatus.PENDING
    await db.commit()

    # ── 5. Notificar cliente (email / whatsapp / ambos) ────────
    frontend_url = getattr(_settings, "FRONTEND_URL", "https://valuora.online")
    analysis_url = (
        f"{frontend_url}/analise/{payment.analysis_id}"
        if payment.analysis_id
        else frontend_url
    )

    pages_by_plan = {PlanType.PROFISSIONAL: "~15 páginas", PlanType.ESTRATEGICO: "~35 páginas"}
    pages = pages_by_plan.get(plan, "relatório completo")
    notifications_sent = []

    # E-mail
    if body.channel in ("email", "both") and recipient_email:
        try:
            await send_templated_email(
                template="charge_reminder",
                to=recipient_email,
                subject=f"💳 {company_name}: seu relatório de valuation está esperando",
                context={
                    "name": recipient_name.split()[0] if recipient_name else "cliente",
                    "company_name": company_name,
                    "plan_label": plan_label,
                    "pages": pages,
                    "is_estrategico": plan == PlanType.ESTRATEGICO,
                    "analysis_url": analysis_url,
                },
            )
            notifications_sent.append("e-mail")
        except Exception as e:
            notifications_sent.append(f"e-mail (erro: {e})")

    # WhatsApp
    if body.channel in ("whatsapp", "both"):
        try:
            from app.services.whatsapp_service import send_text_message as _wa_text
            recipient_phone = (user.phone if user and getattr(user, "phone", None) else None)
            if recipient_phone:
                wa_msg = (
                    f"Olá {recipient_name.split()[0] if recipient_name else 'cliente'}, "
                    f"sua análise *{company_name}* aguarda pagamento. "
                    f"Acesse o link para finalizar: {new_invoice_url or analysis_url}"
                )
                await _wa_text(phone=recipient_phone, message=wa_msg, user_id=str(user.id) if user else None)
                notifications_sent.append("WhatsApp")
            else:
                notifications_sent.append("WhatsApp (sem telefone cadastrado)")
        except Exception as e:
            notifications_sent.append(f"WhatsApp (erro: {e})")

    sent_str = " e ".join(notifications_sent) if notifications_sent else "nenhuma notificação"
    return {
        "message": f"Nova cobrança criada. Notificações: {sent_str}.",
        "new_invoice_url": new_invoice_url,
        "asaas_payment_id": new_asaas["id"],
    }


# ─── Coupon CRUD ──────────────────────────────────────────────
class CouponCreate(BaseModel):
    code: str
    description: Optional[str] = None
    discount_pct: float  # 0.10 = 10%
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True


class CouponResponse(BaseModel):
    id: uuid.UUID
    code: str
    description: Optional[str] = None
    discount_pct: float
    max_uses: Optional[int] = None
    used_count: int
    expires_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/coupons", response_model=List[CouponResponse])
async def list_coupons(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
    return result.scalars().all()


@router.post("/coupons", response_model=CouponResponse)
async def create_coupon(
    data: CouponCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if not (0 < data.discount_pct <= 1):
        raise HTTPException(status_code=400, detail="discount_pct deve estar entre 0 e 1 (ex: 0.10 para 10%, 1.0 para 100%).")
    code = data.code.strip().upper()
    existing = (await db.execute(select(Coupon).where(Coupon.code == code))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Código de cupom já existe.")
    coupon = Coupon(
        code=code,
        description=data.description,
        discount_pct=data.discount_pct,
        max_uses=data.max_uses,
        expires_at=data.expires_at,
        is_active=data.is_active,
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return coupon


@router.patch("/coupons/{coupon_id}", response_model=CouponResponse)
async def update_coupon(
    coupon_id: uuid.UUID,
    data: CouponCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupom não encontrado.")
    if not (0 < data.discount_pct <= 1):
        raise HTTPException(status_code=400, detail="discount_pct deve estar entre 0 e 1 (ex: 0.10 para 10%, 1.0 para 100%).")
    coupon.code = data.code.strip().upper()
    coupon.description = data.description
    coupon.discount_pct = data.discount_pct
    coupon.max_uses = data.max_uses
    coupon.expires_at = data.expires_at
    coupon.is_active = data.is_active
    await db.commit()
    await db.refresh(coupon)
    return coupon


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupom não encontrado.")
    await db.delete(coupon)
    await db.commit()
    return {"message": "Cupom excluído."}

# \u2500\u2500\u2500 Admin: enviar cup\u00f3m por e-mail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
class SendCouponEmailBody(BaseModel):
    user_id: uuid.UUID
    coupon_id: uuid.UUID
    message: Optional[str] = None  # optional personal message


@router.post("/send-coupon-email")
async def send_coupon_email_to_user(
    data: SendCouponEmailBody,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Envia e-mail com cup\u00f3m personalizado para um usu\u00e1rio espec\u00edfico."""
    user = (await db.execute(select(User).where(User.id == data.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usu\u00e1rio n\u00e3o encontrado.")

    coupon = (await db.execute(select(Coupon).where(Coupon.id == data.coupon_id))).scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="Cup\u00f3m n\u00e3o encontrado.")
    if not coupon.is_active:
        raise HTTPException(status_code=400, detail="Cup\u00f3m inativo. Ative-o antes de enviar.")

    discount_label = f"{int(coupon.discount_pct * 100)}% de desconto"
    expires_label = ""
    if coupon.expires_at:
        expires_label = coupon.expires_at.strftime("%d/%m/%Y")

    background_tasks.add_task(
        send_coupon_gift_email,
        user.email,
        user.full_name or user.email,
        coupon.code,
        discount_label,
        expires_label,
        data.message or "",
    )
    return {"message": f"E-mail com cup\u00f3m {coupon.code} agendado para {user.email}."}

# ─── Audit Log ────────────────────────────────────────────
@router.get("/audit-log")
async def list_audit_log(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: User = Depends(get_current_admin),
):
    """Return the most recent audit log entries (newest first)."""
    entries = await get_audit_log(limit=limit, offset=offset)
    return entries


# ─── Admin Partners (dedicated management) ───────────────

@router.get("/partners", response_model=None)
async def admin_list_partners(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """List all partners with full stats: clients, guided analyses, commissions."""
    from app.models.models import Commission, CommissionStatus, PartnerClient

    # Load all partners with user info
    rows = (await db.execute(
        select(Partner, User)
        .join(User, Partner.user_id == User.id)
        .where(User.deleted_at.is_(None))
        .order_by(Partner.created_at.desc())
    )).all()

    if search:
        s = search.lower()
        rows = [r for r in rows if s in (r[1].full_name or "").lower()
                or s in (r[1].email or "").lower()
                or s in (r[0].referral_code or "").lower()
                or s in (r[0].company_name or "").lower()]

    partner_ids = [p.id for p, _ in rows]

    # Bulk-load commissions
    commissions_res = (await db.execute(
        select(Commission).where(Commission.partner_id.in_(partner_ids))
    )).scalars().all()
    comms_by_partner: dict = {}
    for c in commissions_res:
        comms_by_partner.setdefault(c.partner_id, []).append(c)

    # Bulk-load client counts
    client_counts_res = (await db.execute(
        select(PartnerClient.partner_id, func.count(PartnerClient.id).label("cnt"))
        .where(PartnerClient.partner_id.in_(partner_ids))
        .group_by(PartnerClient.partner_id)
    )).all()
    client_counts = {r.partner_id: r.cnt for r in client_counts_res}

    # Bulk-load guided analyses counts
    guided_counts_res = (await db.execute(
        select(Analysis.partner_id, func.count(Analysis.id).label("cnt"))
        .where(Analysis.partner_id.in_(partner_ids), Analysis.deleted_at.is_(None))
        .group_by(Analysis.partner_id)
    )).all()
    guided_counts = {r.partner_id: r.cnt for r in guided_counts_res}

    result = []
    for partner, user in rows:
        commissions = comms_by_partner.get(partner.id, [])
        pending = sum(float(c.partner_amount) for c in commissions if c.status == CommissionStatus.PENDING)
        approved = sum(float(c.partner_amount) for c in commissions if c.status == CommissionStatus.APPROVED)
        paid = sum(float(c.partner_amount) for c in commissions if c.status == CommissionStatus.PAID)
        # Oldest pending commission age in days
        pending_comms = [c for c in commissions if c.status == CommissionStatus.PENDING and c.created_at]
        oldest_pending_days = 0
        if pending_comms:
            from datetime import timezone as _tz
            oldest = min(c.created_at for c in pending_comms)
            oldest_dt = oldest.replace(tzinfo=_tz.utc) if oldest.tzinfo is None else oldest
            oldest_pending_days = (datetime.now(_tz.utc) - oldest_dt).days
        result.append({
            "id": str(partner.id),
            "user_id": str(partner.user_id),
            "name": user.full_name,
            "email": user.email,
            "company_name": partner.company_name,
            "referral_code": partner.referral_code,
            "status": partner.status.value if partner.status else None,
            "commission_rate": float(partner.commission_rate) if partner.commission_rate else 0,
            "pix_key": partner.pix_key,
            "pix_key_type": partner.pix_key_type.value if partner.pix_key_type else None,
            "total_sales": partner.total_sales or 0,
            "total_earnings": float(partner.total_earnings or 0),
            "clients_count": client_counts.get(partner.id, 0),
            "guided_analyses_count": guided_counts.get(partner.id, 0),
            "commissions_pending": pending,
            "commissions_approved": approved,
            "commissions_paid": paid,
            "oldest_pending_days": oldest_pending_days,
            "admin_notes": getattr(partner, "admin_notes", None),
            "created_at": partner.created_at.isoformat() if partner.created_at else None,
        })
    return {"partners": result, "total": len(result)}


@router.get("/partners/{partner_id}/clients", response_model=None)
async def admin_partner_clients(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """List all clients of a specific partner with their analyses and payment status."""
    from app.models.models import PartnerClient

    partner = (await db.execute(select(Partner).where(Partner.id == partner_id))).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")

    clients_res = (await db.execute(
        select(PartnerClient)
        .where(PartnerClient.partner_id == partner_id)
        .order_by(PartnerClient.created_at.desc())
    )).scalars().all()

    # For each client, fetch their analyses
    client_user_ids = [c.user_id for c in clients_res if c.user_id]
    analyses_res = (await db.execute(
        select(Analysis, Report.id.label("report_id"), Payment.status.label("pay_status"), Payment.amount.label("pay_amount"))
        .outerjoin(Report, Report.analysis_id == Analysis.id)
        .outerjoin(Payment, Payment.analysis_id == Analysis.id)
        .where(Analysis.user_id.in_(client_user_ids), Analysis.deleted_at.is_(None))
    )).all()
    analyses_by_user: dict = {}
    for a, rid, ps, pa in analyses_res:
        analyses_by_user.setdefault(a.user_id, []).append({
            "id": str(a.id),
            "company_name": a.company_name,
            "status": a.status.value,
            "equity_value": float(a.equity_value) if a.equity_value else None,
            "plan": a.plan.value if a.plan else None,
            "has_report": rid is not None,
            "payment_status": ps.value if ps else None,
            "payment_amount": float(pa) if pa else None,
            "created_at": a.created_at.isoformat(),
        })

    # Fetch user emails for clients
    users_res = (await db.execute(
        select(User).where(User.id.in_(client_user_ids))
    )).scalars().all()
    users_map = {u.id: u for u in users_res}

    return {
        "clients": [
            {
                "id": str(c.id),
                "client_name": c.client_name,
                "client_email": c.client_email,
                "client_phone": getattr(c, "client_phone", None),
                "user_id": str(c.user_id) if c.user_id else None,
                "user_email": users_map[c.user_id].email if c.user_id and c.user_id in users_map else None,
                "suggested_plan": c.suggested_plan.value if getattr(c, "suggested_plan", None) else None,
                "notes": getattr(c, "notes", None),
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "analyses": analyses_by_user.get(c.user_id, []) if c.user_id else [],
            }
            for c in clients_res
        ],
        "total": len(clients_res),
    }


@router.get("/partners/{partner_id}/commissions", response_model=None)
async def admin_partner_commissions(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """List all commissions for a specific partner."""
    from app.models.models import Commission, CommissionStatus

    partner = (await db.execute(select(Partner).where(Partner.id == partner_id))).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")

    comms = (await db.execute(
        select(Commission, Analysis.company_name.label("company"))
        .outerjoin(Payment, Commission.payment_id == Payment.id)
        .outerjoin(Analysis, Payment.analysis_id == Analysis.id)
        .where(Commission.partner_id == partner_id)
        .order_by(Commission.created_at.desc())
    )).all()

    return {
        "commissions": [
            {
                "id": str(c.id),
                "company_name": company,
                "total_amount": float(c.total_amount),
                "partner_amount": float(c.partner_amount),
                "system_amount": float(c.system_amount),
                "status": c.status.value,
                "created_at": c.created_at.isoformat(),
            }
            for c, company in comms
        ],
        "total": len(comms),
    }


@router.patch("/partners/{partner_id}/status", response_model=None)
async def admin_update_partner_status(
    partner_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Activate or deactivate a partner."""
    partner = (await db.execute(select(Partner).where(Partner.id == partner_id))).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")
    new_status_str = body.get("status")
    if new_status_str not in ("active", "inactive", "pending", "suspended"):
        raise HTTPException(status_code=422, detail="Status inválido. Use: active, inactive, pending.")
    partner.status = PartnerStatus(new_status_str)
    await db.commit()
    await audit_log(
        action="admin_partner_status",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(partner_id),
        detail=f"status={new_status_str}",
    )
    return {"ok": True, "status": new_status_str}


@router.patch("/partners/{partner_id}/edit", response_model=None)
async def admin_edit_partner(
    partner_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Edit partner commission_rate and/or admin_notes."""
    partner = (await db.execute(select(Partner).where(Partner.id == partner_id))).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")
    changed = []
    if "commission_rate" in body:
        rate = float(body["commission_rate"])
        if not 0 <= rate <= 1:
            raise HTTPException(status_code=422, detail="commission_rate deve ser entre 0 e 1.")
        partner.commission_rate = rate
        changed.append(f"commission_rate={rate}")
    if "admin_notes" in body:
        partner.admin_notes = body["admin_notes"]
        changed.append("admin_notes updated")
    await db.commit()
    if changed:
        await audit_log(
            action="admin_partner_edit",
            user_id=str(admin.id),
            user_email=admin.email,
            resource_id=str(partner_id),
            detail="; ".join(changed),
        )
    return {"ok": True}


@router.post("/partners/{partner_id}/payouts", response_model=None)
async def admin_create_payout(
    partner_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Register a manual PIX payout for a partner."""
    from app.models.models import PartnerPayout, Commission, CommissionStatus
    partner = (await db.execute(select(Partner).where(Partner.id == partner_id))).scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")
    amount = body.get("amount")
    if not amount or float(amount) <= 0:
        raise HTTPException(status_code=422, detail="Valor inválido.")
    note = body.get("note")
    payout = PartnerPayout(
        id=uuid.uuid4(),
        partner_id=partner_id,
        amount=float(amount),
        pix_key=body.get("pix_key") or partner.pix_key,
        pix_key_type=body.get("pix_key_type") or (partner.pix_key_type.value if partner.pix_key_type else None),
        note=note,
        paid_by_admin_id=admin.id,
    )
    db.add(payout)
    # Mark approved commissions as PAID if commission_ids provided
    commission_ids = body.get("commission_ids", [])
    if commission_ids:
        comms = (await db.execute(
            select(Commission).where(
                Commission.id.in_([uuid.UUID(c) for c in commission_ids]),
                Commission.partner_id == partner_id,
            )
        )).scalars().all()
        paid_total = 0.0
        for c in comms:
            # Only approved commissions are payable; skip already-paid (idempotent) and pending
            if c.status != CommissionStatus.APPROVED:
                continue
            c.status = CommissionStatus.PAID
            c.paid_at = datetime.now(timezone.utc)
            paid_total += float(c.partner_amount)
        if paid_total:
            partner.total_earnings = float(partner.total_earnings or 0) + paid_total
    await db.commit()
    await audit_log(
        action="admin_partner_payout",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(partner_id),
        detail=f"amount={amount}; note={note}",
    )
    return {"ok": True, "payout_id": str(payout.id)}


@router.get("/partners/{partner_id}/payouts", response_model=None)
async def admin_list_payouts(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """List all payouts for a partner."""
    from app.models.models import PartnerPayout
    payouts = (await db.execute(
        select(PartnerPayout)
        .where(PartnerPayout.partner_id == partner_id)
        .order_by(PartnerPayout.created_at.desc())
    )).scalars().all()
    return {
        "payouts": [
            {
                "id": str(p.id),
                "amount": float(p.amount),
                "pix_key": p.pix_key,
                "pix_key_type": p.pix_key_type,
                "note": p.note,
                "created_at": p.created_at.isoformat(),
            }
            for p in payouts
        ],
        "total_paid": sum(float(p.amount) for p in payouts),
    }


@router.get("/partners/{partner_id}/pipeline", response_model=None)
async def admin_partner_pipeline(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Return partner clients grouped by pipeline stage (Kanban view)."""
    from app.models.models import PartnerClient
    clients = (await db.execute(
        select(PartnerClient)
        .where(PartnerClient.partner_id == partner_id)
        .order_by(PartnerClient.created_at.desc())
    )).scalars().all()
    stages: dict = {}
    for c in clients:
        stage = c.pipeline_stage or "lead"
        stages.setdefault(stage, []).append({
            "id": str(c.id),
            "client_name": c.client_name,
            "client_email": c.client_email,
            "client_phone": c.client_phone,
            "notes": c.notes,
            "plan": c.plan.value if c.plan else None,
            "analysis_id": str(c.analysis_id) if c.analysis_id else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    ordered = ["lead", "contact", "proposal", "negotiation", "won", "lost"]
    return {
        "stages": {s: stages.get(s, []) for s in ordered},
        "extra": {k: v for k, v in stages.items() if k not in ordered},
    }


# ─── Admin Analytics ──────────────────────────────────────
@router.get("/analytics", response_model=None)
async def admin_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Rich analytics: funnel, MRR, churn, recurrent users, UTM, stale analyses."""
    from datetime import timedelta
    from app.models.models import AnalysisStatus as AS, Commission

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # ─── Funnel ───────────────────────────────────────────
    total_analyses = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.created_at >= since, Analysis.deleted_at.is_(None))
    )).scalar() or 0
    paid_analyses = (await db.execute(
        select(func.count(Payment.id)).where(Payment.created_at >= since, Payment.status == PaymentStatus.PAID)
    )).scalar() or 0
    completed_analyses = (await db.execute(
        select(func.count(Analysis.id)).where(
            Analysis.created_at >= since, Analysis.status == AS.COMPLETED, Analysis.deleted_at.is_(None)
        )
    )).scalar() or 0
    with_report = (await db.execute(
        select(func.count(Report.id)).where(Report.created_at >= since)
    )).scalar() or 0

    # ─── MRR by month (last 12 months) ─────────────────────
    mrr_rows = (await db.execute(
        select(
            func.date_trunc('month', Payment.created_at).label("month"),
            func.sum(Payment.amount).label("revenue"),
            func.count(Payment.id).label("count"),
        )
        .where(Payment.status == PaymentStatus.PAID, Payment.created_at >= datetime.now(timezone.utc) - timedelta(days=365))
        .group_by(func.date_trunc('month', Payment.created_at))
        .order_by(func.date_trunc('month', Payment.created_at))
    )).all()
    mrr = [
        {"month": r.month.strftime("%Y-%m"), "revenue": float(r.revenue or 0), "count": r.count}
        for r in mrr_rows
    ]

    # ─── Ticket médio por plano ─────────────────────────────
    ticket_rows = (await db.execute(
        select(Payment.plan, func.avg(Payment.amount).label("avg"), func.count(Payment.id).label("cnt"))
        .where(Payment.status == PaymentStatus.PAID)
        .group_by(Payment.plan)
    )).all()
    tickets = [
        {"plan": r.plan.value if r.plan else "sem_plano", "avg": round(float(r.avg or 0), 2), "count": r.cnt}
        for r in ticket_rows
    ]

    # ─── Recurrent users (paid > 1x) ───────────────────────
    recurrent_rows = (await db.execute(
        select(Payment.user_id, func.count(Payment.id).label("payments"))
        .where(Payment.status == PaymentStatus.PAID, Payment.user_id.isnot(None))
        .group_by(Payment.user_id)
        .having(func.count(Payment.id) > 1)
        .order_by(func.count(Payment.id).desc())
        .limit(20)
    )).all()
    recurrent_user_ids = [r.user_id for r in recurrent_rows]
    recurrent_users_detail = []
    if recurrent_user_ids:
        users_res = (await db.execute(select(User).where(User.id.in_(recurrent_user_ids)))).scalars().all()
        user_map = {u.id: u for u in users_res}
        recurrent_users_detail = [
            {"user_id": str(r.user_id), "name": user_map[r.user_id].full_name if r.user_id in user_map else "?",
             "email": user_map[r.user_id].email if r.user_id in user_map else "?", "payments": r.payments}
            for r in recurrent_rows if r.user_id in user_map
        ]

    # ─── Churn: paid but no activity in 90 days ────────────
    ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
    churned = (await db.execute(
        select(func.count(func.distinct(Payment.user_id)))
        .where(
            Payment.status == PaymentStatus.PAID,
            Payment.user_id.isnot(None),
            ~Payment.user_id.in_(
                select(Analysis.user_id).where(
                    Analysis.created_at >= ninety_days_ago,
                    Analysis.user_id.isnot(None),
                    Analysis.deleted_at.is_(None),
                )
            )
        )
    )).scalar() or 0

    # ─── Stale analyses (created but not completed in X days) ───
    stale_rows = (await db.execute(
        select(Analysis, User.full_name.label("uname"), User.email.label("uemail"))
        .outerjoin(User, Analysis.user_id == User.id)
        .where(
            Analysis.status == AS.PENDING,
            Analysis.created_at <= since,
            Analysis.deleted_at.is_(None),
        )
        .order_by(Analysis.created_at.asc())
        .limit(50)
    )).all()
    stale = [
        {"id": str(a.id), "company_name": a.company_name, "user_name": uname, "user_email": uemail,
         "created_at": a.created_at.isoformat(), "days_old": (datetime.now(timezone.utc) - a.created_at).days}
        for a, uname, uemail in stale_rows
    ]

    # ─── UTM breakdown ─────────────────────────────────────
    utm_rows = (await db.execute(
        select(User.utm_source, User.utm_medium, func.count(User.id).label("cnt"))
        .where(User.created_at >= since, User.utm_source.isnot(None))
        .group_by(User.utm_source, User.utm_medium)
        .order_by(func.count(User.id).desc())
        .limit(20)
    )).all()
    utm = [{"source": r.utm_source, "medium": r.utm_medium, "count": r.cnt} for r in utm_rows]

    # ─── Avg time analysis→payment ─────────────────────────
    avg_time_rows = (await db.execute(
        select(
            func.avg(
                func.extract('epoch', Payment.created_at - Analysis.created_at) / 3600
            ).label("avg_hours")
        )
        .join(Analysis, Payment.analysis_id == Analysis.id)
        .where(Payment.status == PaymentStatus.PAID, Payment.created_at >= since)
    )).scalar()
    avg_hours_to_pay = round(float(avg_time_rows or 0), 1)

    # ─── Partner ranking ───────────────────────────────────
    ranking_rows = (await db.execute(
        select(Partner, User.full_name.label("uname"), User.email.label("uemail"),
               func.sum(Commission.partner_amount).label("earned"),
               func.count(Commission.id).label("comm_count"))
        .join(User, Partner.user_id == User.id)
        .outerjoin(Commission, Commission.partner_id == Partner.id)
        .group_by(Partner.id, User.full_name, User.email)
        .order_by(func.sum(Commission.partner_amount).desc().nulls_last())
        .limit(10)
    )).all()
    ranking = [
        {"id": str(p.id), "name": uname, "email": uemail,
         "total_earned": float(earned or 0), "commissions": comm_count,
         "total_sales": p.total_sales or 0}
        for p, uname, uemail, earned, comm_count in ranking_rows
    ]

    return {
        "funnel": {
            "analyses_created": total_analyses,
            "analyses_paid": paid_analyses,
            "analyses_completed": completed_analyses,
            "with_report": with_report,
            "conversion_rate": round(paid_analyses / total_analyses * 100, 1) if total_analyses else 0,
        },
        "mrr": mrr,
        "tickets": tickets,
        "recurrent_users": recurrent_users_detail,
        "churn_count": churned,
        "stale_analyses": stale,
        "avg_hours_to_pay": avg_hours_to_pay,
        "utm": utm,
        "partner_ranking": ranking,
        "period_days": days,
    }


# ─── Webhook Logs ─────────────────────────────────────────
@router.get("/webhooks/logs", response_model=None)
async def admin_webhook_logs(
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    event: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """List recent Asaas webhook events for debugging."""
    from app.models.models import WebhookLog
    q = select(WebhookLog).order_by(WebhookLog.received_at.desc())
    if event:
        q = q.where(WebhookLog.event == event)
    if status:
        q = q.where(WebhookLog.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    logs = (await db.execute(q.offset(offset).limit(limit))).scalars().all()
    return {
        "logs": [
            {
                "id": str(l.id),
                "source": l.source,
                "event": l.event,
                "asaas_payment_id": l.asaas_payment_id,
                "external_reference": l.external_reference,
                "status": l.status,
                "error_detail": l.error_detail,
                "payload": l.payload,
                "received_at": l.received_at.isoformat(),
            }
            for l in logs
        ],
        "total": total,
    }


# ─── Service Health ───────────────────────────────────────
@router.get("/health/services", response_model=None)
async def admin_service_health(
    admin: User = Depends(get_current_admin),
):
    """Check health of external services: Asaas, Resend, Storage."""
    import httpx
    from app.core.config import settings

    results = {}

    # Asaas
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{settings.ASAAS_BASE_URL}/finance/getCurrentBalance",
                headers={"access_token": settings.ASAAS_API_KEY},
            )
        results["asaas"] = {"status": "ok" if r.status_code == 200 else "degraded", "http": r.status_code}
    except Exception as e:
        results["asaas"] = {"status": "error", "detail": str(e)}

    # Resend
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                "https://api.resend.com/domains",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            )
        results["resend"] = {"status": "ok" if r.status_code == 200 else "degraded", "http": r.status_code}
    except Exception as e:
        results["resend"] = {"status": "error", "detail": str(e)}

    # Database (already connected if we got here)
    results["database"] = {"status": "ok"}

    # Storage (check if env var is set)
    storage_ok = bool(getattr(settings, "AWS_S3_BUCKET", None) or getattr(settings, "STORAGE_PATH", None))
    results["storage"] = {"status": "ok" if storage_ok else "not_configured"}

    return results


# ─── Advanced Export (CSV) ────────────────────────────────
@router.get("/export/users")
async def export_users_csv(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Export all users as CSV (admin only)."""
    import csv, io
    from fastapi.responses import StreamingResponse

    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "email", "full_name", "phone", "company_name",
        "is_active", "is_verified", "is_admin", "created_at",
    ])
    for u in users:
        writer.writerow([
            str(u.id), u.email, u.full_name or "", u.phone or "",
            u.company_name or "", u.is_active, u.is_verified, u.is_admin,
            u.created_at.isoformat() if u.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=usuarios-{__import__('datetime').datetime.now().strftime('%Y%m%d')}.csv"},
    )


@router.get("/export/analyses")
async def export_analyses_csv(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Export all analyses as CSV (admin only)."""
    import csv, io
    from fastapi.responses import StreamingResponse

    # Select only the columns the CSV needs — avoids loading the heavy
    # `valuation_result` JSON column for every row (major memory saver).
    result = await db.execute(
        select(
            Analysis.id, User.email.label("user_email"), Analysis.company_name,
            Analysis.sector, Analysis.status, Analysis.equity_value,
            Analysis.risk_score, Analysis.plan, Analysis.created_at,
        )
        .join(User, Analysis.user_id == User.id)
        .where(Analysis.deleted_at.is_(None))
        .order_by(Analysis.created_at.desc())
        .limit(10000)
    )
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "user_email", "company_name", "sector", "status",
        "equity_value", "risk_score", "plan", "created_at",
    ])
    for r in rows:
        writer.writerow([
            str(r.id), r.user_email, r.company_name, r.sector or "",
            r.status.value if r.status else "", r.equity_value or 0,
            r.risk_score or 0, r.plan.value if r.plan else "",
            r.created_at.isoformat() if r.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=analises-{__import__('datetime').datetime.now().strftime('%Y%m%d')}.csv"},
    )


@router.get("/export/payments")
async def export_payments_csv(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Export all payments as CSV (admin only)."""
    import csv, io
    from fastapi.responses import StreamingResponse

    result = await db.execute(
        select(Payment, User.email.label("user_email"), Analysis.company_name.label("company"))
        .join(User, Payment.user_id == User.id)
        .join(Analysis, Payment.analysis_id == Analysis.id)
        .order_by(Payment.created_at.desc())
        .limit(10000)
    )
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "user_email", "company_name", "plan", "amount",
        "status", "payment_method", "paid_at", "created_at",
    ])
    for p, email, company in rows:
        writer.writerow([
            str(p.id), email, company or "",
            p.plan.value if p.plan else "", float(p.amount or 0),
            p.status.value if p.status else "", p.payment_method or "",
            p.paid_at.isoformat() if p.paid_at else "",
            p.created_at.isoformat() if p.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=pagamentos-{__import__('datetime').datetime.now().strftime('%Y%m%d')}.csv"},
    )


# ─── WhatsApp Admin ──────────────────────────────────────

@router.get("/whatsapp/status")
async def admin_whatsapp_status(
    admin: User = Depends(get_current_admin),
):
    """Check Whatsmiau instance connection status."""
    from app.services.whatsapp_service import check_instance_status
    return await check_instance_status()


@router.post("/whatsapp/test")
async def admin_whatsapp_test(
    body: dict,
    admin: User = Depends(get_current_admin),
):
    """Send a test WhatsApp message to a given phone number."""
    phone = body.get("phone", "").strip()
    if not phone:
        raise HTTPException(status_code=422, detail="phone obrigatório")
    from app.services.whatsapp_service import send_test_message
    result = await send_test_message(phone, user_id=str(admin.id))
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"ok": True, "message": f"Mensagem enviada para {phone}"}


@router.get("/whatsapp/logs")
async def admin_whatsapp_logs(
    event_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """List WhatsApp notification logs."""
    from app.models.models import WhatsAppLog
    from sqlalchemy import func

    q = select(
        WhatsAppLog,
        User.full_name.label("user_name"),
        User.email.label("user_email"),
    ).outerjoin(User, User.id == WhatsAppLog.user_id)

    if event_type:
        q = q.where(WhatsAppLog.event_type == event_type)
    if status:
        q = q.where(WhatsAppLog.status == status)
    if search:
        like = f"%{search}%"
        q = q.where(
            WhatsAppLog.phone.ilike(like) |
            User.full_name.ilike(like) |
            User.email.ilike(like)
        )

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = q.order_by(WhatsAppLog.sent_at.desc()).offset((page - 1) * limit).limit(limit)
    rows = (await db.execute(q)).all()

    return {
        "total": total,
        "logs": [
            {
                "id": str(row.WhatsAppLog.id),
                "phone": row.WhatsAppLog.phone,
                "user_name": row.user_name,
                "user_email": row.user_email,
                "event_type": row.WhatsAppLog.event_type,
                "status": row.WhatsAppLog.status,
                "error": row.WhatsAppLog.error,
                "message_preview": row.WhatsAppLog.message_preview,
                "sent_at": row.WhatsAppLog.sent_at.isoformat() if row.WhatsAppLog.sent_at else None,
            }
            for row in rows
        ],
    }


@router.post("/whatsapp/retry/{log_id}")
async def admin_whatsapp_retry(
    log_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Retry a failed WhatsApp message by log ID. Resends the original message text.
    If the number has no WhatsApp (no LID found), returns 400 with a clear label."""
    from app.models.models import WhatsAppLog
    from app.services.whatsapp_service import _send

    log = (await db.execute(
        select(WhatsAppLog).where(WhatsAppLog.id == log_id)
    )).scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log não encontrado.")
    if log.status == "sent":
        raise HTTPException(status_code=400, detail="Mensagem já foi enviada com sucesso.")
    if not log.phone:
        raise HTTPException(status_code=422, detail="Log não possui número de telefone.")
    if not log.message_preview:
        raise HTTPException(status_code=422, detail="Log não possui preview de mensagem para reenviar.")

    result = await _send(
        phone=log.phone,
        text=log.message_preview,
        event_type=log.event_type,
        user_id=log.user_id,
    )

    if not result["ok"]:
        error_msg = result.get("error") or "Erro desconhecido"
        no_lid = "no LID found" in error_msg or "no lid" in error_msg.lower()
        if no_lid:
            raise HTTPException(
                status_code=400,
                detail=f"Número {log.phone} não tem WhatsApp cadastrado.",
            )
        raise HTTPException(status_code=400, detail=f"Falha ao reenviar: {error_msg}")

    return {"ok": True, "message": f"Mensagem reenviada com sucesso para {log.phone}."}


@router.get("/whatsapp/stats")
async def admin_whatsapp_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Aggregate stats: total sent, failed, by event type — last 30 days."""
    from app.models.models import WhatsAppLog
    from sqlalchemy import func
    from datetime import timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(days=30)

    rows = (await db.execute(
        select(
            WhatsAppLog.event_type,
            WhatsAppLog.status,
            func.count().label("cnt"),
        )
        .where(WhatsAppLog.sent_at >= since)
        .group_by(WhatsAppLog.event_type, WhatsAppLog.status)
    )).all()

    totals = (await db.execute(
        select(WhatsAppLog.status, func.count().label("cnt"))
        .where(WhatsAppLog.sent_at >= since)
        .group_by(WhatsAppLog.status)
    )).all()

    return {
        "totals": {r.status: r.cnt for r in totals},
        "by_event": [
            {"event_type": r.event_type, "status": r.status, "count": r.cnt}
            for r in rows
        ],
    }


# ─── WhatsApp Blacklist ────────────────────────────────────

@router.get("/whatsapp/blacklist")
async def admin_whatsapp_blacklist_list(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    from app.models.models import WhatsAppBlacklist
    rows = (await db.execute(
        select(WhatsAppBlacklist).order_by(WhatsAppBlacklist.created_at.desc())
    )).scalars().all()
    return [
        {"id": str(r.id), "phone": r.phone, "reason": r.reason, "created_at": r.created_at.isoformat()}
        for r in rows
    ]


@router.post("/whatsapp/blacklist")
async def admin_whatsapp_blacklist_add(
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    from app.models.models import WhatsAppBlacklist
    phone = (body.get("phone") or "").strip()
    if not phone:
        raise HTTPException(status_code=422, detail="phone é obrigatório")
    existing = (await db.execute(
        select(WhatsAppBlacklist).where(WhatsAppBlacklist.phone == phone)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Número já está na blacklist")
    # Send confirmation BEFORE adding to blacklist — _send blocks blacklisted numbers
    try:
        from app.services.whatsapp_service import _send
        confirmation = (
            "🔕 You have been removed from Valuora's automated messages.\n\n"
            "Não enviaremos mais nenhuma notificação para este número.\n\n"
            "Se um dia quiser voltar a receber nossas atualizações, "
            "é só responder *RECOMEÇAR* aqui mesmo. 😊"
        )
        await _send(phone, confirmation, "blacklist_optout")
    except Exception as _e:
        logger.warning("[WhatsApp] blacklist confirmation send failed: %r", _e)

    entry = WhatsAppBlacklist(
        phone=phone,
        reason=body.get("reason"),
        added_by=current_user.id,
    )
    db.add(entry)
    await db.commit()

    return {"ok": True, "phone": phone}


@router.delete("/whatsapp/blacklist/{phone}")
async def admin_whatsapp_blacklist_remove(
    phone: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    from app.models.models import WhatsAppBlacklist
    from urllib.parse import unquote
    phone_decoded = unquote(phone)
    entry = (await db.execute(
        select(WhatsAppBlacklist).where(WhatsAppBlacklist.phone == phone_decoded)
    )).scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Número não encontrado na blacklist")
    await db.delete(entry)
    await db.commit()
    return {"ok": True}


# ─── WhatsApp Templates ────────────────────────────────────

@router.get("/whatsapp/templates")
async def admin_whatsapp_templates_list(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    from app.models.models import WhatsAppTemplate
    rows = (await db.execute(
        select(WhatsAppTemplate).order_by(WhatsAppTemplate.event_type)
    )).scalars().all()
    return [
        {
            "id": str(r.id),
            "event_type": r.event_type,
            "text": r.text,
            "enabled": r.enabled,
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


@router.put("/whatsapp/templates/{event_type}")
async def admin_whatsapp_templates_update(
    event_type: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    from app.models.models import WhatsAppTemplate
    row = (await db.execute(
        select(WhatsAppTemplate).where(WhatsAppTemplate.event_type == event_type)
    )).scalar_one_or_none()
    if row:
        if "text" in body:
            row.text = body["text"]
        if "enabled" in body:
            row.enabled = bool(body["enabled"])
        row.updated_by = current_user.id
        row.updated_at = datetime.now(timezone.utc)
    else:
        # Create new template entry
        row = WhatsAppTemplate(
            event_type=event_type,
            text=body.get("text", ""),
            enabled=bool(body.get("enabled", True)),
            updated_by=current_user.id,
        )
        db.add(row)
    await db.commit()
    return {"ok": True, "event_type": event_type}


@router.post("/whatsapp/templates/seed")
async def admin_whatsapp_templates_seed(
    body: dict = Body(default={}),
    current_user=Depends(get_current_admin),
):
    """Seed the default message templates into the DB.

    By default skips templates that already exist.
    Pass {"force": true} to overwrite existing templates with the originals.
    """
    from app.services.whatsapp_service import seed_default_templates, DEFAULT_TEMPLATES
    force = bool(body.get("force", False))
    result = await seed_default_templates(force=force)
    return {"ok": True, **result, "total": len(DEFAULT_TEMPLATES)}


# ─── WhatsApp Broadcast ────────────────────────────────────

async def _execute_broadcast(min_days: int, max_days: int, message: str) -> dict:
    """Core broadcast logic, called immediately or from a scheduled job."""
    from app.core.database import async_session_maker
    from app.models.models import Payment, User
    from app.models.models import PaymentStatus  # type: ignore
    from sqlalchemy import and_
    from app.services.whatsapp_service import _send

    now = datetime.now(timezone.utc)
    cutoff_start = now - timedelta(days=max_days)
    cutoff_end = now - timedelta(days=min_days)

    sent = 0
    skipped = 0
    async with async_session_maker() as db:
        result = await db.execute(
            select(Payment, User)
            .join(User, User.id == Payment.user_id)
            .where(
                and_(
                    Payment.status == PaymentStatus.PENDING,
                    Payment.created_at >= cutoff_start,
                    Payment.created_at <= cutoff_end,
                )
            )
        )
        rows = result.all()
        for payment, user in rows:
            try:
                await _send(user.phone, message, event_type="broadcast", user_id=str(user.id))
                sent += 1
            except Exception:
                skipped += 1
    return {"ok": True, "sent": sent, "skipped": skipped, "total": sent + skipped}


@router.post("/whatsapp/broadcast")
async def admin_whatsapp_broadcast(
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Send a broadcast message to users with PENDING payments older than N days.

    If `scheduled_at` (ISO-8601 string, UTC) is provided, the broadcast is
    scheduled for that time instead of being executed immediately.
    """
    min_days: int = int(body.get("min_days", 1))
    max_days: int = int(body.get("max_days", 7))
    message: str = (body.get("message") or "").strip()
    scheduled_at_raw: str | None = body.get("scheduled_at")

    if not message:
        raise HTTPException(status_code=422, detail="message é obrigatório")

    if scheduled_at_raw:
        from app.tasks import scheduler
        from datetime import datetime as _dt
        try:
            run_at = _dt.fromisoformat(scheduled_at_raw.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="scheduled_at inválido — use ISO-8601 (ex: 2026-06-05T14:30:00Z)")
        if run_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=422, detail="scheduled_at deve ser uma data futura")

        job_id = f"broadcast_{run_at.strftime('%Y%m%d%H%M%S')}_{min_days}_{max_days}"
        scheduler.add_job(
            _execute_broadcast,
            trigger="date",
            run_date=run_at,
            args=[min_days, max_days, message],
            id=job_id,
            replace_existing=True,
            misfire_grace_time=3600,
        )
        return {
            "ok": True,
            "scheduled": True,
            "job_id": job_id,
            "run_at": run_at.isoformat(),
        }

    return await _execute_broadcast(min_days, max_days, message)


# ─── WhatsApp Opt-Out Webhook (public — no auth) ──────────
# Registered on a separate public_router to avoid admin auth middleware.
# Evolution API v2 calls this when an inbound message is received.

public_router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Webhook"])

_OPT_OUT_KEYWORDS = {"sair", "stop", "parar", "cancelar", "descadastrar", "opt-out", "optout"}


@public_router.post("/webhook")
async def whatsapp_opt_out_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive inbound messages from Evolution API v2.
    If the user sends SAIR (or similar opt-out keywords), their phone is added
    to the blacklist and they receive a confirmation message.
    """
    from app.models.models import WhatsAppBlacklist
    try:
        payload = await request.json()
    except Exception:
        return {"ok": False}

    event = payload.get("event", "")
    data = payload.get("data", {})
    key = data.get("key", {})

    if key.get("fromMe", True):
        return {"ok": True}
    if event not in ("messages.upsert", "message.received"):
        return {"ok": True}

    remote_jid: str = key.get("remoteJid", "")
    raw_phone = remote_jid.split("@")[0] if "@" in remote_jid else remote_jid

    msg_obj = data.get("message", {})
    text_body = (
        msg_obj.get("conversation")
        or msg_obj.get("extendedTextMessage", {}).get("text")
        or ""
    ).strip().lower()

    if text_body not in _OPT_OUT_KEYWORDS:
        return {"ok": True, "action": "ignored"}

    # Add to blacklist if not already there
    from app.models.models import WhatsAppBlacklist as WBL
    existing = (await db.execute(
        select(WBL).where(WBL.phone == raw_phone)
    )).scalar_one_or_none()
    if not existing:
        db.add(WBL(phone=raw_phone, reason=f"Opt-out via mensagem: '{text_body}'"))
        await db.commit()
        logger.info("[WHA_WEBHOOK] Opt-out registered for %s", raw_phone)
        try:
            from app.services.whatsapp_service import _BASE
            from app.core.config import settings as _cfg
            from urllib.parse import quote
            import httpx
            api_key = getattr(_cfg, "WHATSMIAU_SECRET_KEY", "")
            instance = getattr(_cfg, "WHATSMIAU_INSTANCE", "")
            if api_key and instance:
                confirmation = (
                    "✅ You have been removed from Valuora's automated messages.\n\n"
                    "If you change your mind, visit valuora.online.\n"
                    "— *Valuora*"
                )
                instance_encoded = quote(instance, safe="")
                async with httpx.AsyncClient(timeout=10) as client:
                    await client.post(
                        f"{_BASE}/message/sendText/{instance_encoded}",
                        json={"number": raw_phone, "text": confirmation, "delay": 500},
                        headers={"apikey": api_key, "Content-Type": "application/json"},
                    )
        except Exception as exc:
            logger.warning("[WHA_WEBHOOK] Opt-out confirmation failed: %s", exc)

    return {"ok": True, "action": "opted_out"}


# ─── Error Logs ───────────────────────────────────────────
class ErrorLogResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    route: str
    method: str
    status_code: int
    error_message: Optional[str] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/error-logs")
async def get_error_logs(
    status_code: Optional[int] = Query(None),
    route: Optional[str] = Query(None),
    user_id: Optional[uuid.UUID] = Query(None),
    period: Optional[str] = Query("7d"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from datetime import timedelta, timezone
    from sqlalchemy.orm import selectinload

    now = datetime.now(timezone.utc)
    period_map = {"1d": 1, "7d": 7, "30d": 30, "90d": 90, "all": None}
    days = period_map.get(period, 7)

    query = select(ErrorLog, User.email).outerjoin(User, ErrorLog.user_id == User.id)

    if days is not None:
        query = query.where(ErrorLog.created_at >= now - timedelta(days=days))
    if status_code:
        query = query.where(ErrorLog.status_code == status_code)
    if route:
        safe_route = route.replace('%', '\\%').replace('_', '\\_')
        query = query.where(ErrorLog.route.ilike(f"%{safe_route}%"))
    if user_id:
        query = query.where(ErrorLog.user_id == user_id)

    total_q = query.with_only_columns(func.count()).order_by(None)
    total_result = await db.execute(total_q)
    total = total_result.scalar() or 0

    query = query.order_by(desc(ErrorLog.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    rows = result.all()

    items = []
    for log, email in rows:
        items.append(ErrorLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=email,
            route=log.route,
            method=log.method,
            status_code=log.status_code,
            error_message=log.error_message,
            ip=log.ip,
            user_agent=log.user_agent,
            created_at=log.created_at,
        ))

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.delete("/error-logs")
async def clear_error_logs(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Clear all error logs (superadmin only)."""
    if not admin.is_superadmin:
        raise HTTPException(status_code=403, detail="Apenas superadmin pode limpar os logs.")
    from sqlalchemy import delete
    await db.execute(delete(ErrorLog))
    await db.commit()
    return {"message": "Logs limpos com sucesso."}


# ─── Cache management (IBGE / CNPJ / Benchmark) ───────────
@router.get("/cache/stats")
async def cache_stats(admin: User = Depends(get_current_admin)):
    """Retorna estatística por prefixo de cache."""
    from app.core.cache import PREFIX_CNAE, PREFIX_SIDRA, PREFIX_BENCHMARK
    from app.core.redis import redis_client
    stats = {}
    for label, prefix in [
        ("cnae", PREFIX_CNAE),
        ("sidra", PREFIX_SIDRA),
        ("benchmark", PREFIX_BENCHMARK),
        ("cnpj", "cnpj:"),
    ]:
        try:
            count = 0
            async for _ in redis_client.scan_iter(match=f"{prefix}*"):
                count += 1
            stats[label] = {"prefix": prefix, "keys": count}
        except Exception as e:
            stats[label] = {"prefix": prefix, "error": str(e)}
    return {"caches": stats}


@router.delete("/cache/{scope}")
async def cache_invalidate(
    scope: str,
    admin: User = Depends(get_current_admin),
):
    """Invalida cache de um escopo: 'cnae' | 'sidra' | 'benchmark' | 'cnpj' | 'all'."""
    from app.core.cache import cache_delete_pattern, PREFIX_CNAE, PREFIX_SIDRA, PREFIX_BENCHMARK
    mapping = {
        "cnae": f"{PREFIX_CNAE}*",
        "sidra": f"{PREFIX_SIDRA}*",
        "benchmark": f"{PREFIX_BENCHMARK}*",
        "cnpj": "cnpj:*",
    }
    if scope == "all":
        total = 0
        for pat in mapping.values():
            total += await cache_delete_pattern(pat)
        return {"scope": "all", "deleted": total}
    if scope not in mapping:
        raise HTTPException(status_code=400, detail="Escopo inválido. Use: cnae, sidra, benchmark, cnpj, all.")
    deleted = await cache_delete_pattern(mapping[scope])
    return {"scope": scope, "deleted": deleted}


# ─── Admin: editar e regerar análise ────────────────────────────────────────

class AdminAnalysisEditRequest(BaseModel):
    company_name: Optional[str] = None
    sector: Optional[str] = None
    cnpj: Optional[str] = None
    revenue: Optional[float] = None
    net_margin: Optional[float] = None
    growth_rate: Optional[float] = None
    debt: Optional[float] = None
    cash: Optional[float] = None
    founder_dependency: Optional[float] = None
    ebitda: Optional[float] = None
    recurring_revenue_pct: Optional[float] = None
    num_employees: Optional[int] = None
    years_in_business: Optional[int] = None
    previous_investment: Optional[float] = None
    tangible_assets: Optional[float] = None
    intangible_assets: Optional[float] = None
    equity_participations: Optional[float] = None
    monthly_burn_rate: Optional[float] = None
    dcf_weight: Optional[float] = None
    company_type: Optional[str] = None
    revenue_ntm: Optional[float] = None
    ebitda_margin: Optional[float] = None
    qualitative_answers: Optional[dict] = None


@router.get("/analyses/{analysis_id}/edit")
async def admin_get_analysis_for_edit(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Get full analysis data for admin editing."""
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    return {
        "id": str(analysis.id),
        "company_name": analysis.company_name,
        "sector": analysis.sector,
        "cnpj": analysis.cnpj,
        "revenue": float(analysis.revenue) if analysis.revenue else None,
        "net_margin": float(analysis.net_margin) if analysis.net_margin is not None else None,
        "growth_rate": float(analysis.growth_rate) if analysis.growth_rate is not None else None,
        "debt": float(analysis.debt) if analysis.debt else 0,
        "cash": float(analysis.cash) if analysis.cash else 0,
        "founder_dependency": float(analysis.founder_dependency) if analysis.founder_dependency is not None else 0,
        "ebitda": float(analysis.ebitda) if analysis.ebitda else None,
        "recurring_revenue_pct": float(analysis.recurring_revenue_pct) if analysis.recurring_revenue_pct is not None else 0,
        "num_employees": analysis.num_employees,
        "years_in_business": analysis.years_in_business,
        "previous_investment": float(analysis.previous_investment) if analysis.previous_investment else 0,
        "tangible_assets": float(analysis.tangible_assets) if analysis.tangible_assets else 0,
        "intangible_assets": float(analysis.intangible_assets) if analysis.intangible_assets else 0,
        "equity_participations": float(analysis.equity_participations) if analysis.equity_participations else 0,
        "monthly_burn_rate": float(analysis.monthly_burn_rate) if analysis.monthly_burn_rate else None,
        "dcf_weight": float(analysis.dcf_weight) if analysis.dcf_weight is not None else 0.6,
        "company_type": analysis.company_type,
        "revenue_ntm": float(analysis.revenue_ntm) if analysis.revenue_ntm else None,
        "ebitda_margin": float(analysis.ebitda_margin) if analysis.ebitda_margin is not None else None,
        "qualitative_answers": analysis.qualitative_answers or {},
        "plan": analysis.plan.value if analysis.plan else None,
        "status": analysis.status.value if analysis.status else None,
        "generate_confirmed": analysis.generate_confirmed,
        "generated_at": analysis.generated_at.isoformat() if analysis.generated_at else None,
        "equity_value": float(analysis.equity_value) if analysis.equity_value else None,
        "user_id": str(analysis.user_id) if analysis.user_id else None,
    }


@router.patch("/analyses/{analysis_id}/edit")
async def admin_edit_analysis(
    analysis_id: uuid.UUID,
    body: AdminAnalysisEditRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Update analysis fields without regenerating PDF."""
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(analysis, field, value)

    analysis.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Análise atualizada com sucesso."}


@router.post("/analyses/{analysis_id}/regenerate")
async def admin_regenerate_analysis(
    analysis_id: uuid.UUID,
    body: AdminAnalysisEditRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Save updated fields and re-run the valuation engine + regenerate PDF.
    Sends the new PDF to the client by email.
    """
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    if not analysis.plan:
        raise HTTPException(status_code=400, detail="Análise sem plano ativo — não é possível regerar.")

    # Apply field updates
    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(analysis, field, value)
    analysis.updated_at = datetime.now(timezone.utc)
    # Reset generation state so the PDF will be regenerated
    analysis.status = AnalysisStatus.COMPLETED  # ensure it's completed
    await db.commit()

    # Get user_id for background task
    user_id = str(analysis.user_id) if analysis.user_id else None
    if not user_id:
        raise HTTPException(status_code=400, detail="Análise sem usuário associado.")

    # Re-run valuation engine + generate PDF in background
    from app.routes.payments import _generate_and_send_report
    background_tasks.add_task(_generate_and_send_report, str(analysis_id), user_id)

    return {"message": "Regeneração iniciada. O cliente receberá o novo PDF por e-mail em ~90 segundos."}


# ─── Platform Health Dashboard ───────────────────────────────────────────────

@router.get("/health")
async def admin_platform_health(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Platform health check — API, DeepSeek, PDF queue, emails, WhatsApp, DB."""
    import time
    import httpx as _httpx
    from app.models.models import Report, WhatsAppLog, ErrorLog, Analysis, AnalysisStatus
    from sqlalchemy import func

    results = {}
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_1h = now - timedelta(hours=1)

    # ── DB connectivity ──────────────────────────
    try:
        t0 = time.monotonic()
        await db.execute(select(func.now()))
        results["database"] = {"status": "ok", "latency_ms": round((time.monotonic() - t0) * 1000)}
    except Exception as e:
        results["database"] = {"status": "error", "error": str(e)[:120]}

    # ── DeepSeek API latency ─────────────────────
    ds_key = getattr(settings, "DEEPSEEK_API_KEY", "")
    if ds_key:
        t0 = time.monotonic()
        try:
            async with _httpx.AsyncClient(timeout=8) as client:
                r = await client.post(
                    f"{getattr(settings, 'DEEPSEEK_API_URL', 'https://api.deepseek.com/v1')}/chat/completions",
                    headers={"Authorization": f"Bearer {ds_key}", "Content-Type": "application/json"},
                    json={"model": "deepseek-chat", "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
                )
            latency = round((time.monotonic() - t0) * 1000)
            if r.status_code < 400:
                results["deepseek"] = {"status": "ok", "latency_ms": latency}
            else:
                results["deepseek"] = {"status": "degraded", "http_status": r.status_code, "latency_ms": latency}
        except Exception as e:
            results["deepseek"] = {"status": "error", "error": str(e)[:120]}
    else:
        results["deepseek"] = {"status": "not_configured"}

    # ── WhatsApp (Whatsmiau) ─────────────────────
    wha_key = getattr(settings, "WHATSMIAU_SECRET_KEY", "")
    wha_instance = getattr(settings, "WHATSMIAU_INSTANCE", "")
    if wha_key and wha_instance:
        from urllib.parse import quote
        t0 = time.monotonic()
        try:
            async with _httpx.AsyncClient(timeout=6) as client:
                r = await client.get(
                    f"https://api.whatsmiau.dev/v2/instance/connectionState/{quote(wha_instance, safe='')}",
                    headers={"apikey": wha_key},
                )
            latency = round((time.monotonic() - t0) * 1000)
            body_json = {}
            if r.headers.get("content-type", "").startswith("application/json"):
                try:
                    body_json = r.json()
                except Exception:
                    pass
            state = body_json.get("instance", {}).get("state") or body_json.get("state") or ("ok" if r.status_code < 400 else "error")
            results["whatsapp"] = {"status": "ok" if state in ("open", "ok") else "degraded", "state": state, "latency_ms": latency}
        except Exception as e:
            results["whatsapp"] = {"status": "error", "error": str(e)[:120]}
    else:
        results["whatsapp"] = {"status": "not_configured"}

    # ── PDF Queue: analyses in PROCESSING or stuck ───
    try:
        processing_count = (await db.execute(
            select(func.count(Analysis.id)).where(Analysis.status == AnalysisStatus.PROCESSING)
        )).scalar() or 0
        # Stuck: analyses in processing for more than 10 minutes
        stuck_cutoff = now - timedelta(minutes=10)
        stuck_count = (await db.execute(
            select(func.count(Analysis.id)).where(
                Analysis.status == AnalysisStatus.PROCESSING,
                Analysis.updated_at < stuck_cutoff,
            )
        )).scalar() or 0
        results["pdf_queue"] = {
            "status": "error" if stuck_count > 0 else ("degraded" if processing_count > 5 else "ok"),
            "processing": int(processing_count),
            "stuck": int(stuck_count),
        }
    except Exception as e:
        results["pdf_queue"] = {"status": "error", "error": str(e)[:120]}

    # ── WhatsApp: sends in last 24h ──────────────
    try:
        wha_sent = (await db.execute(
            select(func.count(WhatsAppLog.id)).where(WhatsAppLog.status == "sent", WhatsAppLog.sent_at >= last_24h)
        )).scalar() or 0
        wha_failed = (await db.execute(
            select(func.count(WhatsAppLog.id)).where(WhatsAppLog.status == "failed", WhatsAppLog.sent_at >= last_24h)
        )).scalar() or 0
        results["whatsapp_logs"] = {
            "sent_24h": int(wha_sent),
            "failed_24h": int(wha_failed),
            "fail_rate": round(wha_failed / max(wha_sent + wha_failed, 1) * 100, 1),
        }
    except Exception as e:
        results["whatsapp_logs"] = {"error": str(e)[:80]}

    # ── Error rate: last 1h ──────────────────────
    try:
        error_count_1h = (await db.execute(
            select(func.count(ErrorLog.id)).where(ErrorLog.created_at >= last_1h)
        )).scalar() or 0
        error_count_24h = (await db.execute(
            select(func.count(ErrorLog.id)).where(ErrorLog.created_at >= last_24h)
        )).scalar() or 0
        results["api_errors"] = {
            "last_1h": int(error_count_1h),
            "last_24h": int(error_count_24h),
            "status": "error" if error_count_1h > 50 else ("degraded" if error_count_1h > 10 else "ok"),
        }
    except Exception as e:
        results["api_errors"] = {"error": str(e)[:80]}

    # ── Recent reports: generated OK ────────────
    try:
        reports_24h = (await db.execute(
            select(func.count(Report.id)).where(Report.created_at >= last_24h)
        )).scalar() or 0
        results["pdf_reports"] = {"generated_24h": int(reports_24h), "status": "ok"}
    except Exception as e:
        results["pdf_reports"] = {"error": str(e)[:80]}

    # ── Overall status ──────────────────────────
    statuses = [v.get("status") for v in results.values() if isinstance(v, dict) and "status" in v]
    overall = "ok" if all(s == "ok" for s in statuses) else ("error" if "error" in statuses else "degraded")

    return {
        "overall": overall,
        "checked_at": now.isoformat(),
        "checks": results,
    }


# ─── Partner Broadcast ────────────────────────────────────

# Templates pré-definidos disponíveis no painel admin
PARTNER_BROADCAST_TEMPLATES = {
    "price_update": {
        "label": "Atualização de preços e comissões",
        "whatsapp": (
            "Oi, {nome}! 👋\n\n"
            "Quick update on an important change at Valuora.\n\n"
            "Subimos os preços dos planos — e junto com isso entregamos *muito mais conteúdo* em cada relatório:\n\n"
            "📄 *Profissional* agora tem ~26 páginas (antes 22): Mapa de Valor por Alavanca + Resumo Executivo em inglês.\n"
            "📄 *Estratégico* agora tem ~37 páginas (antes 33): Due Diligence Checklist + Comparáveis de M&A.\n"
            "📄 *Pitch Deck* agora tem ~42 slides (antes 38): One-pager executivo + Quadrante competitivo.\n\n"
            "Entregamos mais conteúdo que a maioria dos concorrentes — e ainda por um preço bem abaixo do mercado. "
            "Traditional consulting firms charge $15,000 to $50,000 for the same service. "
            "Valuora delivers in minutes, with the same methodology, for much less.\n\n"
            "Sua comissão em reais ficou igual ou maior:\n"
"• Essential: $1,998 → *$2,399* ✅\n"
"• Advanced: $3,998 → *$3,899* (practically equal)\n"
"• Pitch Deck: $448 → *$1,199* 🚀\n\n"
            "A % mudou de 40% pra 30%, mas o produto vale mais e o número na sua conta subiu. "
            "Especialmente o Pitch Deck — quase triplicou.\n\n"
            "Qualquer dúvida me chama!\n\n"
            "— Valuora Team · Automated system message"
        ),
        "email_subject": "Atualização importante — novos preços, produto mais completo e sua comissão",
        "email_intro": (
            "We've restructured Valuora's plans. Higher prices because we deliver more: "
            "o Profissional ganhou Mapa de Valor por Alavanca e Resumo em inglês (~26 págs), "
            "o Estratégico ganhou Due Diligence Checklist e Comparáveis de M&A (~37 págs), "
            "e o Pitch Deck ganhou One-pager executivo e Quadrante competitivo (~42 slides). "
            "E o mais importante: entregamos mais conteúdo que a maioria dos concorrentes e ainda "
            "por um preço significativamente abaixo do mercado — consultorias tradicionais cobram "
            "$15,000 to $50,000 for the same service. Your commission in USD stayed the same or higher — "
            "a taxa mudou de 40% para 30%, mas como o preço subiu, você leva mais por venda no "
            "Profissional e quase 3x mais no Pitch Deck."
        ),
        "email_outro": (
            "The Pitch Deck is now a real opportunity: $1,199 per referral, "
            "produto mais completo, rápido de vender e com alto apelo para quem busca investidor. "
            "Qualquer dúvida, estou aqui."
        ),
    },
}


@router.get("/partners/broadcast/templates")
async def list_partner_broadcast_templates(
    current_user=Depends(get_current_admin),
):
    """Lista os templates disponíveis para broadcast de parceiros."""
    return [
        {"id": k, "label": v["label"]}
        for k, v in PARTNER_BROADCAST_TEMPLATES.items()
    ]


@router.post("/partners/broadcast")
async def partner_broadcast(
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_admin),
):
    """Dispara e-mail e/ou WhatsApp para todos os parceiros ACTIVE.

    Body:
        template_id: str  — chave de PARTNER_BROADCAST_TEMPLATES (obrigatório)
        channels: list[str]  — ["whatsapp"], ["email"] ou ["whatsapp", "email"]
        custom_whatsapp: str | null  — substitui o template de WhatsApp se fornecido
        custom_email_subject: str | null
        custom_email_intro: str | null
        custom_email_outro: str | null
    """
    template_id: str = body.get("template_id", "")
    channels: list = body.get("channels") or ["whatsapp", "email"]
    custom_wpp: str | None = body.get("custom_whatsapp")
    custom_subj: str | None = body.get("custom_email_subject")
    custom_intro: str | None = body.get("custom_email_intro")
    custom_outro: str | None = body.get("custom_email_outro")

    tpl = PARTNER_BROADCAST_TEMPLATES.get(template_id)
    if not tpl:
        raise HTTPException(status_code=422, detail=f"Template '{template_id}' não encontrado.")

    wpp_text = custom_wpp or tpl["whatsapp"]
    email_subj = custom_subj or tpl["email_subject"]
    email_intro = custom_intro or tpl["email_intro"]
    email_outro = custom_outro or tpl["email_outro"]

    from app.models.models import Partner, PartnerStatus
    from app.services.whatsapp_service import send_partner_broadcast_whatsapp
    from app.services.email_service import send_partner_announcement_email
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(Partner).where(Partner.status == PartnerStatus.ACTIVE).options(
            selectinload(Partner.user)
        )
    )
    partners = result.scalars().all()

    wpp_sent = wpp_skipped = email_sent = email_skipped = 0

    for partner in partners:
        user = partner.user
        if not user:
            continue
        full_name = user.full_name or ""

        if "whatsapp" in channels:
            phone = partner.phone or user.phone
            ok = await send_partner_broadcast_whatsapp(
                phone=phone,
                partner_name=full_name,
                message_template=wpp_text,
                user_id=str(user.id),
            )
            if ok:
                wpp_sent += 1
            else:
                wpp_skipped += 1

        if "email" in channels:
            try:
                await send_partner_announcement_email(
                    email=user.email,
                    full_name=full_name,
                    subject=email_subj,
                    body_intro=email_intro,
                    body_outro=email_outro,
                )
                email_sent += 1
            except Exception as _e:
                import logging as _log
                _log.getLogger("app.broadcast").error(
                    "[BROADCAST] Email falhou para %s: %s", user.email, _e
                )
                email_skipped += 1

    import logging as _log
    _log.getLogger("app.broadcast").info(
        "[BROADCAST] Done — partners=%d wpp_sent=%d wpp_skip=%d email_sent=%d email_skip=%d channels=%s",
        len(partners), wpp_sent, wpp_skipped, email_sent, email_skipped, channels,
    )
    return {
        "ok": True,
        "total_partners": len(partners),
        "whatsapp": {"sent": wpp_sent, "skipped": wpp_skipped} if "whatsapp" in channels else None,
        "email": {"sent": email_sent, "skipped": email_skipped} if "email" in channels else None,
    }
