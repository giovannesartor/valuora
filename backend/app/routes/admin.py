"""
Admin panel routes — requires is_admin or is_superadmin.
"""
import uuid
import string
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Body
from sqlalchemy import select, func, desc, true as sa_true
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.audit import get_audit_log, audit_log
from app.core.cache import cache_get, cache_set, cache_delete_pattern
from app.models.models import (
    User, Analysis, Payment, Report, Coupon, Partner, PartnerStatus,
    PaymentStatus, AnalysisStatus, PlanType, ErrorLog,
)
from app.services.auth_service import get_current_admin
from app.services.email_service import send_coupon_gift_email
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
    # Delta vs previous period
    delta: Optional[dict] = None


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
    is_partner: bool = False
    created_at: datetime
    analyses_count: int = 0
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
    user_email: str
    user_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminPaymentResponse(BaseModel):
    id: uuid.UUID
    analysis_id: Optional[uuid.UUID] = None
    user_email: str
    user_name: str
    company_name: str
    plan: PlanType
    amount: float
    net_value: Optional[float] = None
    fee_amount: Optional[float] = None
    currency: str = "USD"
    status: PaymentStatus
    payment_method: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
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
            events.append({"type": "user", "label": full_name or email, "sub": "signed up", "at": at.isoformat()})
    for full_name, amount, at in payments_q:
        if at:
            amt_fmt = f"$ {amount:,.0f}".replace(',', '.')
            events.append({"type": "payment", "label": full_name, "sub": f"paid {amt_fmt}", "at": at.isoformat()})
    for company_name, full_name, at in analyses_q:
        if at:
            events.append({"type": "analysis", "label": company_name, "sub": f"analysis completed · {full_name}", "at": at.isoformat()})

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


