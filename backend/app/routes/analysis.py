import uuid
import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path as FilePath
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, BackgroundTasks, UploadFile, File, Form, HTTPException, Query, Request, Body
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.cache import cache_get, cache_set, cache_delete_pattern, CACHE_TTL_SHORT
from app.core.audit import audit_log
from app.core.valuation_engine.engine import run_valuation, run_valuation_with_ibge
from app.core.valuation_engine.sectors import get_sector_list
from app.services.sector_analysis_service import (
    get_dcf_sector_adjustment, _sector_to_cnae,
)
from app.services.deepseek_service import (
    extract_financial_data, generate_strategic_analysis, estimate_sector_data_with_ai,
)
from app.models.models import (
    User, Analysis, AnalysisVersion, UserFavorite,
    AnalysisStatus, PlanType, Report,
)
from app.schemas.analysis import (
    AnalysisCreate, AnalysisResponse, AnalysisListResponse,
    PaginatedAnalysesResponse,
)
from app.schemas.auth import MessageResponse

logger = logging.getLogger(__name__)
from app.services.auth_service import get_current_user
from app.services.storage_service import save_logo as _storage_save_logo
from app.services.email_service import send_report_ready_email

router = APIRouter(prefix="/analyses", tags=["Análises"])

ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"}
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2MB


async def _save_logo(logo: UploadFile, analysis_id: uuid.UUID) -> str:
    """Valida e persiste o logo — usa R2 se configurado, filesystem local como fallback."""
    if logo.content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(status_code=400, detail="Formato de logo não suportado. Use PNG, JPG, SVG ou WebP.")
    content = await logo.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=400, detail="Logo deve ter no máximo 2MB.")
    ext = logo.filename.rsplit(".", 1)[-1].lower() if logo.filename else "png"
    return await _storage_save_logo(content, analysis_id, ext)


# ─── Per-user rate limiter for expensive operations ───────────────────────────
_USER_ANALYSIS_LIMIT = 10    # max analysis creations
_USER_ANALYSIS_WINDOW = 3600  # per 1 hour (seconds)


async def _check_user_analysis_rate_limit(user_id: str) -> None:
    """Raise 429 if the user has exceeded their hourly analysis creation quota.
    Falls back to allowing requests if Redis is unavailable."""
    from app.core.redis import redis_client
    key = f"rl:user_analysis:{user_id}"
    try:
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, _USER_ANALYSIS_WINDOW)
        if current > _USER_ANALYSIS_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Limite de {_USER_ANALYSIS_LIMIT} análises por hora atingido. Tente novamente mais tarde.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"[RateLimit] Redis unavailable for user rate limit: {e!r} — skipping")


