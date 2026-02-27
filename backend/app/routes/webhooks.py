"""
Asaas webhook handler.
Receives payment notifications and updates order status.

Webhook events to select in Asaas dashboard:
- PAYMENT_CONFIRMED (pagamento confirmado)
- PAYMENT_RECEIVED (pagamento recebido)
- PAYMENT_OVERDUE (pagamento vencido)
- PAYMENT_REFUNDED (pagamento estornado)
- PAYMENT_DELETED (pagamento removido)
"""
import hmac
import uuid
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
)
from app.services.pdf_service import generate_report_pdf
from app.services.email_service import (
    send_payment_confirmation_email,
    send_report_ready_email,
)

router = APIRouter(tags=["Webhooks"])


@router.post("/webhooks/asaas")
async def asaas_webhook(request: Request):
    """
    Handle Asaas payment webhook notifications.
    Configure in Asaas: https://api.quantovale.online/webhooks/asaas
    
    Events to enable:
    - PAYMENT_CONFIRMED
    - PAYMENT_RECEIVED
    - PAYMENT_OVERDUE
    - PAYMENT_REFUNDED
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Verify webhook token using constant-time comparison (prevents timing attacks)
    webhook_token = request.headers.get("asaas-access-token", "")
    if not settings.ASAAS_WEBHOOK_TOKEN:
        # No token configured = reject all webhooks for security
        raise HTTPException(status_code=401, detail="Webhook token not configured")
    if not hmac.compare_digest(webhook_token, settings.ASAAS_WEBHOOK_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    event = body.get("event")
    payment_data = body.get("payment", {})
    asaas_payment_id = payment_data.get("id")
    external_reference = payment_data.get("externalReference")

    if not event or not asaas_payment_id:
        return {"status": "ignored", "reason": "missing event or payment id"}

    async with async_session_maker() as db:
        # Find payment by asaas_payment_id first, then fallback to external_reference as analysis_id
        query = select(Payment).where(Payment.asaas_payment_id == asaas_payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()

        if not payment and external_reference:
            # external_reference is analysis_id, not payment_id
            try:
                ext_uuid = uuid.UUID(external_reference)
                fallback_query = select(Payment).where(Payment.analysis_id == ext_uuid)
                result = await db.execute(fallback_query)
                payment = result.scalar_one_or_none()
            except ValueError:
                pass  # invalid UUID, skip fallback

        if not payment:
            return {"status": "ignored", "reason": "payment not found"}

        # Handle events
        if event in ("PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"):
            if payment.status != PaymentStatus.PAID:
                payment.status = PaymentStatus.PAID
                payment.paid_at = datetime.now(timezone.utc)

                # Captura método, valor líquido e parcelas do payload Asaas
                billing_type = payment_data.get("billingType")  # PIX | CREDIT_CARD | BOLETO
                asaas_net = payment_data.get("netValue")        # já descontado das taxas
                installment_count = payment_data.get("installmentCount")  # None se à vista

                if billing_type:
                    payment.payment_method = billing_type
                if asaas_net is not None:
                    payment.net_value = asaas_net
                    payment.fee_amount = round(float(payment.amount) - float(asaas_net), 2)
                else:
                    # Fallback: estimar taxa caso o Asaas não envie netValue
                    from app.utils.asaas_fees import estimate_asaas_fee
                    fee = estimate_asaas_fee(float(payment.amount), billing_type or "", installment_count)
                    payment.fee_amount = fee
                    payment.net_value = round(float(payment.amount) - fee, 2)
                if installment_count:
                    payment.installment_count = installment_count

                await db.commit()

                # Audit log
                await audit_log(
                    action="payment.confirmed",
                    resource_id=str(payment.id),
                    detail=(
                        f"Asaas event={event}, plan={payment.plan}, "
                        f"amount={payment.amount}, net={payment.net_value}, "
                        f"method={payment.payment_method}"
                    ),
                    ip=request.client.host if request.client else None,
                )

                # Generate report + send emails
                await _process_paid_payment(db, payment)

            return {"status": "ok", "action": "payment_confirmed"}

        elif event == "PAYMENT_OVERDUE":
            payment.status = PaymentStatus.FAILED
            await db.commit()
            return {"status": "ok", "action": "payment_overdue"}

        elif event in ("PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS"):
            payment.status = PaymentStatus.REFUNDED
            await db.commit()
            return {"status": "ok", "action": "payment_refunded"}

        elif event in ("PAYMENT_DELETED", "PAYMENT_CHECKOUT_VIEWED"):
            return {"status": "ok", "action": "ignored_event"}

        return {"status": "ok", "event": event}


async def _process_paid_payment(db: AsyncSession, payment: Payment):
    """Generate PDF report, send confirmation emails, and create partner commission after payment."""
    # Get analysis
    analysis_result = await db.execute(
        select(Analysis).where(Analysis.id == payment.analysis_id)
    )
    analysis = analysis_result.scalar_one_or_none()
    if not analysis:
        return

    # Idempotency: skip if report already exists (polling fallback may have run first)
    existing_report = await db.execute(
        select(Report).where(Report.analysis_id == analysis.id)
    )
    if existing_report.scalar_one_or_none():
        return

    # Update analysis plan
    analysis.plan = payment.plan

    # Get user
    user_result = await db.execute(
        select(User).where(User.id == payment.user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        return

    # Generate PDF (CPU-intensive — run in thread to avoid blocking event loop)
    try:
        import asyncio
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

        # Send emails
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

        # ─── Partner commission ───
        from app.models.models import Partner, PartnerClient, Commission, CommissionStatus, ClientDataStatus
        if analysis.partner_id:
            try:
                partner_result = await db.execute(
                    select(Partner).where(Partner.id == analysis.partner_id)
                )
                partner = partner_result.scalar_one_or_none()
                if partner:
                    gross = float(payment.amount)
                    # Usar valor líquido como base da comissão
                    net = float(payment.net_value) if payment.net_value else gross
                    partner_amount = round(net * partner.commission_rate, 2)
                    system_amount = round(net - partner_amount, 2)

                    commission = Commission(
                        partner_id=partner.id,
                        payment_id=payment.id,
                        total_amount=net,      # base = líquido
                        gross_amount=gross,    # bruto para auditoria
                        partner_amount=partner_amount,
                        system_amount=system_amount,
                        status=CommissionStatus.PENDING,
                    )
                    db.add(commission)
                    # total_earnings updated only when commission is actually paid (admin_pay_commission / admin_partner_payout)
                    partner.total_sales = (partner.total_sales or 0) + 1

                    # Update partner client status
                    client_result = await db.execute(
                        select(PartnerClient).where(PartnerClient.analysis_id == analysis.id)
                    )
                    client = client_result.scalar_one_or_none()
                    if client:
                        client.data_status = ClientDataStatus.REPORT_SENT
                        client.plan = payment.plan

                    await db.commit()

                    # PR3: Notify partner by email
                    try:
                        partner_user_result = await db.execute(
                            select(User).where(User.id == partner.user_id)
                        )
                        partner_user = partner_user_result.scalar_one_or_none()
                        if partner_user:
                            from app.services.email_service import send_email, render_template
                            html = f"""
                            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
                                <h2 style="color:#10b981">🎉 Nova comissão!</h2>
                                <p>Olá, {partner_user.full_name}!</p>
                                <p>Um cliente indicado por você realizou um pagamento:</p>
                                <ul>
                                    <li><strong>Empresa:</strong> {analysis.company_name}</li>
                                    <li><strong>Plano:</strong> {payment.plan.value.capitalize()}</li>
                                    <li><strong>Valor bruto:</strong> R$ {gross:.2f}</li>
                                    <li><strong>Taxa Asaas ({payment.payment_method or 'N/A'}):</strong> R$ {float(payment.fee_amount or 0):.2f}</li>
                                    <li><strong>Valor líquido:</strong> R$ {net:.2f}</li>
                                    <li><strong>Sua comissão (50% do líquido):</strong> R$ {partner_amount:.2f}</li>
                                </ul>
                                <p>Acesse seu painel de parceiro para mais detalhes.</p>
                            </div>
                            """
                            await send_email(
                                partner_user.email,
                                f"Nova comissão: R$ {partner_amount:.2f} — Quanto Vale",
                                html,
                            )
                    except Exception as e:
                        print(f"[WEBHOOK] Partner notification email error: {e}")

            except Exception as e:
                print(f"[WEBHOOK] Commission creation error: {e}")

    except Exception as e:
        print(f"[WEBHOOK] Error processing payment: {e}")
