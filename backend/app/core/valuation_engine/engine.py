"""
Quanto Vale — Valuation Engine
Motor financeiro baseado em DCF (Fluxo de Caixa Descontado).

Funções puras e testáveis.
Nenhum cálculo é feito pela IA — somente pelo motor.
"""

from typing import Dict, Any, Optional, List
import math

# ─── Sector Beta & Risk Premiums ──────────────────────────
SECTOR_BETAS = {
    "tecnologia": 1.3,
    "saude": 0.9,
    "varejo": 1.1,
    "industria": 1.0,
    "servicos": 1.05,
    "alimentacao": 0.85,
    "educacao": 0.9,
    "construcao": 1.15,
    "agronegocio": 1.0,
    "financeiro": 1.2,
    "logistica": 1.1,
    "energia": 0.95,
    "imobiliario": 1.05,
    "consultoria": 1.0,
    "marketing": 1.15,
    "ecommerce": 1.25,
    "outros": 1.0,
}

SECTOR_MULTIPLES = {
    "tecnologia": {"ev_revenue": 4.5, "ev_ebitda": 15.0},
    "saude": {"ev_revenue": 3.0, "ev_ebitda": 12.0},
    "varejo": {"ev_revenue": 1.5, "ev_ebitda": 8.0},
    "industria": {"ev_revenue": 1.8, "ev_ebitda": 7.5},
    "servicos": {"ev_revenue": 2.5, "ev_ebitda": 10.0},
    "alimentacao": {"ev_revenue": 1.2, "ev_ebitda": 7.0},
    "educacao": {"ev_revenue": 2.8, "ev_ebitda": 11.0},
    "construcao": {"ev_revenue": 1.3, "ev_ebitda": 6.5},
    "agronegocio": {"ev_revenue": 1.5, "ev_ebitda": 7.0},
    "financeiro": {"ev_revenue": 3.5, "ev_ebitda": 12.0},
    "logistica": {"ev_revenue": 1.8, "ev_ebitda": 8.5},
    "energia": {"ev_revenue": 2.0, "ev_ebitda": 9.0},
    "imobiliario": {"ev_revenue": 2.2, "ev_ebitda": 9.5},
    "consultoria": {"ev_revenue": 2.5, "ev_ebitda": 10.0},
    "marketing": {"ev_revenue": 2.0, "ev_ebitda": 9.0},
    "ecommerce": {"ev_revenue": 3.0, "ev_ebitda": 12.0},
    "outros": {"ev_revenue": 2.0, "ev_ebitda": 8.0},
}


def get_sector_beta(sector: str) -> float:
    return SECTOR_BETAS.get(sector.lower(), 1.0)


def get_sector_multiples(sector: str) -> Dict[str, float]:
    return SECTOR_MULTIPLES.get(sector.lower(), SECTOR_MULTIPLES["outros"])


# ─── WACC Calculation ────────────────────────────────────

def calculate_wacc(
    beta: float,
    risk_free_rate: float = 0.1075,  # Selic ~10.75%
    market_premium: float = 0.065,   # Prêmio de mercado Brasil
    micro_premium: float = 0.04,     # Prêmio micro/pequena empresa
    debt_ratio: float = 0.0,
    cost_of_debt: float = 0.14,      # CDI + spread
    tax_rate: float = 0.34,          # IR + CSLL
) -> float:
    """Calcula WACC (Weighted Average Cost of Capital).
    
    Ke = Rf + β × (Rm - Rf) + prêmio microempresa
    WACC = Ke × (1 - D/(D+E)) + Kd × (1-t) × D/(D+E)
    """
    ke = risk_free_rate + beta * market_premium + micro_premium
    equity_ratio = 1 - debt_ratio
    wacc = ke * equity_ratio + cost_of_debt * (1 - tax_rate) * debt_ratio
    return round(wacc, 4)


# ─── FCF Projection ─────────────────────────────────────

