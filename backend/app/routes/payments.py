import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_download_token
from app.core.config import settings
from app.models.models import (
    User, Analysis, Payment, Report,
    PlanType, PaymentStatus, AnalysisStatus,
)
from app.schemas.analysis import PaymentCreate, PLAN_PRICES
from app.schemas.auth import MessageResponse
from app.services.auth_service import get_current_user
from app.services.email_service import (
    send_payment_confirmation_email,
    send_report_ready_email,
)
from app.services.pdf_service import generate_report_pdf
from app.services.asaas_service import asaas_service

router = APIRouter(prefix="/payments", tags=["Pagamentos"])


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

    # Check duplicate
    existing = await db.execute(
        select(Payment).where(
            Payment.analysis_id == data.analysis_id,
            Payment.status == PaymentStatus.PAID,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Pagamento já realizado para esta análise.")

    amount = PLAN_PRICES[data.plan]

    # ── Coupon discount ──
    discount_applied = False
    if data.coupon and data.coupon.strip().upper() == "PRIMEIRA":
        amount = round(float(amount) * 0.9, 2)  # 10% off
        discount_applied = True

    # ── Admin bypass: free instant payment ──
    if current_user.is_admin or current_user.is_superadmin:
        payment = Payment(
            user_id=current_user.id,
            analysis_id=data.analysis_id,
            plan=data.plan,
            amount=0,
            payment_method="admin_bypass",
            status=PaymentStatus.PAID,
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
        )
        db.add(payment)
        analysis.plan = data.plan
        await db.commit()
        await db.refresh(payment)

        return payment

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao criar pagamento: {str(e)}")


# ─── Check payment status ──────────────────────────────────
@router.get("/{payment_id}/status")
async def get_payment_status(
    payment_id: uuid.UUID,
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
                await db.commit()
        except Exception:
            pass

    return {
        "id": str(payment.id),
        "status": payment.status.value,
        "asaas_payment_id": payment.asaas_payment_id,
        "asaas_invoice_url": payment.asaas_invoice_url,
    }


async def _generate_and_send_report(analysis_id: str, user_id: str):
    """Background task: generate PDF and send email."""
    import asyncio
    from app.core.database import async_session_maker

    async with async_session_maker() as db:
        result = await db.execute(
            select(Analysis).where(Analysis.id == uuid.UUID(analysis_id))
        )
        analysis = result.scalar_one_or_none()
        if not analysis:
            return

        user_result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = user_result.scalar_one_or_none()
        if not user:
            return

        pdf_path = await asyncio.to_thread(generate_report_pdf, analysis)
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

        await send_report_ready_email(
            user.email,
            user.full_name,
            analysis.company_name,
            download_url,
        )
