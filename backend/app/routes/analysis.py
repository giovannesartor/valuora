import uuid
import os
import re
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
    get_ma_comparables,
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


# ─── Document validation helpers ─────────────────────────────────────────────

def _infer_from_filename(filename: str):
    """Infer document type and fiscal year from filename.
    Returns (doc_type: str | None, fiscal_year: int | None).
    doc_type is one of: 'DRE', 'Balanço Patrimonial', 'Balancete', None.
    """
    name = filename.lower()
    year_match = re.search(r'\b(20\d{2})\b', filename)
    year = int(year_match.group(1)) if year_match else None

    if 'balancete' in name:
        doc_type = 'Balancete'
    elif any(kw in name for kw in ('balanço patrimonial', 'balanco patrimonial',
                                    'balance sheet', 'balanço', 'balanco',
                                    'patrimoni', 'balance_', 'bp_', '_bp')):
        doc_type = 'Balanço Patrimonial'
    elif any(kw in name for kw in ('dre', 'demonstracao', 'demonstração',
                                    'resultado', 'income', 'p&l', 'profit')):
        doc_type = 'DRE'
    else:
        doc_type = None

    return doc_type, year


def _validate_document_set(file_results: list) -> list:
    """Validate uploaded document set against business rules.

    Rules:
      1. All identified years must be within [current_year - 3, current_year].
      2. Max 1 DRE + 1 Balanço Patrimonial per year.
      3. The most recent identified year must have at least 1 DRE and 1 Balanço.

    Args:
        file_results: [(filename, extraction_dict), ...]

    Returns:
        List of human-readable error strings. Empty list = valid.
    """
    current_year = datetime.now(timezone.utc).year
    min_year = current_year - 3

    errors: list = []
    # {year: {'DRE': [fname], 'Balanço Patrimonial': [fname]}}
    docs_by_year: Dict[int, Dict[str, List[str]]] = {}

    for filename, data in file_results:
        if 'error' in data:
            continue

        fname_type, fname_year = _infer_from_filename(filename)

        # AI classification takes priority
        ai_type_raw = (data.get('document_type') or '').strip()
        ai_year_raw = data.get('fiscal_year')

        # Normalise AI type to canonical buckets
        al = ai_type_raw.lower()
        if 'balancete' in al:
            ai_type = 'Balanço Patrimonial'   # balancete substitui balanço
        elif al in ('dre', 'demonstração do resultado', 'demonstracao do resultado', 'income statement'):
            ai_type = 'DRE'
        elif al in ('balanço patrimonial', 'balanco patrimonial', 'balance sheet', 'balanço', 'balanco'):
            ai_type = 'Balanço Patrimonial'
        else:
            ai_type = None

        # Normalise filename type (balancete → balanço)
        if fname_type == 'Balancete':
            fname_type = 'Balanço Patrimonial'

        doc_type = ai_type or fname_type
        doc_year = int(ai_year_raw) if ai_year_raw else fname_year

        if not doc_year:
            continue   # can't determine year — skip silently

        # Rule 1: year range
        if doc_year < min_year or doc_year > current_year:
            errors.append(
                f'"{filename}": exercício {doc_year} fora do intervalo permitido '
                f'({min_year}–{current_year}). Envie documentos dos últimos 3 anos.'
            )
            continue

        if doc_type in ('DRE', 'Balanço Patrimonial'):
            if doc_year not in docs_by_year:
                docs_by_year[doc_year] = {'DRE': [], 'Balanço Patrimonial': []}
            docs_by_year[doc_year][doc_type].append(filename)

    if errors:
        return errors

    # Rule 2: max 1 per type per year
    for year, types in sorted(docs_by_year.items()):
        if len(types['DRE']) > 1:
            extras = ', '.join(f'"{f}"' for f in types['DRE'][1:])
            errors.append(f'Ano {year}: máximo 1 DRE por ano. Remova: {extras}.')
        if len(types['Balanço Patrimonial']) > 1:
            extras = ', '.join(f'"{f}"' for f in types['Balanço Patrimonial'][1:])
            errors.append(f'Ano {year}: máximo 1 Balanço Patrimonial por ano. Remova: {extras}.')

    if errors:
        return errors

    # Rule 3: most-recent year must have both DRE + Balanço
    if docs_by_year:
        latest_year = max(docs_by_year.keys())
        latest = docs_by_year[latest_year]
        missing = []
        if not latest['DRE']:
            missing.append('DRE')
        if not latest['Balanço Patrimonial']:
            missing.append('Balanço Patrimonial')
        if missing:
            errors.append(
                f'É obrigatório enviar ao menos 1 DRE e 1 Balanço Patrimonial do ano '
                f'mais recente ({latest_year}). Faltando: {" e ".join(missing)}.'
            )

    return errors