def project_fcf(
    revenue: float,
    net_margin: float,
    growth_rate: float,
    years: int = 5,
    capex_ratio: float = 0.05,
    nwc_ratio: float = 0.03,
    depreciation_ratio: float = 0.03,
    tax_rate: float = 0.34,
) -> List[Dict[str, float]]:
    """Projeta Fluxo de Caixa Livre (FCL) para N anos."""
    projections = []
    current_revenue = revenue

    for year in range(1, years + 1):
        # Crescimento gradualmente desacelerando
        decay_factor = 1 - (year - 1) * 0.08  # Desaceleração de 8% ao ano
        adjusted_growth = growth_rate * max(decay_factor, 0.4)
        current_revenue *= (1 + adjusted_growth)

        ebit = current_revenue * net_margin
        nopat = ebit * (1 - tax_rate)
        depreciation = current_revenue * depreciation_ratio
        capex = current_revenue * capex_ratio
        delta_nwc = current_revenue * nwc_ratio * adjusted_growth

        fcf = nopat + depreciation - capex - delta_nwc

        projections.append({
            "year": year,
            "revenue": round(current_revenue, 2),
            "growth_rate": round(adjusted_growth, 4),
            "ebit": round(ebit, 2),
            "nopat": round(nopat, 2),
            "depreciation": round(depreciation, 2),
            "capex": round(capex, 2),
            "delta_nwc": round(delta_nwc, 2),
            "fcf": round(fcf, 2),
        })

    return projections


# ─── Terminal Value ──────────────────────────────────────

def calculate_terminal_value(
    last_fcf: float,
    wacc: float,
    perpetuity_growth: float = 0.035,  # Crescimento perpétuo ~3.5% (inflação BR)
) -> float:
    """Calcula valor terminal usando Gordon Growth Model."""
    if wacc <= perpetuity_growth:
        perpetuity_growth = wacc * 0.5  # Safety cap
    tv = last_fcf * (1 + perpetuity_growth) / (wacc - perpetuity_growth)
    return round(tv, 2)


# ─── Enterprise Value ───────────────────────────────────

def calculate_enterprise_value(
    fcf_projections: List[Dict[str, float]],
    wacc: float,
    terminal_value: float,
) -> Dict[str, float]:
    """Calcula Enterprise Value (EV) — valor total da empresa."""
    pv_fcf = []
    for proj in fcf_projections:
        year = proj["year"]
        discount_factor = (1 + wacc) ** year
        pv = proj["fcf"] / discount_factor
        pv_fcf.append(round(pv, 2))

    pv_fcf_total = sum(pv_fcf)

    last_year = len(fcf_projections)
    pv_terminal = terminal_value / ((1 + wacc) ** last_year)

    enterprise_value = pv_fcf_total + pv_terminal

    return {
        "pv_fcf": pv_fcf,
        "pv_fcf_total": round(pv_fcf_total, 2),
        "terminal_value": round(terminal_value, 2),
        "pv_terminal_value": round(pv_terminal, 2),
        "enterprise_value": round(enterprise_value, 2),
    }


# ─── Equity Value ────────────────────────────────────────

def calculate_equity_value(
    enterprise_value: float,
    cash: float = 0,
    debt: float = 0,
) -> float:
    """Equity Value = Enterprise Value + Caixa - Dívida"""
    return round(enterprise_value + cash - debt, 2)


# ─── Founder Dependency Discount ─────────────────────────

def apply_founder_discount(equity_value: float, dependency: float) -> float:
    """Aplica desconto por dependência do fundador.
    
    dependency: 0.0 (nenhuma) a 1.0 (total)
    Desconto máximo: 35%
    """
    discount = dependency * 0.35
    return round(equity_value * (1 - discount), 2)


# ─── Risk Score ──────────────────────────────────────────

