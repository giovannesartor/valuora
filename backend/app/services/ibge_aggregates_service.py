"""
Quanto Vale — IBGE Aggregates Service (SIDRA)
IBGE Aggregate Data v3 API integration service.
https://servicodados.ibge.gov.br/api/v3/agregados

Correct URL format (v3):
  /agregados/{table}/periodos/{periodos}/variaveis/{variavel}?localidades=N1[all]
  &classificacao=C12762[{ibge_category_id}]

Tables in use:
  9418  — CEMPRE (number of companies by section/division/group/class CNAE 2.0)
  1842  — PIA Industry (value structure, employed persons)
  6784  — GDP by activity (gross value added)

Fallback: DeepSeek AI when IBGE data is unavailable.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import httpx
from datetime import datetime, timezone

from app.core.cache import (
    cache_get, cache_set, sidra_key,
    CACHE_TTL_SIDRA,
)
from app.utils.normalizers import (
    safe_float, safe_int,
    calculate_growth_rate, calculate_volatility,
    cnae_to_division, cnae_to_group,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://servicodados.ibge.gov.br/api/v3/agregados"
TIMEOUT = 8.0
MAX_RETRIES = 1  # SIDRA returns HTTP 500 when down — no point retrying; fallback to DeepSeek AI

# ─── SIDRA tables in use ────────────────────────────────
# Central Registry of Companies — covers ALL sectors CNAE
TABELA_CEMPRE = "9418"

# Annual Industrial Survey — industry only (CNAE section C)
TABELA_PIA_EMPRESAS = "1842"

# GDP by economic activity (National Accounts)
TABELA_PIB_SETORIAL = "6784"

# ─── Variables per table ────────────────────────────────
# CEMPRE (9418)
VAR_CEMPRE_EMPRESAS   = "2585"   # Number of companies and other organizations
VAR_CEMPRE_PESSOAL    = "707"    # Total employed persons
VAR_CEMPRE_SALARIOS   = "662"    # Salaries and other compensation

# PIA (1842)
VAR_PIA_EMPRESAS      = "630"    # Number of industrial companies
VAR_PIA_PESSOAL       = "810"    # Total employed persons (industrial)

# PIB (6784)
VAR_PIB_VALOR_ADICIONADO = "93"  # Gross value added at basic prices

# ─── CNAE → IBGE category ID mapping cache ──────────────
# { table_id : { cnae_code_string: ibge_internal_category_id } }
_cnae_category_cache: Dict[str, Dict[str, str]] = {}


async def _sidra_request(url: str, retries: int = MAX_RETRIES) -> Optional[Any]:
    """Makes request to SIDRA with retry and exponential backoff."""
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            logger.warning(f"[SIDRA] Timeout attempt {attempt + 1}/{retries} — {url}")
        except httpx.HTTPStatusError as e:
            logger.error(f"[SIDRA] HTTP {e.response.status_code} — {url}")
            if e.response.status_code == 404:
                return None
            if e.response.status_code < 500:
                return None
            # 5xx: SIDRA server is broken — return None immediately, do NOT retry.
            # Retrying 500s just wastes time; the fallback chain (DeepSeek AI) is faster.
            return None
        except Exception as e:
            logger.error(f"[SIDRA] Unexpected error: {e}")

        if attempt < retries - 1:
            await asyncio.sleep(2 ** attempt)

    logger.error(f"[SIDRA] Failed after {retries} attempts — {url}")
    return None


def _build_sidra_url(
    table: str,
    variavel: str,
    periodos: str = "last5",
    localidade: str = "N1%5Ball%5D",  # N1[all] encoded
    classificacao: Optional[str] = None,
) -> str:
    """Build correct SIDRA v3 URL.

    Format: /agregados/{table}/periodos/{periodos}/variaveis/{variavel}
            ?localidades={localidade}[&classificacao=C12762[{cat_id}]]
    """
    url = f"{BASE_URL}/{table}/periodos/{periodos}/variaveis/{variavel}"
    params = [f"localidades={localidade}"]
    if classificacao:
        params.append(f"classificacao={classificacao}")
    return url + "?" + "&".join(params)


def _parse_sidra_v3_series(data: Any) -> Dict[int, float]:
    """Extract {year: value} series from SIDRA v3 response.

    Expected format:
    [ { "id": "...", "resultados": [
          { "series": [ { "serie": { "2022": "9431239", "2023": "..." } } ] }
    ] } ]
    """
    series: Dict[int, float] = {}
    if not isinstance(data, list):
        return series
    for var_entry in data:
        if not isinstance(var_entry, dict):
            continue
        for resultado in var_entry.get("resultados", []):
            for loc_series in resultado.get("series", []):
                for year_str, value_str in loc_series.get("serie", {}).items():
                    year = safe_int(year_str)
                    value = safe_float(value_str)
                    if year and value and value > 0:
                        # Sum if same year from different localities
                        series[year] = series.get(year, 0.0) + value
    return series


async def _get_cnae_category_id(table: str, cnae_code: str) -> Optional[str]:
    """Map CNAE code to IBGE internal category ID.

    Builds the map from aggregate metadata (lazy + cached).
    """
    if table not in _cnae_category_cache:
        meta_url = f"{BASE_URL}/{table}/metadados"
        data = await _sidra_request(meta_url)
        mapping: Dict[str, str] = {}
        if isinstance(data, dict):
            for classif in data.get("classificacoes", []):
                if str(classif.get("id")) == "12762":  # CNAE 2.0
                    for cat in classif.get("categorias", []):
                        nome = cat.get("nome", "").strip()
                        parts = nome.split(" ", 1)
                        cnae_key = parts[0].strip()
                        if cnae_key:
                            mapping[cnae_key] = str(cat.get("id", ""))
        _cnae_category_cache[table] = mapping

    mapping = _cnae_category_cache.get(table, {})
    clean = cnae_code.replace(".", "").replace("-", "").replace("/", "")
    # Try various representations
    for fmt in [cnae_code, clean, clean[:5], clean[:4], clean[:3], clean[:2]]:
        if fmt in mapping:
            return mapping[fmt]
    return None


async def _fetch_with_fallback(
    cnae_code: str,
    table: str,
    variavel: str,
    periodos: str = "last5",
) -> Optional[Dict[int, float]]:
    """Fetch SIDRA v3 data with CNAE hierarchical fallback.

    Tries: full code → group (3 digits) → division (2 digits).
    Returns {year: value} or None — never uses national total as substitute.
    """
    clean = cnae_code.replace(".", "").replace("-", "").replace("/", "")

    # Candidates for hierarchical fallback
    candidates = [cnae_code, clean]
    grupo = cnae_to_group(cnae_code)       # first 3 digits
    divisao = cnae_to_division(cnae_code)  # first 2 digits
    if grupo not in candidates:
        candidates.append(grupo)
    if divisao not in candidates:
        candidates.append(divisao)

    for candidate in candidates:
        cat_id = await _get_cnae_category_id(table, candidate)
        if cat_id:
            classificacao = f"C12762%5B{cat_id}%5D"  # C12762[cat_id]
            url = _build_sidra_url(table, variavel, periodos=periodos, classificacao=classificacao)
            data = await _sidra_request(url)
            if data:
                series = _parse_sidra_v3_series(data)
                if series:
                    logger.info(f"[SIDRA] Data found — table {table}, CNAE '{candidate}'")
                    return series

    # No hierarchical level returned real sector data — return None.
    # We don't use national totals as a substitute for sector data.
    logger.info(f"[SIDRA] No sector data for CNAE '{cnae_code}' in table {table}")
    return None


# ─── Public Functions ────────────────────────────────────

async def fetch_sector_company_count(cnae_code: str) -> Optional[Dict[str, Any]]:
    """Fetch number of active companies in a CNAE sector.

    Uses CEMPRE table (9418) — covers all sectors.
    """
    key = sidra_key(f"companies:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    series = await _fetch_with_fallback(
        cnae_code=cnae_code,
        table=TABELA_CEMPRE,
        variavel=VAR_CEMPRE_EMPRESAS,
        periodos="last5",
    )

    if not series:
        logger.info(f"[SIDRA] No company data for CNAE {cnae_code}")
        return None

    result = {
        "cnae_code": cnae_code,
        "series": series,
        "latest_count": series.get(max(series)) if series else None,
        "latest_year": max(series) if series else None,
    }

    await cache_set(key, result, CACHE_TTL_SIDRA)
    return result


async def fetch_sector_wages(cnae_code: str) -> Optional[Dict[str, Any]]:
    """Fetch sector salaries and compensation (revenue proxy).

    Uses CEMPRE table (9418) — salaries variable.
    """
    key = sidra_key(f"wages:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    series = await _fetch_with_fallback(
        cnae_code=cnae_code,
        table=TABELA_CEMPRE,
        variavel=VAR_CEMPRE_SALARIOS,
        periodos="last5",
    )

    if not series:
        return None

    values = [series[y] for y in sorted(series)]
    result = {
        "cnae_code": cnae_code,
        "series": series,
        "latest_wages": values[-1] if values else None,
        "growth_rate": calculate_growth_rate(values),
    }

    await cache_set(key, result, CACHE_TTL_SIDRA)
    return result


async def fetch_sector_revenue_average(cnae_code: str) -> Optional[Dict[str, Any]]:
    """Fetch sector salary/revenue indicators.

    Tries CEMPRE (all sectors), then PIA (industry only).
    """
    key = sidra_key(f"revenue:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    # First try CEMPRE (covers all sectors)
    series = await _fetch_with_fallback(
        cnae_code=cnae_code,
        table=TABELA_CEMPRE,
        variavel=VAR_CEMPRE_SALARIOS,
        periodos="last5",
    )

    if not series:
        # Fallback PIA for industrial sector
        series = await _fetch_with_fallback(
            cnae_code=cnae_code,
            table=TABELA_PIA_EMPRESAS,
            variavel=VAR_PIA_EMPRESAS,
            periodos="last5",
        )

    if not series:
        return None

    values = [series[y] for y in sorted(series)]
    result = {
        "cnae_code": cnae_code,
        "series": series,
        "latest_revenue": values[-1] if values else None,
        "average_revenue": sum(values) / len(values) if values else None,
        "growth_rate": calculate_growth_rate(values),
    }

    await cache_set(key, result, CACHE_TTL_SIDRA)
    return result


async def fetch_sector_growth(cnae_code: str) -> Optional[Dict[str, Any]]:
    """Calculate historical growth for a sector from the number of companies."""
    key = sidra_key(f"growth:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    series = await _fetch_with_fallback(
        cnae_code=cnae_code,
        table=TABELA_CEMPRE,
        variavel=VAR_CEMPRE_EMPRESAS,
        periodos="last5",
    )

    if not series:
        return None

    sorted_years = sorted(series.keys())
    values = [series[y] for y in sorted_years]

    annual_growths = []
    for i in range(1, len(values)):
        if values[i - 1] > 0:
            g = (values[i] - values[i - 1]) / values[i - 1]
            annual_growths.append(round(g, 4))

    result = {
        "cnae_code": cnae_code,
        "cagr": calculate_growth_rate(values),
        "annual_growths": annual_growths,
        "volatility": calculate_volatility(values),
        "years": sorted_years,
        "latest_growth": annual_growths[-1] if annual_growths else None,
    }

    await cache_set(key, result, CACHE_TTL_SIDRA)
    return result


async def fetch_sector_value_added(cnae_code: str) -> Optional[Dict[str, Any]]:
    """Fetch sector Gross Value Added (GVA) from national GDP.

    The SIDRA table 6784 uses IBGE's own sector classification (does not map
    directly to CNAE 2.0 without an explicit section-by-section manual mapping).

    Returns None until the CNAE → GDP-IBGE category mapping is implemented.
    This way we don't store Brazil's total GDP as if it were sector data.
    """
    return None


async def fetch_sector_historical_data(
    cnae_code: str,
    years: int = 5,
) -> Dict[str, Any]:
    """Consolidate historical sector data from multiple sources.

    Returns complete package:
    - Number of companies
    - Salary/revenue data
    - Growth
    - GDP value added
    """
    key = sidra_key(f"historical:{cnae_code}:{years}")
    cache = await cache_get(key)
    if cache:
        return cache

    companies, revenue, growth, vab = await asyncio.gather(
        fetch_sector_company_count(cnae_code),
        fetch_sector_revenue_average(cnae_code),
        fetch_sector_growth(cnae_code),
        fetch_sector_value_added(cnae_code),
        return_exceptions=True,
    )

    if isinstance(companies, Exception):
        logger.error(f"[SIDRA] Companies error: {companies}")
        companies = None
    if isinstance(revenue, Exception):
        logger.error(f"[SIDRA] Revenue error: {revenue}")
        revenue = None
    if isinstance(growth, Exception):
        logger.error(f"[SIDRA] Growth error: {growth}")
        growth = None
    if isinstance(vab, Exception):
        logger.error(f"[SIDRA] VAB error: {vab}")
        vab = None

    result = {
        "cnae_code": cnae_code,
        "companies": companies,
        "revenue": revenue,
        "growth": growth,
        "value_added": vab,
        "has_data": any([companies, revenue, growth, vab]),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }

    if result["has_data"]:
        await cache_set(key, result, CACHE_TTL_SIDRA)

    return result


async def get_aggregates_list() -> Optional[List[Dict[str, Any]]]:
    """Get list of all available IBGE aggregates."""
    key = sidra_key("aggregates:list")
    cache = await cache_get(key)
    if cache:
        return cache

    data = await _sidra_request(BASE_URL)
    if not data:
        return None

    results = []
    if isinstance(data, list):
        for pesquisa in data:
            nome = pesquisa.get("nome", "")
            for ag in pesquisa.get("agregados", []):
                results.append({
                    "id": ag.get("id"),
                    "nome": ag.get("nome"),
                    "pesquisa": nome,
                })

    await cache_set(key, results, CACHE_TTL_SIDRA)
    return results
