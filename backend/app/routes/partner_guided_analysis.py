"""
Análise Guiada — Partner Mode
==============================

Fluxo Opção 1 — "Conta Pré-criada + Definir Senha":

1. Parceiro preenche todos os dados do cliente + valuation completo + plano
   (POST /partners/guided-analyses). Sistema cria:
     - User (conta inativa, sem senha utilizável) ou reutiliza conta existente
     - PartnerClient vinculado ao partner e ao user
     - Analysis (status COMPLETED) já vinculada ao user_id
     - AccountActivationToken (validade 7 dias)
     - AnalysisInvite (status PENDING) para rastreamento de comissões/CRM
2. 1º e-mail ao cliente: "Defina sua senha para acessar seu valuation"
   Link: /ativar-conta/{activation_token}
3. Cliente define senha → conta ativada + verificada → JWT retornado → auto-login
   Backend cria o pagamento Asaas (se user tiver CPF/CNPJ e plano definido)
4. 2º e-mail ao cliente: link de cobrança Asaas (plano escolhido pelo parceiro)
5. Cliente paga → webhook confirma → comissão calculada → relatório gerado

Caso especial: se cliente já possui conta ativa (is_verified=True), o sistema
pula a etapa de ativação e envia diretamente o link de pagamento.

Rotas:
    POST   /partners/guided-analyses           (auth parceiro)
    POST   /partners/guided-analyses/upload    (auth parceiro, via PDF/Excel)
    GET    /partners/guided-analyses           (auth parceiro, listar)
    DELETE /partners/guided-analyses/{id}      (auth parceiro, cancelar)
    GET    /analysis-invites/{token}           (público — preview legado)
    POST   /analysis-invites/{token}/accept    (legado — mantido para compatibilidade)
"""
from __future__ import annotations