def calculate_risk_score(
    net_margin: float,
    growth_rate: float,
    debt_ratio: float,
    founder_dependency: float,
    sector_beta: float,
) -> float:
    """Calcula score de risco de 0 (baixo) a 100 (alto)."""
    score = 50.0  # Base

    # Margem (boa = menor risco)
    if net_margin > 0.20:
        score -= 10
    elif net_margin > 0.10:
        score -= 5
    elif net_margin < 0.05:
        score += 15
    elif net_margin < 0:
        score += 25

    # Growth (alto crescimento = mais risco)
    if growth_rate > 0.30:
        score += 10
    elif growth_rate > 0.15:
        score += 5
    elif growth_rate < 0:
        score += 15

    # Debt
    if debt_ratio > 0.6:
        score += 15
    elif debt_ratio > 0.3:
        score += 5
    elif debt_ratio < 0.1:
        score -= 5

    # Founder dependency
    score += founder_dependency * 20

    # Beta
    if sector_beta > 1.2:
        score += 5
    elif sector_beta < 0.9:
        score -= 5

    return round(max(0, min(100, score)), 1)


# ─── Maturity Index ──────────────────────────────────────

def calculate_maturity_index(
    revenue: float,
    net_margin: float,
    growth_rate: float,
    founder_dependency: float,
    years_of_data: int = 1,
) -> float:
    """Calcula índice de maturidade de 0 (iniciante) a 100 (madura)."""
    score = 0.0

    # Revenue scale
    if revenue > 10_000_000:
        score += 25
    elif revenue > 5_000_000:
        score += 20
    elif revenue > 1_000_000:
        score += 15
    elif revenue > 500_000:
        score += 10
    else:
        score += 5

    # Margin stability
    if 0.10 <= net_margin <= 0.30:
        score += 25
    elif net_margin > 0.05:
        score += 15
    elif net_margin > 0:
        score += 10
    else:
        score += 0

    # Growth sustainability
    if 0.05 <= growth_rate <= 0.20:
        score += 20
    elif growth_rate > 0.20:
        score += 10
    elif growth_rate > 0:
        score += 15
    else:
        score += 5

    # Low founder dependency
    score += (1 - founder_dependency) * 15

    # Data richness
    score += min(years_of_data * 5, 15)

    return round(max(0, min(100, score)), 1)


# ─── Percentile ──────────────────────────────────────────

def calculate_percentile(
    equity_value: float,
    revenue: float,
    sector: str,
) -> float:
    """Calcula percentil estimado em relação ao mercado setorial."""
    multiples = get_sector_multiples(sector)
    implied_multiple = equity_value / revenue if revenue > 0 else 0
    sector_multiple = multiples.get("ev_revenue", 2.0)

    ratio = implied_multiple / sector_multiple if sector_multiple > 0 else 1

    # Sigmoid-like mapping to percentile
    percentile = 100 / (1 + math.exp(-3 * (ratio - 1)))

    return round(max(1, min(99, percentile)), 1)


# ─── Main Valuation Function ────────────────────────────