@router.post("/", response_model=AnalysisResponse)
async def create_analysis(
    data: AnalysisCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _check_user_analysis_rate_limit(str(current_user.id))
    analysis = Analysis(
        user_id=current_user.id,
        partner_id=current_user.partner_id,  # propagate referral tracking
        company_name=data.company_name,
        sector=data.sector,
        cnpj=data.cnpj,
        revenue=max(1, data.revenue),  # Block zero/negative revenue
        net_margin=data.net_margin,
        growth_rate=data.growth_rate,
        debt=data.debt,
        cash=data.cash,
        founder_dependency=data.founder_dependency,
        projection_years=data.projection_years,
        ebitda=data.ebitda,
        recurring_revenue_pct=data.recurring_revenue_pct,
        num_employees=data.num_employees,
        years_in_business=data.years_in_business,
        previous_investment=data.previous_investment,
        qualitative_answers=data.qualitative_answers,
        dcf_weight=data.dcf_weight,
        custom_exit_multiple=data.custom_exit_multiple,
        status=AnalysisStatus.PROCESSING,
    )
    db.add(analysis)
    await db.flush()

    # Fetch IBGE sector adjustment (non-blocking, with fallback chain)
    # 1. IBGE/SIDRA (melhor) → 2. DeepSeek AI (bom) → 3. Damodaran estático (seguro)
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
        logger.warning(f"[ANALYSIS] IBGE adjustment failed for {data.sector}: {e}")
        # IBGE falhou → tentar DeepSeek como fallback
        try:
            cnae_code = _sector_to_cnae(data.sector)
            ai_sector = await estimate_sector_data_with_ai(data.sector, cnae_code)
            if ai_sector:
                ibge_adj = ai_sector
        except Exception as e2:
            logger.warning(f"[ANALYSIS] DeepSeek sector fallback failed: {e2}")

    # Run valuation with IBGE data if available (CPU-bound → offload to thread)
    _engine_kwargs = dict(
        years_in_business=data.years_in_business,
        ebitda=float(data.ebitda) if data.ebitda else None,
        recurring_revenue_pct=data.recurring_revenue_pct,
        num_employees=data.num_employees,
        previous_investment=float(data.previous_investment),
        qualitative_answers=data.qualitative_answers,
        dcf_weight=data.dcf_weight,
        custom_exit_multiple=data.custom_exit_multiple,
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
                **_engine_kwargs,
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
                **_engine_kwargs,
            )
    except Exception as engine_err:
        logger.error(f"[MANUAL] Valuation engine error: {engine_err}")
        analysis.status = AnalysisStatus.FAILED
        await db.commit()
        raise HTTPException(status_code=500, detail="Erro no motor de valuation. Tente novamente.")

    analysis.valuation_result = result
    analysis.equity_value = result["equity_value"]
    analysis.risk_score = result["risk_score"]
    analysis.maturity_index = result["maturity_index"]
    analysis.percentile = result["percentile"]
    analysis.status = AnalysisStatus.COMPLETED

    # Save version
    version = AnalysisVersion(
        analysis_id=analysis.id,
        version_number=1,
        valuation_result=result,
        equity_value=result["equity_value"],
    )
    db.add(version)

    await db.commit()
    await db.refresh(analysis)
    # Invalidate KPI cache for this user
    await cache_delete_pattern(f"qv:kpis:{current_user.id}")
    # Notify user by email
    asyncio.create_task(send_report_ready_email(
        current_user.email,
        current_user.full_name or current_user.email,
        analysis.company_name,
        f"{settings.FRONTEND_URL}/analise/{analysis.id}",
    ))
    return analysis


@router.post("/upload", response_model=AnalysisResponse)
async def create_analysis_from_upload(
    company_name: str = Form(...),
    sector: str = Form(...),
    cnpj: str = Form(""),
    founder_dependency: float = Form(0.0),
    projection_years: int = Form(10),
    qualitative_answers: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    logo: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria análise a partir de upload de DRE/Balanço (PDF ou Excel). Aceita múltiplos arquivos."""
    await _check_user_analysis_rate_limit(str(current_user.id))
    print(
        f"[UPLOAD] Start: company={company_name!r}, sector={sector!r}, "
        f"files={len(files) if files else 0}, logo={'yes' if logo and logo.filename else 'no'}"
    )
    if not files:
        raise HTTPException(status_code=400, detail="Envie pelo menos um arquivo.")
    if len(files) > 6:
        raise HTTPException(status_code=400, detail="Máximo de 6 arquivos permitidos.")

    # Parse founder_dependency from percentage to decimal
    founder_dep = min(max(founder_dependency / 100, 0), 1)

    # Parse qualitative_answers JSON
    qual_answers = None
    if qualitative_answers:
        try:
            import json as _json
            qual_answers = _json.loads(qualitative_answers)
        except Exception:
            qual_answers = None

    # ── Read all file contents and validate extensions ──
    file_contents = []
    for file in files:
        ext = file.filename.split(".")[-1].lower() if file.filename else ""
        if ext not in ("pdf", "xlsx", "xls"):
            raise HTTPException(status_code=400, detail=f"Formato não suportado: {file.filename}. Envie PDF ou Excel.")
        content = await file.read()
        file_contents.append((file.filename, content, ext))

    # ── Extract financial data from ALL files concurrently ──
    # Each DeepSeek call can take up to 60s; sequential = N*60s, concurrent ≈ 60s
    async def _extract_one(filename: str, content: bytes, ext: str):
        try:
            return await extract_financial_data(content, ext)
        except Exception as e:
            logger.warning(f"[UPLOAD] Extraction failed for {filename}: {e}")
            return {"error": str(e)}

    print(f"[UPLOAD] Extracting data from {len(file_contents)} files concurrently...")
    extraction_results = await asyncio.gather(
        *[_extract_one(name, content, ext) for name, content, ext in file_contents]
    )

    all_extracted = {}
    uploaded_filenames = []
    for (filename, _, _), result_data in zip(file_contents, extraction_results):
        if "error" not in result_data:
            for k, v in result_data.items():
                if v and (k not in all_extracted or not all_extracted[k]):
                    all_extracted[k] = v
                elif v and k in all_extracted and isinstance(v, (int, float)) and v > 0:
                    all_extracted[k] = v  # Prefer non-zero values
        uploaded_filenames.append(filename)
    print(f"[UPLOAD] Extraction done. Keys found: {list(all_extracted.keys())}")

    extracted = all_extracted
    if not extracted:
        raise HTTPException(status_code=422, detail="Não foi possível extrair dados dos documentos enviados.")

    revenue = extracted.get("revenue") or 0
    net_margin = extracted.get("net_margin") or 0.10
    growth_rate = extracted.get("growth_rate") or 0.10
    debt = extracted.get("total_liabilities") or 0
    cash = extracted.get("cash") or 0

    # Fix #9: Validar números extraídos pela IA
    if revenue <= 0:
        raise HTTPException(status_code=422, detail="Não foi possível extrair receita válida do documento.")
    if not (0 <= net_margin < 1):
        # Se veio como porcentagem (ex: 15 ao invés de 0.15)
        if 1 <= net_margin <= 100:
            net_margin = net_margin / 100
        elif net_margin < 0:
            net_margin = 0.0  # Empresa com margem negativa → breakeven
        else:
            net_margin = 0.10  # Fallback
    if not (-0.5 < growth_rate < 5):
        if 1 <= growth_rate <= 100:
            growth_rate = growth_rate / 100
        else:
            growth_rate = 0.10
    if debt < 0:
        debt = 0
    if cash < 0:
        cash = 0

    analysis = Analysis(
        user_id=current_user.id,
        partner_id=current_user.partner_id,  # propagate referral tracking (upload route)
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
        extracted_data=extracted,
        uploaded_files=uploaded_filenames,
        status=AnalysisStatus.PROCESSING,
    )
    db.add(analysis)
    await db.flush()

    # Fallback chain: IBGE → DeepSeek AI → Damodaran estático
    ibge_adj = None
    try:
        cnae_code = _sector_to_cnae(sector)
        adjustment = await get_dcf_sector_adjustment(
            cnae_code=cnae_code,
            company_revenue=float(revenue),
            company_growth=float(growth_rate),
        )
        ibge_adj = adjustment.model_dump()
    except Exception as e:
        logger.warning(f"[UPLOAD] IBGE adjustment failed for {sector}: {e}")
        # IBGE falhou → tentar DeepSeek como fallback
        try:
            cnae_code = _sector_to_cnae(sector)
            ai_sector = await estimate_sector_data_with_ai(sector, cnae_code)
            if ai_sector:
                ibge_adj = ai_sector
        except Exception as e2:
            logger.warning(f"[UPLOAD] DeepSeek sector fallback failed: {e2}")

    # Enrich engine kwargs with extracted financial data
    _ebitda = extracted.get("ebitda") or None
    _num_employees = extracted.get("num_employees") or 0
    _years_in_business = extracted.get("years_in_business") or 3
    _recurring_revenue_pct = extracted.get("recurring_revenue_pct") or 0.0
    _previous_investment = extracted.get("previous_investment") or 0.0

    _engine_kwargs = dict(
        qualitative_answers=qual_answers,
        ebitda=float(_ebitda) if _ebitda else None,
        num_employees=int(_num_employees),
        years_in_business=int(_years_in_business),
        recurring_revenue_pct=float(_recurring_revenue_pct),
        previous_investment=float(_previous_investment),
    )

    try:
        if ibge_adj:
            result = await asyncio.to_thread(
                run_valuation_with_ibge,
                revenue=float(revenue),
                net_margin=float(net_margin),
                sector=sector,
                ibge_adjustment=ibge_adj,
                growth_rate=float(growth_rate),
                debt=float(debt),
                cash=float(cash),
                founder_dependency=founder_dep,
                projection_years=projection_years,
                **_engine_kwargs,
            )
        else:
            result = await asyncio.to_thread(
                run_valuation,
                revenue=float(revenue),
                net_margin=float(net_margin),
                sector=sector,
                growth_rate=float(growth_rate),
                debt=float(debt),
                cash=float(cash),
                founder_dependency=founder_dep,
                projection_years=projection_years,
                **_engine_kwargs,
            )
    except Exception as engine_err:
        logger.error(f"[UPLOAD] Valuation engine error: {engine_err}")
        analysis.status = AnalysisStatus.FAILED
        await db.commit()
        raise HTTPException(status_code=500, detail="Erro no motor de valuation. Tente novamente.")

    # Fix #12: AI recebe resultado do valuation para análise mais rica
    print(f"[UPLOAD] Valuation done. Generating strategic analysis...")
    ai_text = await generate_strategic_analysis(extracted, valuation_result=result)
    print(f"[UPLOAD] Strategic analysis done. Saving...")

    analysis.valuation_result = result
    analysis.equity_value = result["equity_value"]
    analysis.risk_score = result["risk_score"]
    analysis.maturity_index = result["maturity_index"]
    analysis.percentile = result["percentile"]
    analysis.ai_analysis = ai_text
    analysis.status = AnalysisStatus.COMPLETED

    # Save logo if provided
    if logo and logo.filename:
        try:
            logo_rel = await _save_logo(logo, analysis.id)
            analysis.logo_path = logo_rel
        except Exception as e:
            logger.warning(f"[UPLOAD] Logo save failed for {analysis.id}: {e}")

    version = AnalysisVersion(
        analysis_id=analysis.id,
        version_number=1,
        valuation_result=result,
        equity_value=result["equity_value"],
    )
    db.add(version)

    await db.commit()
    await db.refresh(analysis)
    # Notify user by email
    asyncio.create_task(send_report_ready_email(
        current_user.email,
        current_user.full_name or current_user.email,
        analysis.company_name,
        f"{settings.FRONTEND_URL}/analise/{analysis.id}",
    ))
    return analysis


@router.post("/{analysis_id}/logo", response_model=MessageResponse)
async def upload_logo(
    analysis_id: uuid.UUID,
    logo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload/atualiza logo de uma análise existente."""
    analysis = (await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == current_user.id)
    )).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    logo_rel = await _save_logo(logo, analysis.id)
    analysis.logo_path = logo_rel
    await db.commit()
    return {"message": "Logo atualizada com sucesso."}


