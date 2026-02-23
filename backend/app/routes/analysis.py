import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, BackgroundTasks, UploadFile, File, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.valuation_engine.engine import run_valuation, run_valuation_with_ibge
from app.services.sector_analysis_service import (
    get_dcf_sector_adjustment, _sector_to_cnae,
)
from app.models.models import (
    User, Analysis, AnalysisVersion, SimulationLog,
    AnalysisStatus, PlanType,
)
from app.schemas.analysis import (
    AnalysisCreate, AnalysisResponse, AnalysisListResponse,
    SimulationRequest, SimulationResponse,
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
        revenue=data.revenue,
        net_margin=data.net_margin,
        growth_rate=data.growth_rate,
        debt=data.debt,
        cash=data.cash,
        founder_dependency=data.founder_dependency,
        status=AnalysisStatus.PROCESSING,
    )
    db.add(analysis)
    await db.flush()

    # Fetch IBGE sector adjustment (non-blocking, with fallback)
    ibge_adj = None
    try:
        cnae_code = data.cnpj[:5] if data.cnpj and len(data.cnpj) >= 5 else _sector_to_cnae(data.sector)
        adjustment = await get_dcf_sector_adjustment(
            cnae_code=cnae_code,
            company_revenue=float(data.revenue),
            company_growth=data.growth_rate,
        )
        ibge_adj = adjustment.model_dump()
    except Exception:
        pass  # Fallback to standard engine

    # Run valuation with IBGE data if available
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

    analysis = Analysis(
        user_id=current_user.id,
        company_name=company_name,
        sector=sector,
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

    # Run valuation
    result = run_valuation(
        revenue=float(revenue),
        net_margin=float(net_margin),
        sector=sector,
        growth_rate=float(growth_rate),
        debt=float(debt),
        cash=float(cash),
    )

    # Generate AI analysis
    ai_text = await generate_strategic_analysis(extracted)

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


@router.get("/", response_model=List[AnalysisListResponse])
async def list_analyses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Analysis)
        .where(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
    )
    return result.scalars().all()


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
