"""
Pitch Deck Routes — CRUD, Pagamento, IA, PDF
"""
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.cache import cache_set, cache_get
from app.models.models import (
    User, PitchDeck, PitchDeckPayment, PitchDeckStatus,
    PaymentStatus, Coupon, Analysis,
)
from app.schemas.pitch_deck import (
    PitchDeckCreate, PitchDeckUpdate, PitchDeckResponse,
    PitchDeckListResponse, PitchDeckPaymentCreate, PitchDeckPaymentResponse,
    PitchDeckAIImproveRequest,
)
from app.schemas.analysis import PITCH_DECK_PRICE
from app.services.auth_service import get_current_user
from app.services.asaas_service import asaas_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pitch-deck", tags=["Pitch Deck"])

PITCH_PROGRESS_TTL = 600  # 10 min


async def _set_pitch_progress(
    deck_id: str, step: int, message: str, pct: int,
    done: bool = False, error: str | None = None
):
    """Store PDF generation progress in Redis for the progress bar."""
    key = f"pitch_progress:{deck_id}"
    await cache_set(key, {"step": step, "message": message, "pct": pct, "done": done, "error": error}, ttl=PITCH_PROGRESS_TTL)


# ─── List user's pitch decks ─────────────────────────────
@router.get("/", response_model=list[PitchDeckListResponse])
async def list_pitch_decks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PitchDeck)
        .where(PitchDeck.user_id == current_user.id)
        .order_by(PitchDeck.created_at.desc())
    )
    decks = result.scalars().all()
    return [
        PitchDeckListResponse(
            id=d.id,
            company_name=d.company_name,
            sector=d.sector,
            status=d.status.value,
            is_paid=d.is_paid,
            analysis_id=d.analysis_id,
            created_at=d.created_at,
        )
        for d in decks
    ]