import asyncio
import json as _json
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, func as _func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.core.valuation_engine.engine import run_valuation, run_valuation_with_ibge
from app.models.models import (
    AccountActivationToken,
    Analysis, AnalysisInvite, AnalysisInviteStatus, AnalysisStatus, AnalysisVersion,
    ClientDataStatus, Partner, PartnerClient, PlanType, User,
)
from app.schemas.analysis import AnalysisCreate
from app.services.auth_service import get_current_user
from app.services.deepseek_service import (
    extract_financial_data, generate_strategic_analysis, estimate_sector_data_with_ai,
)
from app.services.sector_analysis_service import (
    get_dcf_sector_adjustment, _sector_to_cnae,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Análise Guiada"])

INVITE_DEFAULT_TTL_DAYS = 30


# ─── Schemas ─────────────────────────────────────────────
class GuidedAnalysisCreate(BaseModel):
    client_name: str = Field(..., min_length=2, max_length=255)
    client_email: EmailStr
    client_phone: Optional[str] = None
    client_cpf_cnpj: Optional[str] = None   # CPF ou CNPJ do cliente (necessário para cobrança Asaas)
    client_company: Optional[str] = None
    suggested_plan: Optional[PlanType] = None
    message: Optional[str] = Field(None, max_length=2000)
    analysis: AnalysisCreate


class GuidedAnalysisResponse(BaseModel):
    id: uuid.UUID
    token: str
    public_url: str
    partner_client_id: uuid.UUID
    analysis_id: uuid.UUID
    client_email: str
    client_name: Optional[str]
    suggested_plan: Optional[str]
    status: str
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisInvitePreview(BaseModel):
    token: str
    status: str
    partner_company_name: Optional[str]
    partner_full_name: Optional[str]
    client_email: str
    client_name: Optional[str]
    suggested_plan: Optional[str]
    message: Optional[str]
    expires_at: Optional[datetime]
    company_name: Optional[str]
    sector: Optional[str]


# ─── Helpers ─────────────────────────────────────────────
def _generate_token() -> str:
    return secrets.token_urlsafe(32)


def _public_invite_url(token: str) -> str:
    base = (settings.FRONTEND_URL or "").rstrip("/")
    return f"{base}/analise-guiada/convite/{token}"


def _activation_url(token: str) -> str:
    base = (settings.FRONTEND_URL or "").rstrip("/")
    return f"{base}/ativar-conta/{token}"


ACTIVATION_TTL_DAYS = 7


async def _find_or_pre_create_user(
    db: AsyncSession,
    email: str,
    full_name: str,
    company_name: Optional[str] = None,
    phone: Optional[str] = None,
    cpf_cnpj: Optional[str] = None,
) -> tuple[User, bool]:
    """Encontra usuário existente ou cria conta pré-criada (sem senha utilizável).

    Retorna (user, is_already_verified):
    - is_already_verified=True → cliente já tem conta ativa; pular ativação.
    - is_already_verified=False → conta foi criada ou estava inativa; enviar e-mail de ativação.
    """
    email_norm = email.lower().strip()
    res = await db.execute(select(User).where(User.email == email_norm))
    existing = res.scalar_one_or_none()

    if existing:
        # Enriquece campos opcionais se o parceiro forneceu mais dados
        if phone and not existing.phone:
            existing.phone = phone
        if company_name and not existing.company_name:
            existing.company_name = company_name
        if cpf_cnpj and not existing.cpf_cnpj:
            existing.cpf_cnpj = cpf_cnpj
        await db.flush()
        return existing, existing.is_verified

    # Cria conta inativa com senha inutilizável
    user = User(
        email=email_norm,
        hashed_password=hash_password(secrets.token_hex(32)),
        full_name=full_name,
        company_name=company_name,
        phone=phone,
        cpf_cnpj=cpf_cnpj,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()
    return user, False


async def _create_activation_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    analysis_id: uuid.UUID,
) -> AccountActivationToken:
    """Invalida tokens anteriores para o mesmo usuário e cria um novo."""
    # Invalida tokens pendentes anteriores do mesmo user (best-effort)
    old_tokens_res = await db.execute(
        select(AccountActivationToken).where(
            AccountActivationToken.user_id == user_id,
            AccountActivationToken.is_used == False,  # noqa: E712
        )
    )
    for old_tok in old_tokens_res.scalars().all():
        old_tok.is_used = True

    token = AccountActivationToken(
        user_id=user_id,
        analysis_id=analysis_id,
        token=_generate_token(),
        expires_at=datetime.now(timezone.utc) + timedelta(days=ACTIVATION_TTL_DAYS),
    )
    db.add(token)
    await db.flush()
    return token


async def _get_partner_or_403(db: AsyncSession, current_user: User) -> Partner:
    res = await db.execute(select(Partner).where(Partner.user_id == current_user.id))
    partner = res.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Usuário não é parceiro.")
    return partner


def _to_response(invite: AnalysisInvite) -> GuidedAnalysisResponse:
    return GuidedAnalysisResponse(
        id=invite.id,
        token=invite.token,
        public_url=_public_invite_url(invite.token),
        partner_client_id=invite.partner_client_id,
        analysis_id=invite.analysis_id,
        client_email=invite.client_email,
        client_name=invite.client_name,
        suggested_plan=invite.suggested_plan.value if invite.suggested_plan else None,
        status=invite.status.value if invite.status else None,
        expires_at=invite.expires_at,
        created_at=invite.created_at,
    )


# ─── Partner endpoints ───────────────────────────────────
async def _run_valuation_pipeline(
    *,
    data: AnalysisCreate,
    analysis: Analysis,
    db: AsyncSession,
    extracted: dict | None = None,
    historical_revenues: list | None = None,
    historical_margins: list | None = None,
) -> None:
    """Roda IBGE + valuation engine + (opcional) IA estratégica, mutando o Analysis in-place."""
    ibge_adj = None
    try:
        cnae_code = _sector_to_cnae(data.sector)
        adjustment = await get_dcf_sector_adjustment(
            cnae_code=cnae_code,
            company_revenue=float(data.revenue),
            company_growth=data.growth_rate,
        )
        ibge_adj = adjustment.model_dump()
    except Exception as e:
        logger.warning("[GUIDED] IBGE adjustment failed for %s: %s", data.sector, e)
        try:
            cnae_code = _sector_to_cnae(data.sector)
            ai_sector = await estimate_sector_data_with_ai(data.sector, cnae_code)
            if ai_sector:
                ibge_adj = ai_sector
        except Exception as e2:
            logger.warning("[GUIDED] DeepSeek sector fallback failed: %s", e2)

    engine_kwargs = dict(
        years_in_business=data.years_in_business,
        ebitda=float(data.ebitda) if data.ebitda else None,
        recurring_revenue_pct=data.recurring_revenue_pct,
        num_employees=data.num_employees,
        previous_investment=float(data.previous_investment) if data.previous_investment else 0.0,
        qualitative_answers=data.qualitative_answers,
        dcf_weight=data.dcf_weight,
        custom_exit_multiple=data.custom_exit_multiple,
        company_type=data.company_type,
        revenue_ntm=float(data.revenue_ntm) if data.revenue_ntm else None,
        ebitda_margin=data.ebitda_margin,
        tangible_assets=float(data.tangible_assets) if data.tangible_assets else 0,
        intangible_assets=float(data.intangible_assets) if data.intangible_assets else 0,
        equity_participations=float(data.equity_participations) if data.equity_participations else 0,
        monthly_burn_rate=float(data.monthly_burn_rate) if data.monthly_burn_rate else None,
        pending_assets=[a.model_dump() for a in data.pending_assets] if data.pending_assets else None,
        # Item 7: multi-year historical series
        historical_revenues=historical_revenues if historical_revenues and len(historical_revenues) >= 2 else None,
        historical_margins=historical_margins if historical_margins and len(historical_margins) >= 2 else None,
    )

    try:
        if ibge_adj:
            result = await asyncio.to_thread(
                run_valuation_with_ibge,
                revenue=float(data.revenue),
                net_margin=data.net_margin,
                sector=data.sector,
                ibge_adjustment=ibge_adj,
                growth_rate=data.growth_rate,
                debt=float(data.debt),
                cash=float(data.cash),
                founder_dependency=data.founder_dependency,
                projection_years=data.projection_years,
                **engine_kwargs,
            )
        else:
            result = await asyncio.to_thread(
                run_valuation,
                revenue=float(data.revenue),
                net_margin=data.net_margin,
                sector=data.sector,
                growth_rate=data.growth_rate,
                debt=float(data.debt),
                cash=float(data.cash),
                founder_dependency=data.founder_dependency,
                projection_years=data.projection_years,
                **engine_kwargs,
            )
    except Exception as engine_err:
        from app.core.observability import report_exc
        report_exc(engine_err, "guided.valuation_engine", analysis_id=str(getattr(analysis, 'id', None)))
        analysis.status = AnalysisStatus.FAILED
        await db.commit()
        raise HTTPException(status_code=500, detail="Erro no motor de valuation. Tente novamente.")

    # IA estratégica (best-effort) — só se temos dados extraídos (upload mode)
    if extracted:
        try:
            ai_text = await generate_strategic_analysis(extracted, valuation_result=result)
            analysis.ai_analysis = ai_text
        except Exception as e:
            logger.warning("[GUIDED] Strategic AI failed: %s", e)

    analysis.valuation_result = result
    analysis.equity_value = result["equity_value"]
    analysis.risk_score = result["risk_score"]
    analysis.maturity_index = result["maturity_index"]
    analysis.percentile = result["percentile"]
    analysis.status = AnalysisStatus.COMPLETED

    version = AnalysisVersion(
        analysis_id=analysis.id,
        version_number=1,
        valuation_result=result,
        equity_value=result["equity_value"],
    )
    db.add(version)


@router.post("/partners/guided-analyses", response_model=GuidedAnalysisResponse)
async def create_guided_analysis(
    payload: GuidedAnalysisCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parceiro cria análise guiada: pré-cria conta do cliente e envia e-mail de ativação/cobrança."""
    partner = await _get_partner_or_403(db, current_user)

    # Rate limit: max 100 por 24h
    _day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    invite_count_r = await db.execute(
        select(_func.count(AnalysisInvite.id)).where(
            AnalysisInvite.partner_id == partner.id,
            AnalysisInvite.created_at >= _day_ago,
        )
    )
    if (invite_count_r.scalar() or 0) >= 100:
        raise HTTPException(status_code=429, detail="Limite de 100 convites por dia atingido. Tente novamente amanhã.")

    email_norm = payload.client_email.lower().strip()

    # Idempotência: protege contra duplo-clique / reenvio acidental. Se já existe
    # um convite recente (últimos 2 min) para o mesmo parceiro + cliente + empresa,
    # retorna-o em vez de criar uma segunda análise/cobrança.
    _dedup_since = datetime.now(timezone.utc) - timedelta(seconds=120)
    dup_invite_r = await db.execute(
        select(AnalysisInvite)
        .join(Analysis, AnalysisInvite.analysis_id == Analysis.id)
        .where(
            AnalysisInvite.partner_id == partner.id,
            AnalysisInvite.client_email == email_norm,
            AnalysisInvite.status.in_((AnalysisInviteStatus.PENDING, AnalysisInviteStatus.ACCEPTED)),
            AnalysisInvite.created_at >= _dedup_since,
            Analysis.company_name == payload.analysis.company_name,
        )
        .order_by(AnalysisInvite.created_at.desc())
        .limit(1)
    )
    _existing_invite = dup_invite_r.scalars().first()
    if _existing_invite:
        logger.info(
            "guided_analysis.dedup partner=%s email=%s invite=%s (double-submit ignorado)",
            partner.id, email_norm, _existing_invite.id,
        )
        return _to_response(_existing_invite)

    # 1. Encontra ou pré-cria conta do cliente
    client_user, is_already_verified = await _find_or_pre_create_user(
        db,
        email=email_norm,
        full_name=payload.client_name,
        company_name=payload.client_company,
        phone=payload.client_phone,
        cpf_cnpj=payload.client_cpf_cnpj,
    )

    # CPF/CNPJ é obrigatório para gerar a cobrança Asaas
    from app.core.validators import is_valid_cpf_or_cnpj
    _cpf_digits = ''.join(c for c in (client_user.cpf_cnpj or "") if c.isdigit())
    if not is_valid_cpf_or_cnpj(_cpf_digits):
        raise HTTPException(
            status_code=400,
            detail="CPF ou CNPJ do cliente é obrigatório e deve ser válido para gerar a cobrança.",
        )

    # 2. Reusa PartnerClient por email ou cria
    res = await db.execute(
        select(PartnerClient).where(
            PartnerClient.partner_id == partner.id,
            PartnerClient.client_email == email_norm,
        )
    )
    partner_client = res.scalar_one_or_none()
    if partner_client is None:
        partner_client = PartnerClient(
            partner_id=partner.id,
            user_id=client_user.id,
            client_name=payload.client_name,
            client_company=payload.client_company,
            client_email=email_norm,
            client_phone=payload.client_phone,
            data_status=ClientDataStatus.PRE_FILLED,
            plan=payload.suggested_plan,
        )
        db.add(partner_client)
        await db.flush()
    elif partner_client.user_id is None:
        partner_client.user_id = client_user.id

    # 3. Cria Analysis já vinculada ao cliente e roda o motor
    analysis_dict = payload.analysis.model_dump(exclude_unset=False)
    pa = analysis_dict.get("pending_assets")
    if pa:
        analysis_dict["pending_assets"] = [
            p.model_dump() if hasattr(p, "model_dump") else dict(p) for p in pa
        ]
    analysis = Analysis(
        user_id=client_user.id,
        partner_id=partner.id,
        status=AnalysisStatus.PROCESSING,
        plan=payload.suggested_plan,
        **analysis_dict,
    )
    db.add(analysis)
    await db.flush()

    await _run_valuation_pipeline(data=payload.analysis, analysis=analysis, db=db)

    # Sempre aponta o PartnerClient para a análise mais recente (evita CRM/comissão órfãos)
    partner_client.analysis_id = analysis.id

    # 4. AnalysisInvite para rastreamento de comissões e CRM
    invite_token = _generate_token()
    invite = AnalysisInvite(
        token=invite_token,
        partner_id=partner.id,
        partner_client_id=partner_client.id,
        analysis_id=analysis.id,
        suggested_plan=payload.suggested_plan,
        status=AnalysisInviteStatus.PENDING,
        client_email=email_norm,
        client_name=payload.client_name,
        message=payload.message,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_DEFAULT_TTL_DAYS),
    )
    db.add(invite)

    partner_company = partner.company_name or current_user.full_name

    if is_already_verified:
        # Cliente já tem conta ativa → aceita invite imediatamente → dispara cobrança
        invite.status = AnalysisInviteStatus.ACCEPTED
        invite.accepted_at = datetime.now(timezone.utc)
        partner_client.data_status = ClientDataStatus.COMPLETED
        await db.commit()
        await db.refresh(invite)

        background_tasks.add_task(
            _async_send_payment_email,
            analysis_id=str(analysis.id),
            user_id=str(client_user.id),
            to_email=email_norm,
            client_name=payload.client_name,
            partner_company=partner_company,
            message=payload.message,
        )
    else:
        # Conta nova ou inativa → cria token de ativação → envia e-mail
        activation = await _create_activation_token(db, client_user.id, analysis.id)
        await db.commit()
        await db.refresh(invite)

        act_url = _activation_url(activation.token)
        background_tasks.add_task(
            _async_send_activation_email,
            to_email=email_norm,
            client_name=payload.client_name,
            partner_company=partner_company,
            url=act_url,
            message=payload.message,
            plan=payload.suggested_plan.value if payload.suggested_plan else None,
            company_name=payload.analysis.company_name,
            client_phone=payload.client_phone or client_user.phone,
            user_id=str(client_user.id),
        )

    # Notifica o parceiro (WhatsApp) sobre o novo cliente no fluxo guiado
    _partner_phone = partner.phone or current_user.phone
    if _partner_phone:
        background_tasks.add_task(
            _async_send_partner_new_client_whatsapp,
            phone=_partner_phone,
            partner_name=current_user.full_name,
            company_name=payload.analysis.company_name,
            user_id=str(current_user.id),
        )

    logger.info(
        "guided_analysis.created partner=%s client_user=%s invite=%s verified=%s",
        partner.id, client_user.id, invite.id, is_already_verified,
    )
    return _to_response(invite)


@router.post("/partners/guided-analyses/upload", response_model=GuidedAnalysisResponse)
async def create_guided_analysis_from_upload(
    background_tasks: BackgroundTasks,
    client_name: str = Form(...),
    client_email: str = Form(...),
    client_phone: Optional[str] = Form(None),
    client_cpf_cnpj: Optional[str] = Form(None),
    client_company: Optional[str] = Form(None),
    suggested_plan: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    company_name: str = Form(...),
    sector: str = Form(...),
    cnpj: Optional[str] = Form(None),
    founder_dependency: float = Form(0.0),
    projection_years: int = Form(5),
    qualitative_answers: Optional[str] = Form(None),
    file_labels: Optional[str] = Form(None),
    pending_assets: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parceiro cria análise guiada via upload de DRE/Balanço (mesma pipeline do /analyses/upload)."""
    partner = await _get_partner_or_403(db, current_user)

    if not files:
        raise HTTPException(status_code=400, detail="Envie pelo menos um arquivo.")
    if len(files) > 15:
        raise HTTPException(status_code=400, detail="Máximo de 15 arquivos.")

    founder_dep = min(max(founder_dependency / 100, 0), 1) if founder_dependency > 1 else founder_dependency

    qual_answers = None
    if qualitative_answers:
        try:
            qual_answers = _json.loads(qualitative_answers)
        except Exception:
            qual_answers = None

    pending_assets_list = None
    if pending_assets:
        try:
            pending_assets_list = _json.loads(pending_assets)
        except Exception:
            pending_assets_list = None

    plan_enum = None
    if suggested_plan:
        try:
            plan_enum = PlanType(suggested_plan.lower())
        except (ValueError, AttributeError):
            plan_enum = None

    MAX_FILE_SIZE = 15 * 1024 * 1024
    file_contents = []
    for f in files:
        ext = (f.filename or "").split(".")[-1].lower()
        if ext not in ("pdf", "xlsx", "xls"):
            raise HTTPException(status_code=400, detail=f"Formato não suportado: {f.filename}. Envie PDF ou Excel.")
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"Arquivo {f.filename!r} excede 15 MB.")
        file_contents.append((f.filename, content, ext))

    async def _extract_one(filename: str, content: bytes, ext: str):
        try:
            return await extract_financial_data(content, ext)
        except Exception as e:
            logger.warning("[GUIDED-UPLOAD] Extraction failed for %s: %s", filename, e)
            return {"error": str(e)}

    extraction_results = await asyncio.gather(
        *[_extract_one(name, content, ext) for name, content, ext in file_contents]
    )

    all_extracted: dict = {}
    uploaded_filenames: list[str] = []
    # Item 7: per-year historical data collection
    _pga_year_data: dict = {}
    for (filename, _, _), result_data in zip(file_contents, extraction_results):
        if "error" not in result_data:
            for k, v in result_data.items():
                if v is not None and v != "" and (k not in all_extracted or all_extracted[k] in (None, "")):
                    all_extracted[k] = v
            _fy = result_data.get("fiscal_year") or result_data.get("year")
            if _fy:
                try:
                    _fy = int(_fy)
                except (TypeError, ValueError):
                    _fy = None
            if _fy:
                _pga_year_data[_fy] = {
                    "revenue": result_data.get("revenue"),
                    "net_margin": result_data.get("net_margin"),
                }
        uploaded_filenames.append(filename)

    # Item 7: historical arrays
    _pga_hist_rev: list = []
    _pga_hist_mar: list = []
    if len(_pga_year_data) >= 2:
        for _yr in sorted(_pga_year_data.keys()):
            _yd = _pga_year_data[_yr]
            if _yd.get("revenue") and float(_yd["revenue"]) > 0:
                _pga_hist_rev.append(float(_yd["revenue"]))
                _pga_hist_mar.append(float(_yd.get("net_margin") or 0.10))

    if not all_extracted:
        raise HTTPException(status_code=422, detail="Não foi possível extrair dados dos documentos enviados.")

    revenue = all_extracted.get("revenue") or 0
    net_margin = all_extracted.get("net_margin") or 0.10
    growth_rate = all_extracted.get("growth_rate") or 0.10
    debt = all_extracted.get("total_liabilities") or 0
    cash = all_extracted.get("cash") or 0

    if revenue <= 0:
        raise HTTPException(status_code=422, detail="Não foi possível extrair receita válida.")
    if not (0 <= net_margin < 1):
        net_margin = net_margin / 100 if 1 <= net_margin <= 100 else 0.10
    if not (-0.5 < growth_rate < 5):
        growth_rate = growth_rate / 100 if 1 <= growth_rate <= 100 else 0.10
    debt = max(0, debt)
    cash = max(0, cash)

    # Reusa ou cria conta pré-criada do cliente
    email_norm = client_email.lower().strip()

    # Idempotência: ignora duplo-clique / reenvio (últimos 2 min, mesmo cliente + empresa)
    _dedup_since = datetime.now(timezone.utc) - timedelta(seconds=120)
    dup_invite_r = await db.execute(
        select(AnalysisInvite)
        .join(Analysis, AnalysisInvite.analysis_id == Analysis.id)
        .where(
            AnalysisInvite.partner_id == partner.id,
            AnalysisInvite.client_email == email_norm,
            AnalysisInvite.status.in_((AnalysisInviteStatus.PENDING, AnalysisInviteStatus.ACCEPTED)),
            AnalysisInvite.created_at >= _dedup_since,
            Analysis.company_name == company_name,
        )
        .order_by(AnalysisInvite.created_at.desc())
        .limit(1)
    )
    _existing_invite = dup_invite_r.scalars().first()
    if _existing_invite:
        logger.info(
            "guided_analysis.upload.dedup partner=%s email=%s invite=%s (double-submit ignorado)",
            partner.id, email_norm, _existing_invite.id,
        )
        return _to_response(_existing_invite)

    client_user, is_already_verified = await _find_or_pre_create_user(
        db,
        email=email_norm,
        full_name=client_name,
        company_name=client_company,
        phone=client_phone,
        cpf_cnpj=client_cpf_cnpj,
    )

    # CPF/CNPJ é obrigatório para gerar a cobrança Asaas
    from app.core.validators import is_valid_cpf_or_cnpj as _is_valid_doc
    _cpf_digits = ''.join(c for c in (client_user.cpf_cnpj or "") if c.isdigit())
    if not _is_valid_doc(_cpf_digits):
        raise HTTPException(
            status_code=400,
            detail="CPF ou CNPJ do cliente é obrigatório e deve ser válido para gerar a cobrança.",
        )

    # Reusa ou cria PartnerClient
    res = await db.execute(
        select(PartnerClient).where(
            PartnerClient.partner_id == partner.id,
            PartnerClient.client_email == email_norm,
        )
    )
    partner_client = res.scalar_one_or_none()
    if partner_client is None:
        partner_client = PartnerClient(
            partner_id=partner.id,
            user_id=client_user.id,
            client_name=client_name,
            client_company=client_company,
            client_email=email_norm,
            client_phone=client_phone,
            data_status=ClientDataStatus.PRE_FILLED,
            plan=plan_enum,
        )
        db.add(partner_client)
        await db.flush()
    elif partner_client.user_id is None:
        partner_client.user_id = client_user.id

    # Constrói AnalysisCreate pra reusar o pipeline
    data = AnalysisCreate(
        company_name=company_name,
        sector=sector,
        cnpj=cnpj or None,
        revenue=revenue,
        net_margin=net_margin,
        growth_rate=growth_rate,
        debt=debt,
        cash=cash,
        founder_dependency=founder_dep,
        projection_years=projection_years,
        qualitative_answers=qual_answers,
        ebitda=all_extracted.get("ebitda"),
        num_employees=all_extracted.get("num_employees") or 0,
        years_in_business=all_extracted.get("years_in_business") or 3,
        recurring_revenue_pct=all_extracted.get("recurring_revenue_pct") or 0.0,
        previous_investment=all_extracted.get("previous_investment") or 0.0,
    )

    analysis = Analysis(
        user_id=client_user.id,
        partner_id=partner.id,
        sector=sector,
        cnpj=cnpj or None,
        revenue=revenue,
        net_margin=net_margin,
        growth_rate=growth_rate,
        debt=debt,
        cash=cash,
        founder_dependency=founder_dep,
        projection_years=projection_years,
        qualitative_answers=qual_answers,
        pending_assets=pending_assets_list or None,
        extracted_data=all_extracted,
        uploaded_files=uploaded_filenames,
        plan=plan_enum,
        status=AnalysisStatus.PROCESSING,
    )
    db.add(analysis)
    await db.flush()

    await _run_valuation_pipeline(
        data=data, analysis=analysis, db=db, extracted=all_extracted,
        historical_revenues=_pga_hist_rev if len(_pga_hist_rev) >= 2 else None,
        historical_margins=_pga_hist_mar if len(_pga_hist_mar) >= 2 else None,
    )

    # Sempre aponta o PartnerClient para a análise mais recente
    partner_client.analysis_id = analysis.id

    invite_token = _generate_token()
    invite = AnalysisInvite(
        token=invite_token,
        partner_id=partner.id,
        partner_client_id=partner_client.id,
        analysis_id=analysis.id,
        suggested_plan=plan_enum,
        status=AnalysisInviteStatus.PENDING,
        client_email=email_norm,
        client_name=client_name,
        message=message,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_DEFAULT_TTL_DAYS),
    )
    db.add(invite)

    partner_company = partner.company_name or current_user.full_name

    if is_already_verified:
        invite.status = AnalysisInviteStatus.ACCEPTED
        invite.accepted_at = datetime.now(timezone.utc)
        partner_client.data_status = ClientDataStatus.COMPLETED
        await db.commit()
        await db.refresh(invite)

        background_tasks.add_task(
            _async_send_payment_email,
            analysis_id=str(analysis.id),
            user_id=str(client_user.id),
            to_email=email_norm,
            client_name=client_name,
            partner_company=partner_company,
            message=message,
        )
    else:
        activation = await _create_activation_token(db, client_user.id, analysis.id)
        await db.commit()
        await db.refresh(invite)

        act_url = _activation_url(activation.token)
        background_tasks.add_task(
            _async_send_activation_email,
            to_email=email_norm,
            client_name=client_name,
            partner_company=partner_company,
            url=act_url,
            message=message,
            plan=plan_enum.value if plan_enum else None,
            company_name=company_name,
            client_phone=client_phone or client_user.phone,
            user_id=str(client_user.id),
        )

    # Notifica o parceiro (WhatsApp) sobre o novo cliente no fluxo guiado
    _partner_phone = partner.phone or current_user.phone
    if _partner_phone:
        background_tasks.add_task(
            _async_send_partner_new_client_whatsapp,
            phone=_partner_phone,
            partner_name=current_user.full_name,
            company_name=company_name,
            user_id=str(current_user.id),
        )

    logger.info(
        "guided_analysis.upload.created partner=%s client_user=%s invite=%s verified=%s",
        partner.id, client_user.id, invite.id, is_already_verified,
    )
    return _to_response(invite)