# ─────────────────────────────────────────────────────────────────────────────

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


@router.post("/extract-preview")
async def extract_preview(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    """Extrai dados financeiros dos arquivos enviados sem criar a análise.
    Usado para mostrar o painel de preview antes das perguntas qualitativas."""
    if not files:
        raise HTTPException(status_code=400, detail="Envie pelo menos um arquivo.")
    if len(files) > 6:
        raise HTTPException(status_code=400, detail="Máximo de 6 arquivos permitidos.")

    file_contents = []
    for file in files:
        ext = file.filename.split(".")[-1].lower() if file.filename else ""
        if ext not in ("pdf", "xlsx", "xls"):
            raise HTTPException(status_code=400, detail=f"Formato não suportado: {file.filename}. Envie PDF ou Excel.")
        content = await file.read()
        file_contents.append((file.filename, content, ext))

    async def _extract_one(filename: str, content: bytes, ext: str):
        try:
            return await extract_financial_data(content, ext)
        except Exception as e:
            logger.warning(f"[EXTRACT-PREVIEW] Extraction failed for {filename}: {e}")
            return {"error": str(e)}

    extraction_results = await asyncio.gather(
        *[_extract_one(name, content, ext) for name, content, ext in file_contents]
    )

    # ── Validate document set (year range, duplicates, minimum requirements) ──
    _val_input = [(fname, res) for (fname, _, _), res in zip(file_contents, extraction_results)]
    _val_errors = _validate_document_set(_val_input)
    if _val_errors:
        raise HTTPException(
            status_code=422,
            detail=_val_errors if len(_val_errors) > 1 else _val_errors[0],
        )

    # Sort by fiscal_year descending so most-recent-year data takes priority on conflicts
    _paired = list(zip(file_contents, extraction_results))
    _paired.sort(
        key=lambda x: int(x[1].get("fiscal_year") or 0) if "error" not in x[1] else 0,
        reverse=True,
    )

    merged: dict = {}
    sources: dict = {}  # campo -> nome do arquivo de origem
    all_notes: list = []
    for (filename, _, _), result_data in _paired:
        if "error" not in result_data:
            if result_data.get("notes"):
                all_notes.append(result_data["notes"])
            for k, v in result_data.items():
                if k == "notes":
                    continue
                # Most-recent year is processed first; only fill truly missing/empty slots
                if v is not None and v != "" and (k not in merged or merged[k] is None or merged[k] == ""):
                    merged[k] = v
                    sources[k] = filename
    if all_notes:
        merged["notes"] = " | ".join(all_notes)

    if not merged:
        raise HTTPException(
            status_code=422,
            detail="Não foi possível extrair dados dos documentos enviados. Verifique se os arquivos contêm DRE ou Balanço Patrimonial legíveis.",
        )

    # Conta campos reais extraídos (ignora metadados internos)
    _data_keys = [k for k in merged if not k.startswith("_") and k != "notes" and k != "error" and merged[k] is not None]
    return {**merged, "_sources": sources, "_file_count": len(file_contents), "_field_count": len(_data_keys)}


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

    # ── Validate document set (year range, duplicates, minimum requirements) ──
    _val_input_up = [(fname, res) for (fname, _, _), res in zip(file_contents, extraction_results)]
    _val_errors_up = _validate_document_set(_val_input_up)
    if _val_errors_up:
        raise HTTPException(
            status_code=422,
            detail=_val_errors_up if len(_val_errors_up) > 1 else _val_errors_up[0],
        )

    # Sort by fiscal_year descending so most-recent-year data takes priority on conflicts
    _paired_upload = list(zip(file_contents, extraction_results))
    _paired_upload.sort(
        key=lambda x: int(x[1].get("fiscal_year") or 0) if "error" not in x[1] else 0,
        reverse=True,
    )

    all_extracted = {}
    all_upload_notes: list = []
    uploaded_filenames = []
    for (filename, _, _), result_data in _paired_upload:
        if "error" not in result_data:
            if result_data.get("notes"):
                all_upload_notes.append(result_data["notes"])
            for k, v in result_data.items():
                if k == "notes":
                    continue
                # Most-recent year processed first; only fill missing/empty slots from older years
                if v is not None and v != "" and (k not in all_extracted or all_extracted[k] is None or all_extracted[k] == ""):
                    all_extracted[k] = v
        uploaded_filenames.append(filename)
    if all_upload_notes:
        all_extracted["notes"] = " | ".join(all_upload_notes)
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

    # Sparklines: last 30 days avg equity_value per day (PostgreSQL date_trunc)
    # Gracefully degrades to empty sparklines on SQLite (tests) or other DBs
    sparklines: dict = {"dates": [], "avg_value": [], "count": []}
    try:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        sparkline_rows = (await db.execute(
            select(
                func.date_trunc("day", Analysis.created_at).label("day"),
                func.avg(Analysis.equity_value).label("avg_val"),
                func.count(Analysis.id).label("cnt"),
            )
            .where(
                Analysis.user_id == current_user.id,
                Analysis.deleted_at.is_(None),
                Analysis.status == AnalysisStatus.COMPLETED,
                Analysis.equity_value.isnot(None),
                Analysis.created_at >= thirty_days_ago,
            )
            .group_by(func.date_trunc("day", Analysis.created_at))
            .order_by(func.date_trunc("day", Analysis.created_at))
        )).all()
        sparklines = {
            "dates": [str(row.day)[:10] for row in sparkline_rows],
            "avg_value": [float(row.avg_val) for row in sparkline_rows],
            "count": [int(row.cnt) for row in sparkline_rows],
        }
    except Exception as _spark_exc:
        logger.debug("[KPIs] Sparkline query skipped: %s", _spark_exc)

    result_data = {
        "total": total,
        "completed": completed,
        "avg_value": float(avg_value),
        "max_value": float(max_value),
        "avg_risk": float(avg_risk),
        "sectors": sectors,
        "sparklines": sparklines,
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


# ─── Excel Export (single analysis) ──────────────────────

@router.get("/{analysis_id}/export/xlsx")
async def export_analysis_xlsx(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exporta os dados de uma análise específica em XLSX (3 abas)."""
    import io
    from fastapi.responses import StreamingResponse
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, numbers
    from openpyxl.utils import get_column_letter

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

    wb = openpyxl.Workbook()
    HEADER_FILL = PatternFill("solid", fgColor="1A6B45")
    HEADER_FONT = Font(bold=True, color="FFFFFF")
    SUB_FILL   = PatternFill("solid", fgColor="E8F5EF")

    def _style_header_row(ws, row_num, ncols):
        for c in range(1, ncols + 1):
            cell = ws.cell(row=row_num, column=c)
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = Alignment(horizontal="center")
        ws.row_dimensions[row_num].height = 22

    def _autofit(ws):
        for col in ws.columns:
            max_len = max((len(str(c.value or "")) for c in col), default=10)
            ws.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 40)

    vr = analysis.valuation_result or {}

    # ── Sheet 1: Resumo ─────────────────────────────────
    ws1 = wb.active
    ws1.title = "Resumo"
    headers1 = ["Campo", "Valor"]
    ws1.append(headers1)
    _style_header_row(ws1, 1, 2)

    summary_rows = [
        ("Empresa",          analysis.company_name),
        ("Setor",            analysis.sector),
        ("CNPJ",             analysis.cnpj or "N/A"),
        ("Receita (R$)",     float(analysis.revenue) if analysis.revenue else 0),
        ("Margem Líquida",   f"{analysis.net_margin * 100:.1f}%"),
        ("Crescimento",      f"{(analysis.growth_rate or 0) * 100:.1f}%"),
        ("Dívida (R$)",      float(analysis.debt or 0)),
        ("Caixa (R$)",       float(analysis.cash or 0)),
        ("Anos na empresa",  analysis.years_in_business or "N/A"),
        ("Employees",        analysis.num_employees or "N/A"),
        ("Valor Equity (R$)", float(analysis.equity_value) if analysis.equity_value else "N/A"),
        ("Score de Risco",   analysis.risk_score or "N/A"),
        ("Maturidade",       analysis.maturity_index or "N/A"),
        ("Percentil",        f"{analysis.percentile:.1f}%" if analysis.percentile else "N/A"),
        ("Plano",            analysis.plan.value if analysis.plan else "N/A"),
        ("Status",           analysis.status.value),
        ("Criado em",        analysis.created_at.strftime("%d/%m/%Y %H:%M") if analysis.created_at else ""),
    ]
    for i, row in enumerate(summary_rows, start=2):
        ws1.append(list(row))
        if i % 2 == 0:
            for c in range(1, 3):
                ws1.cell(row=i, column=c).fill = SUB_FILL
    _autofit(ws1)

    # ── Sheet 2: FCF Projetado ────────────────────────────
    ws2 = wb.create_sheet("FCF Projetado")
    fcf_proj = vr.get("fcf_projections", [])
    if fcf_proj:
        fcf_cols = list(fcf_proj[0].keys())
        ws2.append(fcf_cols)
        _style_header_row(ws2, 1, len(fcf_cols))
        for row in fcf_proj:
            ws2.append([row.get(k) for k in fcf_cols])
        _autofit(ws2)
    else:
        ws2["A1"] = "Sem dados de projeção FCF disponíveis."

    # ── Sheet 3: DRE Projetada ────────────────────────────
    ws3 = wb.create_sheet("DRE Projetada")
    pnl_proj = vr.get("pnl_projections", [])
    if pnl_proj:
        pnl_cols = list(pnl_proj[0].keys())
        ws3.append(pnl_cols)
        _style_header_row(ws3, 1, len(pnl_cols))
        for row in pnl_proj:
            ws3.append([row.get(k) for k in pnl_cols])
        _autofit(ws3)
    else:
        ws3["A1"] = "Sem dados de DRE projetada disponíveis."

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    safe_name = (analysis.company_name or "empresa").replace(" ", "-").lower()
    filename = f"valuation-{safe_name}-{str(analysis.id)[:8]}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
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
    # Admins can view any analysis; regular users only their own
    query = select(Analysis).where(
        Analysis.id == analysis_id,
        Analysis.deleted_at.is_(None),
    )
    if not current_user.is_admin:
        query = query.where(Analysis.user_id == current_user.id)
    result = await db.execute(query)
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
from passlib.context import CryptContext as _CryptContext

_share_pwd_ctx = _CryptContext(schemes=["bcrypt"], deprecated="auto")


class ShareInput(BaseModel):
    password: Optional[str] = None  # if provided, protects the share link


@router.post("/{analysis_id}/share")
async def generate_share_token(
    analysis_id: uuid.UUID,
    body: ShareInput = ShareInput(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate or return existing share token for a public read-only link.
    Optionally password-protect it by providing ``password`` in the request body.
    Calling again with a new password will update it.
    """
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
    if body.password:
        analysis.share_password_hash = _share_pwd_ctx.hash(body.password)
    else:
        # Explicitly passing no password clears any existing protection
        if body.password is not None:
            analysis.share_password_hash = None
    await db.commit()
    return {
        "share_token": analysis.share_token,
        "password_protected": bool(analysis.share_password_hash),
    }


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
    analysis.share_password_hash = None
    await db.commit()
    return {"message": "Link compartilhável revogado."}


# ─── Reanalysis Alert Threshold ────────────────────────────
class AlertInput(BaseModel):
    threshold_pct: Optional[float] = None  # e.g. 0.10 = 10%; None clears the alert


@router.put("/{analysis_id}/alert")
async def set_alert_threshold(
    analysis_id: uuid.UUID,
    body: AlertInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set or clear the reanalysis alert threshold.
    When set, the user will be notified if equity_value changes by >= threshold_pct
    after a re-analysis.
    """
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    if body.threshold_pct is not None and not (0.01 <= body.threshold_pct <= 1.0):
        raise HTTPException(status_code=422, detail="threshold_pct deve estar entre 0.01 e 1.0")
    analysis.reanalysis_alert_pct = body.threshold_pct
    await db.commit()
    return {
        "message": "Alerta configurado." if body.threshold_pct else "Alerta removido.",
        "reanalysis_alert_pct": body.threshold_pct,
    }


# ─── Public Read-Only by Share Token ──────────────────────
@router.get("/public/{share_token}")
async def get_public_analysis(
    share_token: str,
    password: Optional[str] = None,  # query param: ?password=...
    db: AsyncSession = Depends(get_db),
):
    """Return a read-only summary of an analysis by share token (no auth required).
    If the analysis is password-protected, supply ?password=<pass>."""
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
    # Password check
    if analysis.share_password_hash:
        if not password:
            raise HTTPException(status_code=401, detail="Esta análise está protegida por senha.")
        if not _share_pwd_ctx.verify(password, analysis.share_password_hash):
            raise HTTPException(status_code=401, detail="Senha incorreta.")
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

    # Check reanalysis alert threshold
    old_equity = float(analysis.equity_value) if analysis.equity_value else None

    analysis.valuation_result = new_result
    analysis.equity_value  = new_result["equity_value"]
    analysis.risk_score    = new_result["risk_score"]
    analysis.maturity_index = new_result["maturity_index"]
    analysis.percentile    = new_result["percentile"]
    analysis.status        = AnalysisStatus.COMPLETED

    # Fire alert if threshold is configured and value changed significantly
    new_equity = float(analysis.equity_value) if analysis.equity_value else None
    if (
        analysis.reanalysis_alert_pct
        and old_equity
        and new_equity
        and abs(new_equity - old_equity) / old_equity >= analysis.reanalysis_alert_pct
    ):
        asyncio.create_task(send_report_ready_email(
            current_user.email,
            current_user.full_name or current_user.email,
            analysis.company_name,
            f"{settings.FRONTEND_URL}/analise/{analysis.id}",
        ))

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

    def _extract_params(vr: dict) -> dict:
        """Extract key comparable parameters from a valuation result."""
        params = vr.get("parameters", {})
        return {
            "growth_rate": round(float(params.get("growth_rate", 0)) * 100, 2),
            "net_margin": round(float(params.get("net_margin", 0)) * 100, 2),
            "wacc": round(float(vr.get("wacc", 0)) * 100, 2),
            "revenue": float(params.get("revenue", 0)),
            "projection_years": int(params.get("projection_years", 10)),
            "dlom_pct": round(float((vr.get("dlom") or {}).get("dlom_pct", 0)) * 100, 1),
            "risk_score": float(vr.get("risk_score", vr.get("survival", {}).get("risk_score", 0))),
            "tv_percentage": float(vr.get("tv_percentage", 0)),
        }

    current_params = _extract_params(analysis.valuation_result or {})

    return {
        "analysis_id": str(analysis_id),
        "company_name": analysis.company_name,
        "current_value": float(analysis.equity_value) if analysis.equity_value else None,
        "current_params": current_params,
        "versions": [
            {
                "id": str(v.id),
                "version_number": v.version_number,
                "equity_value": float(v.equity_value) if v.equity_value else None,
                "created_at": v.created_at.isoformat() if v.created_at else None,
                "params": _extract_params(v.valuation_result or {}),
            }
            for v in versions
        ],
    }


# ─── Valuation History (Valuation E) ─────────────────────

@router.get("/valuation-history")
async def get_valuation_history(
    company_name: str = Query(..., description="Nome da empresa para buscar histórico"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return valuation history for a company name — shows equity value over time."""
    analyses = (await db.execute(
        select(Analysis)
        .where(
            Analysis.user_id == current_user.id,
            Analysis.company_name.ilike(f"%{company_name}%"),
            Analysis.status == AnalysisStatus.COMPLETED,
            Analysis.deleted_at.is_(None),
            Analysis.equity_value.is_not(None),
        )
        .order_by(Analysis.created_at.asc())
    )).scalars().all()

    return {
        "company_name": company_name,
        "history": [
            {
                "id": str(a.id),
                "equity_value": float(a.equity_value),
                "risk_score": float(a.risk_score) if a.risk_score else None,
                "maturity_index": float(a.maturity_index) if a.maturity_index else None,
                "wacc": a.valuation_result.get("wacc") if a.valuation_result else None,
                "growth_rate": a.valuation_result.get("parameters", {}).get("growth_rate") if a.valuation_result else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "label": a.created_at.strftime("%b/%Y") if a.created_at else "",
            }
            for a in analyses
        ],
        "count": len(analyses),
    }


# ─── M&A Comparables (Valuation H) ───────────────────────

@router.get("/{analysis_id}/ma-comparables")
async def get_analysis_ma_comparables(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get M&A comparable transactions for a company's sector — AI-powered."""
    analysis = (await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    cache_key = f"qv:ma_comparables:{analysis.sector}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    revenue = float(analysis.revenue) if analysis.revenue else 0
    data = await get_ma_comparables(sector=analysis.sector or "tecnologia", revenue=revenue)
    if not data:
        raise HTTPException(status_code=503, detail="Não foi possível obter comparáveis de M&A no momento.")

    # Cache for 7 days
    await cache_set(cache_key, data, ttl=604800)
    return data


# ─── Inverse Projection (F6) ──────────────────────────────

@router.post("/inverse-projection")
async def inverse_projection(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Given an analysis and a target equity value, find the revenue growth rate
    and/or net margin needed to reach that target.  Binary-search over the
    driving variable while holding all other parameters constant.
    """
    analysis_id = payload.get("analysis_id")
    target_equity = float(payload.get("target_equity", 0))
    variable = payload.get("variable", "growth_rate")  # growth_rate | net_margin
    lo = float(payload.get("range_min", 0.0))
    hi = float(payload.get("range_max", 1.5))

    if not analysis_id or target_equity <= 0:
        raise HTTPException(status_code=422, detail="analysis_id e target_equity são obrigatórios.")

    analysis = (await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
            Analysis.status == AnalysisStatus.COMPLETED,
        )
    )).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada ou não concluída.")

    vr = analysis.valuation_result or {}
    params = vr.get("parameters", {})

    from app.core.valuation_engine import run_valuation_with_ibge

    async def _value_at(x: float) -> float:
        """Run valuation with variable set to x; return equity value."""
        overrides = dict(params)
        overrides[variable] = x
        result = await run_valuation_with_ibge(
            revenue=overrides.get("revenue", float(analysis.revenue or 0)),
            net_margin=overrides.get("net_margin", float(analysis.net_margin or 0)),
            growth_rate=overrides.get("growth_rate", float(analysis.growth_rate or 0)),
            sector=analysis.sector or "servicos",
            years_in_business=int(overrides.get("years_in_business", analysis.years_in_business or 5)),
            projected_years=int(overrides.get("projection_years", 10)),
            qualitative_answers=analysis.qualitative_answers or {},
            debt=float(overrides.get("debt", 0)),
        )
        return float(result.get("equity_value_final") or result.get("equity_value", 0))

    # Binary search — max 20 iterations, ~0.1% precision
    results = []
    for _ in range(20):
        mid = (lo + hi) / 2
        val = await _value_at(mid)
        results.append({"x": round(mid * 100, 2), "equity": round(val, 0)})
        if abs(val - target_equity) / max(target_equity, 1) < 0.001:
            break
        if val < target_equity:
            lo = mid
        else:
            hi = mid

    solution_x = results[-1]["x"] if results else None
    solution_val = results[-1]["equity"] if results else None

    # Build a small curve for charting: 10 evenly spaced points between range
    curve = []
    range_lo = float(payload.get("range_min", 0.0))
    range_hi = float(payload.get("range_max", 1.5))
    step = (range_hi - range_lo) / 9
    for i in range(10):
        x = range_lo + step * i
        v = await _value_at(x)
        curve.append({"x": round(x * 100, 1), "equity": round(v, 0)})

    label = "Taxa de Crescimento" if variable == "growth_rate" else "Margem Líquida"
    return {
        "variable": variable,
        "variable_label": label,
        "target_equity": target_equity,
        "solution_x_pct": solution_x,
        "solution_equity": solution_val,
        "curve": curve,
        "current_x_pct": round(float(params.get(variable, 0)) * 100, 2),
        "current_equity": float(analysis.equity_value or 0),
    }
