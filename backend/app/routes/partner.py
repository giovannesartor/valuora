"""
Partner Mode routes — Modo Parceiro.
Permite contabilidades e consultorias indicar clientes e receber comissão de 60%.
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
    PaymentStatus, PlanType,
)
from app.schemas.partner import (
    PartnerRegister, PartnerResponse, PartnerClientCreate,
    PartnerClientResponse, CommissionResponse,
    PartnerDashboardResponse, PartnerSummary,
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
        commission_rate=0.60,
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

    # Get commissions
    commissions_result = await db.execute(
        select(Commission)
        .where(Commission.partner_id == partner.id)
        .order_by(Commission.created_at.desc())
    )
    commissions = commissions_result.scalars().all()

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
        commissions=[CommissionResponse.model_validate(c) for c in commissions],
        summary=PartnerSummary(
            total_clients=total_clients,
            total_sales=total_sales,
            total_earnings=total_earnings,
            pending_commissions=pending_commissions,
            conversion_rate=round(conversion_rate, 1),
        ),
    )


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


# ─── Commission History ──────────────────────────────────
@router.get("/commissions", response_model=List[CommissionResponse])
async def list_commissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all commissions for the current partner."""
    result = await db.execute(
        select(Partner).where(Partner.user_id == current_user.id)
    )
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Você não é um parceiro registrado.")

    commissions_result = await db.execute(
        select(Commission)
        .where(Commission.partner_id == partner.id)
        .order_by(Commission.created_at.desc())
    )
    return commissions_result.scalars().all()


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

    rows = []
    for c in commissions:
        partner_result = await db.execute(select(Partner).where(Partner.id == c.partner_id))
        partner = partner_result.scalar_one_or_none()
        user_result = await db.execute(select(User).where(User.id == partner.user_id)) if partner else None
        user = user_result.scalar_one_or_none() if user_result else None

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
