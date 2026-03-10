"""
Partner Mode routes — Modo Parceiro.
Permite contabilidades e consultorias indicar clientes e receber comissão de 50%.
"""
import uuid
import secrets
import string
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import hash_password, create_email_token
from app.models.models import (
    User, Partner, PartnerClient, Commission, Payment, Analysis,
    PartnerStatus, CommissionStatus, ClientDataStatus,
    PaymentStatus, PlanType, PixKeyType, ProductType,
    PitchDeck, PitchDeckPayment, PitchDeckStatus,
)
from app.schemas.partner import (
    PartnerRegister, PartnerResponse, PartnerClientCreate,
    PartnerClientResponse, CommissionResponse,
    PartnerDashboardResponse, PartnerSummary,
    PixKeyUpdate, PaginatedClientsResponse,
)
from app.schemas.auth import MessageResponse
from app.services.auth_service import get_current_user, get_current_admin
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

    # Get commissions with payment info and analysis/pitch company_name via JOIN
    commissions_result = await db.execute(
        select(
            Commission,
            Payment.payment_method,
            Payment.fee_amount,
            Payment.installment_count,
            Analysis.company_name,
            PitchDeck.company_name.label("pitch_company_name"),
        )
        .outerjoin(Payment, Commission.payment_id == Payment.id)
        .outerjoin(Analysis, Payment.analysis_id == Analysis.id)
        .outerjoin(PitchDeckPayment, Commission.pitch_deck_payment_id == PitchDeckPayment.id)
        .outerjoin(PitchDeck, PitchDeckPayment.pitch_deck_id == PitchDeck.id)
        .where(Commission.partner_id == partner.id)
        .order_by(Commission.created_at.desc())
    )
    commission_rows = commissions_result.all()

    # Build CommissionResponse with enriched payment + company_name fields
    commissions_data = []
    commissions = []  # plain Commission objects for summary calculation
    for row in commission_rows:
        c, payment_method, fee_amount, installment_count, company_name, pitch_company_name = row
        commissions.append(c)
        resp = CommissionResponse.model_validate(c)
        resp.payment_method = payment_method
        resp.fee_amount = float(fee_amount) if fee_amount is not None else None
        resp.installment_count = installment_count
        resp.product_type = c.product_type.value if c.product_type else "valuation"
        resp.company_name = pitch_company_name if c.pitch_deck_payment_id else company_name
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
@router.put("/pix-key", response_model=MessageResponse)
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
    return MessageResponse(message="Chave PIX salva com sucesso.")


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
        notes=data.notes,
        data_status=ClientDataStatus.PRE_FILLED,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


# ─── List Clients (paginated) ───────────────────────────
@router.get("/clients", response_model=PaginatedClientsResponse)
async def list_clients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Filter by name, company or email"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List clients for the current partner with pagination and optional search."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Você não é um parceiro registrado.")

    base_query = select(PartnerClient).where(PartnerClient.partner_id == partner.id)
    if search:
        term = f"%{search.lower()}%"
        from sqlalchemy import or_
        base_query = base_query.where(
            or_(
                func.lower(PartnerClient.client_name).like(term),
                func.lower(PartnerClient.client_company).like(term),
                func.lower(PartnerClient.client_email).like(term),
            )
        )

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    clients_result = await db.execute(
        base_query
        .order_by(PartnerClient.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = clients_result.scalars().all()

    # F3: Compute has_pitch_deck for each client via analysis_id
    analysis_ids = [c.analysis_id for c in items if c.analysis_id]
    pitch_deck_set = set()
    if analysis_ids:
        pd_result = await db.execute(
            select(PitchDeck.analysis_id)
            .where(
                PitchDeck.analysis_id.in_(analysis_ids),
                PitchDeck.is_paid == True,  # noqa
                PitchDeck.deleted_at == None,  # noqa
            )
        )
        pitch_deck_set = {row[0] for row in pd_result.all()}

    item_responses = []
    for c in items:
        resp = PartnerClientResponse.model_validate(c)
        resp.has_pitch_deck = c.analysis_id in pitch_deck_set if c.analysis_id else False
        item_responses.append(resp)

    import math
    return PaginatedClientsResponse(
        items=item_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


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
    client.notes = data.notes

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
            Payment.payment_method.label("pay_method"),
            Payment.fee_amount.label("pay_fee"),
            Payment.net_value.label("pay_net"),
            Payment.installment_count.label("pay_installments"),
            Analysis.company_name.label("analysis_company"),
            PitchDeckPayment.payment_method.label("deck_method"),
            PitchDeckPayment.fee_amount.label("deck_fee"),
            PitchDeck.company_name.label("deck_company"),
        )
        .outerjoin(Payment, Commission.payment_id == Payment.id)
        .outerjoin(Analysis, Payment.analysis_id == Analysis.id)
        .outerjoin(PitchDeckPayment, Commission.pitch_deck_payment_id == PitchDeckPayment.id)
        .outerjoin(PitchDeck, PitchDeckPayment.pitch_deck_id == PitchDeck.id)
        .where(Commission.partner_id == partner.id)
        .order_by(Commission.created_at.desc())
    )
    rows = rows_result.all()

    out = []
    for row in rows:
        c = row[0]
        is_deck = bool(c.pitch_deck_payment_id)
        method = row.deck_method if is_deck else row.pay_method
        fee = row.deck_fee if is_deck else row.pay_fee
        installments = row.pay_installments if not is_deck else None
        company_name = row.deck_company if is_deck else row.analysis_company
        product_type = c.product_type.value if c.product_type else ("pitch_deck" if is_deck else "valuation")
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
            "product_type": product_type,
            "company_name": company_name,
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
    _: User = Depends(get_current_admin),
):
    """Admin: List all partners."""
    result = await db.execute(
        select(Partner).order_by(Partner.created_at.desc())
    )
    return result.scalars().all()


