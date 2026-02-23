import uuid
import os
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, BackgroundTasks, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.valuation_engine.engine import run_valuation, run_valuation_with_ibge
from app.core.valuation_engine.sectors import get_sector_list
from app.services.sector_analysis_service import (
    get_dcf_sector_adjustment, _sector_to_cnae,
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
from app.services.deepseek_service import extract_financial_data, generate_strategic_analysis

router = APIRouter(prefix="/analyses", tags=["Análises"])


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

    # Fetch IBGE sector adjustment (non-blocking, with fallback)
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
        pass  # Fallback to standard engine

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
    company_name: str,
    sector: str,
    cnpj: str = "",
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria análise a partir de upload de DRE (PDF ou Excel)."""
    # Validate file type
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ("pdf", "xlsx", "xls"):
        raise HTTPException(status_code=400, detail="Formato não suportado. Envie PDF ou Excel.")

    content = await file.read()

    # Extract data using DeepSeek
    extracted = await extract_financial_data(content, ext)
    if "error" in extracted:
        raise HTTPException(status_code=422, detail=extracted["error"])

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
        founder_dependency=0.0,
        extracted_data=extracted,
        uploaded_files=[file.filename],
        status=AnalysisStatus.PROCESSING,
    )
    db.add(analysis)
    await db.flush()

    # Fix #5: Upload usa IBGE igual ao manual
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
        pass

    if ibge_adj:
        result = run_valuation_with_ibge(
            revenue=float(revenue),
            net_margin=float(net_margin),
            sector=sector,
            ibge_adjustment=ibge_adj,
            growth_rate=float(growth_rate),
            debt=float(debt),
            cash=float(cash),
        )
    else:
        result = run_valuation(
            revenue=float(revenue),
            net_margin=float(net_margin),
            sector=sector,
            growth_rate=float(growth_rate),
            debt=float(debt),
            cash=float(cash),
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
    base = select(Analysis).where(Analysis.user_id == current_user.id)
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
