"""
Quanto Vale — Sector Analysis Service
Serviço integrador que consolida dados IBGE e gera métricas para o motor DCF.

Responsabilidades:
- Ajuste de crescimento baseado em dados setoriais oficiais
- Cálculo de prêmio de risco setorial
- Posição de benchmark comparativo
- Score de risco setorial com múltiplas dimensões
- Integração direta com o motor DCF
"""

import logging
import math
import unicodedata
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import async_session_maker
from app.core.cache import cache_get, cache_set, benchmark_key, CACHE_TTL_BENCHMARK
from app.models.cnae import SectorBenchmark
from app.services.ibge_aggregates_service import (
    fetch_sector_growth,
    fetch_sector_revenue_average,
    fetch_sector_company_count,
    fetch_sector_value_added,
    fetch_sector_historical_data,
)
from app.utils.normalizers import (
    safe_float, calculate_volatility, calculate_growth_rate, calculate_trend,
)
from app.schemas.cnae_schema import (
    DCFSectorAdjustment, SectorRiskDetail, SectorBenchmarkSummary,
)

logger = logging.getLogger(__name__)

# ─── Mapeamento setor textual → código CNAE divisão ─────
# Cobre 60+ aliases em português; divisões CNAE 2.0 de 2 dígitos.
SECTOR_CNAE_MAP = {
    # Tecnologia & Digital
    "tecnologia": "62",
    "ti": "62",
    "software": "62",
    "saas": "62",
    "startup": "62",
    "desenvolvimento": "62",
    "dados": "62",
    "ia": "62",
    "fintech": "64",
    "ecommerce": "47",
    "e-commerce": "47",
    "marketplace": "47",
    "telecom": "61",
    "telecomunicacoes": "61",
    # Saúde
    "saude": "86",
    "hospital": "86",
    "clinica": "86",
    "farmacia": "47",
    "farma": "21",
    "laboratorio": "86",
    "odontologia": "86",
    "medtech": "32",
    "healthtech": "86",
    "veterinaria": "75",
    # Varejo & Comércio
    "varejo": "47",
    "comercio": "47",
    "loja": "47",
    "supermercado": "47",
    "atacado": "46",
    "atacarejo": "46",
    "distribuicao": "46",
    # Indústria & Manufatura
    "industria": "25",
    "manufatura": "25",
    "fabricacao": "25",
    "metalurgia": "24",
    "automoveis": "29",
    "textil": "13",
    "quimica": "20",
    "plasticos": "22",
    "alimentos": "10",
    "bebidas": "11",
    "calcados": "15",
    "moveis": "31",
    # Serviços
    "servicos": "74",
    "consultoria": "70",
    "juridico": "69",
    "contabilidade": "69",
    "rh": "78",
    "seguranca": "80",
    "limpeza": "81",
    # Marketing & Comunicação
    "marketing": "73",
    "publicidade": "73",
    "pesquisa": "72",
    "midia": "60",
    "comunicacao": "60",
    # Alimentação
    "alimentacao": "56",
    "restaurante": "56",
    "bar": "56",
    "cafeteria": "56",
    "delivery": "56",
    "foodtech": "56",
    # Educação
    "educacao": "85",
    "escola": "85",
    "universidade": "85",
    "curso": "85",
    "edtech": "85",
    "treinamento": "85",
    # Construção & Imobiliário
    "construcao": "41",
    "construtora": "41",
    "incorporadora": "41",
    "imobiliario": "68",
    "imoveis": "68",
    "proptech": "68",
    "arquitetura": "71",
    "engenharia": "71",
    # Agronegócio
    "agronegocio": "01",
    "agro": "01",
    "agricultura": "01",
    "pecuaria": "01",
    "agroindustria": "10",
    "agtech": "01",
    # Financeiro
    "financeiro": "64",
    "banco": "64",
    "seguro": "65",
    "seguros": "65",
    "credito": "64",
    "investimento": "64",
    "gestora": "64",
    # Logística & Transporte
    "logistica": "49",
    "transporte": "49",
    "frete": "49",
    "entrega": "49",
    "armazenagem": "52",
    "porto": "50",
    # Energia
    "energia": "35",
    "eletricidade": "35",
    "solar": "35",
    "renovavel": "35",
    "petroleo": "06",
    "gas": "06",
    # Hotelaria & Turismo
    "hotel": "55",
    "hotelaria": "55",
    "turismo": "79",
    "viagem": "79",
    # Outros
    "entretenimento": "90",
    "esportes": "93",
    "beleza": "96",
    "estetica": "96",
    "petshop": "75",
}