# Revenue breakdown by plan + ticket médio
@router.get("/plan-breakdown")
async def plan_breakdown(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Revenue, count and average ticket per plan."""
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
        return {"message": "No pending commissions.", "approved": 0}
    for c in commissions:
        c.status = CommissionStatus.APPROVED
    await db.commit()
    return {"message": f"{len(commissions)} commission(s) approved.", "approved": len(commissions)}


@router.get("/users", response_model=None)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_verified: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    # B1: Try cache first (only for unfiltered first page requests)
    _cache_key = f"admin:users:{skip}:{limit}:{search or ''}:{is_active}:{is_verified}"
    if not search and is_active is None and is_verified is None:
        cached = await cache_get(_cache_key)
        if cached:
            return cached
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

    base = (
        select(
            User,
            analyses_sub.c.cnt,
            payments_sub.c.pay_total,
            partner_sub.c.user_id.label("partner_uid"),
            last_analysis_sub.c.last_at,
            has_plan_sub.c.user_id.label("plan_uid"),
        )
        .outerjoin(analyses_sub, User.id == analyses_sub.c.user_id)
        .outerjoin(last_analysis_sub, User.id == last_analysis_sub.c.user_id)
        .outerjoin(payments_sub, User.id == payments_sub.c.user_id)
        .outerjoin(has_plan_sub, User.id == has_plan_sub.c.user_id)
        .outerjoin(partner_sub, User.id == partner_sub.c.user_id)
    )
    if search:
        base = base.where(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )
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
                company_name=user.company_name,
                is_active=user.is_active,
                is_verified=user.is_verified,
                is_admin=user.is_admin,
                is_superadmin=user.is_superadmin,
                is_partner=partner_uid is not None,
                created_at=user.created_at,
                analyses_count=int(cnt or 0),
                payments_total=float(pay_total or 0),
                last_analysis_at=last_at,
                has_active_plan=plan_uid is not None,
            ).model_dump(mode='json')
            for user, cnt, pay_total, partner_uid, last_at, plan_uid in rows
        ],
        "total": total_count,
    }
    # B1: Cache 60s when no filters
    if not search and is_active is None and is_verified is None:
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
        raise HTTPException(status_code=404, detail="User not found.")
    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Cannot deactivate the superadmin.")
    user.is_active = not user.is_active
    await db.commit()
    status = "activated" if user.is_active else "deactivated"
    return MessageResponse(message=f"User {status} successfully.")


@router.patch("/users/{user_id}/toggle-admin", response_model=MessageResponse)
async def toggle_user_admin(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Toggle is_admin flag on a user. Only superadmin or admin can do this."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Cannot change superadmin status.")
    if user.id == admin.id:
        raise HTTPException(status_code=403, detail="Cannot change your own admin status.")
    user.is_admin = not user.is_admin
    await db.commit()
    status = "promoted to admin" if user.is_admin else "removed from admin"
    await audit_log(
        action="admin_toggle_admin",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(user_id),
        detail=f"user {status}",
    )
    await cache_delete_pattern("admin:users:*")
    return MessageResponse(message=f"User {status} successfully.")


@router.patch("/users/{user_id}/verify", response_model=MessageResponse)
async def verify_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_verified = True
    await db.commit()
    return MessageResponse(message="User verified successfully.")


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
        raise HTTPException(status_code=404, detail="User not found.")

    if body.full_name is not None:
        name = body.full_name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Name cannot be empty.")
        user.full_name = name

    if body.company_name is not None:
        user.company_name = body.company_name.strip() or None  # allow clearing

    await db.commit()
    await cache_delete_pattern("admin:users:*")
    return MessageResponse(message="User profile updated successfully.")


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.is_superadmin:
        raise HTTPException(status_code=403, detail="Cannot delete the superadmin.")
    if user.id == admin.id:
        raise HTTPException(status_code=403, detail="Cannot delete your own account.")
    await db.delete(user)
    await db.commit()
    return MessageResponse(message="User deleted successfully.")


@router.post("/users/{user_id}/promote-partner", response_model=MessageResponse)
async def promote_user_to_partner(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Check if already a partner
    existing = await db.execute(select(Partner).where(Partner.user_id == user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This user is already a partner.")

    # Generate a unique referral code matching QV-XXXX format
    chars = string.ascii_uppercase + string.digits
    referral_code = "QV-" + ''.join(secrets.choice(chars) for _ in range(8))
    # Ensure uniqueness
    while True:
        check = await db.execute(select(Partner).where(Partner.referral_code == referral_code))
        if not check.scalar_one_or_none():
            break
        referral_code = "QV-" + ''.join(secrets.choice(chars) for _ in range(8))

    partner = Partner(
        user_id=user.id,
        company_name=user.company_name,
        phone=user.phone,
        referral_code=referral_code,
        referral_link=f"{settings.FRONTEND_URL}/register?ref={referral_code}",
        commission_rate=0.50,
        status=PartnerStatus.ACTIVE,
    )
    db.add(partner)
    await db.commit()
    await cache_delete_pattern("admin:users:*")
    return MessageResponse(message=f"User promoted to partner with code {referral_code}.")


@router.post("/users/{user_id}/demote-partner", response_model=MessageResponse)
async def demote_user_from_partner(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    partner_result = await db.execute(select(Partner).where(Partner.user_id == user_id))
    partner = partner_result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=400, detail="This user is not a partner.")

    await db.delete(partner)
    await db.commit()
    await cache_delete_pattern("admin:users:*")
    return MessageResponse(message="Partner removed successfully.")


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
    base = (
        select(Analysis, User.email, User.full_name)
        .join(User, Analysis.user_id == User.id)
    )
    if search:
        base = base.where(
            Analysis.company_name.ilike(f"%{search}%")
            | User.email.ilike(f"%{search}%")
            | User.full_name.ilike(f"%{search}%")
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
                created_at=a.created_at,
            ).model_dump(mode='json')
            for a, email, name in rows
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
        .join(User, Payment.user_id == User.id)
        .join(Analysis, Payment.analysis_id == Analysis.id)
    )
    if search:
        base = base.where(
            User.email.ilike(f"%{search}%")
            | User.full_name.ilike(f"%{search}%")
            | Analysis.company_name.ilike(f"%{search}%")
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
                plan=p.plan,
                amount=float(p.amount),
                net_value=float(p.net_value) if p.net_value else None,
                fee_amount=float(p.fee_amount) if p.fee_amount else None,
                currency=getattr(p, 'currency', 'USD') or 'USD',
                status=p.status,
                payment_method=p.payment_method,
                stripe_payment_intent_id=p.stripe_payment_intent_id,
                stripe_session_id=p.stripe_session_id,
                paid_at=p.paid_at,
                created_at=p.created_at,
            ).model_dump(mode='json')
            for p, email, name, company in rows
        ],
        "total": total,
    }


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
    """Marks a payment as manually paid (admin bypass).
    Triggers report generation in background."""
    from datetime import timezone

    result = await db.execute(
        select(Payment, Analysis)
        .join(Analysis, Payment.analysis_id == Analysis.id)
        .where(Payment.id == payment_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found.")
    payment, analysis = row

    if payment.status == PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Payment is already confirmed.")

    payment.status = PaymentStatus.PAID
    payment.payment_method = "admin_bypass"
    payment.paid_at = datetime.now(timezone.utc)
    analysis.plan = payment.plan

    note_text = body.note or f"Manually marked as paid by admin {admin.email}"
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
        from app.routes.payments import _run_valuation_and_report
        background_tasks.add_task(_run_valuation_and_report, str(analysis.id), str(analysis.user_id), payment.plan)

    return {"ok": True, "message": "Payment confirmed. Report being generated.", "analysis_id": str(analysis.id)}


@router.post("/analyses/{analysis_id}/resend-report")
async def resend_report(
    analysis_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Forces re-sending the report to the user (admin).

    If the report already exists, resends the email with download link.
    If not, generates a new PDF and sends it.
    Auto-assigns 'profissional' plan if analysis has no plan.
    """
    from app.core.security import create_download_token
    from app.core.config import settings
    from app.services.email_service import send_report_ready_email
    from app.services.pdf_service import generate_report_pdf
    import asyncio

    result = await db.execute(
        select(Analysis, User)
        .join(User, Analysis.user_id == User.id)
        .where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    analysis, owner = row

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Analysis has not been completed yet. Cannot resend the report.")

    # Auto-assign plan if missing
    if not analysis.plan:
        analysis.plan = PlanType.PROFISSIONAL
        await db.commit()
        await db.refresh(analysis)

    # Check if a report row already exists
    existing = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()

    if existing:
        # Just resend the email with the existing token
        download_url = f"{settings.APP_URL}/api/v1/reports/download?token={existing.download_token}"
        await send_report_ready_email(owner.email, owner.full_name, analysis.company_name, download_url)
        await audit_log(
            action="admin_resend_report",
            user_id=str(admin.id),
            user_email=admin.email,
            resource_id=str(analysis_id),
        )
        return {"ok": True, "message": "Report email resent successfully."}

    # No report yet — generate PDF synchronously then send email
    try:
        pdf_path = await asyncio.to_thread(generate_report_pdf, analysis)
        download_token = create_download_token(str(analysis_id))
        report = Report(
            analysis_id=analysis_id,
            file_path=pdf_path,
            download_token=download_token,
        )
        db.add(report)
        await db.commit()

        download_url = f"{settings.APP_URL}/api/v1/reports/download?token={download_token}"
        await send_report_ready_email(owner.email, owner.full_name, analysis.company_name, download_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)[:200]}")

    await audit_log(
        action="admin_resend_report",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
    )
    return {"ok": True, "message": "Report generated and sent to the user."}


# ─── Admin: Generate report (choose plan) ───────────────────
class GenerateReportBody(BaseModel):
    plan: str = "profissional"
    send_email: bool = False


@router.post("/analyses/{analysis_id}/generate-report")
async def admin_generate_report(
    analysis_id: uuid.UUID,
    body: GenerateReportBody = Body(default=GenerateReportBody()),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin generates a report for any completed analysis.
    Chooses plan tier (essencial/profissional/estrategico).
    Optionally sends the email to the client."""
    from app.core.security import create_download_token
    from app.services.pdf_service import generate_report_pdf
    from app.services.email_service import send_report_ready_email
    import asyncio

    result = await db.execute(
        select(Analysis, User)
        .join(User, Analysis.user_id == User.id)
        .where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    analysis, owner = row

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Analysis is not completed yet.")

    # Map plan string to PlanType
    plan_map = {
        "essencial": PlanType.ESSENCIAL,
        "profissional": PlanType.PROFISSIONAL,
        "estrategico": PlanType.ESTRATEGICO,
    }
    plan_type = plan_map.get(body.plan.lower())
    if not plan_type:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan}. Use essencial, profissional, or estrategico.")

    # Set plan on analysis so generate_report_pdf reads it
    analysis.plan = plan_type
    await db.commit()
    await db.refresh(analysis)

    # Get existing report if any
    existing = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()

    # Generate PDF
    try:
        pdf_path = await asyncio.to_thread(generate_report_pdf, analysis)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)[:200]}")

    if existing:
        # Update file path but preserve download_token so emailed links stay valid
        existing.file_path = pdf_path
        await db.commit()
        download_url = f"{settings.APP_URL}/api/v1/reports/download?token={existing.download_token}"
    else:
        download_token = create_download_token(str(analysis_id))
        report = Report(
            analysis_id=analysis_id,
            file_path=pdf_path,
            download_token=download_token,
        )
        db.add(report)
        await db.commit()
        download_url = f"{settings.APP_URL}/api/v1/reports/download?token={download_token}"

    # Optionally send email
    if body.send_email:
        try:
            await send_report_ready_email(owner.email, owner.full_name, analysis.company_name, download_url)
        except Exception:
            pass  # Don't fail the whole request if email fails

    await audit_log(
        action="admin_generate_report",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
        detail=f"plan={body.plan} send_email={body.send_email}",
    )

    return {
        "ok": True,
        "message": f"Report generated ({body.plan})" + (" and sent to client." if body.send_email else "."),
        "download_url": download_url,
    }


# ─── Admin: Download PDF directly ───────────────────────────
@router.get("/analyses/{analysis_id}/download-pdf")
async def admin_download_pdf(
    analysis_id: uuid.UUID,
    plan: Optional[str] = Query(default=None, description="Plan tier: essencial, profissional, estrategico"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin downloads the PDF report directly.
    If a plan is specified, (re)generates the report with that plan.
    If no report exists yet, auto-generates with profissional plan."""
    from app.core.security import create_download_token
    from app.services.pdf_service import generate_report_pdf
    from fastapi.responses import FileResponse
    import asyncio, os

    analysis = (await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Analysis is not completed yet.")

    # If plan specified, force regeneration with that plan
    force_plan = None
    if plan:
        plan_lower = plan.strip().lower()
        plan_map = {"essencial": PlanType.ESSENCIAL, "profissional": PlanType.PROFISSIONAL, "estrategico": PlanType.ESTRATEGICO}
        if plan_lower not in plan_map:
            raise HTTPException(status_code=400, detail=f"Invalid plan: {plan}. Must be essencial, profissional or estrategico.")
        force_plan = plan_map[plan_lower]
        analysis.plan = force_plan
        await db.commit()
        await db.refresh(analysis)

    # Get or create report
    report = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()

    need_generate = False
    if force_plan:
        need_generate = True  # always regenerate when plan explicitly chosen
    elif not report:
        need_generate = True
    elif not os.path.exists(report.file_path):
        need_generate = True

    if need_generate:
        # Auto-assign plan if missing
        if not analysis.plan:
            analysis.plan = PlanType.PROFISSIONAL
            await db.commit()
            await db.refresh(analysis)

        try:
            pdf_path = await asyncio.to_thread(generate_report_pdf, analysis)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)[:200]}")

        if report:
            report.file_path = pdf_path
        else:
            download_token = create_download_token(str(analysis_id))
            report = Report(
                analysis_id=analysis_id,
                file_path=pdf_path,
                download_token=download_token,
            )
            db.add(report)
        await db.commit()

    return FileResponse(
        report.file_path,
        media_type="application/pdf",
        filename=f"valuora-report-{analysis.company_name or analysis_id}.pdf",
    )


# ─── Admin: Send report to client or custom email ───────────
class SendToClientBody(BaseModel):
    email: Optional[str] = None  # None = send to client's email
    plan: Optional[str] = None   # None = use existing plan; essencial/profissional/estrategico


@router.post("/analyses/{analysis_id}/send-to-client")
async def admin_send_to_client(
    analysis_id: uuid.UUID,
    body: SendToClientBody = Body(default=SendToClientBody()),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Sends the report to the client email or a custom email.
    Auto-generates the report if it doesn't exist yet."""
    from app.core.security import create_download_token
    from app.services.pdf_service import generate_report_pdf
    from app.services.email_service import send_report_ready_email
    import asyncio, os

    result = await db.execute(
        select(Analysis, User)
        .join(User, Analysis.user_id == User.id)
        .where(Analysis.id == analysis_id, Analysis.deleted_at.is_(None))
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    analysis, owner = row

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Analysis is not completed yet.")

    # If plan specified, force regeneration with that plan
    force_regen = False
    if body.plan:
        plan_lower = body.plan.strip().lower()
        plan_map = {"essencial": PlanType.ESSENCIAL, "profissional": PlanType.PROFISSIONAL, "estrategico": PlanType.ESTRATEGICO}
        if plan_lower not in plan_map:
            raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan}. Must be essencial, profissional or estrategico.")
        analysis.plan = plan_map[plan_lower]
        await db.commit()
        await db.refresh(analysis)
        force_regen = True

    # Get or create report
    report = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()

    if force_regen or not report or not os.path.exists(report.file_path):
        # Auto-assign plan if missing
        if not analysis.plan:
            analysis.plan = PlanType.PROFISSIONAL
            await db.commit()
            await db.refresh(analysis)

        try:
            pdf_path = await asyncio.to_thread(generate_report_pdf, analysis)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)[:200]}")

        if report:
            report.file_path = pdf_path
        else:
            download_token = create_download_token(str(analysis_id))
            report = Report(
                analysis_id=analysis_id,
                file_path=pdf_path,
                download_token=download_token,
            )
            db.add(report)
        await db.commit()
        await db.refresh(report)

    # Determine recipient
    target_email = body.email or owner.email
    target_name = owner.full_name if not body.email else target_email

    download_url = f"{settings.APP_URL}/api/v1/reports/download?token={report.download_token}"
    try:
        await send_report_ready_email(target_email, target_name, analysis.company_name, download_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)[:200]}")

    await audit_log(
        action="admin_send_report",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(analysis_id),
        detail=f"sent_to={target_email}",
    )

    return {"ok": True, "message": f"Report sent to {target_email}."}


