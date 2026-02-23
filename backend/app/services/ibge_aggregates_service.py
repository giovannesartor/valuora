"""
Quanto Vale — IBGE Aggregates Service (SIDRA)
Serviço de integração com a API de Dados Agregados v3 do IBGE.
https://servicodados.ibge.gov.br/api/v3/agregados

Funcionalidades:
- Crescimento setorial histórico
- Receita média por setor
- Número de empresas por atividade
- Valor adicionado setorial
- Fallback hierárquico (Classe → Grupo → Divisão)
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import httpx
from datetime import datetime

from app.core.cache import (
    cache_get, cache_set, sidra_key,
    CACHE_TTL_SIDRA,
)
from app.utils.normalizers import (
    safe_float, safe_int, normalize_ibge_response,
    extract_sidra_values, calculate_growth_rate, calculate_volatility,
    cnae_to_division, cnae_to_group,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://servicodados.ibge.gov.br/api/v3/agregados"
TIMEOUT = 30.0
MAX_RETRIES = 3

# ─── Tabelas SIDRA relevantes ────────────────────────────
# Pesquisa Industrial Anual (PIA)
TABELA_PIA_EMPRESAS = "1842"         # Dados gerais das empresas por atividade
TABELA_PIA_RECEITA = "1844"          # Receita líquida de vendas industriais
# Pesquisa Anual de Serviços (PAS) 
TABELA_PAS_EMPRESAS = "6442"         # Empresas de serviços (número, receita, pessoal)
# Pesquisa Anual de Comércio (PAC)
TABELA_PAC_EMPRESAS = "6443"         # Comércio (número de empresas, receita)
# Cadastro Central de Empresas (CEMPRE)
TABELA_CEMPRE = "6450"              # Total de empresas por atividade e porte
# Contas Nacionais
TABELA_PIB_SETORIAL = "6784"         # PIB por atividade (valor adicionado)

# Variáveis comuns
VAR_EMPRESAS = "630"           # Número de empresas
VAR_RECEITA = "631"            # Receita líquida de vendas
VAR_PESSOAL = "810"            # Pessoal ocupado
VAR_SALARIO = "812"            # Salários e remunerações
VAR_VALOR_ADICIONADO = "37"    # Valor adicionado bruto


# ─── HTTP Client com retry ──────────────────────────────

async def _sidra_request(url: str, retries: int = MAX_RETRIES) -> Optional[Any]:
    """Faz requisição ao SIDRA com retry e backoff exponencial."""
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                return data
        except httpx.TimeoutException:
            logger.warning(f"[SIDRA] Timeout tentativa {attempt + 1}/{retries} — {url}")
        except httpx.HTTPStatusError as e:
            logger.error(f"[SIDRA] HTTP {e.response.status_code} — {url}")
            if e.response.status_code == 404:
                return None
            if e.response.status_code >= 500:
                pass  # Retry
            else:
                return None
        except Exception as e:
            logger.error(f"[SIDRA] Erro: {e}")

        if attempt < retries - 1:
            wait = 2 ** attempt
            await asyncio.sleep(wait)

    logger.error(f"[SIDRA] Falha após {retries} tentativas")
    return None


def _build_sidra_url(
    tabela: str,
    variavel: str,
    localidade: str = "N1/all",  # Brasil inteiro
    periodos: str = "all",
    classificacao: Optional[str] = None,
    view: str = "flat",
) -> str:
    """Constrói URL de consulta SIDRA dinamicamente.

    Padrão: /agregados/{tabela}/variaveis/{variavel}?localidades={loc}&periodos={periodos}
    """
    url = f"{BASE_URL}/{tabela}/variaveis/{variavel}"
    params = []
    params.append(f"localidades={localidade}")

    if periodos != "all":
        params.append(f"periodos={periodos}")

    if classificacao:
        params.append(f"classificacao={classificacao}")

    params.append(f"view={view}")

    return url + "?" + "&".join(params)


async def _fetch_with_fallback(
    cnae_code: str,
    tabela: str,
    variavel: str,
    classificacao_template: str,
    periodos: str = "all",
) -> Optional[List[Dict]]:
    """Busca dados SIDRA com fallback hierárquico.

    Tenta: código completo → grupo → divisão.
    """
    clean = cnae_code.replace(".", "").replace("-", "").replace("/", "")

    # Tentar código completo
    classificacao = classificacao_template.format(code=clean)
    url = _build_sidra_url(tabela, variavel, classificacao=classificacao, periodos=periodos)
    data = await _sidra_request(url)
    normalized = normalize_ibge_response(data) if data else []

    if normalized and any(safe_float(item.get("V")) != 0 for item in normalized):
        return normalized

    # Fallback para grupo (3 dígitos)
    grupo = cnae_to_group(cnae_code)
    if grupo != clean:
        logger.info(f"[SIDRA] Fallback para grupo {grupo}")
        classificacao = classificacao_template.format(code=grupo)
        url = _build_sidra_url(tabela, variavel, classificacao=classificacao, periodos=periodos)
        data = await _sidra_request(url)
        normalized = normalize_ibge_response(data) if data else []
        if normalized and any(safe_float(item.get("V")) != 0 for item in normalized):
            return normalized

    # Fallback para divisão (2 dígitos)
    divisao = cnae_to_division(cnae_code)
    if divisao != grupo:
        logger.info(f"[SIDRA] Fallback para divisão {divisao}")
        classificacao = classificacao_template.format(code=divisao)
        url = _build_sidra_url(tabela, variavel, classificacao=classificacao, periodos=periodos)
        data = await _sidra_request(url)
        normalized = normalize_ibge_response(data) if data else []
        if normalized:
            return normalized

    return None


# ─── Funções Públicas ────────────────────────────────────

async def fetch_sector_company_count(cnae_code: str) -> Optional[Dict[str, Any]]:
    """Busca número de empresas ativas em um setor CNAE.

    Usa tabela CEMPRE (Cadastro Central de Empresas).
    """
    key = sidra_key(f"companies:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    # CEMPRE — classificação por atividade CNAE 2.0
    data = await _fetch_with_fallback(
        cnae_code=cnae_code,
        tabela=TABELA_CEMPRE,
        variavel=VAR_EMPRESAS,
        classificacao_template="C12762/{code}",
        periodos="last%205",
    )

    if not data:
        logger.info(f"[SIDRA] Sem dados de empresas para CNAE {cnae_code}")
        return None

    # Extrair série temporal
    series = {}
    for item in data:
        year = safe_int(item.get("D3C"))  # Código do período
        if not year:
            # Tentar campo de nome do período
            period_name = item.get("D3N", "")
            if period_name.isdigit():
                year = int(period_name)
        value = safe_int(item.get("V"))
        if year and value:
            series[year] = value

    result = {
        "cnae_code": cnae_code,
        "series": series,
        "latest_count": max(series.values()) if series else None,
        "latest_year": max(series.keys()) if series else None,
    }

    await cache_set(key, result, CACHE_TTL_SIDRA)
    return result


async def fetch_sector_revenue_average(cnae_code: str) -> Optional[Dict[str, Any]]:
    """Busca receita média por setor.

    Usa PIA (indústria), PAS (serviços) ou PAC (comércio) conforme CNAE.
    """
    key = sidra_key(f"revenue:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    # Tenta diferentes tabelas
    for tabela, desc in [
        (TABELA_PIA_RECEITA, "PIA"),
        (TABELA_PAS_EMPRESAS, "PAS"),
        (TABELA_PAC_EMPRESAS, "PAC"),
    ]:
        data = await _fetch_with_fallback(
            cnae_code=cnae_code,
            tabela=tabela,
            variavel=VAR_RECEITA,
            classificacao_template="C12762/{code}",
            periodos="last%205",
        )
        if data:
            logger.info(f"[SIDRA] Dados de receita encontrados via {desc}")
            break

    if not data:
        return None

    series = {}
    for item in data:
        period_name = item.get("D3N", item.get("D2N", ""))
        year = safe_int(period_name) if period_name.strip().isdigit() else safe_int(item.get("D3C", item.get("D2C")))
        value = safe_float(item.get("V"))
        if year and value:
            series[year] = value

    values = list(series.values())
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
    """Calcula crescimento histórico de um setor a partir da receita."""
    key = sidra_key(f"growth:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    revenue_data = await fetch_sector_revenue_average(cnae_code)
    if not revenue_data or not revenue_data.get("series"):
        return None

    series = revenue_data["series"]
    sorted_years = sorted(series.keys())
    values = [series[y] for y in sorted_years]

    # Calcular crescimentos anuais
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
    """Busca Valor Adicionado Bruto (VAB) setorial — proxy para participação econômica."""
    key = sidra_key(f"vab:{cnae_code}")
    cache = await cache_get(key)
    if cache:
        return cache

    data = await _fetch_with_fallback(
        cnae_code=cnae_code,
        tabela=TABELA_PIB_SETORIAL,
        variavel=VAR_VALOR_ADICIONADO,
        classificacao_template="C11255/{code}",
        periodos="last%205",
    )

    if not data:
        return None

    series = {}
    for item in data:
        period_name = item.get("D3N", item.get("D2N", ""))
        year = safe_int(period_name) if period_name.strip().isdigit() else safe_int(item.get("D3C", item.get("D2C")))
        value = safe_float(item.get("V"))
        if year and value:
            series[year] = value

    values = list(series.values())
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
    - Receita
    - Crescimento
    - Valor adicionado
    """
    key = sidra_key(f"historical:{cnae_code}:{years}")
    cache = await cache_get(key)
    if cache:
        return cache

    # Buscar tudo em paralelo
    companies, revenue, growth, vab = await asyncio.gather(
        fetch_sector_company_count(cnae_code),
        fetch_sector_revenue_average(cnae_code),
        fetch_sector_growth(cnae_code),
        fetch_sector_value_added(cnae_code),
        return_exceptions=True,
    )

    # Tratar exceções individuais
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
        "fetched_at": datetime.utcnow().isoformat(),
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

    # A resposta é um array de pesquisas com agregados
    results = []
    if isinstance(data, list):
        for pesquisa in data:
            nome = pesquisa.get("nome", "")
            agregados = pesquisa.get("agregados", [])
            for ag in agregados:
                results.append({
                    "id": ag.get("id"),
                    "nome": ag.get("nome"),
                    "pesquisa": nome,
                })

    await cache_set(key, results, CACHE_TTL_SIDRA)
    return results
