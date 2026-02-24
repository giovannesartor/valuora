"""
Quanto Vale — Benchmark API Routes
Endpoints para benchmarks setoriais e dados IBGE/SIDRA.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.cache import cache_get, cache_set, CACHE_TTL_BENCHMARK
from app.services.sector_analysis_service import (
    get_dcf_sector_adjustment,
    calculate_sector_risk_score,
    get_sector_benchmark_position,
    get_sector_summary,
    _sector_to_cnae,
)
from app.services.ibge_aggregates_service import (
    fetch_sector_historical_data,
    fetch_sector_growth,
    fetch_sector_company_count,
)
from app.tasks.benchmark_updater import update_all_benchmarks, update_single_benchmark
from app.schemas.cnae_schema import (
    DCFSectorAdjustment,
    SectorRiskDetail,
    SectorBenchmarkSummary,
)
from app.services.auth_service import get_current_user
from app.models.models import User

router = APIRouter(prefix="/benchmarks", tags=["Benchmarks Setoriais"])


@router.get("/sector/{cnae_code}", response_model=SectorBenchmarkSummary, summary="Resumo setorial")
async def get_sector_benchmark(cnae_code: str):
    """Retorna resumo consolidado de um setor por código CNAE. Cached 12h."""
    cache_key = f"qv:bench:sector:{cnae_code}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        summary = await get_sector_summary(cnae_code)
        await cache_set(cache_key, summary.model_dump(), ttl=CACHE_TTL_BENCHMARK)
        return summary
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar dados setoriais: {str(e)}")


@router.get("/sector-by-name/{sector_name}", response_model=SectorBenchmarkSummary, summary="Resumo por nome do setor")
async def get_sector_by_name(sector_name: str):
    """Retorna resumo setorial pelo nome do setor (ex: 'tecnologia', 'saude'). Cached 12h."""
    cnae_code = _sector_to_cnae(sector_name)
    cache_key = f"qv:bench:sector-name:{sector_name}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        summary = await get_sector_summary(cnae_code)
        summary.sector_name = sector_name
        await cache_set(cache_key, summary.model_dump(), ttl=CACHE_TTL_BENCHMARK)
        return summary
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar dados setoriais: {str(e)}")


@router.get("/risk/{cnae_code}", response_model=SectorRiskDetail, summary="Score de risco setorial")
async def get_risk_score(cnae_code: str):
    """Calcula e retorna score de risco setorial (0-100) baseado no IBGE."""
    try:
        risk = await calculate_sector_risk_score(cnae_code)
        return risk
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao calcular risco: {str(e)}")


@router.get("/dcf-adjustment/{cnae_code}", response_model=DCFSectorAdjustment, summary="Ajuste DCF")
async def get_dcf_adjustment(
    cnae_code: str,
    company_revenue: float = Query(default=None, description="Receita da empresa"),
    company_growth: float = Query(default=None, description="Crescimento da empresa"),
):
    """Retorna ajuste setorial para o motor DCF com dados IBGE. Cached 12h."""
    cache_key = f"qv:bench:dcf:{cnae_code}:{company_revenue}:{company_growth}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        adjustment = await get_dcf_sector_adjustment(
            cnae_code=cnae_code,
            company_revenue=company_revenue,
            company_growth=company_growth,
        )
        await cache_set(cache_key, adjustment.model_dump(), ttl=CACHE_TTL_BENCHMARK)
        return adjustment
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao calcular ajuste DCF: {str(e)}")


@router.get("/historical/{cnae_code}", summary="Dados históricos setoriais")
async def get_historical_data(cnae_code: str):
    """Retorna dados históricos consolidados de um setor (empresas, receita, crescimento, VAB)."""
    try:
        data = await fetch_sector_historical_data(cnae_code)
        return data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar histórico: {str(e)}")


@router.get("/growth/{cnae_code}", summary="Crescimento setorial")
async def get_growth(cnae_code: str):
    """Retorna dados de crescimento histórico de um setor."""
    data = await fetch_sector_growth(cnae_code)
    if not data:
        raise HTTPException(status_code=404, detail="Dados de crescimento não encontrados.")
    return data


@router.get("/companies/{cnae_code}", summary="Número de empresas")
async def get_companies_count(cnae_code: str):
    """Retorna número de empresas ativas em um setor."""
    data = await fetch_sector_company_count(cnae_code)
    if not data:
        raise HTTPException(status_code=404, detail="Dados de empresas não encontrados.")
    return data


@router.get("/position", summary="Posição de benchmark")
async def get_benchmark_position(
    cnae_code: str = Query(...),
    revenue: float = Query(..., description="Receita da empresa"),
):
    """Compara empresa com benchmark setorial (acima, na_media, abaixo)."""
    try:
        result = await get_sector_benchmark_position(revenue, cnae_code)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro: {str(e)}")


# ─── Admin: Atualização manual ───────────────────────────

@router.post("/update-all", summary="[Admin] Atualizar todos os benchmarks")
async def trigger_benchmark_update(
    current_user: User = Depends(get_current_user),
):
    """Dispara atualização manual de todos os benchmarks. Requer admin."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    report = await update_all_benchmarks()
    return report


@router.post("/update/{cnae_code}", summary="[Admin] Atualizar benchmark específico")
async def trigger_single_update(
    cnae_code: str,
    current_user: User = Depends(get_current_user),
):
    """Atualiza benchmark de um setor específico. Requer admin."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso negado.")
    result = await update_single_benchmark(cnae_code)
    return result