def _normalize_sector(s: str) -> str:
    """Remove acentos e normaliza string para comparação robusta."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s.lower().strip())
        if unicodedata.category(c) != "Mn"
    )


def _sector_to_cnae(sector: str) -> str:
    """Converte nome de setor para código CNAE divisão.

    Ordem de prioridade:
    1. Match exato (após normalização de acentos)
    2. Match parcial — chave do mapa aparece no setor informado
    3. Default conservador: 47 (Comércio Varejista)
    """
    normalized = _normalize_sector(sector)
    # 1. Exact match
    if normalized in SECTOR_CNAE_MAP:
        return SECTOR_CNAE_MAP[normalized]
    # 2. Partial match
    for key, code in SECTOR_CNAE_MAP.items():
        if key in normalized or normalized in key:
            return code
    # 3. Default
    return "47"


# ─── Score de Risco Setorial ─────────────────────────────

async def calculate_sector_risk_score(cnae_code: str) -> SectorRiskDetail:
    """Calcula score de risco setorial (0–100) baseado em dados IBGE.

    Componentes:
    1. Volatilidade histórica do crescimento (peso 30%)
    2. Desvio padrão das receitas setoriais (peso 25%)
    3. Fragmentação: número de empresas (peso 20%)
    4. Tendência macroeconômica (peso 25%)
    """
    key = benchmark_key(cnae_code) + ":risk"
    cache = await cache_get(key)
    if cache:
        return SectorRiskDetail(**cache)

    # Buscar dados
    growth_data = await fetch_sector_growth(cnae_code)
    revenue_data = await fetch_sector_revenue_average(cnae_code)
    companies_data = await fetch_sector_company_count(cnae_code)

    # 1. Volatilidade do crescimento (0-100)
    growth_volatility = 50.0  # default
    if growth_data and growth_data.get("annual_growths"):
        vol = calculate_volatility(growth_data["annual_growths"])
        growth_volatility = min(vol * 100, 100)

    # 2. Desvio padrão da receita (0-100)
    revenue_std = 50.0
    if revenue_data and revenue_data.get("series"):
        values = list(revenue_data["series"].values())
        vol = calculate_volatility(values)
        revenue_std = min(vol * 100, 100)

    # 3. Fragmentação: mais empresas = mais competição = mais risco
    fragmentation = 50.0
    if companies_data and companies_data.get("latest_count"):
        count = companies_data["latest_count"]
        # Normalizar: muitas empresas (>100k) = alto; poucas (<1k) = baixo
        if count > 100000:
            fragmentation = 80
        elif count > 50000:
            fragmentation = 65
        elif count > 10000:
            fragmentation = 50
        elif count > 1000:
            fragmentation = 35
        else:
            fragmentation = 20

    # 4. Tendência macroeconômica
    trend_score = 50.0
    if revenue_data and revenue_data.get("series"):
        values = list(revenue_data["series"].values())
        trend = calculate_trend(values)
        # Positivo = menor risco; Negativo = maior risco
        trend_score = 50 - (trend * 40)  # Range ~10-90
        trend_score = max(10, min(90, trend_score))

    # Cálculo ponderado
    final_score = (
        growth_volatility * 0.30 +
        revenue_std * 0.25 +
        fragmentation * 0.20 +
        trend_score * 0.25
    )
    final_score = round(max(0, min(100, final_score)), 1)

    # Classificar nível
    if final_score <= 25:
        risk_level = "baixo"
    elif final_score <= 50:
        risk_level = "medio"
    elif final_score <= 75:
        risk_level = "alto"
    else:
        risk_level = "muito_alto"

    result = SectorRiskDetail(
        cnae_code=cnae_code,
        growth_volatility=round(growth_volatility, 2),
        revenue_std_dev=round(revenue_std, 2),
        fragmentation_score=round(fragmentation, 2),
        trend_score=round(trend_score, 2),
        final_score=final_score,
        risk_level=risk_level,
        components={
            "growth_volatility_weight": 0.30,
            "revenue_std_weight": 0.25,
            "fragmentation_weight": 0.20,
            "trend_weight": 0.25,
        },
    )

    await cache_set(key, result.model_dump(), CACHE_TTL_BENCHMARK)
    return result


# ─── Integração DCF ─────────────────────────────────────

async def get_adjusted_growth_for_dcf(
    cnae_code: str,
    company_growth: Optional[float] = None,
) -> float:
    """Retorna taxa de crescimento ajustada pelo setor para o motor DCF.

    Lógica:
    1. Buscar crescimento setorial oficial (CAGR do IBGE)
    2. Se empresa informou crescimento, fazer blend
    3. Aplicar cap de segurança

    Blend = 60% empresa + 40% setor (quando dados disponíveis)
    """
    sector_growth = None

    # Tentar buscar do banco primeiro
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(SectorBenchmark)
                .where(SectorBenchmark.cnae_code == cnae_code)
                .order_by(desc(SectorBenchmark.year))
                .limit(1)
            )
            benchmark = result.scalar_one_or_none()
            if benchmark and benchmark.growth_rate is not None:
                sector_growth = benchmark.growth_rate
    except Exception as e:
        logger.warning(f"[DCF] Erro ao buscar benchmark no DB: {e}")

    # Se não encontrou no banco, buscar na API
    if sector_growth is None:
        growth_data = await fetch_sector_growth(cnae_code)
        if growth_data and growth_data.get("cagr") is not None:
            sector_growth = growth_data["cagr"]

    # Se ainda sem dados, usar default
    if sector_growth is None:
        sector_growth = 0.05  # 5% default conservador

    # Se empresa informou crescimento, blendear
    if company_growth is not None:
        # 60% empresa + 40% setor
        adjusted = company_growth * 0.60 + sector_growth * 0.40
    else:
        adjusted = sector_growth

    # Cap de segurança: -20% a +40%
    adjusted = max(-0.20, min(0.40, adjusted))

    return round(adjusted, 4)


async def get_sector_risk_premium(cnae_code: str) -> float:
    """Calcula prêmio de risco setorial baseado nos dados IBGE.

    Mapeamento:
    - Score 0-25: prêmio 0.01 (1%)
    - Score 25-50: prêmio 0.02 (2%)
    - Score 50-75: prêmio 0.04 (4%)
    - Score 75-100: prêmio 0.06 (6%)
    """
    risk = await calculate_sector_risk_score(cnae_code)

    if risk.final_score <= 25:
        premium = 0.01
    elif risk.final_score <= 50:
        premium = 0.01 + (risk.final_score - 25) * 0.0004  # Interpola 1%-2%
    elif risk.final_score <= 75:
        premium = 0.02 + (risk.final_score - 50) * 0.0008  # Interpola 2%-4%
    else:
        premium = 0.04 + (risk.final_score - 75) * 0.0008  # Interpola 4%-6%

    return round(min(premium, 0.06), 4)


async def get_sector_benchmark_position(
    company_revenue: float,
    cnae_code: str,
) -> Dict[str, Any]:
    """Determina posição da empresa em relação ao benchmark setorial.

    Retorna: "acima", "na_media" ou "abaixo".
    """
    revenue_data = await fetch_sector_revenue_average(cnae_code)
    companies_data = await fetch_sector_company_count(cnae_code)

    benchmark_revenue = None
    total_companies = None

    if revenue_data:
        benchmark_revenue = revenue_data.get("average_revenue")
        if benchmark_revenue and companies_data and companies_data.get("latest_count"):
            total_companies = companies_data["latest_count"]
            # Receita média por empresa = receita total / N empresas
            if total_companies > 0:
                benchmark_revenue = benchmark_revenue / total_companies

    position = "na_media"
    percentile_estimate = 50

    if benchmark_revenue and benchmark_revenue > 0:
        ratio = company_revenue / benchmark_revenue
        if ratio > 1.5:
            position = "acima"
            percentile_estimate = min(95, 50 + ratio * 15)
        elif ratio > 0.8:
            position = "na_media"
            percentile_estimate = 40 + ratio * 10
        else:
            position = "abaixo"
            percentile_estimate = max(5, ratio * 40)

    return {
        "position": position,
        "benchmark_revenue": benchmark_revenue,
        "company_revenue": company_revenue,
        "total_companies": total_companies,
        "percentile_estimate": round(percentile_estimate, 1),
    }


async def get_dcf_sector_adjustment(
    cnae_code: str,
    company_revenue: Optional[float] = None,
    company_growth: Optional[float] = None,
) -> DCFSectorAdjustment:
    """Retorna pacote completo de ajuste setorial para o motor DCF.

    Integra crescimento ajustado, prêmio de risco e benchmark.
    """
    key = benchmark_key(cnae_code) + ":dcf_adj"
    cache = await cache_get(key)
    if cache:
        return DCFSectorAdjustment(**cache)

    # Buscar tudo
    adjusted_growth = await get_adjusted_growth_for_dcf(cnae_code, company_growth)
    risk_premium = await get_sector_risk_premium(cnae_code)

    benchmark_data = None
    sector_position = None

    if company_revenue:
        position = await get_sector_benchmark_position(company_revenue, cnae_code)
        sector_position = position.get("position")
        benchmark_data = position.get("benchmark_revenue")

    # Buscar dados adicionais
    revenue_data = await fetch_sector_revenue_average(cnae_code)
    growth_data = await fetch_sector_growth(cnae_code)

    # ── Confiança multi-fator ──────────────────────────────
    # Base: presença de cada fonte de dados
    base = 0.0
    if revenue_data:   base += 0.30
    if growth_data:    base += 0.30
    if benchmark_data: base += 0.17

    # Bônus por tamanho da série histórica
    years_in_series = len(growth_data.get("years", [])) if growth_data else 0
    if years_in_series >= 5:   base += 0.15
    elif years_in_series >= 3: base += 0.07

    # Bônus/penalidade por recência dos dados
    latest_year = max(growth_data["years"]) if (growth_data and growth_data.get("years")) else 0
    current_year = datetime.now().year
    if latest_year >= current_year - 1:  base += 0.10
    elif latest_year >= current_year - 3: base += 0.05
    elif latest_year > 0:                base -= 0.10

    confidence = round(min(1.0, max(0.0, base)), 2)

    # Rótulo de qualidade para exibição no relatório
    if confidence >= 0.80:
        ibge_data_quality = "alta"
        ibge_data_label = f"IBGE/SIDRA: alta confiança — {years_in_series} anos de histórico ({latest_year})"
    elif confidence >= 0.50:
        ibge_data_quality = "media"
        ibge_data_label = f"IBGE/SIDRA: confiança média — {years_in_series} ano(s) de dados"
    elif confidence >= 0.20:
        ibge_data_quality = "baixa"
        ibge_data_label = "IBGE/SIDRA: baixa confiança — dados parciais disponíveis"
    else:
        ibge_data_quality = "indisponivel"
        ibge_data_label = "IBGE/SIDRA: indisponível — crescimento baseado no informado"

    result = DCFSectorAdjustment(
        adjusted_growth_rate=adjusted_growth,
        sector_risk_premium=risk_premium,
        benchmark_revenue=benchmark_data,
        benchmark_growth=growth_data.get("cagr") if growth_data else None,
        sector_position=sector_position,
        confidence_level=confidence,
        ibge_data_quality=ibge_data_quality,
        ibge_data_label=ibge_data_label,
    )

    await cache_set(key, result.model_dump(), CACHE_TTL_BENCHMARK)
    return result


# ─── Persistência de Benchmarks ──────────────────────────

async def persist_sector_benchmark(
    cnae_code: str,
    year: int,
    data: Dict[str, Any],
) -> None:
    """Persiste dados de benchmark no PostgreSQL."""
    try:
        risk = await calculate_sector_risk_score(cnae_code)

        async with async_session_maker() as session:
            stmt = pg_insert(SectorBenchmark).values(
                cnae_code=cnae_code,
                year=year,
                revenue_avg=data.get("revenue_avg"),
                growth_rate=data.get("growth_rate"),
                companies_total=data.get("companies_total"),
                value_added=data.get("value_added"),
                volatility_index=data.get("volatility"),
                sector_risk_score=risk.final_score,
            ).on_conflict_do_update(
                constraint="uq_benchmark_cnae_year",
                set_={
                    "revenue_avg": data.get("revenue_avg"),
                    "growth_rate": data.get("growth_rate"),
                    "companies_total": data.get("companies_total"),
                    "value_added": data.get("value_added"),
                    "volatility_index": data.get("volatility"),
                    "sector_risk_score": risk.final_score,
                    "updated_at": datetime.now(timezone.utc),
                }
            )
            await session.execute(stmt)
            await session.commit()
            logger.info(f"[BENCHMARK] Persistido benchmark CNAE {cnae_code} ano {year}")
    except Exception as e:
        logger.error(f"[BENCHMARK] Erro ao persistir: {e}")


async def get_sector_summary(cnae_code: str) -> SectorBenchmarkSummary:
    """Retorna resumo consolidado do setor para exibição no frontend."""
    historical = await fetch_sector_historical_data(cnae_code)

    years_available = []
    avg_growth = None
    avg_revenue = None
    total_companies = None

    if historical.get("growth") and historical["growth"].get("cagr"):
        avg_growth = historical["growth"]["cagr"]
        years_available = historical["growth"].get("years", [])

    if historical.get("revenue") and historical["revenue"].get("average_revenue"):
        avg_revenue = historical["revenue"]["average_revenue"]

    if historical.get("companies") and historical["companies"].get("latest_count"):
        total_companies = historical["companies"]["latest_count"]

    risk = await calculate_sector_risk_score(cnae_code)
    volatility = risk.growth_volatility / 100.0 if risk.growth_volatility else None

    return SectorBenchmarkSummary(
        cnae_code=cnae_code,
        avg_growth_rate=avg_growth,
        avg_revenue=avg_revenue,
        total_companies=total_companies,
        risk_score=risk.final_score,
        volatility=volatility,
        years_available=years_available,
    )
