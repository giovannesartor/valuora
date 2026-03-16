import uuid
import asyncio as _asyncio
import stripe
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_download_token
from app.core.config import settings
from app.models.models import (
    User, Analysis, Payment, Report, Coupon,
    PlanType, PaymentStatus, AnalysisStatus,
)
from app.schemas.analysis import PaymentCreate, PLAN_PRICES, PLAN_CURRENCY
from app.schemas.auth import MessageResponse
from app.core.cache import cache_set
from app.services.auth_service import get_current_user
from app.services.email_service import (
    send_payment_confirmation_email,
    send_report_ready_email,
)
from app.services.pdf_service import generate_report_pdf

import logging
logger = logging.getLogger(__name__)

GEN_PROGRESS_TTL = 600  # 10 min

# ─── Stripe setup ─────────────────────────────────────────
stripe.api_key = settings.STRIPE_SECRET_KEY

# Map plan types to Stripe product IDs
PLAN_TO_STRIPE_PRODUCT = {
    PlanType.PROFESSIONAL: settings.STRIPE_PRODUCT_PROFESSIONAL,
    PlanType.ESSENCIAL: settings.STRIPE_PRODUCT_PROFESSIONAL,       # legacy alias
    PlanType.INVESTOR_READY: settings.STRIPE_PRODUCT_ADVANCED,
    PlanType.PROFISSIONAL: settings.STRIPE_PRODUCT_ADVANCED,        # legacy alias
    PlanType.FUNDRAISING: settings.STRIPE_PRODUCT_COMPLETE,
    PlanType.ESTRATEGICO: settings.STRIPE_PRODUCT_COMPLETE,         # legacy alias
}


async def _set_gen_progress(analysis_id: str, step: int, message: str, pct: int, done: bool = False, error: str | None = None):
    """Store generation progress in Redis so the SSE endpoint can relay it."""
    key = f"gen_progress:{analysis_id}"
    await cache_set(key, {"step": step, "message": message, "pct": pct, "done": done, "error": error}, ttl=GEN_PROGRESS_TTL)

# Prevent background tasks from being garbage-collected mid-execution
_bg_tasks: set = set()

def _fire_and_forget(coro):
    """Schedule a coroutine as a background task that won't be GC'd."""
    task = _asyncio.create_task(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)

router = APIRouter(prefix="/payments", tags=["Payments"])


# ─── List user payments ───────────────────────────────────
@router.get("/mine")
async def list_my_payments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Payment, Analysis.company_name)
        .join(Analysis, Payment.analysis_id == Analysis.id)
        .where(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": str(p.id),
            "analysis_id": str(p.analysis_id),
            "company_name": company,
            "plan": p.plan.value if p.plan else None,
            "amount": float(p.amount),
            "currency": getattr(p, "currency", "USD") or "USD",
            "status": p.status.value,
            "payment_method": p.payment_method,
            "stripe_session_id": p.stripe_session_id,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p, company in rows
    ]