# ─── PA3: Refund a payment ─────────────────────────────────
@router.post("/payments/{payment_id}/refund")
async def refund_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found.")
    if payment.status != PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Only confirmed payments can be refunded.")

    # TODO: If Stripe payment, issue refund via Stripe API
    # if payment.stripe_payment_intent_id and payment.payment_method != "admin_bypass":
    #     import stripe
    #     stripe.Refund.create(payment_intent=payment.stripe_payment_intent_id)

    payment.status = PaymentStatus.REFUNDED
    await db.commit()
    return {"message": "Payment refunded successfully."}


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
        raise HTTPException(status_code=400, detail="discount_pct must be between 0 and 1 (e.g. 0.10 for 10%, 1.0 for 100%).")
    code = data.code.strip().upper()
    existing = (await db.execute(select(Coupon).where(Coupon.code == code))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists.")
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
        raise HTTPException(status_code=404, detail="Coupon not found.")
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
        raise HTTPException(status_code=404, detail="Coupon not found.")
    await db.delete(coupon)
    await db.commit()
    return {"message": "Coupon deleted."}

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

    discount_label = f"{int(coupon.discount_pct * 100)}% discount"
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
    return {"message": f"E-mail com cup\u00f3m {coupon.code} ) scheduled for {user.email}."}

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
        headers={"Content-Disposition": f"attachment; filename=users-{__import__('datetime').datetime.now().strftime('%Y%m%d')}.csv"},
    )


