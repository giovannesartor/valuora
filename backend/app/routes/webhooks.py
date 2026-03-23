"""
Stripe webhook handler.
Receives payment notifications and updates order status.

Stripe Dashboard → Developers → Webhooks → Add endpoint:
  URL: https://api.valuora.online/webhooks/stripe

Events to subscribe:
  - checkout.session.completed
  - payment_intent.succeeded
  - payment_intent.payment_failed
  - charge.refunded
"""
import stripe
import uuid
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.core.config import settings
from app.core.security import create_download_token
from app.core.audit import audit_log
from app.models.models import (
    Payment, Analysis, User, Report,
    PaymentStatus, AnalysisStatus,
    PitchDeckPayment, PitchDeck, PitchDeckStatus, ProductType, PlanType,
)
from app.services.pdf_service import generate_report_pdf
from app.services.email_service import (
    send_payment_confirmation_email,
    send_report_ready_email,
)

import logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Webhooks"])

# Prevent background tasks from being garbage-collected mid-execution
_bg_tasks: set = set()

def _fire_and_forget(coro):
    """Schedule a coroutine as a background task that won't be GC'd."""
    task = asyncio.create_task(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook notifications with full signature verification.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.warning("[Webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting")
        raise HTTPException(status_code=503, detail="Stripe webhooks not configured")

    # Verify webhook signature
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        logger.error("[Webhook] Invalid payload")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        logger.error("[Webhook] Invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    logger.info(f"[Webhook] Received event: {event_type}")

    # ── Handle events ──────────────────────────────────────
    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        payment_id = session.get("metadata", {}).get("payment_id")
        stripe_pi = session.get("payment_intent")
        stripe_session_id = session.get("id")
        if payment_id:
            _fire_and_forget(_process_payment_success(payment_id, stripe_pi))
        elif stripe_session_id:
            # Safety net: look up payment by stripe_session_id
            logger.warning(f"[Webhook] checkout.session.completed without payment_id — trying session {stripe_session_id}")
            _fire_and_forget(_process_payment_success_by_session(stripe_session_id, stripe_pi, session.get("metadata", {})))
        else:
            logger.warning(f"[Webhook] checkout.session.completed without payment_id or session_id metadata")

    elif event_type == "payment_intent.succeeded":
        pi = event["data"]["object"]
        payment_id = pi.get("metadata", {}).get("payment_id")
        if payment_id:
            _fire_and_forget(_process_payment_success(payment_id, pi["id"]))

    elif event_type == "payment_intent.payment_failed":
        pi = event["data"]["object"]
        payment_id = pi.get("metadata", {}).get("payment_id")
        if payment_id:
            _fire_and_forget(_process_payment_failure(payment_id))

    elif event_type == "charge.refunded":
        charge = event["data"]["object"]
        payment_id = charge.get("metadata", {}).get("payment_id")
        if payment_id:
            _fire_and_forget(_process_payment_refund(payment_id))

    return {"status": "ok"}


# ─── Helper: process successful payment ───────────────────
async def _process_payment_success(payment_id: str, stripe_payment_intent_id: str = None):
    """
    Called when a payment is confirmed (by Stripe webhook or admin).
    Updates payment status, triggers valuation, and sends emails.
    """
    async with async_session_maker() as db:
        payment = await db.get(Payment, uuid.UUID(payment_id))
        if not payment:
            logger.error(f"[Webhook] Payment {payment_id} not found")
            return

        if payment.status == PaymentStatus.PAID:
            logger.info(f"[Webhook] Payment {payment_id} already paid — skipping")
            return

        payment.status = PaymentStatus.PAID
        payment.paid_at = datetime.now(timezone.utc)
        if stripe_payment_intent_id:
            payment.stripe_payment_intent_id = stripe_payment_intent_id
        payment.net_value = float(payment.amount)  # Update when Stripe fees are known

        # Update analysis
        analysis = await db.get(Analysis, payment.analysis_id)
        if analysis:
            analysis.plan = payment.plan
            analysis.status = AnalysisStatus.PROCESSING

        await db.commit()

        # Audit
        await audit_log(
            db,
            actor=f"stripe_webhook",
            action="payment_confirmed",
            resource=f"payment:{payment_id}",
            details={"stripe_pi": stripe_payment_intent_id},
        )

        # Trigger valuation in background
        if analysis:
            _fire_and_forget(
                _run_valuation_pipeline(
                    str(analysis.id), str(payment.user_id), payment.plan
                )
            )

        # Send confirmation email
        user = await db.get(User, payment.user_id)
        if user:
            try:
                await send_payment_confirmation_email(
                    user.email, user.full_name,
                    analysis.company_name if analysis else "N/A",
                    payment.plan,
                )
            except Exception as e:
                logger.error(f"[Webhook] Failed to send payment confirmation email: {e}")
        else:
            logger.error(f"[Webhook] User {payment.user_id} not found — cannot send email")


async def _process_payment_success_by_session(stripe_session_id: str, stripe_pi: str = None, metadata: dict = None):
    """
    Safety net: look up Payment by stripe_session_id when payment_id is missing from metadata.
    """
    async with async_session_maker() as db:
        result = await db.execute(
            select(Payment).where(Payment.stripe_session_id == stripe_session_id)
        )
        payment = result.scalars().first()
        if payment:
            await _process_payment_success(str(payment.id), stripe_pi)
            return

        logger.error(f"[Webhook] No payment found for session {stripe_session_id}")


async def _process_payment_failure(payment_id: str):
    """Mark a payment as failed when Stripe reports a failure."""
    async with async_session_maker() as db:
        payment = await db.get(Payment, uuid.UUID(payment_id))
        if not payment:
            logger.error(f"[Webhook] Payment {payment_id} not found for failure event")
            return
        if payment.status == PaymentStatus.PAID:
            logger.info(f"[Webhook] Payment {payment_id} already paid — ignoring failure")
            return
        payment.status = PaymentStatus.FAILED
        await db.commit()
        await audit_log(
            db, actor="stripe_webhook", action="payment_failed",
            resource=f"payment:{payment_id}", details={},
        )
        logger.info(f"[Webhook] Payment {payment_id} marked as FAILED")


async def _process_payment_refund(payment_id: str):
    """Mark a payment as refunded when Stripe reports a refund."""
    async with async_session_maker() as db:
        payment = await db.get(Payment, uuid.UUID(payment_id))
        if not payment:
            logger.error(f"[Webhook] Payment {payment_id} not found for refund event")
            return
        payment.status = PaymentStatus.REFUNDED
        await db.commit()
        await audit_log(
            db, actor="stripe_webhook", action="payment_refunded",
            resource=f"payment:{payment_id}", details={},
        )
        logger.info(f"[Webhook] Payment {payment_id} marked as REFUNDED")


async def _run_valuation_pipeline(analysis_id: str, user_id: str, plan: PlanType):
    """Run valuation engine and generate PDF report."""
    from app.core.valuation_engine.engine import run_valuation
    from app.core.cache import cache_set

    progress_key = f"gen_progress:{analysis_id}"

    try:
        async with async_session_maker() as db:
            analysis = await db.get(Analysis, uuid.UUID(analysis_id))
            if not analysis:
                return

            await cache_set(progress_key, {"step": 1, "message": "Running valuation...", "pct": 20}, ttl=600)

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

            analysis.valuation_result = result
            analysis.equity_value = result.get("equity_value")
            analysis.risk_score = result.get("risk_score")
            analysis.maturity_index = result.get("maturity_index")
            analysis.percentile = result.get("percentile")
            analysis.status = AnalysisStatus.COMPLETED
            await db.commit()

            await cache_set(progress_key, {"step": 3, "message": "Generating report...", "pct": 60}, ttl=600)

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
            except Exception as e:
                logger.error(f"[Webhook] PDF generation failed: {e}", exc_info=True)

            # Email notification
            try:
                user = await db.get(User, uuid.UUID(user_id))
                if user:
                    await send_report_ready_email(
                        user.email, user.full_name, analysis.company_name
                    )
            except Exception as e:
                logger.error(f"[Webhook] Email failed: {e}")

            await cache_set(progress_key, {"step": 5, "message": "Complete!", "pct": 100, "done": True}, ttl=600)

    except Exception as e:
        logger.error(f"[Webhook] Valuation pipeline failed: {e}", exc_info=True)
        from app.core.cache import cache_set as cs
        await cs(progress_key, {"step": 0, "message": f"Error: {str(e)[:200]}", "pct": 0, "error": str(e)[:200]}, ttl=600)