# ─── Get single pitch deck ──────────────────────────────
@router.get("/{deck_id}", response_model=PitchDeckResponse)
async def get_pitch_deck(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")
    return PitchDeckResponse(
        id=deck.id,
        user_id=deck.user_id,
        analysis_id=deck.analysis_id,
        company_name=deck.company_name,
        sector=deck.sector,
        logo_path=deck.logo_path,
        slogan=deck.slogan,
        contact_email=deck.contact_email,
        contact_phone=deck.contact_phone,
        website=deck.website,
        headline=deck.headline,
        problem=deck.problem,
        solution=deck.solution,
        target_market=deck.target_market,
        competitive_landscape=deck.competitive_landscape,
        business_model=deck.business_model,
        sales_channels=deck.sales_channels,
        marketing_activities=deck.marketing_activities,
        funding_needs=deck.funding_needs,
        financial_projections=deck.financial_projections,
        milestones=deck.milestones,
        team=deck.team,
        partners_resources=deck.partners_resources,
        ai_headline=deck.ai_headline,
        ai_problem=deck.ai_problem,
        ai_solution=deck.ai_solution,
        ai_business_model=deck.ai_business_model,
        ai_sales_channels=deck.ai_sales_channels,
        ai_marketing=deck.ai_marketing,
        ai_funding_use=deck.ai_funding_use,
        pdf_path=deck.pdf_path,
        status=deck.status.value,
        is_paid=deck.is_paid,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
    )


# ─── Create pitch deck ──────────────────────────────────
@router.post("/", response_model=PitchDeckResponse, status_code=201)
async def create_pitch_deck(
    data: PitchDeckCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # If linked to analysis, verify ownership
    if data.analysis_id:
        result = await db.execute(
            select(Analysis).where(
                Analysis.id == data.analysis_id,
                Analysis.user_id == current_user.id,
            )
        )
        analysis = result.scalar_one_or_none()
        if not analysis:
            raise HTTPException(status_code=404, detail="Análise vinculada não encontrada.")

    deck = PitchDeck(
        user_id=current_user.id,
        analysis_id=data.analysis_id,
        company_name=data.company_name,
        sector=data.sector,
        slogan=data.slogan,
        contact_email=data.contact_email or current_user.email,
        contact_phone=data.contact_phone or current_user.phone,
        website=data.website,
        headline=data.headline,
        problem=data.problem,
        solution=data.solution,
        target_market=data.target_market.model_dump() if data.target_market else None,
        competitive_landscape=[c.model_dump() for c in data.competitive_landscape] if data.competitive_landscape else None,
        business_model=data.business_model,
        sales_channels=data.sales_channels,
        marketing_activities=data.marketing_activities,
        funding_needs=data.funding_needs.model_dump() if data.funding_needs else None,
        financial_projections=[fp.model_dump() for fp in data.financial_projections] if data.financial_projections else None,
        milestones=[m.model_dump() for m in data.milestones] if data.milestones else None,
        team=[t.model_dump() for t in data.team] if data.team else None,
        partners_resources=[p.model_dump() for p in data.partners_resources] if data.partners_resources else None,
        status=PitchDeckStatus.DRAFT,
    )
    db.add(deck)
    await db.commit()
    await db.refresh(deck)

    return PitchDeckResponse(
        id=deck.id,
        user_id=deck.user_id,
        analysis_id=deck.analysis_id,
        company_name=deck.company_name,
        sector=deck.sector,
        logo_path=deck.logo_path,
        slogan=deck.slogan,
        contact_email=deck.contact_email,
        contact_phone=deck.contact_phone,
        website=deck.website,
        headline=deck.headline,
        problem=deck.problem,
        solution=deck.solution,
        target_market=deck.target_market,
        competitive_landscape=deck.competitive_landscape,
        business_model=deck.business_model,
        sales_channels=deck.sales_channels,
        marketing_activities=deck.marketing_activities,
        funding_needs=deck.funding_needs,
        financial_projections=deck.financial_projections,
        milestones=deck.milestones,
        team=deck.team,
        partners_resources=deck.partners_resources,
        ai_headline=deck.ai_headline,
        ai_problem=deck.ai_problem,
        ai_solution=deck.ai_solution,
        ai_business_model=deck.ai_business_model,
        ai_sales_channels=deck.ai_sales_channels,
        ai_marketing=deck.ai_marketing,
        ai_funding_use=deck.ai_funding_use,
        pdf_path=deck.pdf_path,
        status=deck.status.value,
        is_paid=deck.is_paid,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
    )


# ─── Update pitch deck ──────────────────────────────────
@router.patch("/{deck_id}", response_model=PitchDeckResponse)
async def update_pitch_deck(
    deck_id: uuid.UUID,
    data: PitchDeckUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")

    update_data = data.model_dump(exclude_unset=True)
    # Serialize Pydantic sub-models to dicts
    for field_name in ("target_market", "funding_needs"):
        if field_name in update_data and update_data[field_name] is not None:
            update_data[field_name] = update_data[field_name] if isinstance(update_data[field_name], dict) else update_data[field_name]
    for field_name in ("competitive_landscape", "financial_projections", "milestones", "team", "partners_resources"):
        if field_name in update_data and update_data[field_name] is not None:
            update_data[field_name] = [
                item if isinstance(item, dict) else item
                for item in update_data[field_name]
            ]

    for key, value in update_data.items():
        setattr(deck, key, value)

    await db.commit()
    await db.refresh(deck)

    return PitchDeckResponse(
        id=deck.id,
        user_id=deck.user_id,
        analysis_id=deck.analysis_id,
        company_name=deck.company_name,
        sector=deck.sector,
        logo_path=deck.logo_path,
        slogan=deck.slogan,
        contact_email=deck.contact_email,
        contact_phone=deck.contact_phone,
        website=deck.website,
        headline=deck.headline,
        problem=deck.problem,
        solution=deck.solution,
        target_market=deck.target_market,
        competitive_landscape=deck.competitive_landscape,
        business_model=deck.business_model,
        sales_channels=deck.sales_channels,
        marketing_activities=deck.marketing_activities,
        funding_needs=deck.funding_needs,
        financial_projections=deck.financial_projections,
        milestones=deck.milestones,
        team=deck.team,
        partners_resources=deck.partners_resources,
        ai_headline=deck.ai_headline,
        ai_problem=deck.ai_problem,
        ai_solution=deck.ai_solution,
        ai_business_model=deck.ai_business_model,
        ai_sales_channels=deck.ai_sales_channels,
        ai_marketing=deck.ai_marketing,
        ai_funding_use=deck.ai_funding_use,
        pdf_path=deck.pdf_path,
        status=deck.status.value,
        is_paid=deck.is_paid,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
    )


# ─── Delete pitch deck ──────────────────────────────────
@router.delete("/{deck_id}")
async def delete_pitch_deck(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")
    await db.delete(deck)
    await db.commit()
    return {"detail": "Pitch Deck excluído."}


# ─── Upload logo for pitch deck ─────────────────────────
@router.post("/{deck_id}/logo")
async def upload_pitch_deck_logo(
    deck_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser uma imagem.")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="Imagem muito grande. Máximo: 5MB.")

    ext = file.filename.split(".")[-1] if file.filename else "png"
    from app.services.storage_service import save_logo
    logo_path = await save_logo(content, deck.id, ext)
    deck.logo_path = logo_path
    await db.commit()

    return {"logo_path": logo_path}


# ─── AI Improve section ─────────────────────────────────
@router.post("/{deck_id}/ai-improve")
async def ai_improve_section(
    deck_id: uuid.UUID,
    data: PitchDeckAIImproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")

    from app.services.pitch_deck_ai_service import improve_pitch_section
    improved = await improve_pitch_section(
        section=data.section,
        current_text=data.current_text or "",
        company_name=data.company_name or deck.company_name,
        sector=data.sector or deck.sector or "",
        context=data.context or "",
    )

    # Store AI result in the corresponding ai_ field
    ai_field = f"ai_{data.section}"
    if hasattr(deck, ai_field):
        setattr(deck, ai_field, improved)
        await db.commit()

    return {"section": data.section, "improved_text": improved}


# ─── Create payment for pitch deck ──────────────────────
@router.post("/payment", response_model=PitchDeckPaymentResponse)
async def create_pitch_deck_payment(
    data: PitchDeckPaymentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify pitch deck
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == data.pitch_deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")

    if deck.is_paid:
        raise HTTPException(status_code=400, detail="Pitch Deck já está pago.")

    # Check existing paid payment
    existing = await db.execute(
        select(PitchDeckPayment).where(
            PitchDeckPayment.pitch_deck_id == data.pitch_deck_id,
            PitchDeckPayment.status == PaymentStatus.PAID,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Pagamento já realizado.")

    # Remove stale pending payments
    stale = await db.execute(
        select(PitchDeckPayment).where(
            PitchDeckPayment.pitch_deck_id == data.pitch_deck_id,
            PitchDeckPayment.status == PaymentStatus.PENDING,
        )
    )
    for old in stale.scalars().all():
        await db.delete(old)
    await db.flush()

    amount = PITCH_DECK_PRICE

    # Coupon discount
    coupon_code_applied = None
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
        from sqlalchemy import update as sa_update
        rows = await db.execute(
            sa_update(Coupon)
            .where(Coupon.id == coupon.id)
            .where((Coupon.max_uses.is_(None)) | (Coupon.used_count < Coupon.max_uses))
            .values(used_count=Coupon.used_count + 1)
        )
        if rows.rowcount == 0:
            raise HTTPException(status_code=400, detail="Cupom já atingiu o limite de usos.")
        discount = min(max(coupon.discount_pct, 0), 1.0)
        amount = round(float(amount) * (1 - discount), 2)
        if amount < 0:
            amount = 0
        coupon_code_applied = coupon.code

    # Admin bypass
    if current_user.is_admin or current_user.is_superadmin:
        payment = PitchDeckPayment(
            user_id=current_user.id,
            pitch_deck_id=data.pitch_deck_id,
            amount=0,
            payment_method="admin_bypass",
            status=PaymentStatus.PAID,
            coupon_code=coupon_code_applied,
            paid_at=datetime.now(timezone.utc),
        )
        db.add(payment)
        deck.is_paid = True
        await db.commit()
        await db.refresh(payment)

        background_tasks.add_task(
            _generate_pitch_deck_pdf_task,
            str(deck.id),
            str(current_user.id),
        )
        return PitchDeckPaymentResponse(
            id=payment.id,
            pitch_deck_id=payment.pitch_deck_id,
            amount=float(payment.amount),
            status=payment.status.value,
            payment_method=payment.payment_method,
            asaas_payment_id=payment.asaas_payment_id,
            asaas_invoice_url=payment.asaas_invoice_url,
            created_at=payment.created_at,
        )

    # Regular user: Asaas payment
    try:
        if not current_user.cpf_cnpj:
            raise HTTPException(status_code=400, detail="CPF ou CNPJ é obrigatório para pagamento.")

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
            description=f"Quanto Vale - Pitch Deck - {deck.company_name}",
            external_reference=f"pitch_{deck.id}",
        )

        invoice_url = asaas_payment.get("invoiceUrl", "")

        payment = PitchDeckPayment(
            user_id=current_user.id,
            pitch_deck_id=data.pitch_deck_id,
            amount=amount,
            payment_method="asaas",
            status=PaymentStatus.PENDING,
            asaas_payment_id=asaas_payment["id"],
            asaas_customer_id=customer["id"],
            asaas_invoice_url=invoice_url,
            coupon_code=coupon_code_applied,
        )
        db.add(payment)
        await db.commit()
        await db.refresh(payment)

        return PitchDeckPaymentResponse(
            id=payment.id,
            pitch_deck_id=payment.pitch_deck_id,
            amount=float(payment.amount),
            status=payment.status.value,
            payment_method=payment.payment_method,
            asaas_payment_id=payment.asaas_payment_id,
            asaas_invoice_url=payment.asaas_invoice_url,
            created_at=payment.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao criar pagamento: {str(e)}")


# ─── Check pitch deck payment status ────────────────────
@router.get("/payment/{payment_id}/status")
async def check_pitch_payment_status(
    payment_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PitchDeckPayment).where(
            PitchDeckPayment.id == payment_id,
            PitchDeckPayment.user_id == current_user.id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")

    if payment.status == PaymentStatus.PENDING and payment.asaas_payment_id:
        try:
            remote = await asaas_service.get_payment(payment.asaas_payment_id)
            remote_status = remote.get("status", "")
            if remote_status in ("CONFIRMED", "RECEIVED"):
                payment.status = PaymentStatus.PAID
                payment.paid_at = datetime.now(timezone.utc)
                # Mark deck as paid
                deck_result = await db.execute(
                    select(PitchDeck).where(PitchDeck.id == payment.pitch_deck_id)
                )
                deck = deck_result.scalar_one_or_none()
                if deck:
                    deck.is_paid = True
                await db.commit()
                background_tasks.add_task(
                    _generate_pitch_deck_pdf_task,
                    str(payment.pitch_deck_id),
                    str(current_user.id),
                )
        except Exception as e:
            logger.warning(f"[PitchDeck] Payment status check failed for {payment.id}: {e!r}")

    return {
        "id": str(payment.id),
        "status": payment.status.value,
        "asaas_invoice_url": payment.asaas_invoice_url,
    }


# ─── Generate PDF (manually trigger) ────────────────────
@router.post("/{deck_id}/generate-pdf")
async def generate_pitch_pdf(
    deck_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")
    if not deck.is_paid:
        raise HTTPException(status_code=402, detail="Pagamento necessário para gerar o PDF.")

    deck.status = PitchDeckStatus.PROCESSING
    await db.commit()

    background_tasks.add_task(
        _generate_pitch_deck_pdf_task,
        str(deck.id),
        str(current_user.id),
    )
    return {"detail": "Geração do PDF iniciada."}


# ─── Get PDF generation progress ────────────────────────
@router.get("/{deck_id}/progress")
async def get_pitch_progress(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns real-time PDF generation progress from Redis cache."""
    row = (await db.execute(
        select(PitchDeck.id).where(
            PitchDeck.id == deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")
    progress = await cache_get(f"pitch_progress:{deck_id}")
    if progress is None:
        return {"step": 0, "message": "Aguardando...", "pct": 0, "done": False, "error": None}
    return progress


# ─── Clone pitch deck ────────────────────────────────────
@router.post("/{deck_id}/clone")
async def clone_pitch_deck(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new draft clone of an existing pitch deck."""
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")

    clone = PitchDeck(
        user_id=current_user.id,
        analysis_id=deck.analysis_id,
        company_name=f"{deck.company_name} (cópia)",
        sector=deck.sector,
        slogan=deck.slogan,
        contact_email=deck.contact_email,
        contact_phone=deck.contact_phone,
        website=deck.website,
        headline=deck.headline,
        problem=deck.problem,
        solution=deck.solution,
        target_market=deck.target_market,
        competitive_landscape=deck.competitive_landscape,
        business_model=deck.business_model,
        sales_channels=deck.sales_channels,
        marketing_activities=deck.marketing_activities,
        funding_needs=deck.funding_needs,
        financial_projections=deck.financial_projections,
        milestones=deck.milestones,
        team=deck.team,
        partners_resources=deck.partners_resources,
        status=PitchDeckStatus.DRAFT,
        is_paid=False,
    )
    db.add(clone)
    await db.commit()
    await db.refresh(clone)
    return {"id": str(clone.id), "company_name": clone.company_name}


# ─── Download PDF ────────────────────────────────────────
@router.get("/{deck_id}/download")
async def download_pitch_deck_pdf(
    deck_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PitchDeck).where(
            PitchDeck.id == deck_id,
            PitchDeck.user_id == current_user.id,
        )
    )
    deck = result.scalar_one_or_none()
    if not deck:
        raise HTTPException(status_code=404, detail="Pitch Deck não encontrado.")
    if not deck.pdf_path:
        raise HTTPException(status_code=404, detail="PDF ainda não foi gerado.")

    import os
    from fastapi.responses import FileResponse
    if not os.path.exists(deck.pdf_path):
        raise HTTPException(status_code=404, detail="Arquivo PDF não encontrado no servidor.")

    return FileResponse(
        path=deck.pdf_path,
        media_type="application/pdf",
        filename=f"PitchDeck_{deck.company_name.replace(' ', '_')}.pdf",
    )


# ─── Background: generate PDF ───────────────────────────
async def _generate_pitch_deck_pdf_task(deck_id: str, user_id: str):
    """Background task to generate pitch deck PDF + AI sections."""
    from app.core.database import async_session_maker
    from app.services.pitch_deck_pdf_service import generate_pitch_deck_pdf
    from app.services.pitch_deck_ai_service import generate_all_ai_sections
    from app.services.email_service import send_report_ready_email

    async with async_session_maker() as db:
        result = await db.execute(
            select(PitchDeck).where(PitchDeck.id == uuid.UUID(deck_id))
        )
        deck = result.scalar_one_or_none()
        if not deck:
            return

        user_result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = user_result.scalar_one_or_none()
        if not user:
            return

        try:
            deck.status = PitchDeckStatus.PROCESSING
            await db.commit()
            await _set_pitch_progress(deck_id, 1, "Gerando conteúdo com IA...", 20)

            # Generate AI sections if they haven't been generated yet
            ai_data = await generate_all_ai_sections(deck)
            for field, value in ai_data.items():
                if value and not getattr(deck, field, None):
                    setattr(deck, field, value)
            await _set_pitch_progress(deck_id, 2, "Montando PDF...", 60)

            # Fetch linked analysis data if available
            analysis_data = None
            if deck.analysis_id:
                analysis_result = await db.execute(
                    select(Analysis).where(Analysis.id == deck.analysis_id)
                )
                analysis = analysis_result.scalar_one_or_none()
                if analysis and analysis.valuation_result:
                    analysis_data = {
                        "valuation_result": analysis.valuation_result,
                        "equity_value": float(analysis.equity_value) if analysis.equity_value else None,
                        "revenue": float(analysis.revenue) if analysis.revenue else None,
                        "net_margin": analysis.net_margin,
                        "growth_rate": analysis.growth_rate,
                        "ebitda": float(analysis.ebitda) if analysis.ebitda else None,
                        "risk_score": analysis.risk_score,
                    }

            # Generate PDF
            pdf_path = await asyncio.to_thread(
                generate_pitch_deck_pdf, deck, analysis_data
            )
            await _set_pitch_progress(deck_id, 3, "Finalizando...", 90)

            deck.pdf_path = pdf_path
            deck.pdf_generated_at = datetime.now(timezone.utc)
            deck.status = PitchDeckStatus.COMPLETED
            await db.commit()
            await _set_pitch_progress(deck_id, 4, "PDF pronto!", 100, done=True)

            # Send email
            download_url = f"{settings.APP_URL}/pitch-deck/{deck.id}"
            await send_report_ready_email(
                user.email,
                user.full_name,
                f"Pitch Deck - {deck.company_name}",
                download_url,
            )

        except Exception as e:
            logger.error(f"[PitchDeck] PDF generation failed for {deck_id}: {e}")
            deck.status = PitchDeckStatus.FAILED
            await db.commit()
            await _set_pitch_progress(deck_id, 0, "Erro ao gerar PDF.", 0, done=True, error=str(e))