@router.delete("/{analysis_id}", response_model=MessageResponse)
async def delete_analysis(
    analysis_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move análise para a lixeira (soft delete — 30 dias)."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    analysis.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    # Invalidate KPI cache for this user
    await cache_delete_pattern(f"qv:kpis:{current_user.id}")
    await audit_log(
        action="analysis.delete",
        user_id=str(current_user.id),
        user_email=current_user.email,
        resource_id=str(analysis_id),
        detail=f"Soft-deleted analysis: {analysis.company_name}",
        ip=request.client.host if request.client else None,
    )
    return {"message": "Análise movida para a lixeira. Será excluída permanentemente em 30 dias."}


@router.get("/trash", response_model=PaginatedAnalysesResponse)
async def list_trash(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista análises na lixeira."""
    base = select(Analysis).where(
        Analysis.user_id == current_user.id,
        Analysis.deleted_at.isnot(None),
    )
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    base = base.order_by(Analysis.deleted_at.desc())
    offset = (page - 1) * page_size
    items = (await db.execute(base.offset(offset).limit(page_size))).scalars().all()
    total_pages = max(1, -(-total // page_size))

    return PaginatedAnalysesResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=total_pages,
    )


@router.post("/{analysis_id}/restore", response_model=MessageResponse)
async def restore_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restaura análise da lixeira."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.isnot(None),
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada na lixeira.")

    analysis.deleted_at = None
    await db.commit()
    return {"message": "Análise restaurada com sucesso."}


@router.delete("/{analysis_id}/permanent", response_model=MessageResponse)
async def permanent_delete_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exclui permanentemente uma análise da lixeira."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    # Delete logo file if exists
    if analysis.logo_path:
        logo_full = os.path.join(settings.UPLOADS_DIR, analysis.logo_path.lstrip("/"))
        if os.path.exists(logo_full):
            try:
                os.remove(logo_full)
            except OSError:
                pass

    # Delete PDF report files
    for report in (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalars().all():
        if report.file_path and os.path.exists(report.file_path):
            try:
                os.remove(report.file_path)
            except OSError:
                pass

    await db.delete(analysis)  # cascade deletes versions, simulations, reports, payment
    await db.commit()
    return {"message": "Análise excluída permanentemente."}


@router.get("/", response_model=PaginatedAnalysesResponse)
async def list_analyses(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    sort: str = Query("date_desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base = select(Analysis).where(Analysis.user_id == current_user.id, Analysis.deleted_at.is_(None))
    if search:
        safe_search = search.replace('%', '\\%').replace('_', '\\_')  # escape LIKE wildcards
        base = base.where(Analysis.company_name.ilike(f"%{safe_search}%"))
    if status and status != "all":
        base = base.where(Analysis.status == status)
    if sector and sector != "all":
        base = base.where(Analysis.sector == sector)

    # Count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Sort
    order_map = {
        "date_desc": Analysis.created_at.desc(),
        "date_asc": Analysis.created_at.asc(),
        "value_desc": Analysis.equity_value.desc().nullslast(),
        "value_asc": Analysis.equity_value.asc().nullsfirst(),
        "name_asc": Analysis.company_name.asc(),
        "name_desc": Analysis.company_name.desc(),
    }
    base = base.order_by(order_map.get(sort, Analysis.created_at.desc()))

    # Paginate
    offset = (page - 1) * page_size
    items = (await db.execute(base.offset(offset).limit(page_size))).scalars().all()
    total_pages = max(1, -(-total // page_size))

    return PaginatedAnalysesResponse(
        items=items, total=total, page=page,
        page_size=page_size, total_pages=total_pages,
    )


# ─── KPIs Endpoint ────────────────────────────────────────

@router.get("/kpis/summary")
async def get_kpis(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna KPIs agregados das análises do usuário. Cached 5 min per user."""
    cache_key = f"qv:kpis:{current_user.id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    base = select(Analysis).where(
        Analysis.user_id == current_user.id,
        Analysis.deleted_at.is_(None),
    )

    # Total analyses
    total = (await db.execute(
        select(func.count()).select_from(base.subquery())
    )).scalar() or 0

    # Completed analyses
    completed_q = base.where(Analysis.status == AnalysisStatus.COMPLETED)
    completed = (await db.execute(
        select(func.count()).select_from(completed_q.subquery())
    )).scalar() or 0

    # Avg equity value
    avg_value = (await db.execute(
        select(func.avg(Analysis.equity_value)).where(
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
            Analysis.status == AnalysisStatus.COMPLETED,
            Analysis.equity_value.isnot(None),
        )
    )).scalar() or 0

    # Max equity value
    max_value = (await db.execute(
        select(func.max(Analysis.equity_value)).where(
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
            Analysis.status == AnalysisStatus.COMPLETED,
        )
    )).scalar() or 0

    # Avg risk score
    avg_risk = (await db.execute(
        select(func.avg(Analysis.risk_score)).where(
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
            Analysis.status == AnalysisStatus.COMPLETED,
            Analysis.risk_score.isnot(None),
        )
    )).scalar() or 0

    # Sector distribution
    sector_rows = (await db.execute(
        select(Analysis.sector, func.count(Analysis.id))
        .where(
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
        )
        .group_by(Analysis.sector)
    )).all()
    sectors = {row[0]: row[1] for row in sector_rows}

    result_data = {
        "total": total,
        "completed": completed,
        "avg_value": float(avg_value),
        "max_value": float(max_value),
        "avg_risk": float(avg_risk),
        "sectors": sectors,
    }
    await cache_set(cache_key, result_data, ttl=300)  # 5 minutes
    return result_data


# ─── CSV Export ────────────────────────────────────────────

@router.get("/export/csv")
async def export_analyses_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exporta todas as análises do usuário em CSV."""
    import csv
    import io
    from fastapi.responses import StreamingResponse

    result = await db.execute(
        select(Analysis).where(
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
        ).order_by(Analysis.created_at.desc())
    )
    analyses = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Empresa", "Setor", "CNPJ", "Receita", "Margem Líquida",
        "Crescimento", "Dívida", "Caixa", "Dependência Fundador",
        "Valor Equity", "Score Risco", "Maturidade", "Percentil",
        "Plano", "Status", "Criado em",
    ])
    for a in analyses:
        writer.writerow([
            a.company_name, a.sector, a.cnpj or "",
            float(a.revenue), a.net_margin, a.growth_rate or "",
            float(a.debt), float(a.cash), a.founder_dependency,
            float(a.equity_value) if a.equity_value else "",
            a.risk_score or "", a.maturity_index or "", a.percentile or "",
            a.plan.value if a.plan else "", a.status.value,
            a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=analises-quantovale.csv"},
    )


# ─── Sectors Endpoint ────────────────────────────────────

@router.get("/sectors/list")
async def list_sectors():
    """Retorna todos os setores IBGE disponíveis agrupados."""
    sectors = get_sector_list()
    groups: Dict = {}
    for s in sectors:
        group = s["group"]
        if group not in groups:
            groups[group] = []
        groups[group].append({"id": s["id"], "label": s["label"]})
    return {"sectors": sectors, "groups": groups, "total": len(sectors)}


# ─── FEEDBACK ────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    analysis_id: uuid.UUID
    score: int
    comment: Optional[str] = None


@router.post("/feedback", status_code=201)
async def submit_feedback(
    payload: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Store NPS/feedback score submitted from the post-analysis modal."""
    logger.info(
        f"[FEEDBACK] user={current_user.id} analysis={payload.analysis_id} "
        f"score={payload.score} comment={payload.comment!r}"
    )
    return {"message": "Feedback recebido.", "score": payload.score}


# ─── SINGLE ANALYSIS ─────────────────────────────────────────────────────────

@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    return analysis


# ─── Duplicate Analysis ─────────────────────────────────────
@router.post("/{analysis_id}/duplicate", response_model=AnalysisResponse)
async def duplicate_analysis(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a copy of an existing analysis."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    
    # Create duplicate with same data but new ID
    duplicate = Analysis(
        user_id=current_user.id,
        company_name=f"{original.company_name} (cópia)",
        sector=original.sector,
        cnpj=original.cnpj,
        revenue=original.revenue,
        net_margin=original.net_margin,
        growth_rate=original.growth_rate,
        debt=original.debt,
        cash=original.cash,
        founder_dependency=original.founder_dependency,
        projection_years=original.projection_years,
        ebitda=original.ebitda,
        recurring_revenue_pct=original.recurring_revenue_pct,
        num_employees=original.num_employees,
        years_in_business=original.years_in_business,
        previous_investment=original.previous_investment,
        qualitative_answers=original.qualitative_answers,
        dcf_weight=original.dcf_weight,
        custom_exit_multiple=original.custom_exit_multiple,
        logo_path=original.logo_path,
        status=AnalysisStatus.DRAFT,
        valuation_result=None,
        plan=None,
    )
    db.add(duplicate)
    await db.commit()
    await db.refresh(duplicate)
    return duplicate

# ─── Patch Analysis (Archive/Unarchive / Quick Edit) ─────────────────────
@router.patch("/{analysis_id}")
async def patch_analysis(
    analysis_id: uuid.UUID,
    deleted_at: Optional[str] = Body(None, embed=True),
    company_name: Optional[str] = Body(None, embed=True),
    revenue: Optional[float] = Body(None, embed=True),
    net_margin: Optional[float] = Body(None, embed=True),
    ebitda: Optional[float] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update analysis fields: archive/unarchive or quick-edit basic inputs."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    # ── Quick-edit fields ──────────────────────────────────────
    if company_name is not None:
        stripped = company_name.strip()
        if stripped:
            analysis.company_name = stripped
    if revenue is not None:
        if revenue < 0:
            raise HTTPException(status_code=400, detail="Receita não pode ser negativa.")
        analysis.revenue = revenue
    if net_margin is not None:
        # frontend sends as percentage (e.g. 25.5 → stored as 0.255)
        analysis.net_margin = net_margin / 100.0
    if ebitda is not None:
        analysis.ebitda = ebitda

    # ── Archive / unarchive ────────────────────────────────────
    if deleted_at is not None:
        if deleted_at == "":
            analysis.deleted_at = None
        else:
            try:
                analysis.deleted_at = datetime.fromisoformat(deleted_at).replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Formato de data inválido. Use ISO 8601.")
    elif all(v is None for v in (company_name, revenue, net_margin, ebitda)):
        # legacy behaviour: bare PATCH with no fields → unarchive
        analysis.deleted_at = None

    await db.commit()
    return {"message": "Análise atualizada com sucesso."}

# duplicate DELETE /{analysis_id} removed — use /{analysis_id}/permanent for hard delete


# ─── Update Notes ──────────────────────────────────────────
@router.patch("/{analysis_id}/notes")
async def update_notes(
    analysis_id: uuid.UUID,
    notes: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save user notes for an analysis."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    analysis.notes = notes
    await db.commit()
    return {"message": "Notas salvas.", "notes": notes}


# ─── Generate Share Token ──────────────────────────────────
import secrets as _secrets

@router.post("/{analysis_id}/share")
async def generate_share_token(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate or return existing share token for a public read-only link."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    if not analysis.share_token:
        analysis.share_token = _secrets.token_urlsafe(32)
        await db.commit()
    return {"share_token": analysis.share_token}


# ─── Revoke Share Token ────────────────────────────────────
@router.delete("/{analysis_id}/share")
async def revoke_share_token(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke the share token, making the link inaccessible."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    analysis.share_token = None
    await db.commit()
    return {"message": "Link compartilhável revogado."}


# ─── Public Read-Only by Share Token ──────────────────────
@router.get("/public/{share_token}")
async def get_public_analysis(
    share_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Return a read-only summary of an analysis by share token (no auth required)."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.share_token == share_token,
            Analysis.deleted_at.is_(None),
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Link inválido ou expirado.")
    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(status_code=403, detail="Esta análise ainda não foi concluída.")
    return {
        "company_name": analysis.company_name,
        "sector": analysis.sector,
        "equity_value": float(analysis.equity_value) if analysis.equity_value else None,
        "risk_score": analysis.risk_score,
        "maturity_index": analysis.maturity_index,
        "percentile": analysis.percentile,
        "valuation_result": analysis.valuation_result,
        "ai_analysis": analysis.ai_analysis,
        "plan": analysis.plan.value if analysis.plan else None,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
    }


# ─── Re-análise sem novo pagamento ───────────────────────────────────────────
class ReanalyzeInput(BaseModel):
    """All fields optional — only provided values override the analysis."""
    revenue: Optional[float] = None
    net_margin: Optional[float] = None
    growth_rate: Optional[float] = None
    debt: Optional[float] = None
    cash: Optional[float] = None
    founder_dependency: Optional[float] = None
    projection_years: Optional[int] = None
    ebitda: Optional[float] = None
    recurring_revenue_pct: Optional[float] = None
    num_employees: Optional[int] = None
    years_in_business: Optional[int] = None
    previous_investment: Optional[float] = None
    qualitative_answers: Optional[dict] = None
    dcf_weight: Optional[float] = None
    custom_exit_multiple: Optional[float] = None

    class Config:
        extra = "ignore"


@router.post("/{analysis_id}/reanalyze", response_model=AnalysisResponse)
async def reanalyze(
    analysis_id: uuid.UUID,
    body: ReanalyzeInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-run the valuation engine with (optionally) updated inputs.

    Requires the analysis to be COMPLETED and already paid (plan set).
    Creates a historical snapshot in AnalysisVersion before overwriting results.
    """
    await _check_user_analysis_rate_limit(str(current_user.id))
    result_row = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
        )
    )
    analysis = result_row.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    if not analysis.plan:
        raise HTTPException(status_code=403, detail="Esta análise ainda não foi paga. Conclua o pagamento primeiro.")
    if analysis.status not in (AnalysisStatus.COMPLETED, AnalysisStatus.FAILED):
        raise HTTPException(status_code=400, detail="Análise não está em estado que permita re-execução.")

    # Snapshot current results before overwriting
    next_version = await db.scalar(
        select(func.coalesce(func.max(AnalysisVersion.version_number), 0) + 1)
        .where(AnalysisVersion.analysis_id == analysis_id)
    )
    if analysis.valuation_result:
        snapshot = AnalysisVersion(
            analysis_id=analysis.id,
            version_number=next_version or 2,
            valuation_result=analysis.valuation_result,
            equity_value=analysis.equity_value,
        )
        db.add(snapshot)

    # Merge provided fields into analysis
    def _v(new_val, old_val):
        return new_val if new_val is not None else old_val

    revenue           = _v(body.revenue,           float(analysis.revenue or 0))
    net_margin        = _v(body.net_margin,         float(analysis.net_margin or 0.10))
    growth_rate       = _v(body.growth_rate,        float(analysis.growth_rate or 0.10))
    debt              = _v(body.debt,               float(analysis.debt or 0))
    cash              = _v(body.cash,               float(analysis.cash or 0))
    founder_dep       = _v(body.founder_dependency, float(analysis.founder_dependency or 0))
    projection_years  = _v(body.projection_years,   analysis.projection_years or 10)
    ebitda            = _v(body.ebitda,             float(analysis.ebitda) if analysis.ebitda else None)
    recurring_rev_pct = _v(body.recurring_revenue_pct, float(analysis.recurring_revenue_pct or 0))
    num_employees     = _v(body.num_employees,      analysis.num_employees or 0)
    years_in_business = _v(body.years_in_business,  analysis.years_in_business or 3)
    prev_investment   = _v(body.previous_investment, float(analysis.previous_investment or 0))
    qual_answers      = _v(body.qualitative_answers, analysis.qualitative_answers)
    dcf_weight        = _v(body.dcf_weight,         float(analysis.dcf_weight) if analysis.dcf_weight else 0.50)
    custom_exit_mult  = _v(body.custom_exit_multiple, analysis.custom_exit_multiple)

    analysis.status = AnalysisStatus.PROCESSING

    # Persist updated input fields
    analysis.revenue          = revenue
    analysis.net_margin       = net_margin
    analysis.growth_rate      = growth_rate
    analysis.debt             = debt
    analysis.cash             = cash
    analysis.founder_dependency    = founder_dep
    analysis.projection_years      = projection_years
    analysis.ebitda                = ebitda
    analysis.recurring_revenue_pct = recurring_rev_pct
    analysis.num_employees         = num_employees
    analysis.years_in_business     = years_in_business
    analysis.previous_investment   = prev_investment
    analysis.qualitative_answers   = qual_answers
    analysis.dcf_weight            = dcf_weight
    analysis.custom_exit_multiple  = custom_exit_mult
    await db.flush()

    # Try IBGE sector adjustment
    ibge_adj = None
    try:
        cnae_code = _sector_to_cnae(analysis.sector)
        adjustment = await get_dcf_sector_adjustment(
            cnae_code=cnae_code,
            company_revenue=revenue,
            company_growth=growth_rate,
        )
        ibge_adj = adjustment.model_dump()
    except Exception as exc:
        logger.warning("[REANALYZE] IBGE failed: %s", exc)

    _engine_kwargs = dict(
        years_in_business=years_in_business,
        ebitda=ebitda,
        recurring_revenue_pct=recurring_rev_pct,
        num_employees=num_employees,
        previous_investment=prev_investment,
        qualitative_answers=qual_answers,
        dcf_weight=dcf_weight,
        custom_exit_multiple=custom_exit_mult,
    )

    if ibge_adj:
        new_result = await asyncio.to_thread(
            run_valuation_with_ibge,
            revenue=revenue, net_margin=net_margin, sector=analysis.sector,
            ibge_adjustment=ibge_adj, growth_rate=growth_rate,
            debt=debt, cash=cash, founder_dependency=founder_dep,
            projection_years=projection_years, **_engine_kwargs,
        )
    else:
        new_result = await asyncio.to_thread(
            run_valuation,
            revenue=revenue, net_margin=net_margin, sector=analysis.sector,
            growth_rate=growth_rate, debt=debt, cash=cash,
            founder_dependency=founder_dep, projection_years=projection_years,
            **_engine_kwargs,
        )

    analysis.valuation_result = new_result
    analysis.equity_value  = new_result["equity_value"]
    analysis.risk_score    = new_result["risk_score"]
    analysis.maturity_index = new_result["maturity_index"]
    analysis.percentile    = new_result["percentile"]
    analysis.status        = AnalysisStatus.COMPLETED

    # Invalidate report so a new PDF can be generated on next download
    old_report = (await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )).scalar_one_or_none()
    if old_report:
        await db.delete(old_report)

    # Invalidate cache
    await cache_delete_pattern(f"analysis:{analysis_id}:*")

    await db.commit()
    await db.refresh(analysis)
    # Notify user by email (re-run)
    asyncio.create_task(send_report_ready_email(
        current_user.email,
        current_user.full_name or current_user.email,
        analysis.company_name,
        f"{settings.FRONTEND_URL}/analise/{analysis.id}",
    ))
    return analysis


# ─── SSE: generation progress ────────────────────────────────────────────────
@router.get("/{analysis_id}/generation-progress")
async def generation_progress_stream(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE stream: polls Redis for PDF generation progress every 2 s.

    The key ``gen_progress:{analysis_id}`` is set by
    ``_generate_and_send_report`` in payments.py.
    """
    from sse_starlette.sse import EventSourceResponse
    import asyncio, json

    # Verify ownership
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    key = f"gen_progress:{analysis_id}"

    async def event_gen():
        import time
        max_ticks = 150  # 150 × 2 s = 5 min
        start_time = time.monotonic()
        for _ in range(max_ticks):
            data = await cache_get(key)
            if data:
                pct = data.get("pct", 0)
                if pct and pct > 0:
                    elapsed = time.monotonic() - start_time
                    estimated_total = elapsed / (pct / 100)
                    data["eta_seconds"] = max(0, round(estimated_total - elapsed))
                yield {"event": "progress", "data": json.dumps(data)}
                if data.get("done") or data.get("error"):
                    return
            else:
                yield {"event": "waiting", "data": "{}"}
            await asyncio.sleep(2)
        yield {"event": "timeout", "data": "{}"}

    return EventSourceResponse(event_gen())


# ─── REST: generation status (poll-friendly alternative) ─────────────────────
@router.get("/{analysis_id}/generation-status")
async def generation_status(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return current generation progress from Redis (poll every 2s from frontend)."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    key = f"gen_progress:{analysis_id}"
    data = await cache_get(key)
    if data:
        return data
    return {"step": 0, "message": "Aguardando início…", "pct": 0, "done": False, "error": None}


# ─── PDF download ─────────────────────────────────────────────────────────────
@router.get("/{analysis_id}/pdf")
async def download_analysis_pdf(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve the generated PDF report directly as a file download."""
    # Allow analysis owner OR admin to download
    query = select(Analysis).where(Analysis.id == analysis_id)
    if not current_user.is_admin:
        query = query.where(Analysis.user_id == current_user.id)

    result = await db.execute(query)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    report_result = await db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    )
    report = report_result.scalar_one_or_none()

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Relatório PDF ainda não gerado. Aguarde a confirmação do pagamento.",
        )

    # If PDF file is missing on disk (e.g. Railway ephemeral FS), regenerate it
    if not report.file_path or not os.path.exists(report.file_path):
        if not analysis.valuation_result:
            raise HTTPException(
                status_code=404,
                detail="Dados de valuation não encontrados para regenerar o PDF.",
            )
        from app.services.pdf_service import generate_report_pdf
        try:
            pdf_path = await asyncio.to_thread(generate_report_pdf, analysis)
        except Exception as exc:
            logging.getLogger(__name__).error("PDF regen failed for %s: %s", analysis_id, exc)
            raise HTTPException(status_code=500, detail="Falha ao regenerar o PDF.")
        report.file_path = pdf_path
        await db.commit()

    company = (analysis.company_name or str(analysis_id)).replace(" ", "_")
    return FileResponse(
        report.file_path,
        media_type="application/pdf",
        filename=f"relatorio-quantovale-{company}.pdf",
    )


# ─── Favorites ────────────────────────────────────────────────────────────────

@router.get("/favorites/list")
async def list_favorites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all favorited analysis IDs for the current user."""
    rows = (await db.execute(
        select(UserFavorite.analysis_id)
        .where(UserFavorite.user_id == current_user.id)
    )).scalars().all()
    return {"favorites": [str(r) for r in rows]}


@router.post("/{analysis_id}/favorite", response_model=dict)
async def add_favorite(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle-add: favorite an analysis."""
    # Verify ownership
    analysis = (await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == current_user.id)
    )).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    # Idempotent insert
    existing = (await db.execute(
        select(UserFavorite).where(
            UserFavorite.user_id == current_user.id,
            UserFavorite.analysis_id == analysis_id,
        )
    )).scalar_one_or_none()
    if not existing:
        fav = UserFavorite(user_id=current_user.id, analysis_id=analysis_id)
        db.add(fav)
        await db.commit()
    return {"favorited": True, "analysis_id": str(analysis_id)}


@router.delete("/{analysis_id}/favorite", response_model=dict)
async def remove_favorite(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove an analysis from favorites."""
    existing = (await db.execute(
        select(UserFavorite).where(
            UserFavorite.user_id == current_user.id,
            UserFavorite.analysis_id == analysis_id,
        )
    )).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
    return {"favorited": False, "analysis_id": str(analysis_id)}


# ─── Version History ──────────────────────────────────────────────────────────

@router.get("/{analysis_id}/versions")
async def get_versions(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all version snapshots for an analysis."""
    # Verify ownership
    analysis = (await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    versions = (await db.execute(
        select(AnalysisVersion)
        .where(AnalysisVersion.analysis_id == analysis_id)
        .order_by(AnalysisVersion.version_number.desc())
    )).scalars().all()

    return {
        "analysis_id": str(analysis_id),
        "company_name": analysis.company_name,
        "current_value": float(analysis.equity_value) if analysis.equity_value else None,
        "versions": [
            {
                "id": str(v.id),
                "version_number": v.version_number,
                "equity_value": float(v.equity_value) if v.equity_value else None,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in versions
        ],
    }