@router.get("/export/analyses")
async def export_analyses_csv(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Export all analyses as CSV (admin only)."""
    import csv, io
    from fastapi.responses import StreamingResponse

    result = await db.execute(
        select(Analysis, User.email.label("user_email"))
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
    for a, email in rows:
        writer.writerow([
            str(a.id), email, a.company_name, a.sector or "",
            a.status.value if a.status else "", a.equity_value or 0,
            a.risk_score or 0, a.plan.value if a.plan else "",
            a.created_at.isoformat() if a.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=analyses-{__import__('datetime').datetime.now().strftime('%Y%m%d')}.csv"},
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
        headers={"Content-Disposition": f"attachment; filename=payments-{__import__('datetime').datetime.now().strftime('%Y%m%d')}.csv"},
    )


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
        query = query.where(ErrorLog.route.ilike(f"%{route}%"))
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
        raise HTTPException(status_code=403, detail="Only superadmin can clear the logs.")
    from sqlalchemy import delete
    await db.execute(delete(ErrorLog))
    await db.commit()
    return {"message": "Logs cleared successfully."}


# ─── Background Job Queue ─────────────────────────────────────

@router.post("/jobs/batch-revaluation")
async def batch_revaluation(
    analysis_ids: List[str] = Body(..., embed=True),
    admin: User = Depends(get_current_admin),
):
    """Enqueue batch re-valuation of multiple analyses."""
    from app.tasks.job_queue import enqueue_job
    job_id = await enqueue_job(
        "batch_revaluation",
        {"analysis_ids": analysis_ids, "user_id": str(admin.id)},
        priority=3,
    )
    return {"job_id": job_id, "message": f"Batch revaluation of {len(analysis_ids)} analyses queued."}


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    admin: User = Depends(get_current_admin),
):
    """Check status of a background job."""
    from app.tasks.job_queue import get_job_status as _get_status
    status = await _get_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return status