# ─── Response schema ─────────────────────────────────────
class PaymentResponseSchema(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    analysis_id: uuid.UUID
    plan: PlanType
    amount: float
    currency: str = "USD"
    payment_method: Optional[str] = None
    status: PaymentStatus
    stripe_payment_intent_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    checkout_url: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Create payment (Stripe or admin bypass) ────────────────
@router.post("", response_model=PaymentResponseSchema)
async def create_payment(
    body: PaymentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a payment for an analysis.
    - Admin users: payment is auto-approved (bypass).
    - Regular users: returns payment record; Stripe checkout will be integrated.
    """
    # Validate analysis ownership
    analysis = await db.get(Analysis, body.analysis_id)
    if not analysis or analysis.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status == AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Analysis already completed")

    # Check duplicate payment
    existing = await db.execute(
        select(Payment).where(
            Payment.analysis_id == body.analysis_id,
            Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.PAID]),
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Payment already exists for this analysis")

    # Calculate price
    base_price = PLAN_PRICES.get(body.plan, 990.00)
    discount_pct = 0.0

    # Apply coupon if provided
    if body.coupon:
        coupon_result = await db.execute(
            select(Coupon).where(Coupon.code == body.coupon.upper(), Coupon.is_active == True)
        )
        coupon = coupon_result.scalars().first()
        if coupon:
            if coupon.max_uses and coupon.used_count >= coupon.max_uses:
                raise HTTPException(status_code=400, detail="Coupon usage limit reached")
            if coupon.expires_at and coupon.expires_at < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Coupon expired")
            discount_pct = coupon.discount_pct
            coupon.used_count += 1
        else:
            raise HTTPException(status_code=400, detail="Invalid coupon code")

    final_amount = round(base_price * (1 - discount_pct), 2)

    # Admin bypass — auto-approve
    if current_user.is_admin:
        payment = Payment(
            user_id=current_user.id,
            analysis_id=body.analysis_id,
            plan=body.plan,
            amount=final_amount,
            currency="USD",
            status=PaymentStatus.PAID,
            payment_method="admin_bypass",
            coupon_code=body.coupon.upper() if body.coupon else None,
            net_value=final_amount,
            paid_at=datetime.now(timezone.utc),
        )
        db.add(payment)
        analysis.plan = body.plan
        analysis.status = AnalysisStatus.PROCESSING
        await db.commit()
        await db.refresh(payment)

        # Trigger valuation + PDF in background
        _fire_and_forget(
            _run_valuation_and_report(str(analysis.id), str(current_user.id), body.plan)
        )
        return payment

    # ─── Regular user: create pending payment + Stripe Checkout ─────
    payment = Payment(
        user_id=current_user.id,
        analysis_id=body.analysis_id,
        plan=body.plan,
        amount=final_amount,
        currency="USD",
        status=PaymentStatus.PENDING,
        payment_method="stripe",
        coupon_code=body.coupon.upper() if body.coupon else None,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    # Create Stripe Checkout Session
    stripe_product_id = PLAN_TO_STRIPE_PRODUCT.get(body.plan)
    if not stripe_product_id or not settings.STRIPE_SECRET_KEY:
        logger.error(f"[Payment] Stripe not configured for plan {body.plan}")
        raise HTTPException(status_code=503, detail="Payment processing not available")

    try:
        checkout_session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product": stripe_product_id,
                    "unit_amount": int(final_amount * 100),  # Stripe uses cents
                },
                "quantity": 1,
            }],
            metadata={
                "payment_id": str(payment.id),
                "analysis_id": str(body.analysis_id),
                "user_id": str(current_user.id),
                "plan": body.plan.value,
            },
            customer_email=current_user.email,
            success_url=f"{settings.FRONTEND_URL}/analysis/{body.analysis_id}?payment=success",
            cancel_url=f"{settings.FRONTEND_URL}/analysis/{body.analysis_id}?payment=cancelled",
        )

        payment.stripe_session_id = checkout_session.id
        await db.commit()
        await db.refresh(payment)

        logger.info(f"[Payment] Created Stripe session {checkout_session.id} for payment {payment.id}")

    except stripe.error.StripeError as e:
        logger.error(f"[Payment] Stripe session creation failed: {e}")
        payment.status = PaymentStatus.FAILED
        await db.commit()
        raise HTTPException(status_code=502, detail="Failed to create payment session")

    # Return payment with checkout_url for frontend redirect
    return {
        "id": str(payment.id),
        "user_id": str(payment.user_id),
        "analysis_id": str(payment.analysis_id),
        "plan": payment.plan.value,
        "amount": float(payment.amount),
        "currency": "USD",
        "payment_method": "stripe",
        "status": payment.status.value,
        "stripe_session_id": checkout_session.id,
        "checkout_url": checkout_session.url,
    }


# ─── Confirm payment (called by Stripe webhook or admin) ──
@router.post("/{payment_id}/confirm")
async def confirm_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin endpoint to manually confirm a payment."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    payment = await db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.status == PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Payment already confirmed")

    payment.status = PaymentStatus.PAID
    payment.paid_at = datetime.now(timezone.utc)
    payment.net_value = float(payment.amount)

    analysis = await db.get(Analysis, payment.analysis_id)
    if analysis:
        analysis.plan = payment.plan
        analysis.status = AnalysisStatus.PROCESSING

    await db.commit()

    # Trigger valuation
    _fire_and_forget(
        _run_valuation_and_report(str(payment.analysis_id), str(payment.user_id), payment.plan)
    )

    return {"detail": "Payment confirmed", "payment_id": str(payment_id)}


# ─── Payment status check ──────────────────────────────────
@router.get("/{payment_id}/status")
async def check_payment_status(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = await db.get(Payment, payment_id)
    if not payment or payment.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Payment not found")

    return {
        "payment_id": str(payment.id),
        "status": payment.status.value,
        "amount": float(payment.amount),
        "currency": getattr(payment, "currency", "USD") or "USD",
        "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
    }


# ─── SSE: generation progress ─────────────────────────────
from fastapi.responses import StreamingResponse
from app.core.cache import cache_get
import json

@router.get("/{analysis_id}/progress")
async def generation_progress(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Server-Sent Events stream for report-generation progress."""
    analysis = await db.get(Analysis, analysis_id)
    if not analysis or analysis.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    async def event_stream():
        key = f"gen_progress:{analysis_id}"
        last = None
        retries = 0
        max_retries = 300  # 5 min at 1s interval
        while retries < max_retries:
            data = await cache_get(key)
            if data and data != last:
                last = data
                yield f"data: {json.dumps(data)}\n\n"
                if data.get("done") or data.get("error"):
                    break
            retries += 1
            await _asyncio.sleep(1)
        yield f"data: {json.dumps({'done': True, 'pct': 100, 'message': 'Stream ended'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ─── Validate coupon ──────────────────────────────────────
@router.post("/validate-coupon")
async def validate_coupon(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = body.get("code", "").strip().upper()
    plan = body.get("plan", "")
    if not code:
        raise HTTPException(status_code=400, detail="Coupon code required")

    result = await db.execute(
        select(Coupon).where(Coupon.code == code, Coupon.is_active == True)
    )
    coupon = result.scalars().first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    if coupon.max_uses and coupon.used_count >= coupon.max_uses:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    if coupon.expires_at and coupon.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Coupon expired")

    # Calculate discounted price
    plan_enum = None
    for pt in PlanType:
        if pt.value == plan:
            plan_enum = pt
            break
    base_price = PLAN_PRICES.get(plan_enum, 990.00) if plan_enum else 990.00
    discounted = round(base_price * (1 - coupon.discount_pct), 2)

    return {
        "valid": True,
        "code": coupon.code,
        "discount_pct": coupon.discount_pct,
        "original_price": base_price,
        "discounted_price": discounted,
        "currency": PLAN_CURRENCY,
    }


# ─── Background: run valuation + generate report ──────────
async def _run_valuation_and_report(analysis_id: str, user_id: str, plan: PlanType):
    """Run the full valuation engine and generate PDF report."""
    from app.core.database import async_session_maker
    from app.core.valuation_engine.engine import run_valuation

    try:
        await _set_gen_progress(analysis_id, 1, "Starting valuation engine...", 10)

        async with async_session_maker() as db:
            analysis = await db.get(Analysis, uuid.UUID(analysis_id))
            if not analysis:
                await _set_gen_progress(analysis_id, 0, "Analysis not found", 0, error="not_found")
                return

            await _set_gen_progress(analysis_id, 2, "Running DCF & multi-method valuation...", 25)

            # Build engine input
            engine_input = {
                "company_name": analysis.company_name,
                "sector": analysis.sector,
                "revenue": float(analysis.revenue),
                "net_margin": float(analysis.net_margin),
                "growth_rate": float(analysis.growth_rate) if analysis.growth_rate else None,
                "debt": float(analysis.debt or 0),
                "cash": float(analysis.cash or 0),
                "founder_dependency": float(analysis.founder_dependency or 0),
                "projection_years": analysis.projection_years or 10,
                "ebitda": float(analysis.ebitda) if analysis.ebitda else None,
                "recurring_revenue_pct": float(analysis.recurring_revenue_pct or 0),
                "num_employees": analysis.num_employees or 0,
                "years_in_business": analysis.years_in_business or 3,
                "previous_investment": float(analysis.previous_investment or 0),
                "qualitative_answers": analysis.qualitative_answers or {},
                "dcf_weight": analysis.dcf_weight,
                "custom_exit_multiple": analysis.custom_exit_multiple,
                # v8 diagnostic fields
                "company_type": analysis.company_type,
                "revenue_ntm": float(analysis.revenue_ntm) if analysis.revenue_ntm else None,
                "ebitda_margin": analysis.ebitda_margin,
                "tangible_assets": float(analysis.tangible_assets) if analysis.tangible_assets else None,
                "intangible_assets": float(analysis.intangible_assets) if analysis.intangible_assets else None,
                "equity_participations": float(analysis.equity_participations) if analysis.equity_participations else None,
            }

            result = await run_valuation(engine_input)

            await _set_gen_progress(analysis_id, 3, "Valuation complete. Generating report...", 50)

            # Update analysis with results
            analysis.valuation_result = result
            analysis.equity_value = result.get("equity_value")
            analysis.risk_score = result.get("risk_score")
            analysis.maturity_index = result.get("maturity_index")
            analysis.percentile = result.get("percentile")
            analysis.status = AnalysisStatus.COMPLETED
            await db.commit()

            await _set_gen_progress(analysis_id, 4, "Generating PDF report...", 70)

            # Generate PDF
            try:
                pdf_path = generate_report_pdf(analysis, plan)
                if pdf_path:
                    download_token = create_download_token(analysis_id)
                    report = Report(
                        analysis_id=uuid.UUID(analysis_id),
                        file_path=pdf_path,
                        download_token=download_token,
                    )
                    db.add(report)
                    await db.commit()
                    await _set_gen_progress(analysis_id, 5, "Report ready!", 90)
            except Exception as pdf_err:
                logger.error(f"[Payment] PDF generation failed: {pdf_err}", exc_info=True)
                await _set_gen_progress(analysis_id, 5, "Valuation complete (PDF generation failed)", 90)

            # Send emails
            await _set_gen_progress(analysis_id, 6, "Sending confirmation emails...", 95)
            try:
                user = await db.get(User, uuid.UUID(user_id))
                if user:
                    await send_payment_confirmation_email(user.email, user.full_name, analysis.company_name, plan)
                    await send_report_ready_email(user.email, user.full_name, analysis.company_name)
            except Exception as email_err:
                logger.error(f"[Payment] Email send failed: {email_err}", exc_info=True)

            await _set_gen_progress(analysis_id, 7, "All done!", 100, done=True)

    except Exception as e:
        logger.error(f"[Payment] Valuation failed for {analysis_id}: {e}", exc_info=True)
        await _set_gen_progress(analysis_id, 0, f"Error: {str(e)[:200]}", 0, error=str(e)[:200])

        # Mark analysis as failed
        try:
            async with async_session_maker() as db:
                analysis = await db.get(Analysis, uuid.UUID(analysis_id))
                if analysis:
                    analysis.status = AnalysisStatus.FAILED
                    await db.commit()
        except Exception:
            pass