# ─── Admin: Export commissions CSV ────────────────────────
@router.get("/admin/commissions/export")
async def admin_export_commissions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Admin: Export all commissions as CSV-ready data."""

    export_result = await db.execute(
        select(
            Commission,
            User.full_name.label("partner_name"),
            User.email.label("partner_email"),
            Analysis.company_name.label("analysis_company"),
            PitchDeck.company_name.label("deck_company"),
        )
        .join(Partner, Commission.partner_id == Partner.id)
        .join(User, Partner.user_id == User.id)
        .outerjoin(Payment, Commission.payment_id == Payment.id)
        .outerjoin(Analysis, Payment.analysis_id == Analysis.id)
        .outerjoin(PitchDeckPayment, Commission.pitch_deck_payment_id == PitchDeckPayment.id)
        .outerjoin(PitchDeck, PitchDeckPayment.pitch_deck_id == PitchDeck.id)
        .order_by(Commission.created_at.desc())
    )
    export_rows = export_result.all()

    rows = []
    for row in export_rows:
        c = row[0]
        is_deck = bool(c.pitch_deck_payment_id)
        company_name = row.deck_company if is_deck else row.analysis_company
        product_type = c.product_type.value if c.product_type else ("pitch_deck" if is_deck else "valuation")
        rows.append({
            "commission_id": str(c.id),
            "partner_name": row.partner_name or "N/A",
            "partner_email": row.partner_email or "N/A",
            "company_name": company_name or "N/A",
            "product_type": product_type,
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
    _: User = Depends(get_current_admin),
):
    """Admin: Approve a pending commission (pending → approved)."""
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
    _: User = Depends(get_current_admin),
):
    """Admin: Mark a commission as paid (approved → paid). Record transfer date."""
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
    _: User = Depends(get_current_admin),
):
    """Admin: Pay all approved commissions for a partner in bulk.
    Use after making a PIX transfer to the partner."""
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
    _: User = Depends(get_current_admin),
):
    """Admin: Get payout summary for all partners (pending, approved, total paid)."""
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


# ─── P1: Partner creates pitch deck for a client ────────
@router.post("/clients/{client_id}/pitch-deck", status_code=201)
async def partner_create_pitch_deck_for_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Partner creates a Pitch Deck linked to a client (uses client's analysis if available)."""
    result = await db.execute(select(Partner).where(Partner.user_id == current_user.id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Parceiro não encontrado.")

    # Verify client belongs to this partner
    client_res = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = client_res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    # Get analysis linked to client (optional)
    analysis_id = client.analysis_id
    company_name = client.company_name or ""
    sector = None

    if analysis_id:
        analysis_res = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
        analysis = analysis_res.scalar_one_or_none()
        if analysis:
            company_name = analysis.company_name or company_name
            sector = analysis.sector

        # Check if pitch deck already exists for this analysis
        existing_res = await db.execute(
            select(PitchDeck).where(
                PitchDeck.analysis_id == analysis_id,
                PitchDeck.deleted_at == None,  # noqa
            )
        )
        existing = existing_res.scalar_one_or_none()
        if existing:
            return {
                "message": "Pitch Deck já existe para esta análise.",
                "pitch_deck_id": str(existing.id),
                "status": existing.status.value,
                "is_paid": existing.is_paid,
            }

    # Get client's user (pitch deck owner)
    client_user_res = await db.execute(select(User).where(User.id == client.user_id))
    client_user = client_user_res.scalar_one_or_none()
    if not client_user:
        raise HTTPException(status_code=404, detail="Usuário do cliente não encontrado.")

    deck = PitchDeck(
        user_id=client.user_id,
        analysis_id=analysis_id,
        partner_id=partner.id,
        company_name=company_name,
        sector=sector,
        status=PitchDeckStatus.DRAFT,
        is_paid=False,
    )
    db.add(deck)
    await db.commit()
    await db.refresh(deck)

    return {
        "message": "Pitch Deck criado com sucesso.",
        "pitch_deck_id": str(deck.id),
        "status": deck.status.value,
        "is_paid": deck.is_paid,
        "company_name": deck.company_name,
    }


# ─── P2: Partner Ranking ─────────────────────────────────
@router.get("/ranking")
async def get_partner_ranking(
    db: AsyncSession = Depends(get_db),
):
    """Public: Top 10 partners by total_sales (names anonymized like 'João S.')."""
    result = await db.execute(
        select(Partner, User.full_name)
        .join(User, Partner.user_id == User.id)
        .where(Partner.status == PartnerStatus.ACTIVE, (Partner.total_sales or 0) > 0)
        .order_by(Partner.total_sales.desc())
        .limit(10)
    )
    rows = result.all()

    ranking = []
    for idx, (p, full_name) in enumerate(rows, 1):
        # Anonymize: "João Santos" → "João S."
        parts = (full_name or "").split()
        anon_name = parts[0] if parts else "Parceiro"
        if len(parts) > 1:
            anon_name = f"{parts[0]} {parts[-1][0]}."
        ranking.append({
            "position": idx,
            "name": anon_name,
            "company": p.company_name or "",
            "total_sales": p.total_sales or 0,
            "total_earnings": float(p.total_earnings or 0),
        })

    return {"ranking": ranking, "total": len(ranking)}


# ─── P3: Partner Certificate PDF ─────────────────────────
@router.get("/certificate")
async def get_partner_certificate(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and return a partner achievement certificate as PDF."""
    from fastapi.responses import Response
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER
    from reportlab.graphics.shapes import Drawing, Rect, String
    from datetime import datetime as dt, timezone as tz

    result = await db.execute(select(Partner).where(Partner.user_id == current_user.id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Parceiro não encontrado.")

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=25*mm, rightMargin=25*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )

    styles = getSampleStyleSheet()
    em_green = HexColor("#10b981")
    dark_bg = HexColor("#111827")
    white = HexColor("#ffffff")
    gray = HexColor("#9ca3af")

    title_style = ParagraphStyle("title", parent=styles["Title"], textColor=em_green, fontSize=28, spaceAfter=6, alignment=TA_CENTER, fontName="Helvetica-Bold")
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], textColor=gray, fontSize=12, spaceAfter=4, alignment=TA_CENTER)
    name_style = ParagraphStyle("name", parent=styles["Normal"], textColor=white, fontSize=22, spaceBefore=10, spaceAfter=10, alignment=TA_CENTER, fontName="Helvetica-Bold")
    body_style = ParagraphStyle("body", parent=styles["Normal"], textColor=white, fontSize=12, spaceAfter=4, alignment=TA_CENTER)
    stats_style = ParagraphStyle("stats", parent=styles["Normal"], textColor=em_green, fontSize=16, spaceBefore=8, spaceAfter=8, alignment=TA_CENTER, fontName="Helvetica-Bold")

    year = dt.now(tz.utc).year
    partner_name = current_user.full_name or "Parceiro"
    total_sales = partner.total_sales or 0
    total_earnings = float(partner.total_earnings or 0)

    story = [
        Spacer(1, 10*mm),
        Paragraph("QuantoVale", title_style),
        Paragraph("Certificado de Parceiro", sub_style),
        Spacer(1, 8*mm),
        Paragraph("Certificamos que", body_style),
        Paragraph(partner_name, name_style),
        Paragraph(f"da empresa <b>{partner.company_name or 'N/A'}</b>", body_style),
        Paragraph("é um parceiro oficial da QuantoVale e contribuiu para", body_style),
        Paragraph("o crescimento de empresas brasileiras por meio de valuações profissionais.", body_style),
        Spacer(1, 8*mm),
        Paragraph(f"Vendas realizadas: {total_sales} | Comissões geradas: R$ {total_earnings:,.2f}", stats_style),
        Spacer(1, 8*mm),
        Paragraph(f"Código de parceiro: <b>{partner.referral_code}</b>", body_style),
        Paragraph(f"Emitido em {dt.now(tz.utc).strftime('%d/%m/%Y')} — {year}", sub_style),
        Spacer(1, 10*mm),
        Paragraph("quantovale.online", sub_style),
    ]

    def _dark_canvas(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(dark_bg)
        canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
        # Gold/green border
        canvas.setStrokeColor(em_green)
        canvas.setLineWidth(3)
        canvas.rect(15*mm, 15*mm, A4[0] - 30*mm, A4[1] - 30*mm, fill=0, stroke=1)
        canvas.restoreState()

    doc.build(story, onFirstPage=_dark_canvas, onLaterPages=_dark_canvas)
    pdf_bytes = buf.getvalue()

    filename = f"certificado-parceiro-{partner.referral_code}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
