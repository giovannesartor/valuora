"""
Quanto Vale — IBGE Aggregates Service (SIDRA)
Serviço de integração com a API de Dados Agregados v3 do IBGE.
https://servicodados.ibge.gov.br/api/v3/agregados

URL format correto (v3):
  /agregados/{tabela}/periodos/{periodos}/variaveis/{variavel}?localidades=N1[all]
  &classificacao=C12762[{ibge_category_id}]

Tabelas em uso:
  9418  — CEMPRE (número de empresas por seção/divisão/grupo/classe CNAE 2.0)
  1842  — PIA Indústria (estrutura de valor, pessoal ocupado)
  6784  — PIB por atividade (valor adicionado bruto)

Fallback: DeepSeek AI quando dados IBGE indisponíveis.
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
TIMEOUT = 10.0
MAX_RETRIES = 2

# ─── Tabelas SIDRA em uso ────────────────────────────────
# Cadastro Central de Empresas — cobre TODOS os setores CNAE
TABELA_CEMPRE = "9418"

# Pesquisa Industrial Anual — só indústria (CNAE seção C)
TABELA_PIA_EMPRESAS = "1842"

# PIB por atividade econômica (Contas Nacionais)
TABELA_PIB_SETORIAL = "6784"

# ─── Variáveis por tabela ────────────────────────────────
# CEMPRE (9418)
VAR_CEMPRE_EMPRESAS   = "2585"   # Número de empresas e outras organizações
VAR_CEMPRE_PESSOAL    = "707"    # Pessoal ocupado total
VAR_CEMPRE_SALARIOS   = "662"    # Salários e outras remunerações

# PIA (1842)
VAR_PIA_EMPRESAS      = "630"    # Número de empresas industriais
VAR_PIA_PESSOAL       = "810"    # Pessoal ocupado total (industrial)

# PIB (6784)
VAR_PIB_VALOR_ADICIONADO = "93"  # Valor adicionado bruto a preços básicos

# ─── Cache de mapeamento CNAE → ID de categoria IBGE ────
# { tabela_id : { cnae_code_string: ibge_internal_category_id } }
_cnae_category_cache: Dict[str, Dict[str, str]] = {}


async def _sidra_request(url: str, retries: int = MAX_RETRIES) -> Optional[Any]:
    """Faz requisição ao SIDRA com retry e backoff exponencial."""
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            logger.warning(f"[SIDRA] Timeout tentativa {attempt + 1}/{retries} — {url}")
        except httpx.HTTPStatusError as e:
            logger.error(f"[SIDRA] HTTP {e.response.status_code} — {url}")
            if e.response.status_code == 404:
                return None
            if e.response.status_code < 500:
                return None
            # 5xx: retry
        except Exception as e:
            logger.error(f"[SIDRA] Erro inesperado: {e}")

        if attempt < retries - 1:
            await asyncio.sleep(2 ** attempt)

    logger.error(f"[SIDRA] Falha após {retries} tentativas — {url}")
    return None


def _build_sidra_url(
    tabela: str,
    variavel: str,
    periodos: str = "last5",
    localidade: str = "N1%5Ball%5D",  # N1[all] encoded
    classificacao: Optional[str] = None,
) -> str:
    """Constrói URL SIDRA v3 correta.

    Formato: /agregados/{tabela}/periodos/{periodos}/variaveis/{variavel}
             ?localidades={localidade}[&classificacao=C12762[{cat_id}]]
    """
    url = f"{BASE_URL}/{tabela}/periodos/{periodos}/variaveis/{variavel}"
    params = [f"localidades={localidade}"]
    if classificacao:
        params.append(f"classificacao={classificacao}")
    return url + "?" + "&".join(params)


def _parse_sidra_v3_series(data: Any) -> Dict[int, float]:
    """Extrai série {ano: valor} de resposta SIDRA v3.

    Formato esperado:
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
                        # Soma se mesmo ano de diferentes localidades
                        series[year] = series.get(year, 0.0) + value
    return series


async def _get_cnae_category_id(tabela: str, cnae_code: str) -> Optional[str]:
    """Mapeia código CNAE para ID interno de categoria IBGE.

    Constrói o mapa via metadados do agregado (lazy + cached).
    """
    if tabela not in _cnae_category_cache:
        meta_url = f"{BASE_URL}/{tabela}/metadados"
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
        _cnae_category_cache[tabela] = mapping

    mapping = _cnae_category_cache.get(tabela, {})
    clean = cnae_code.replace(".", "").replace("-", "").replace("/", "")
    # Tentar diversas representações
    for fmt in [cnae_code, clean, clean[:5], clean[:4], clean[:3], clean[:2]]:
        if fmt in mapping:
            return mapping[fmt]
    return None


