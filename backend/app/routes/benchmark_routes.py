"""
Quanto Vale — Benchmark API Routes
Endpoints for sector benchmarks and IBGE/SIDRA data.
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

router = APIRouter(prefix="/benchmarks", tags=["Sector Benchmarks"])


@router.get("/sector/{cnae_code}", response_model=SectorBenchmarkSummary, summary="Sector Summary")
async def get_sector_benchmark(cnae_code: str):
    """Returns consolidated sector summary by CNAE code. Cached 12h."""
    cache_key = f"qv:bench:sector:{cnae_code}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        summary = await get_sector_summary(cnae_code)
        await cache_set(cache_key, summary.model_dump(), ttl=CACHE_TTL_BENCHMARK)
        return summary
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error querying sector data: {str(e)}")


@router.get("/sector-by-name/{sector_name}", response_model=SectorBenchmarkSummary, summary="Summary by sector name")
async def get_sector_by_name(sector_name: str):
    """Returns sector summary by sector name (ex: 'tecnologia', 'saude'). Cached 12h."""
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
        raise HTTPException(status_code=502, detail=f"Error querying sector data: {str(e)}")


@router.get("/risk/{cnae_code}", response_model=SectorRiskDetail, summary="Sector Risk Score")
async def get_risk_score(cnae_code: str):
    """Calculates and returns sector risk score (0-100) based on IBGE data. Cached 12h."""
    cache_key = f"qv:bench:risk:{cnae_code}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        risk = await calculate_sector_risk_score(cnae_code)
        await cache_set(cache_key, risk.model_dump(), ttl=CACHE_TTL_BENCHMARK)
        return risk
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error calculating risk: {str(e)}")


@router.get("/dcf-adjustment/{cnae_code}", response_model=DCFSectorAdjustment, summary="DCF Adjustment")
async def get_dcf_adjustment(
    cnae_code: str,
    company_revenue: float = Query(default=None, description="Company revenue"),
    company_growth: float = Query(default=None, description="Company growth"),
):
    """Returns sector adjustment for the DCF engine with IBGE data. Cached 12h."""
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
        raise HTTPException(status_code=502, detail=f"Error calculating DCF adjustment: {str(e)}")


@router.get("/historical/{cnae_code}", summary="Sector Historical Data")
async def get_historical_data(cnae_code: str):
    """Returns consolidated historical sector data. Cached 12h."""
    cache_key = f"qv:bench:historical:{cnae_code}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        data = await fetch_sector_historical_data(cnae_code)
        await cache_set(cache_key, data, ttl=CACHE_TTL_BENCHMARK)
        return data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error fetching history: {str(e)}")


@router.get("/growth/{cnae_code}", summary="Sector Growth")
async def get_growth(cnae_code: str):
    """Returns historical growth data for a sector. Cached 12h."""
    cache_key = f"qv:bench:growth:{cnae_code}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    data = await fetch_sector_growth(cnae_code)
    if not data:
        raise HTTPException(status_code=404, detail="Growth data not found.")
    await cache_set(cache_key, data, ttl=CACHE_TTL_BENCHMARK)
    return data


@router.get("/companies/{cnae_code}", summary="Number of companies")
async def get_companies_count(cnae_code: str):
    """Returns number of active companies in a sector. Cached 12h."""
    cache_key = f"qv:bench:companies:{cnae_code}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    data = await fetch_sector_company_count(cnae_code)
    if not data:
        raise HTTPException(status_code=404, detail="Company data not found.")
    await cache_set(cache_key, data, ttl=CACHE_TTL_BENCHMARK)
    return data


@router.get("/position", summary="Benchmark position")
async def get_benchmark_position(
    cnae_code: str = Query(...),
    revenue: float = Query(..., description="Company revenue"),
):
    """Compares company with sector benchmark (above, average, below). Cached 12h."""
    cache_key = f"qv:bench:position:{cnae_code}:{int(revenue)}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    try:
        result = await get_sector_benchmark_position(revenue, cnae_code)
        await cache_set(cache_key, result, ttl=CACHE_TTL_BENCHMARK)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error: {str(e)}")


# ─── Admin: Manual update ───────────────────────────

@router.post("/update-all", summary="[Admin] Update all benchmarks")
async def trigger_benchmark_update(
    current_user: User = Depends(get_current_user),
):
    """Triggers manual update of all benchmarks. Requires admin."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied.")
    report = await update_all_benchmarks()
    return report


@router.post("/update/{cnae_code}", summary="[Admin] Update specific benchmark")
async def trigger_single_update(
    cnae_code: str,
    current_user: User = Depends(get_current_user),
):
    """Updates benchmark for a specific sector. Requires admin."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied.")
    result = await update_single_benchmark(cnae_code)
    return result
