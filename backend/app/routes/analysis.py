import uuid
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path as FilePath
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, BackgroundTasks, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.valuation_engine.engine import run_valuation, run_valuation_with_ibge
from app.core.valuation_engine.sectors import get_sector_list
from app.services.sector_analysis_service import (
    get_dcf_sector_adjustment, _sector_to_cnae,
)
from app.services.deepseek_service import (
    extract_financial_data, generate_strategic_analysis, estimate_sector_data_with_ai,
)
from app.models.models import (
    User, Analysis, AnalysisVersion, SimulationLog,
    AnalysisStatus, PlanType, Report,
)
from app.schemas.analysis import (
    AnalysisCreate, AnalysisResponse, AnalysisListResponse,
    SimulationRequest, SimulationResponse,
    PaginatedAnalysesResponse,
)
from app.schemas.auth import MessageResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/analyses", tags=["Análises"])

ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"}
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2MB


async def _save_logo(logo: UploadFile, analysis_id: uuid.UUID) -> str:
    """Save logo file and return relative path."""
    if logo.content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(status_code=400, detail="Formato de logo não suportado. Use PNG, JPG, SVG ou WebP.")
    content = await logo.read()
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=400, detail="Logo deve ter no máximo 2MB.")
    ext = logo.filename.rsplit(".", 1)[-1].lower() if logo.filename else "png"
    logo_dir = FilePath(settings.UPLOADS_DIR) / "logos"
    logo_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{analysis_id}.{ext}"
    filepath = logo_dir / filename
    with open(filepath, "wb") as f:
        f.write(content)
    return f"logos/{filename}"


