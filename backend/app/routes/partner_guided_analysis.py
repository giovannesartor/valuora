"""
Guided Analysis — Partner Mode
================================

Allows a partner to create a valuation on behalf of a client. Flow:

1. Partner creates an invite (POST /partners/guided-analyses) filling in all
   valuation fields. The system creates:
     - PartnerClient (if not already linked by email)
     - Analysis in DRAFT status, without user_id (nullable)
     - AnalysisInvite with token + public link
2. System sends client an email with the link
   /guided-analysis/invite/{token}.
3. Client opens the link (public) → GET /analysis-invites/{token} returns a preview.
4. Client logs in OR creates account, then POST /analysis-invites/{token}/accept
   links the Analysis to user_id and marks the invite as ACCEPTED.
5. Client is redirected to the standard payment page.

Routes:
    POST   /partners/guided-analyses           (partner auth)
    GET    /partners/guided-analyses           (partner auth, list)
    DELETE /partners/guided-analyses/{id}      (partner auth, cancel)
    GET    /analysis-invites/{token}           (public — preview)
    POST   /analysis-invites/{token}/accept    (any authenticated user — links)
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
from app.core.valuation_engine.engine import run_valuation, run_valuation_with_ibge
from app.models.models import (
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

router = APIRouter(tags=["Guided Analysis"])

INVITE_DEFAULT_TTL_DAYS = 30


# ─── Schemas ─────────────────────────────────────────────
class GuidedAnalysisCreate(BaseModel):
    client_name: str = Field(..., min_length=2, max_length=255)
    client_email: EmailStr
    client_phone: Optional[str] = None
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


async def _get_partner_or_403(db: AsyncSession, current_user: User) -> Partner:
    res = await db.execute(select(Partner).where(Partner.user_id == current_user.id))
    partner = res.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="User is not a partner.")
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
    """Runs IBGE + valuation engine + (optional) strategic AI, mutating the Analysis in-place."""
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
        logger.error("[GUIDED] Valuation engine error: %s", engine_err)
        analysis.status = AnalysisStatus.FAILED
        await db.commit()
        raise HTTPException(status_code=500, detail="Valuation engine error. Please try again.")

    # Strategic AI (best-effort) — only if we have extracted data (upload mode)
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
    """Partner creates a guided analysis (DRAFT) + client invite."""
    partner = await _get_partner_or_403(db, current_user)

    # Rate limit: max 100 invites per partner per 24h
    _day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    invite_count_r = await db.execute(
        select(_func.count(AnalysisInvite.id)).where(
            AnalysisInvite.partner_id == partner.id,
            AnalysisInvite.created_at >= _day_ago,
        )
    )
    if (invite_count_r.scalar() or 0) >= 100:
        raise HTTPException(status_code=429, detail="Daily limit of 100 invites reached. Try again tomorrow.")

    # 1. Reuse or create PartnerClient by email
    email_norm = payload.client_email.lower().strip()
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
            client_name=payload.client_name,
            client_company=payload.client_company,
            client_email=email_norm,
            client_phone=payload.client_phone,
            data_status=ClientDataStatus.PRE_FILLED,
            plan=payload.suggested_plan,
        )
        db.add(partner_client)
        await db.flush()

    # 2. Create Analysis (PROCESSING) without user_id and run valuation engine
    analysis_dict = payload.analysis.model_dump(exclude_unset=False)
    pa = analysis_dict.get("pending_assets")
    if pa:
        analysis_dict["pending_assets"] = [
            p.model_dump() if hasattr(p, "model_dump") else dict(p) for p in pa
        ]
    analysis = Analysis(
        user_id=None,
        partner_id=partner.id,
        status=AnalysisStatus.PROCESSING,
        plan=payload.suggested_plan,
        **analysis_dict,
    )
    db.add(analysis)
    await db.flush()

    # Run the valuation engine (same pipeline as /analyses/ POST)
    await _run_valuation_pipeline(data=payload.analysis, analysis=analysis, db=db)

    # Link analysis to PartnerClient
    if partner_client.analysis_id is None:
        partner_client.analysis_id = analysis.id

    # 3. Create AnalysisInvite with token
    token = _generate_token()
    invite = AnalysisInvite(
        token=token,
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
    await db.commit()
    await db.refresh(invite)

    # 4. Send email (best-effort)
    public_url = _public_invite_url(token)
    background_tasks.add_task(
        _send_invite_email_safe,
        to_email=email_norm,
        client_name=payload.client_name,
        partner_company=partner.company_name or current_user.full_name,
        url=public_url,
        message=payload.message,
    )

    logger.info(
        "guided_analysis.created partner=%s client=%s invite=%s",
        partner.id, partner_client.id, invite.id,
    )
    return _to_response(invite)


@router.post("/partners/guided-analyses/upload", response_model=GuidedAnalysisResponse)
async def create_guided_analysis_from_upload(
    background_tasks: BackgroundTasks,
    client_name: str = Form(...),
    client_email: str = Form(...),
    client_phone: Optional[str] = Form(None),
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
    """Partner creates a guided analysis via financial document upload (same pipeline as /analyses/upload)."""
    partner = await _get_partner_or_403(db, current_user)

    if not files:
        raise HTTPException(status_code=400, detail="Please send at least one file.")
    if len(files) > 15:
        raise HTTPException(status_code=400, detail="Maximum of 15 files.")

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
            raise HTTPException(status_code=400, detail=f"Unsupported format: {f.filename}. Please upload PDF or Excel.")
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File {f.filename!r} exceeds 15 MB.")
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
        raise HTTPException(status_code=422, detail="Could not extract data from the submitted documents.")

    revenue = all_extracted.get("revenue") or 0
    net_margin = all_extracted.get("net_margin") or 0.10
    growth_rate = all_extracted.get("growth_rate") or 0.10
    debt = all_extracted.get("total_liabilities") or 0
    cash = all_extracted.get("cash") or 0

    if revenue <= 0:
        raise HTTPException(status_code=422, detail="Could not extract a valid revenue value.")
    if not (0 <= net_margin < 1):
        net_margin = net_margin / 100 if 1 <= net_margin <= 100 else 0.10
    if not (-0.5 < growth_rate < 5):
        growth_rate = growth_rate / 100 if 1 <= growth_rate <= 100 else 0.10
    debt = max(0, debt)
    cash = max(0, cash)

    # Reuse or create PartnerClient
    email_norm = client_email.lower().strip()
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
            client_name=client_name,
            client_company=client_company,
            client_email=email_norm,
            client_phone=client_phone,
            data_status=ClientDataStatus.PRE_FILLED,
            plan=plan_enum,
        )
        db.add(partner_client)
        await db.flush()

    # Build AnalysisCreate to reuse the pipeline
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
        user_id=None,
        partner_id=partner.id,
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

    if partner_client.analysis_id is None:
        partner_client.analysis_id = analysis.id

    token = _generate_token()
    invite = AnalysisInvite(
        token=token,
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
    await db.commit()
    await db.refresh(invite)

    public_url = _public_invite_url(token)
    background_tasks.add_task(
        _send_invite_email_safe,
        to_email=email_norm,
        client_name=client_name,
        partner_company=partner.company_name or current_user.full_name,
        url=public_url,
        message=message,
    )

    logger.info(
        "guided_analysis.upload.created partner=%s client=%s invite=%s",
        partner.id, partner_client.id, invite.id,
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
        raise HTTPException(status_code=404, detail="Invite not found.")
    if invite.status in (AnalysisInviteStatus.ACCEPTED, AnalysisInviteStatus.COMPLETED):
        raise HTTPException(status_code=400, detail="An already accepted invite cannot be cancelled.")
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
    """Public endpoint: client opens the link to view the invite."""
    # Rate limit by IP — 30 req/min to protect against token enumeration
    from app.main import _check_rate_limit
    client_ip = (request.client.host if request.client else "unknown")
    if not await _check_rate_limit(f"guided-preview:{client_ip}", max_requests=30):
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again in 1 minute.")

    res = await db.execute(select(AnalysisInvite).where(AnalysisInvite.token == token))
    invite = res.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")

    # Check expiry
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        if invite.status == AnalysisInviteStatus.PENDING:
            invite.status = AnalysisInviteStatus.EXPIRED
            await db.commit()
        raise HTTPException(status_code=410, detail="Invite has expired.")

    if invite.status == AnalysisInviteStatus.CANCELLED:
        raise HTTPException(status_code=410, detail="Invite was cancelled by the partner.")

    # Mark OPENED on first visit
    if invite.status == AnalysisInviteStatus.PENDING:
        invite.status = AnalysisInviteStatus.OPENED
        invite.opened_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(invite)

    # Load auxiliary data
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
    """Authenticated client accepts the invite — links Analysis to user_id."""
    res = await db.execute(select(AnalysisInvite).where(AnalysisInvite.token == token))
    invite = res.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found.")

    if invite.status == AnalysisInviteStatus.CANCELLED:
        raise HTTPException(status_code=410, detail="Invite was cancelled.")
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite has expired.")
    if invite.status == AnalysisInviteStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Invite already completed.")

    # Email validation: logged-in user must own the email the invite was sent to
    if (current_user.email or "").lower().strip() != invite.client_email.lower().strip():
        raise HTTPException(
            status_code=403,
            detail="Please log in with the email address the invite was sent to.",
        )

    # Link Analysis to user
    if invite.analysis_id:
        a_res = await db.execute(select(Analysis).where(Analysis.id == invite.analysis_id))
        analysis = a_res.scalar_one_or_none()
        if analysis and analysis.user_id is None:
            analysis.user_id = current_user.id

    # Also link PartnerClient to user
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


# ─── Email helper ────────────────────────────────────────
def _send_invite_email_safe(
    to_email: str,
    client_name: str,
    partner_company: Optional[str],
    url: str,
    message: Optional[str],
) -> None:
    """Sends the invite email — failures are logged but not raised."""
    import asyncio
    try:
        from app.services.email_service import send_email  # type: ignore

        subject = f"{partner_company or 'Valuora'} prepared your valuation"
        msg_html = f'<p><em>Message from your partner:</em><br/>{message}</p>' if message else ''
        body_html = f"""
        <p>Hello, {client_name}!</p>
        <p><strong>{partner_company or 'Your partner'}</strong> has prepared a valuation
        analysis for your company on the Valuora platform.</p>
        {msg_html}
        <p>To review the data and complete payment, visit:</p>
        <p><a href="{url}">{url}</a></p>
        <p>The link is valid for {INVITE_DEFAULT_TTL_DAYS} days.</p>
        """
        asyncio.run(send_email(to_email, subject, body_html))
    except Exception as exc:  # noqa: BLE001
        logger.warning("guided_analysis.email_failed to=%s err=%s", to_email, exc)