async def _fetch_with_fallback(
    cnae_code: str,
    tabela: str,
    variavel: str,
    periodos: str = "last5",
) -> Optional[Dict[int, float]]:
    """Busca dados SIDRA v3 com fallback hierárquico CNAE.

    Tenta: código completo → grupo (3 dígitos) → divisão (2 dígitos) → total nacional.
    Retorna {ano: valor} ou None.
    """
    clean = cnae_code.replace(".", "").replace("-", "").replace("/", "")

    # Candidatos para fallback hierárquico
    candidates = [cnae_code, clean]
    grupo = cnae_to_group(cnae_code)       # 3 primeiros dígitos
    divisao = cnae_to_division(cnae_code)  # 2 primeiros dígitos
    if grupo not in candidates:
        candidates.append(grupo)
    if divisao not in candidates:
        candidates.append(divisao)

    for candidate in candidates:
        cat_id = await _get_cnae_category_id(tabela, candidate)
        if cat_id:
            classificacao = f"C12762%5B{cat_id}%5D"  # C12762[cat_id]
            url = _build_sidra_url(tabela, variavel, periodos=periodos, classificacao=classificacao)
            data = await _sidra_request(url)
            if data:
                series = _parse_sidra_v3_series(data)
                if series:
                    logger.info(f"[SIDRA] Dados encontrados — tabela {tabela}, CNAE '{candidate}'")
                    return series

    # Último fallback: total nacional sem filtro setorial
    url = _build_sidra_url(tabela, variavel, periodos=periodos)
    data = await _sidra_request(url)
    if data:
        series = _parse_sidra_v3_series(data)
        if series:
            logger.info(f"[SIDRA] Usando total nacional — tabela {tabela}")
            return series

    return None


# ─── Funções Públicas ────────────────────────────────────

async def fetch_sector_company_count(cnae_code: str) -> Optional[Dict[str, Any]]:
    """Busca número de empresas ativas em um setor CNAE.

    Usa tabela CEMPRE (9418) — cobre todos os setores.
    """
    key = sidra_key(f"companies:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    series = await _fetch_with_fallback(
        cnae_code=cnae_code,
        tabela=TABELA_CEMPRE,
        variavel=VAR_CEMPRE_EMPRESAS,
        periodos="last5",
    )

    if not series:
        logger.info(f"[SIDRA] Sem dados de empresas para CNAE {cnae_code}")
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
    """Busca salários e remunerações setoriais (proxy de receita).

    Usa tabela CEMPRE (9418) — variável de salários.
    """
    key = sidra_key(f"wages:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    series = await _fetch_with_fallback(
        cnae_code=cnae_code,
        tabela=TABELA_CEMPRE,
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
    """Busca indicadores de receita/salários setoriais.

    Tenta CEMPRE (todos setores), depois PIA (só indústria).
    """
    key = sidra_key(f"revenue:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    # Primeiro tenta CEMPRE (cobre todos setores)
    series = await _fetch_with_fallback(
        cnae_code=cnae_code,
        tabela=TABELA_CEMPRE,
        variavel=VAR_CEMPRE_SALARIOS,
        periodos="last5",
    )

    if not series:
        # Fallback PIA para setor industrial
        series = await _fetch_with_fallback(
            cnae_code=cnae_code,
            tabela=TABELA_PIA_EMPRESAS,
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
    """Calcula crescimento histórico de um setor a partir do número de empresas."""
    key = sidra_key(f"growth:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    series = await _fetch_with_fallback(
        cnae_code=cnae_code,
        tabela=TABELA_CEMPRE,
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
    """Busca Valor Adicionado Bruto (VAB) setorial do PIB nacional.

    Tabela 6784 usa classificação diferente (não CNAE 2.0 direta).
    Retorna dados nacionais agregados como fallback.
    """
    key = sidra_key(f"vab:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    # PIB table usa classificação setorial própria; buscar total sem filtro CNAE
    url = _build_sidra_url(
        tabela=TABELA_PIB_SETORIAL,
        variavel=VAR_PIB_VALOR_ADICIONADO,
        periodos="last5",
    )
    data = await _sidra_request(url)
    if not data:
        return None

    series = _parse_sidra_v3_series(data)
    if not series:
        return None

    values = [series[y] for y in sorted(series)]
    result = {
        "cnae_code": cnae_code,
        "series": series,
        "latest_value_added": values[-1] if values else None,
        "growth_rate": calculate_growth_rate(values),
    }

    await cache_set(key, result, CACHE_TTL_SIDRA)
    return result


async def fetch_sector_historical_data(
    cnae_code: str,
    years: int = 5,
) -> Dict[str, Any]:
    """Consolida dados históricos setoriais de múltiplas fontes.

    Retorna pacote completo:
    - Número de empresas
    - Dados salariais/receita
    - Crescimento
    - Valor adicionado PIB
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
        logger.error(f"[SIDRA] Erro empresas: {companies}")
        companies = None
    if isinstance(revenue, Exception):
        logger.error(f"[SIDRA] Erro receita: {revenue}")
        revenue = None
    if isinstance(growth, Exception):
        logger.error(f"[SIDRA] Erro crescimento: {growth}")
        growth = None
    if isinstance(vab, Exception):
        logger.error(f"[SIDRA] Erro VAB: {vab}")
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
    """Obtém lista de todos os agregados disponíveis no IBGE."""
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