@router.post("/", response_model=AnalysisResponse)
async def create_analysis(
    data: AnalysisCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = Analysis(
        user_id=current_user.id,
        company_name=data.company_name,
        sector=data.sector,
        cnpj=data.cnpj,
        revenue=max(0, data.revenue),  # Block negative revenue
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
    except Exception:
        # IBGE falhou → tentar DeepSeek como fallback
        try:
            cnae_code = _sector_to_cnae(data.sector)
            ai_sector = await estimate_sector_data_with_ai(data.sector, cnae_code)
            if ai_sector:
                ibge_adj = ai_sector
        except Exception:
            pass  # Fallback final: Damodaran estático

    # Run valuation with IBGE data if available
    _v3_kwargs = dict(
        years_in_business=data.years_in_business,
        ebitda=float(data.ebitda) if data.ebitda else None,
        recurring_revenue_pct=data.recurring_revenue_pct,
        num_employees=data.num_employees,
        previous_investment=float(data.previous_investment),
        qualitative_answers=data.qualitative_answers,
        dcf_weight=data.dcf_weight,
        custom_exit_multiple=data.custom_exit_multiple,
    )
    if ibge_adj:
        result = run_valuation_with_ibge(
            revenue=float(data.revenue),
            net_margin=data.net_margin,
            sector=data.sector,
            ibge_adjustment=ibge_adj,
            growth_rate=data.growth_rate,
            debt=float(data.debt),
            cash=float(data.cash),
            founder_dependency=data.founder_dependency,
            projection_years=data.projection_years,
            **_v3_kwargs,
        )
    else:
        result = run_valuation(
            revenue=float(data.revenue),
            net_margin=data.net_margin,
            sector=data.sector,
            growth_rate=data.growth_rate,
            debt=float(data.debt),
            cash=float(data.cash),
            founder_dependency=data.founder_dependency,
            projection_years=data.projection_years,
            **_v3_kwargs,
        )

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
    return analysis


@router.post("/upload", response_model=AnalysisResponse)
async def create_analysis_from_upload(
    company_name: str = Form(...),
    sector: str = Form(...),
    cnpj: str = Form(""),
    founder_dependency: float = Form(0.0),
    projection_years: int = Form(5),
    qualitative_answers: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    logo: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria análise a partir de upload de DRE/Balanço (PDF ou Excel). Aceita múltiplos arquivos."""
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

    # Process all files and merge extracted data
    all_extracted = {}
    uploaded_filenames = []
    for file in files:
        ext = file.filename.split(".")[-1].lower() if file.filename else ""
        if ext not in ("pdf", "xlsx", "xls"):
            raise HTTPException(status_code=400, detail=f"Formato não suportado: {file.filename}. Envie PDF ou Excel.")
        content = await file.read()
        extracted = await extract_financial_data(content, ext)
        if "error" not in extracted:
            # Merge: later files override, but keep the best values
            for k, v in extracted.items():
                if v and (k not in all_extracted or not all_extracted[k]):
                    all_extracted[k] = v
                elif v and k in all_extracted and isinstance(v, (int, float)) and v > 0:
                    all_extracted[k] = v  # Prefer non-zero values
        uploaded_filenames.append(file.filename)

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
    if not (0 < net_margin < 1):
        # Se veio como porcentagem (ex: 15 ao invés de 0.15)
        if 1 <= net_margin <= 100:
            net_margin = net_margin / 100
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
    except Exception:
        # IBGE falhou → tentar DeepSeek como fallback
        try:
            cnae_code = _sector_to_cnae(sector)
            ai_sector = await estimate_sector_data_with_ai(sector, cnae_code)
            if ai_sector:
                ibge_adj = ai_sector
        except Exception:
            pass  # Fallback final: Damodaran estático

    _v3_kwargs = dict(
        qualitative_answers=qual_answers,
    )
    if ibge_adj:
        result = run_valuation_with_ibge(
            revenue=float(revenue),
            net_margin=float(net_margin),
            sector=sector,
            ibge_adjustment=ibge_adj,
            growth_rate=float(growth_rate),
            debt=float(debt),
            cash=float(cash),
            founder_dependency=founder_dep,
            projection_years=projection_years,
            **_v3_kwargs,
        )
    else:
        result = run_valuation(
            revenue=float(revenue),
            net_margin=float(net_margin),
            sector=sector,
            growth_rate=float(growth_rate),
            debt=float(debt),
            cash=float(cash),
            founder_dependency=founder_dep,
            projection_years=projection_years,
            **_v3_kwargs,
        )

    # Fix #12: AI recebe resultado do valuation para análise mais rica
    ai_text = await generate_strategic_analysis(extracted, valuation_result=result)

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
        except Exception:
            pass  # logo is best-effort

    version = AnalysisVersion(
        analysis_id=analysis.id,
        version_number=1,
        valuation_result=result,
        equity_value=result["equity_value"],
    )
    db.add(version)

    await db.commit()
    await db.refresh(analysis)
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
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort: str = Query("date_desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base = select(Analysis).where(Analysis.user_id == current_user.id, Analysis.deleted_at.is_(None))
    if search:
        base = base.where(Analysis.company_name.ilike(f"%{search}%"))
    if status and status != "all":
        base = base.where(Analysis.status == status)

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
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    return analysis


# ─── Simulator ───────────────────────────────────────────

@router.post("/simulate", response_model=SimulationResponse)
async def simulate(
    data: SimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Simulador interativo — recalcula valuation com parâmetros ajustados."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == data.analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    sim_result = run_valuation(
        revenue=float(analysis.revenue),
        net_margin=float(analysis.net_margin),
        sector=analysis.sector,
        growth_rate=float(analysis.growth_rate or 0.10),
        debt=float(analysis.debt),
        cash=float(analysis.cash),
        founder_dependency=data.founder_dependency if data.founder_dependency is not None else analysis.founder_dependency,
        custom_growth=data.growth_rate,
        custom_margin=data.net_margin,
        custom_wacc=data.discount_rate,
    )

    params = {
        "growth_rate": data.growth_rate,
        "net_margin": data.net_margin,
        "discount_rate": data.discount_rate,
        "founder_dependency": data.founder_dependency,
    }

    log = SimulationLog(
        analysis_id=analysis.id,
        parameters=params,
        result=sim_result,
        equity_value=sim_result["equity_value"],
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


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


# ─── PDF Download ─────────────────────────────────────────

@router.get("/{analysis_id}/pdf")
async def download_analysis_pdf(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download do relatório PDF de uma análise paga."""
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    if analysis.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Sem permissão.")
    if not analysis.plan:
        raise HTTPException(status_code=402, detail="Relatório requer plano pago.")

    # Find the latest report for this analysis
    report_result = await db.execute(
        select(Report)
        .where(Report.analysis_id == analysis_id)
        .order_by(Report.created_at.desc())
    )
    report = report_result.scalar_one_or_none()

    if not report or not report.file_path or not os.path.exists(report.file_path):
        # Generate PDF on-demand if not found
        from app.services.pdf_service import generate_report_pdf
        import asyncio
        pdf_path = await asyncio.to_thread(generate_report_pdf, analysis)
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=f"relatorio-quantovale-{analysis.company_name}.pdf",
        )

    report.download_count += 1
    await db.commit()

    return FileResponse(
        report.file_path,
        media_type="application/pdf",
        filename=f"relatorio-quantovale-{analysis.company_name}.pdf",
    )
