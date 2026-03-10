import uuid
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
from app.schemas.analysis import PaymentCreate, PLAN_PRICES
from app.schemas.auth import MessageResponse
from app.core.cache import cache_set
from app.services.auth_service import get_current_user
from app.services.email_service import (
    send_payment_confirmation_email,
    send_report_ready_email,
)
from app.services.pdf_service import generate_report_pdf
from app.services.asaas_service import asaas_service

import logging
logger = logging.getLogger(__name__)

GEN_PROGRESS_TTL = 600  # 10 min


async def _set_gen_progress(analysis_id: str, step: int, message: str, pct: int, done: bool = False, error: str | None = None):
    """Store generation progress in Redis so the SSE endpoint can relay it."""
    key = f"gen_progress:{analysis_id}"
    await cache_set(key, {"step": step, "message": message, "pct": pct, "done": done, "error": error}, ttl=GEN_PROGRESS_TTL)

router = APIRouter(prefix="/payments", tags=["Pagamentos"])


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
            "status": p.status.value,
            "payment_method": p.payment_method,
            "asaas_invoice_url": p.asaas_invoice_url,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p, company in rows
    ]


# ─── Response schema with Asaas fields ─────────────────────
class PaymentResponseAsaas(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    analysis_id: uuid.UUID
    plan: PlanType
    amount: float
    payment_method: Optional[str] = None
    status: PaymentStatus
    asaas_payment_id: Optional[str] = None
    asaas_invoice_url: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Create payment (Asaas or admin bypass) ────────────────
@router.post("/", response_model=PaymentResponseAsaas)
async def create_payment(
    data: PaymentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify analysis
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == data.analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Análise ainda não foi processada.")

    # Check duplicate — only block if already paid
    existing = await db.execute(
        select(Payment).where(
            Payment.analysis_id == data.analysis_id,
            Payment.status == PaymentStatus.PAID,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Pagamento já realizado para esta análise.")

    # Remove stale pending/failed payments for same analysis (allows retry)
    stale = await db.execute(
        select(Payment).where(
            Payment.analysis_id == data.analysis_id,
            Payment.status.in_([PaymentStatus.PENDING]),
        )
    )
    for old_payment in stale.scalars().all():
        await db.delete(old_payment)
    await db.flush()

    amount = PLAN_PRICES[data.plan]

    # ── Coupon discount (DB-backed) ──
    coupon_code_applied: Optional[str] = None
    if data.coupon and data.coupon.strip():
        code = data.coupon.strip().upper()
        coupon_result = await db.execute(
            select(Coupon).where(Coupon.code == code, Coupon.is_active == True)
        )
        coupon = coupon_result.scalar_one_or_none()
        if coupon is None:
            raise HTTPException(status_code=400, detail="Cupom inválido ou inativo.")
        if coupon.expires_at and coupon.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Cupom expirado.")
        if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
            raise HTTPException(status_code=400, detail="Cupom já atingiu o limite de usos.")
        # Atomic increment: guard against race conditions
        from sqlalchemy import update as sa_update
        rows = await db.execute(
            sa_update(Coupon)
            .where(Coupon.id == coupon.id)
            .where(
                (Coupon.max_uses.is_(None)) | (Coupon.used_count < Coupon.max_uses)
            )
            .values(used_count=Coupon.used_count + 1)
        )
        if rows.rowcount == 0:
            raise HTTPException(status_code=400, detail="Cupom já atingiu o limite de usos.")
        discount = min(max(coupon.discount_pct, 0), 1.0)  # Validate 0-1 range
        amount = round(float(amount) * (1 - discount), 2)
        if amount < 0:
            amount = 0
        coupon_code_applied = coupon.code

    # ── Admin bypass: free instant payment ──
    if current_user.is_admin or current_user.is_superadmin:
        payment = Payment(
            user_id=current_user.id,
            analysis_id=data.analysis_id,
            plan=data.plan,
            amount=0,
            net_value=0,
            payment_method="admin_bypass",
            status=PaymentStatus.PAID,
            coupon_code=coupon_code_applied,
            paid_at=datetime.now(timezone.utc),
        )
        db.add(payment)
        analysis.plan = data.plan
        await db.commit()
        await db.refresh(payment)

        background_tasks.add_task(
            _generate_and_send_report,
            str(analysis.id),
            str(current_user.id),
        )
        return payment

    # ── Regular user: create Asaas payment ──
    try:
        if not current_user.cpf_cnpj:
            raise HTTPException(status_code=400, detail="CPF ou CNPJ é obrigatório para pagamento. Atualize seu cadastro.")

        # Strip non-numeric characters for Asaas
        cpf_cnpj_clean = ''.join(c for c in current_user.cpf_cnpj if c.isdigit())
        if len(cpf_cnpj_clean) not in (11, 14):
            raise HTTPException(status_code=400, detail="CPF ou CNPJ inválido.")

        customer = await asaas_service.find_or_create_customer(
            name=current_user.full_name,
            email=current_user.email,
            cpf_cnpj=cpf_cnpj_clean,
            phone=current_user.phone,
        )

        asaas_payment = await asaas_service.create_payment(
            customer_id=customer["id"],
            value=float(amount),
            description=f"Quanto Vale - Plano {data.plan.value.capitalize()} - {analysis.company_name}",
            external_reference=str(data.analysis_id),
        )

        invoice_url = asaas_payment.get("invoiceUrl", "")

        payment = Payment(
            user_id=current_user.id,
            analysis_id=data.analysis_id,
            plan=data.plan,
            amount=amount,
            payment_method="asaas",
            status=PaymentStatus.PENDING,
            asaas_payment_id=asaas_payment["id"],
            asaas_customer_id=customer["id"],
            asaas_invoice_url=invoice_url,
            coupon_code=coupon_code_applied,
        )
        db.add(payment)
        # Plan will be activated by webhook when payment is confirmed
        await db.commit()
        await db.refresh(payment)

        return payment

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao criar pagamento: {str(e)}")


# ─── Check payment status ──────────────────────────────────
@router.get("/{payment_id}/status")
async def get_payment_status(
    payment_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.user_id == current_user.id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")

    # If pending and has Asaas ID, check remotely
    if payment.status == PaymentStatus.PENDING and payment.asaas_payment_id:
        try:
            remote = await asaas_service.get_payment(payment.asaas_payment_id)
            remote_status = remote.get("status", "")
            if remote_status in ("CONFIRMED", "RECEIVED"):
                payment.status = PaymentStatus.PAID
                payment.paid_at = datetime.now(timezone.utc)
                await db.commit()
                # Generate report + send emails (fallback if webhook missed)
                background_tasks.add_task(
                    _generate_and_send_report,
                    str(payment.analysis_id),
                    str(payment.user_id),
                )
        except Exception:
            pass

    return {
        "id": str(payment.id),
        "status": payment.status.value,
        "asaas_payment_id": payment.asaas_payment_id,
        "asaas_invoice_url": payment.asaas_invoice_url,
    }


# ─── SSE: stream payment status updates ───────────────────
@router.get("/{payment_id}/stream")
async def stream_payment_status(
    payment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    """
    Server-Sent Events endpoint — push payment status to the browser.
    Polls Asaas every 3 s; closes automatically when paid/failed or after 3 min.
    """
    from sse_starlette.sse import EventSourceResponse
    import asyncio
    from app.core.database import async_session_maker

    user_id = current_user.id

    async def event_generator():
        max_polls = 60  # 60 × 3 s = 3 minutes
        async with async_session_maker() as session:
            for _ in range(max_polls):
                result = await session.execute(
                    select(Payment).where(
                        Payment.id == payment_id,
                        Payment.user_id == user_id,
                    )
                )
                payment = result.scalar_one_or_none()

                if not payment:
                    yield {"event": "error", "data": "not_found"}
                    return

                status = payment.status

                # Query Asaas if still pending
                if status == PaymentStatus.PENDING and payment.asaas_payment_id:
                    try:
                        remote = await asaas_service.get_payment(payment.asaas_payment_id)
                        if remote.get("status") in ("CONFIRMED", "RECEIVED"):
                            result2 = await session.execute(
                                select(Payment).where(
                                    Payment.id == payment_id,
                                    Payment.user_id == user_id,
                                )
                            )
                            p2 = result2.scalar_one_or_none()
                            if p2:
                                p2.status = PaymentStatus.PAID
                                p2.paid_at = datetime.now(timezone.utc)
                                if p2.net_value is None:
                                    p2.net_value = float(p2.amount or 0)
                                _analysis_id = str(p2.analysis_id)
                                await session.commit()
                                # Fire-and-forget: generate report (webhook may not fire in sandbox/dev)
                                asyncio.create_task(
                                    _generate_and_send_report(_analysis_id, str(user_id))
                                )
                            status = PaymentStatus.PAID
                    except Exception:
                        pass

                yield {"event": "status", "data": status.value}

                if status in (PaymentStatus.PAID, PaymentStatus.FAILED):
                    return

                await asyncio.sleep(3)

        yield {"event": "timeout", "data": "timeout"}

    return EventSourceResponse(event_generator())


async def _generate_and_send_report(analysis_id: str, user_id: str):
    """Background task: generate PDF and send emails (fallback when webhook misses)."""
    import asyncio
    from app.core.database import async_session_maker

    aid = analysis_id  # short alias
    await _set_gen_progress(aid, 1, "Buscando dados da empresa…", 5)

    async with async_session_maker() as db:
        result = await db.execute(
            select(Analysis).where(Analysis.id == uuid.UUID(analysis_id))
        )
        analysis = result.scalar_one_or_none()
        if not analysis:
            await _set_gen_progress(aid, 0, "Análise não encontrada.", 0, done=True, error="not_found")
            return

        user_result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = user_result.scalar_one_or_none()
        if not user:
            await _set_gen_progress(aid, 0, "Usuário não encontrado.", 0, done=True, error="user_not_found")
            return

        # Idempotency: skip if report already exists (webhook may have run first)
        existing_report = await db.execute(
            select(Report).where(Report.analysis_id == analysis.id)
        )
        if existing_report.scalar_one_or_none():
            await _set_gen_progress(aid, 6, "Relatório já disponível.", 100, done=True)
            return

        # Ensure analysis.plan is set (webhook may have missed it)
        payment_result = await db.execute(
            select(Payment).where(Payment.analysis_id == analysis.id)
        )
        payment = payment_result.scalar_one_or_none()
        if payment and payment.plan and not analysis.plan:
            analysis.plan = payment.plan

        await _set_gen_progress(aid, 2, "Calculando Ke (custo de capital próprio)…", 25)
        await asyncio.sleep(0)  # yield to event loop

        await _set_gen_progress(aid, 3, "Calculando DCF e múltiplos de mercado…", 45)
        await asyncio.sleep(0)

        await _set_gen_progress(aid, 4, "Gerando relatório PDF…", 65)

        # Retry PDF generation up to 3 attempts with exponential backoff
        pdf_path = None
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                pdf_path = await asyncio.to_thread(generate_report_pdf, analysis)
                break
            except Exception as exc:
                last_exc = exc
                logger.warning("[PDF] Attempt %d failed for analysis %s: %s", attempt + 1, analysis_id, exc)
                if attempt < 2:
                    await asyncio.sleep(5 * (2 ** attempt))  # 5s, 10s

        if pdf_path is None:
            await _set_gen_progress(aid, 4, "Falha ao gerar PDF após 3 tentativas.", 65, done=True, error=str(last_exc))
            logger.error("[PDF] All retries exhausted for analysis %s: %s", analysis_id, last_exc)
            return

        await _set_gen_progress(aid, 5, "Enviando relatório por e-mail…", 85)

        download_token = create_download_token(str(analysis.id))
        download_url = f"{settings.APP_URL}/api/v1/reports/download?token={download_token}"

        report = Report(
            analysis_id=analysis.id,
            version=1,
            file_path=pdf_path,
            download_token=download_token,
        )
        db.add(report)
        await db.commit()

        # Send both confirmation + report-ready emails
        if payment:
            await send_payment_confirmation_email(
                user.email,
                user.full_name,
                payment.plan.value.capitalize(),
                float(payment.amount),
            )
        await send_report_ready_email(
            user.email,
            user.full_name,
            analysis.company_name,
            download_url,
        )

        await _set_gen_progress(aid, 6, "Relatório pronto! Verifique seu e-mail.", 100, done=True)