@router.get("/partners/guided-analyses", response_model=List[GuidedAnalysisResponse])
async def list_guided_analyses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner_or_403(db, current_user)
    res = await db.execute(
        select(AnalysisInvite)
        .where(AnalysisInvite.partner_id == partner.id)
        .order_by(AnalysisInvite.created_at.desc())
    )
    invites = res.scalars().all()
    return [_to_response(inv) for inv in invites]


@router.delete("/partners/guided-analyses/{invite_id}")
async def cancel_guided_analysis(
    invite_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner_or_403(db, current_user)
    res = await db.execute(
        select(AnalysisInvite).where(
            AnalysisInvite.id == invite_id,
            AnalysisInvite.partner_id == partner.id,
        )
    )
    invite = res.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")
    if invite.status in (AnalysisInviteStatus.ACCEPTED, AnalysisInviteStatus.COMPLETED):
        raise HTTPException(status_code=400, detail="Convite já aceito não pode ser cancelado.")
    invite.status = AnalysisInviteStatus.CANCELLED
    await db.commit()
    return {"ok": True}


# ─── Public / client endpoints ───────────────────────────
@router.get("/analysis-invites/{token}", response_model=AnalysisInvitePreview)
async def preview_invite(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Endpoint público: cliente abre o link para visualizar o convite."""
    # Rate limit por IP — 30 req/min para proteger contra enumeração de tokens
    from app.main import _check_rate_limit
    client_ip = (request.client.host if request.client else "unknown")
    if not await _check_rate_limit(f"guided-preview:{client_ip}", max_requests=30):
        raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente em 1 minuto.")

    res = await db.execute(select(AnalysisInvite).where(AnalysisInvite.token == token))
    invite = res.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")

    # Expiração
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        if invite.status == AnalysisInviteStatus.PENDING:
            invite.status = AnalysisInviteStatus.EXPIRED
            await db.commit()
        raise HTTPException(status_code=410, detail="Convite expirado.")

    if invite.status == AnalysisInviteStatus.CANCELLED:
        raise HTTPException(status_code=410, detail="Convite cancelado pelo parceiro.")

    # Marca OPENED na primeira visita
    if invite.status == AnalysisInviteStatus.PENDING:
        invite.status = AnalysisInviteStatus.OPENED
        invite.opened_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(invite)

    # Carrega dados auxiliares
    partner_res = await db.execute(select(Partner).where(Partner.id == invite.partner_id))
    partner = partner_res.scalar_one_or_none()
    partner_user_name = None
    if partner:
        u_res = await db.execute(select(User).where(User.id == partner.user_id))
        u = u_res.scalar_one_or_none()
        partner_user_name = u.full_name if u else None

    analysis_company = None
    analysis_sector = None
    if invite.analysis_id:
        a_res = await db.execute(select(Analysis).where(Analysis.id == invite.analysis_id))
        a = a_res.scalar_one_or_none()
        if a:
            analysis_company = a.company_name
            analysis_sector = a.sector

    return AnalysisInvitePreview(
        token=invite.token,
        status=invite.status.value,
        partner_company_name=partner.company_name if partner else None,
        partner_full_name=partner_user_name,
        client_email=invite.client_email,
        client_name=invite.client_name,
        suggested_plan=invite.suggested_plan.value if invite.suggested_plan else None,
        message=invite.message,
        expires_at=invite.expires_at,
        company_name=analysis_company,
        sector=analysis_sector,
    )


@router.post("/analysis-invites/{token}/accept", response_model=GuidedAnalysisResponse)
async def accept_invite(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cliente (logado/cadastrado) aceita o convite — vincula Analysis ao user_id."""
    res = await db.execute(select(AnalysisInvite).where(AnalysisInvite.token == token))
    invite = res.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")

    if invite.status == AnalysisInviteStatus.CANCELLED:
        raise HTTPException(status_code=410, detail="Convite cancelado.")
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Convite expirado.")
    if invite.status == AnalysisInviteStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Convite já concluído.")

    # Validação de e-mail: o usuário logado deve ser dono do email do convite
    if (current_user.email or "").lower().strip() != invite.client_email.lower().strip():
        raise HTTPException(
            status_code=403,
            detail="Faça login com o e-mail para o qual o convite foi enviado.",
        )

    # Vincula Analysis
    if invite.analysis_id:
        a_res = await db.execute(select(Analysis).where(Analysis.id == invite.analysis_id))
        analysis = a_res.scalar_one_or_none()
        if analysis and analysis.user_id is None:
            analysis.user_id = current_user.id

    # Vincula PartnerClient ao user também
    pc_res = await db.execute(
        select(PartnerClient).where(PartnerClient.id == invite.partner_client_id)
    )
    partner_client = pc_res.scalar_one_or_none()
    if partner_client and partner_client.user_id is None:
        partner_client.user_id = current_user.id
        partner_client.data_status = ClientDataStatus.COMPLETED

    invite.status = AnalysisInviteStatus.ACCEPTED
    invite.accepted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(invite)

    return _to_response(invite)


# ─── Email helpers ───────────────────────────────────────
async def _async_send_activation_email(
    to_email: str,
    client_name: str,
    partner_company: Optional[str],
    url: str,
    message: Optional[str],
    plan: Optional[str],
    company_name: Optional[str],
    client_phone: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    """Envia e-mail + WhatsApp de ativação de conta para o cliente. Falhas são apenas logadas."""
    try:
        from app.services.email_service import send_account_activation_email
        await send_account_activation_email(
            email=to_email,
            client_name=client_name,
            partner_company=partner_company or "Valuora",
            activation_url=url,
            company_name=company_name,
            plan=plan,
            message=message,
        )
    except Exception as exc:
        logger.warning("guided_analysis.activation_email_failed to=%s err=%s", to_email, exc)

    # WhatsApp (best-effort): mesmo aviso de ativação
    if client_phone:
        try:
            from app.services.whatsapp_service import send_account_activation
            await send_account_activation(
                phone=client_phone,
                user_name=client_name,
                company_name=company_name or "",
                activation_url=url,
                partner_company=partner_company or "",
                user_id=user_id,
            )
        except Exception as exc:
            logger.warning("guided_analysis.activation_whatsapp_failed to=%s err=%s", client_phone, exc)


async def _async_send_partner_new_client_whatsapp(
    phone: str,
    partner_name: Optional[str],
    company_name: Optional[str],
    user_id: Optional[str] = None,
) -> None:
    """Notifica o parceiro por WhatsApp que um novo cliente entrou no fluxo guiado."""
    try:
        from app.services.whatsapp_service import send_partner_new_client
        await send_partner_new_client(
            phone=phone,
            partner_name=partner_name,
            company_name=company_name or "",
            user_id=user_id,
        )
    except Exception as exc:
        logger.warning("guided_analysis.partner_new_client_whatsapp_failed phone=%s err=%s", phone, exc)


async def _async_send_payment_email(
    analysis_id: str,
    user_id: str,
    to_email: str,
    client_name: str,
    partner_company: Optional[str],
    message: Optional[str],
) -> None:
    """Cria pagamento Asaas e envia e-mail com link de cobrança (best-effort).

    Wrapper que captura qualquer exceção para não vazar no background task
    (SMTP/DB/Asaas). Falhas são apenas logadas.
    """
    try:
        await _async_send_payment_email_impl(
            analysis_id=analysis_id,
            user_id=user_id,
            to_email=to_email,
            client_name=client_name,
            partner_company=partner_company,
            message=message,
        )
    except Exception as exc:
        logger.warning("guided_analysis.payment_email_failed to=%s err=%s", to_email, exc)


async def _async_send_payment_email_impl(
    analysis_id: str,
    user_id: str,
    to_email: str,
    client_name: str,
    partner_company: Optional[str],
    message: Optional[str],
) -> None:
    """Cria pagamento Asaas e envia e-mail com link de cobrança (best-effort)."""
    from app.core.database import async_session_maker
    from app.services.email_service import send_payment_link_email
    from app.services.asaas_service import asaas_service
    from app.schemas.analysis import PLAN_PRICES
    from app.core.validators import is_valid_cpf_or_cnpj

    async with async_session_maker() as db:
        a_res = await db.execute(select(Analysis).where(Analysis.id == uuid.UUID(analysis_id)))
        analysis = a_res.scalar_one_or_none()
        u_res = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = u_res.scalar_one_or_none()

        if not analysis or not user:
            logger.warning("_async_send_payment_email: analysis or user not found")
            return

        # Guard: não criar pagamento duplicado
        from app.models.models import Payment as _Payment, PaymentStatus as _PS
        dup_res = await db.execute(
            select(_Payment).where(
                _Payment.analysis_id == uuid.UUID(analysis_id),
                _Payment.status.in_([_PS.PENDING, _PS.PAID]),
            )
        )
        existing_payment = dup_res.scalar_one_or_none()
        if existing_payment:
            logger.info("_async_send_payment_email: payment already exists for analysis %s, skipping Asaas", analysis_id)
            frontend_url = (settings.FRONTEND_URL or "").rstrip("/")
            fallback_url = f"{frontend_url}/analise/{analysis_id}"
            invoice_url = existing_payment.asaas_invoice_url or fallback_url
            await send_payment_link_email(
                email=to_email,
                client_name=client_name,
                partner_company=partner_company or "Valuora",
                company_name=analysis.company_name,
                plan=analysis.plan.value if analysis.plan else None,
                invoice_url=invoice_url,
                analysis_url=fallback_url,
                message=message,
            )
            await _send_charge_whatsapp(
                phone=user.phone,
                user_name=user.full_name,
                company_name=analysis.company_name,
                invoice_url=invoice_url,
                plan=analysis.plan.value if analysis.plan else "",
                user_id=str(user.id),
            )
            return

        invoice_url: Optional[str] = None

        if analysis.plan and user.cpf_cnpj:
            cpf_cnpj_clean = ''.join(c for c in user.cpf_cnpj if c.isdigit())
            if is_valid_cpf_or_cnpj(cpf_cnpj_clean):
                try:
                    amount = float(PLAN_PRICES[analysis.plan])
                    customer = await asaas_service.find_or_create_customer(
                        name=user.full_name,
                        email=user.email,
                        cpf_cnpj=cpf_cnpj_clean,
                        phone=user.phone,
                    )
                    asaas_payment = await asaas_service.create_payment(
                        customer_id=customer["id"],
                        value=amount,
                        description=f"Valuora - Plan {analysis.plan.value.capitalize()} - {analysis.company_name}",
                        external_reference=str(analysis.id),
                    )
                    invoice_url = asaas_payment.get("invoiceUrl")

                    payment = _Payment(
                        user_id=user.id,
                        analysis_id=analysis.id,
                        plan=analysis.plan,
                        amount=amount,
                        payment_method="asaas",
                        status=_PS.PENDING,
                        asaas_payment_id=asaas_payment["id"],
                        asaas_customer_id=customer["id"],
                        asaas_invoice_url=invoice_url,
                    )
                    db.add(payment)
                    await db.commit()
                except Exception as e:
                    from app.core.observability import report_exc
                    report_exc(e, "guided.asaas_charge", analysis_id=analysis_id)
        else:
            logger.error(
                "_async_send_payment_email: cannot create Asaas charge for analysis %s — plan=%s cpf_cnpj_present=%s",
                analysis_id, analysis.plan, bool(user.cpf_cnpj),
            )

        frontend_url = (settings.FRONTEND_URL or "").rstrip("/")
        fallback_url = f"{frontend_url}/analise/{analysis_id}"
        final_url = invoice_url or fallback_url

        await send_payment_link_email(
            email=to_email,
            client_name=client_name,
            partner_company=partner_company or "Valuora",
            company_name=analysis.company_name,
            plan=analysis.plan.value if analysis.plan else None,
            invoice_url=final_url,
            analysis_url=fallback_url,
            message=message,
        )
        await _send_charge_whatsapp(
            phone=user.phone,
            user_name=user.full_name,
            company_name=analysis.company_name,
            invoice_url=final_url,
            plan=analysis.plan.value if analysis.plan else "",
            user_id=str(user.id),
        )


async def _send_charge_whatsapp(
    phone: Optional[str],
    user_name: Optional[str],
    company_name: Optional[str],
    invoice_url: str,
    plan: str = "",
    user_id: Optional[str] = None,
) -> None:
    """Envia o link de cobrança por WhatsApp (best-effort)."""
    if not phone:
        return
    try:
        from app.services.whatsapp_service import send_charge_created
        await send_charge_created(
            phone=phone,
            user_name=user_name,
            company_name=company_name or "",
            invoice_url=invoice_url,
            plan=plan or "",
            user_id=user_id,
        )
    except Exception as exc:
        logger.warning("guided_analysis.charge_whatsapp_failed phone=%s err=%s", phone, exc)
