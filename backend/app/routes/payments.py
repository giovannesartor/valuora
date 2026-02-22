import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_download_token
from app.core.config import settings
from app.models.models import (
    User, Analysis, Payment, Report,
    PlanType, PaymentStatus, AnalysisStatus,
)
from app.schemas.analysis import PaymentCreate, PaymentResponse, PLAN_PRICES
from app.schemas.auth import MessageResponse
from app.services.auth_service import get_current_user
from app.services.email_service import (
    send_payment_confirmation_email,
    send_report_ready_email,
)
from app.services.pdf_service import generate_report_pdf

router = APIRouter(prefix="/payments", tags=["Pagamentos"])


@router.post("/", response_model=PaymentResponse)
async def create_payment(
    data: PaymentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify analysis exists and belongs to user
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

    # Check if already paid
    existing = await db.execute(
        select(Payment).where(
            Payment.analysis_id == data.analysis_id,
            Payment.status == PaymentStatus.PAID,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Pagamento já realizado para esta análise.")

    amount = PLAN_PRICES[data.plan]

    payment = Payment(
        user_id=current_user.id,
        analysis_id=data.analysis_id,
        plan=data.plan,
        amount=amount,
        status=PaymentStatus.PAID,  # Simplified — in production, integrate payment gateway
    )
    db.add(payment)

    # Update analysis plan
    analysis.plan = data.plan

    await db.commit()
    await db.refresh(payment)

    # Send confirmation & generate report in background
    background_tasks.add_task(
        send_payment_confirmation_email,
        current_user.email,
        current_user.full_name,
        data.plan.value.capitalize(),
        float(amount),
    )

    background_tasks.add_task(
        _generate_and_send_report,
        str(analysis.id),
        str(current_user.id),
    )

    return payment


async def _generate_and_send_report(analysis_id: str, user_id: str):
    """Background task: generate PDF and send email."""
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

        # Generate PDF
        pdf_path = generate_report_pdf(analysis)

        # Create download token
        download_token = create_download_token(str(analysis.id))
        download_url = f"{settings.APP_URL}/api/v1/reports/download?token={download_token}"

        # Save report record
        report = Report(
            analysis_id=analysis.id,
            version=1,
            file_path=pdf_path,
            download_token=download_token,
        )
        db.add(report)
        await db.commit()

        # Send email
        await send_report_ready_email(
            user.email,
            user.full_name,
            analysis.company_name,
            download_url,
        )
