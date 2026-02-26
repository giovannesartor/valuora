"""
Partner Mode routes — Modo Parceiro.
Permite contabilidades e consultorias indicar clientes e receber comissão de 50%.
"""
import uuid
import secrets
import string
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import hash_password, create_email_token
from app.models.models import (
    User, Partner, PartnerClient, Commission, Payment, Analysis,
    PartnerStatus, CommissionStatus, ClientDataStatus,
    PaymentStatus, PlanType, PixKeyType,
)
from app.schemas.partner import (
    PartnerRegister, PartnerResponse, PartnerClientCreate,
    PartnerClientResponse, CommissionResponse,
    PartnerDashboardResponse, PartnerSummary,
    PixKeyUpdate,
)
from app.schemas.auth import MessageResponse
from app.services.auth_service import get_current_user
from app.services.email_service import send_verification_email

router = APIRouter(prefix="/partners", tags=["Parceiros"])


def _generate_referral_code(length: int = 8) -> str:
    """Generate unique referral code like QV-ABCD1234."""
    chars = string.ascii_uppercase + string.digits
    code = ''.join(secrets.choice(chars) for _ in range(length))
    return f"QV-{code}"


# ─── Partner Registration ────────────────────────────────
@router.post("/register", response_model=MessageResponse)
async def register_partner(
    data: PartnerRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Register a new partner account (contabilidade/consultoria)."""
    # Check if user exists
    result = await db.execute(select(User).where(User.email == data.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    # Password validation
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 8 caracteres.")

    # Create user
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        cpf_cnpj=data.cpf_cnpj,
        phone=data.phone,
        company_name=data.company_name,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    # Generate unique referral code
    referral_code = _generate_referral_code()
    while True:
        check = await db.execute(select(Partner).where(Partner.referral_code == referral_code))
        if not check.scalar_one_or_none():
            break
        referral_code = _generate_referral_code()

    referral_link = f"{settings.FRONTEND_URL}/cadastro?ref={referral_code}"

    # Create partner profile
    partner = Partner(
        user_id=user.id,
        company_name=data.company_name,
        phone=data.phone,
        referral_code=referral_code,
        referral_link=referral_link,
        commission_rate=0.50,
        status=PartnerStatus.ACTIVE,
    )
    db.add(partner)

    # Email verification
    token = create_email_token(data.email, purpose="verify")
    from app.models.models import EmailVerification
    from datetime import datetime, timedelta, timezone
    verification = EmailVerification(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(verification)
    await db.commit()

    background_tasks.add_task(send_verification_email, user.email, user.full_name, token)
    return MessageResponse(message=f"Conta de parceiro criada! Seu código de indicação é: {referral_code}. Verifique seu e-mail.")


# ─── Get Partner Profile ─────────────────────────────────
@router.get("/me", response_model=PartnerResponse)
async def get_partner_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's partner profile."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Perfil de parceiro não encontrado.")
    return partner


# ─── Partner Dashboard ───────────────────────────────────
@router.get("/dashboard", response_model=PartnerDashboardResponse)
async def get_partner_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full partner dashboard with clients, commissions, and summary."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Perfil de parceiro não encontrado.")

    # Get clients
    clients_result = await db.execute(
        select(PartnerClient)
        .where(PartnerClient.partner_id == partner.id)
        .order_by(PartnerClient.created_at.desc())
    )
    clients = clients_result.scalars().all()

    # Get commissions with payment info and analysis company_name via JOIN
    commissions_result = await db.execute(
        select(
            Commission,
            Payment.payment_method,
            Payment.fee_amount,
            Payment.installment_count,
            Analysis.company_name,
        )
        .outerjoin(Payment, Commission.payment_id == Payment.id)
        .outerjoin(Analysis, Payment.analysis_id == Analysis.id)
        .where(Commission.partner_id == partner.id)
        .order_by(Commission.created_at.desc())
    )
    commission_rows = commissions_result.all()

    # Build CommissionResponse with enriched payment + company_name fields
    commissions_data = []
    commissions = []  # plain Commission objects for summary calculation
    for row in commission_rows:
        c, payment_method, fee_amount, installment_count, company_name = row
        commissions.append(c)
        resp = CommissionResponse.model_validate(c)
        resp.payment_method = payment_method
        resp.fee_amount = float(fee_amount) if fee_amount is not None else None
        resp.installment_count = installment_count
        resp.company_name = company_name
        commissions_data.append(resp)

    # Calculate summary
    total_clients = len(clients)
    total_sales = partner.total_sales or 0
    total_earnings = float(partner.total_earnings or 0)
    pending_commissions = sum(
        float(c.partner_amount) for c in commissions
        if c.status == CommissionStatus.PENDING
    )
    conversion_rate = (total_sales / total_clients * 100) if total_clients > 0 else 0

    return PartnerDashboardResponse(
        partner=partner,
        clients=[PartnerClientResponse.model_validate(c) for c in clients],
        commissions=commissions_data,
        summary=PartnerSummary(
            total_clients=total_clients,
            total_sales=total_sales,
            total_earnings=total_earnings,
            pending_commissions=pending_commissions,
            conversion_rate=round(conversion_rate, 1),
        ),
    )


# ─── Update PIX Key ──────────────────────────────────────
@router.put("/pix-key", response_model=PartnerResponse)
async def update_pix_key(
    data: PixKeyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update partner's PIX key and optional payout day."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Perfil de parceiro não encontrado.")

    # Validate pix_key_type (normalize to lowercase — DB enum uses lowercase values)
    try:
        partner.pix_key_type = PixKeyType(data.pix_key_type.strip().lower())
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Tipo de chave PIX inválido. Use: cpf, cnpj, email, phone ou random.")

    partner.pix_key = data.pix_key.strip()

    if data.payout_day is not None:
        if data.payout_day < 1 or data.payout_day > 28:
            raise HTTPException(status_code=400, detail="Dia de pagamento deve ser entre 1 e 28.")
        partner.payout_day = data.payout_day

    await db.commit()
    await db.refresh(partner)
    return partner


# ─── Get PIX Key ──────────────────────────────────────────
@router.get("/pix-key")
async def get_pix_key(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get partner's PIX key info."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Perfil de parceiro não encontrado.")

    return {
        "pix_key_type": partner.pix_key_type.value if partner.pix_key_type else None,
        "pix_key": partner.pix_key,
        "payout_day": partner.payout_day or 15,
    }


# ─── Add Client ──────────────────────────────────────────
@router.post("/clients", response_model=PartnerClientResponse)
async def add_client(
    data: PartnerClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a client to the partner's portfolio."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Você não é um parceiro registrado.")

    client = PartnerClient(
        partner_id=partner.id,
        client_name=data.client_name,
        client_company=data.client_company,
        client_email=data.client_email,
        client_phone=data.client_phone,
        data_status=ClientDataStatus.PRE_FILLED,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


# ─── List Clients ────────────────────────────────────────
@router.get("/clients", response_model=List[PartnerClientResponse])
async def list_clients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all clients for the current partner."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Você não é um parceiro registrado.")

    clients_result = await db.execute(
        select(PartnerClient)
        .where(PartnerClient.partner_id == partner.id)
        .order_by(PartnerClient.created_at.desc())
    )
    return clients_result.scalars().all()


# ─── Update Client Status ────────────────────────────────
@router.patch("/clients/{client_id}/status", response_model=PartnerClientResponse)
async def update_client_status(
    client_id: uuid.UUID,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the data status of a partner's client."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Você não é um parceiro registrado.")

    client_result = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = client_result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    try:
        client.data_status = ClientDataStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Status inválido.")

    await db.commit()
    await db.refresh(client)
    return client


# ─── Update Client ────────────────────────────────────────
@router.put("/clients/{client_id}", response_model=PartnerClientResponse)
async def update_partner_client(
    client_id: uuid.UUID,
    data: PartnerClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a partner's client info."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Você não é um parceiro registrado.")

    client_result = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = client_result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    client.client_name = data.client_name
    client.client_email = data.client_email
    client.client_company = data.client_company
    client.client_phone = data.client_phone

    await db.commit()
    await db.refresh(client)
    return client


# ─── Delete Client ────────────────────────────────────────
@router.delete("/clients/{client_id}", response_model=MessageResponse)
async def delete_partner_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a partner's client."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Você não é um parceiro registrado.")

    client_result = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = client_result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    await db.delete(client)
    await db.commit()
    return {"message": "Cliente removido com sucesso."}


# ─── Commission History ──────────────────────────────────
@router.get("/commissions", response_model=None)
async def list_commissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all commissions for the current partner, enriched with payment method/fee info."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Você não é um parceiro registrado.")

    from app.utils.asaas_fees import get_settlement_info
    rows_result = await db.execute(
        select(
            Commission,
            Payment.payment_method,
            Payment.fee_amount,
            Payment.net_value,
            Payment.installment_count,
        )
        .outerjoin(Payment, Commission.payment_id == Payment.id)
        .where(Commission.partner_id == partner.id)
        .order_by(Commission.created_at.desc())
    )
    rows = rows_result.all()

    out = []
    for c, method, fee, net, installments in rows:
        info = get_settlement_info(method)
        out.append({
            "id": str(c.id),
            "partner_id": str(c.partner_id),
            "total_amount": float(c.total_amount),
            "gross_amount": float(c.gross_amount) if c.gross_amount else float(c.total_amount),
            "partner_amount": float(c.partner_amount),
            "system_amount": float(c.system_amount),
            "status": c.status.value,
            "paid_at": c.paid_at.isoformat() if c.paid_at else None,
            "created_at": c.created_at.isoformat(),
            "payment_method": method,
            "fee_amount": float(fee) if fee else None,
            "installment_count": installments,
            "settlement_label": info["settlement"],
            "settlement_days": info["settlement_days"],
        })
    return out


# ─── Referral link resolution ────────────────────────────
@router.get("/referral/{code}")
async def resolve_referral(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Public: Validate a referral code and return partner info."""
    result = await db.execute(
        select(Partner).where(
            Partner.referral_code == code,
            Partner.status == PartnerStatus.ACTIVE,
        )
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=404, detail="Código de indicação inválido ou expirado.")

    # Get partner's user name
    user_result = await db.execute(select(User).where(User.id == partner.user_id))
    user = user_result.scalar_one_or_none()

    return {
        "valid": True,
        "partner_name": user.full_name if user else "Parceiro",
        "partner_company": partner.company_name,
        "referral_code": partner.referral_code,
    }


# ─── Admin: List all partners ────────────────────────────
@router.get("/admin/all", response_model=List[PartnerResponse])
async def admin_list_partners(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: List all partners."""
    if not current_user.is_admin and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")

    result = await db.execute(
        select(Partner).order_by(Partner.created_at.desc())
    )
    return result.scalars().all()


# ─── Admin: Export commissions CSV ────────────────────────
@router.get("/admin/commissions/export")
async def admin_export_commissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Export all commissions as CSV-ready data."""
    if not current_user.is_admin and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")

    result = await db.execute(
        select(Commission).order_by(Commission.created_at.desc())
    )
    commissions = result.scalars().all()

    # Bulk-load partners and users to avoid N+1
    partner_ids = list({c.partner_id for c in commissions})
    partners_res = await db.execute(select(Partner).where(Partner.id.in_(partner_ids)))
    partners_map = {p.id: p for p in partners_res.scalars().all()}
    user_ids = list({p.user_id for p in partners_map.values() if p})
    users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in users_res.scalars().all()}

    rows = []
    for c in commissions:
        partner = partners_map.get(c.partner_id)
        user = users_map.get(partner.user_id) if partner else None

        rows.append({
            "commission_id": str(c.id),
            "partner_name": user.full_name if user else "N/A",
            "partner_email": user.email if user else "N/A",
            "total_amount": float(c.total_amount),
            "partner_amount": float(c.partner_amount),
            "system_amount": float(c.system_amount),
            "status": c.status.value,
            "created_at": c.created_at.isoformat(),
        })

    return {"commissions": rows, "total": len(rows)}


# ─── Admin: Approve pending commissions ──────────────────
@router.patch("/admin/commissions/{commission_id}/approve")
async def admin_approve_commission(
    commission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Approve a pending commission (pending → approved)."""
    if not current_user.is_admin and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")

    result = await db.execute(select(Commission).where(Commission.id == commission_id))
    commission = result.scalar_one_or_none()
    if not commission:
        raise HTTPException(status_code=404, detail="Comissão não encontrada.")
    if commission.status != CommissionStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Comissão já está em status '{commission.status.value}'.")

    commission.status = CommissionStatus.APPROVED
    await db.commit()
    return {"message": "Comissão aprovada.", "status": "approved"}


# ─── Admin: Mark commission as paid ──────────────────────
@router.patch("/admin/commissions/{commission_id}/pay")
async def admin_pay_commission(
    commission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Mark a commission as paid (approved → paid). Record transfer date."""
    if not current_user.is_admin and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")

    result = await db.execute(select(Commission).where(Commission.id == commission_id))
    commission = result.scalar_one_or_none()
    if not commission:
        raise HTTPException(status_code=404, detail="Comissão não encontrada.")
    if commission.status == CommissionStatus.PAID:
        raise HTTPException(status_code=400, detail="Comissão já foi paga.")

    from datetime import datetime, timezone
    commission.status = CommissionStatus.PAID
    commission.paid_at = datetime.now(timezone.utc)

    # Update partner total earnings
    partner_result = await db.execute(select(Partner).where(Partner.id == commission.partner_id))
    partner = partner_result.scalar_one_or_none()
    if partner:
        partner.total_earnings = float(partner.total_earnings or 0) + float(commission.partner_amount)

    await db.commit()
    return {
        "message": f"Comissão paga: R$ {float(commission.partner_amount):.2f}",
        "status": "paid",
        "paid_at": commission.paid_at.isoformat(),
    }


# ─── Admin: Bulk pay all approved commissions for a partner ──
@router.post("/admin/partners/{partner_id}/payout")
async def admin_partner_payout(
    partner_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Pay all approved commissions for a partner in bulk.
    Use after making a PIX transfer to the partner."""
    if not current_user.is_admin and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")

    result = await db.execute(
        select(Commission).where(
            Commission.partner_id == partner_id,
            Commission.status == CommissionStatus.APPROVED,
        )
    )
    commissions = result.scalars().all()
    if not commissions:
        raise HTTPException(status_code=404, detail="Nenhuma comissão aprovada para este parceiro.")

    from datetime import datetime, timezone
    total_paid = 0
    now = datetime.now(timezone.utc)
    for c in commissions:
        c.status = CommissionStatus.PAID
        c.paid_at = now
        total_paid += float(c.partner_amount)

    # Update partner total earnings
    partner_result = await db.execute(select(Partner).where(Partner.id == partner_id))
    partner = partner_result.scalar_one_or_none()
    if partner:
        partner.total_earnings = float(partner.total_earnings or 0) + total_paid

    await db.commit()
    return {
        "message": f"Payout realizado: R$ {total_paid:.2f} ({len(commissions)} comissões)",
        "total_paid": total_paid,
        "commissions_paid": len(commissions),
    }


# ─── Admin: Payout summary per partner ──────────────────
@router.get("/admin/payout-summary")
async def admin_payout_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Get payout summary for all partners (pending, approved, total paid)."""
    if not current_user.is_admin and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")

    partners_result = await db.execute(
        select(Partner).order_by(Partner.created_at.desc())
    )
    partners = partners_result.scalars().all()

    # Bulk-load users and commissions to avoid N+1
    user_ids = list({p.user_id for p in partners})
    users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in users_res.scalars().all()}

    partner_ids = [p.id for p in partners]
    commissions_res = await db.execute(
        select(Commission).where(Commission.partner_id.in_(partner_ids))
    )
    all_commissions = commissions_res.scalars().all()
    commissions_by_partner: dict = {}
    for c in all_commissions:
        commissions_by_partner.setdefault(c.partner_id, []).append(c)

    summary = []
    for partner in partners:
        user = users_map.get(partner.user_id)
        commissions = commissions_by_partner.get(partner.id, [])

        pending = sum(float(c.partner_amount) for c in commissions if c.status == CommissionStatus.PENDING)
        approved = sum(float(c.partner_amount) for c in commissions if c.status == CommissionStatus.APPROVED)
        paid = sum(float(c.partner_amount) for c in commissions if c.status == CommissionStatus.PAID)

        summary.append({
            "partner_id": str(partner.id),
            "partner_name": user.full_name if user else "N/A",
            "partner_email": user.email if user else "N/A",
            "company_name": partner.company_name,
            "referral_code": partner.referral_code,
            "pix_key_type": partner.pix_key_type.value if partner.pix_key_type else None,
            "pix_key": partner.pix_key,
            "payout_day": partner.payout_day or 15,
            "pending": pending,
            "approved_awaiting_payout": approved,
            "total_paid": paid,
            "total_sales": partner.total_sales or 0,
        })

    return {"partners": summary, "total": len(summary)}