def run_valuation(
    revenue: float,
    net_margin: float,
    sector: str,
    growth_rate: Optional[float] = None,
    debt: float = 0,
    cash: float = 0,
    founder_dependency: float = 0.0,
    years_of_data: int = 1,
    projection_years: int = 5,
    custom_wacc: Optional[float] = None,
    custom_growth: Optional[float] = None,
    custom_margin: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Executa valuation completo por DCF.
    
    Retorna dicionário com todos os resultados.
    """
    # Use custom parameters if provided (simulation)
    effective_margin = custom_margin if custom_margin is not None else net_margin
    effective_growth = custom_growth if custom_growth is not None else (growth_rate or 0.10)

    # 1. Sector data
    beta = get_sector_beta(sector)
    multiples = get_sector_multiples(sector)

    # 2. Debt ratio
    total_capital = revenue * 3  # Proxy for total capital
    debt_ratio = debt / (debt + total_capital) if (debt + total_capital) > 0 else 0

    # 3. WACC
    wacc = custom_wacc if custom_wacc is not None else calculate_wacc(
        beta=beta,
        debt_ratio=debt_ratio,
    )

    # 4. FCF Projections
    fcf_projections = project_fcf(
        revenue=revenue,
        net_margin=effective_margin,
        growth_rate=effective_growth,
        years=projection_years,
    )

    # 5. Terminal Value
    last_fcf = fcf_projections[-1]["fcf"]
    terminal_value = calculate_terminal_value(last_fcf=last_fcf, wacc=wacc)

    # 6. Enterprise Value
    ev_result = calculate_enterprise_value(
        fcf_projections=fcf_projections,
        wacc=wacc,
        terminal_value=terminal_value,
    )

    # 7. Equity Value
    equity_raw = calculate_equity_value(
        enterprise_value=ev_result["enterprise_value"],
        cash=cash,
        debt=debt,
    )

    # 8. Founder Discount
    equity_value = apply_founder_discount(equity_raw, founder_dependency)

    # 9. Risk Score
    risk_score = calculate_risk_score(
        net_margin=effective_margin,
        growth_rate=effective_growth,
        debt_ratio=debt_ratio,
        founder_dependency=founder_dependency,
        sector_beta=beta,
    )

    # 10. Maturity Index
    maturity_index = calculate_maturity_index(
        revenue=revenue,
        net_margin=effective_margin,
        growth_rate=effective_growth,
        founder_dependency=founder_dependency,
        years_of_data=years_of_data,
    )

    # 11. Percentile
    percentile = calculate_percentile(
        equity_value=equity_value,
        revenue=revenue,
        sector=sector,
    )

    # 12. Valuation range
    valuation_low = round(equity_value * 0.80, 2)
    valuation_high = round(equity_value * 1.20, 2)

    return {
        "equity_value": equity_value,
        "equity_value_raw": equity_raw,
        "valuation_range": {
            "low": valuation_low,
            "mid": equity_value,
            "high": valuation_high,
        },
        "enterprise_value": ev_result["enterprise_value"],
        "wacc": wacc,
        "beta": beta,
        "sector": sector,
        "sector_multiples": multiples,
        "fcf_projections": fcf_projections,
        "terminal_value": ev_result["terminal_value"],
        "pv_terminal_value": ev_result["pv_terminal_value"],
        "pv_fcf_total": ev_result["pv_fcf_total"],
        "pv_fcf": ev_result["pv_fcf"],
        "founder_discount": round(founder_dependency * 0.35 * 100, 1),
        "risk_score": risk_score,
        "maturity_index": maturity_index,
        "percentile": percentile,
        "parameters": {
            "revenue": revenue,
            "net_margin": effective_margin,
            "growth_rate": effective_growth,
            "debt": debt,
            "cash": cash,
            "founder_dependency": founder_dependency,
            "years_of_data": years_of_data,
            "projection_years": projection_years,
        },
    }


# ─── IBGE-Enhanced Valuation ────────────────────────────

def run_valuation_with_ibge(
    revenue: float,
    net_margin: float,
    sector: str,
    ibge_adjustment: Optional[Dict[str, Any]] = None,
    growth_rate: Optional[float] = None,
    debt: float = 0,
    cash: float = 0,
    founder_dependency: float = 0.0,
    years_of_data: int = 1,
    projection_years: int = 5,
    custom_wacc: Optional[float] = None,
    custom_growth: Optional[float] = None,
    custom_margin: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Executa valuation DCF com ajuste setorial IBGE.

    ibge_adjustment é um dict com:
    - adjusted_growth_rate: taxa de crescimento ajustada pelo setor
    - sector_risk_premium: prêmio de risco setorial
    - benchmark_revenue: receita média do setor
    - sector_position: posição da empresa (acima/abaixo/na_media)
    - confidence_level: nível de confiança dos dados (0-1)
    """
    # Determinar crescimento efetivo com IBGE
    if custom_growth is not None:
        effective_growth = custom_growth
    elif ibge_adjustment and ibge_adjustment.get("adjusted_growth_rate") is not None:
        # Blend: crescimento informado com ajuste IBGE
        confidence = ibge_adjustment.get("confidence_level", 0.5)
        ibge_growth = ibge_adjustment["adjusted_growth_rate"]
        if growth_rate is not None:
            effective_growth = growth_rate * (1 - confidence * 0.4) + ibge_growth * (confidence * 0.4)
        else:
            effective_growth = ibge_growth
    else:
        effective_growth = growth_rate or 0.10

    effective_margin = custom_margin if custom_margin is not None else net_margin

    # Setor data
    beta = get_sector_beta(sector)
    multiples = get_sector_multiples(sector)

    # Debt ratio
    total_capital = revenue * 3
    debt_ratio = debt / (debt + total_capital) if (debt + total_capital) > 0 else 0

    # WACC com prêmio de risco IBGE
    sector_risk_premium = 0.0
    if ibge_adjustment and ibge_adjustment.get("sector_risk_premium"):
        sector_risk_premium = ibge_adjustment["sector_risk_premium"]

    wacc = custom_wacc if custom_wacc is not None else calculate_wacc(
        beta=beta,
        debt_ratio=debt_ratio,
        micro_premium=0.04 + sector_risk_premium,  # Base + IBGE premium
    )

    # FCF, TV, EV, Equity — mesma lógica
    fcf_projections = project_fcf(
        revenue=revenue,
        net_margin=effective_margin,
        growth_rate=effective_growth,
        years=projection_years,
    )

    last_fcf = fcf_projections[-1]["fcf"]
    terminal_value = calculate_terminal_value(last_fcf=last_fcf, wacc=wacc)

    ev_result = calculate_enterprise_value(
        fcf_projections=fcf_projections,
        wacc=wacc,
        terminal_value=terminal_value,
    )

    equity_raw = calculate_equity_value(
        enterprise_value=ev_result["enterprise_value"],
        cash=cash,
        debt=debt,
    )

    equity_value = apply_founder_discount(equity_raw, founder_dependency)

    risk_score = calculate_risk_score(
        net_margin=effective_margin,
        growth_rate=effective_growth,
        debt_ratio=debt_ratio,
        founder_dependency=founder_dependency,
        sector_beta=beta,
    )

    # Ajustar risk_score se tiver dados IBGE
    if ibge_adjustment and ibge_adjustment.get("sector_risk_premium"):
        ibge_risk_adj = ibge_adjustment["sector_risk_premium"] * 100
        risk_score = round(max(0, min(100, risk_score + ibge_risk_adj)), 1)

    maturity_index = calculate_maturity_index(
        revenue=revenue,
        net_margin=effective_margin,
        growth_rate=effective_growth,
        founder_dependency=founder_dependency,
        years_of_data=years_of_data,
    )

    percentile = calculate_percentile(
        equity_value=equity_value,
        revenue=revenue,
        sector=sector,
    )

    valuation_low = round(equity_value * 0.80, 2)
    valuation_high = round(equity_value * 1.20, 2)

    result = {
        "equity_value": equity_value,
        "equity_value_raw": equity_raw,
        "valuation_range": {
            "low": valuation_low,
            "mid": equity_value,
            "high": valuation_high,
        },
        "enterprise_value": ev_result["enterprise_value"],
        "wacc": wacc,
        "beta": beta,
        "sector": sector,
        "sector_multiples": multiples,
        "fcf_projections": fcf_projections,
        "terminal_value": ev_result["terminal_value"],
        "pv_terminal_value": ev_result["pv_terminal_value"],
        "pv_fcf_total": ev_result["pv_fcf_total"],
        "pv_fcf": ev_result["pv_fcf"],
        "founder_discount": round(founder_dependency * 0.35 * 100, 1),
        "risk_score": risk_score,
        "maturity_index": maturity_index,
        "percentile": percentile,
        "parameters": {
            "revenue": revenue,
            "net_margin": effective_margin,
            "growth_rate": effective_growth,
            "debt": debt,
            "cash": cash,
            "founder_dependency": founder_dependency,
            "years_of_data": years_of_data,
            "projection_years": projection_years,
        },
    }

    # Incluir dados IBGE no resultado
    if ibge_adjustment:
        result["ibge_sector_data"] = {
            "adjusted_growth_rate": ibge_adjustment.get("adjusted_growth_rate"),
            "sector_risk_premium": ibge_adjustment.get("sector_risk_premium"),
            "benchmark_revenue": ibge_adjustment.get("benchmark_revenue"),
            "benchmark_growth": ibge_adjustment.get("benchmark_growth"),
            "sector_position": ibge_adjustment.get("sector_position"),
            "confidence_level": ibge_adjustment.get("confidence_level"),
            "data_source": ibge_adjustment.get("data_source", "IBGE/SIDRA"),
        }

    return result
