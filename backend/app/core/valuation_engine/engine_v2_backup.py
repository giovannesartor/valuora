"""
Quanto Vale — Valuation Engine v2
Motor financeiro baseado em DCF (Fluxo de Caixa Descontado).

Melhorias v2:
 #1  EBIT margin (sem dupla tributação)
 #2  Faixa ajustada por risco (não flat ±20%)
 #3  Múltiplos setoriais como cross-check
 #4  Guard para Terminal Value negativo
 #7  Tabela de sensibilidade 5×5
 #8  TV % do EV exibido
 #10 Mean-reversion exponencial ao PIB
 #11 Beta re-alavancado pela estrutura de capital
 #14 Dados para waterfall chart
 #15 Selic dinâmica via BCB API
 #16 Múltiplos calibrados para PMEs brasileiras
"""

from typing import Dict, Any, Optional, List
import math
import asyncio
import httpx

# ─── Selic Cache ─────────────────────────────────────────
_selic_cache: Dict[str, float] = {"rate": 0.1075}  # Fallback


async def fetch_selic_rate() -> float:
    """Busca taxa Selic atual via API do Banco Central."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json"
            )
            resp.raise_for_status()
            data = resp.json()
            rate = float(data[0]["valor"]) / 100
            _selic_cache["rate"] = rate
            return rate
    except Exception:
        return _selic_cache["rate"]


def get_selic() -> float:
    return _selic_cache["rate"]


# ─── Sector Betas (UNLEVERED) ────────────────────────────
SECTOR_BETAS_UNLEVERED = {
    "tecnologia": 1.10,
    "saude": 0.80,
    "varejo": 0.90,
    "industria": 0.85,
    "servicos": 0.88,
    "alimentacao": 0.70,
    "educacao": 0.75,
    "construcao": 0.95,
    "agronegocio": 0.82,
    "financeiro": 0.98,
    "logistica": 0.90,
    "energia": 0.78,
    "imobiliario": 0.85,
    "consultoria": 0.82,
    "marketing": 0.95,
    "ecommerce": 1.05,
    "outros": 0.85,
}

# ─── Múltiplos calibrados para PMEs brasileiras (#16) ────
SECTOR_MULTIPLES = {
    "tecnologia": {"ev_revenue": 2.5, "ev_ebitda": 8.0},
    "saude": {"ev_revenue": 1.8, "ev_ebitda": 7.0},
    "varejo": {"ev_revenue": 0.8, "ev_ebitda": 5.0},
    "industria": {"ev_revenue": 0.9, "ev_ebitda": 4.5},
    "servicos": {"ev_revenue": 1.4, "ev_ebitda": 6.0},
    "alimentacao": {"ev_revenue": 0.7, "ev_ebitda": 4.5},
    "educacao": {"ev_revenue": 1.5, "ev_ebitda": 6.5},
    "construcao": {"ev_revenue": 0.7, "ev_ebitda": 4.0},
    "agronegocio": {"ev_revenue": 0.8, "ev_ebitda": 4.5},
    "financeiro": {"ev_revenue": 2.0, "ev_ebitda": 7.0},
    "logistica": {"ev_revenue": 1.0, "ev_ebitda": 5.0},
    "energia": {"ev_revenue": 1.1, "ev_ebitda": 5.5},
    "imobiliario": {"ev_revenue": 1.2, "ev_ebitda": 5.5},
    "consultoria": {"ev_revenue": 1.4, "ev_ebitda": 6.0},
    "marketing": {"ev_revenue": 1.1, "ev_ebitda": 5.5},
    "ecommerce": {"ev_revenue": 1.6, "ev_ebitda": 6.5},
    "outros": {"ev_revenue": 1.0, "ev_ebitda": 5.0},
}

LONG_TERM_GDP_GROWTH = 0.06  # PIB nominal BR longo prazo (~3% real + 3% inflação)


def get_sector_beta_unlevered(sector: str) -> float:
    return SECTOR_BETAS_UNLEVERED.get(sector.lower(), 0.85)


def get_sector_multiples(sector: str) -> Dict[str, float]:
    return SECTOR_MULTIPLES.get(sector.lower(), SECTOR_MULTIPLES["outros"])


def relever_beta(beta_unlevered: float, debt: float, equity_proxy: float, tax_rate: float = 0.34) -> float:
    """Re-alavanca beta pela estrutura de capital: β_L = β_U × (1 + (1-t) × D/E)  (#11)"""
    if equity_proxy <= 0:
        return beta_unlevered
    de_ratio = debt / equity_proxy
    return round(beta_unlevered * (1 + (1 - tax_rate) * de_ratio), 4)


def net_margin_to_ebit_margin(net_margin: float, tax_rate: float = 0.34) -> float:
    """Converte net_margin em ebit_margin para evitar dupla tributação (#1)."""
    return net_margin / (1 - tax_rate) if (1 - tax_rate) > 0 else net_margin


# ─── WACC Calculation ────────────────────────────────────

def calculate_wacc(
    beta_levered: float,
    risk_free_rate: Optional[float] = None,
    market_premium: float = 0.065,
    micro_premium: float = 0.04,
    debt_ratio: float = 0.0,
    cost_of_debt: float = 0.14,
    tax_rate: float = 0.34,
) -> float:
    """Calcula WACC com Selic dinâmica (#15).

    Ke = Rf + β_L × (Rm - Rf) + prêmio micro
    WACC = Ke × E/(D+E) + Kd × (1-t) × D/(D+E)
    """
    rf = risk_free_rate if risk_free_rate is not None else get_selic()
    ke = rf + beta_levered * market_premium + micro_premium
    equity_ratio = 1 - debt_ratio
    wacc = ke * equity_ratio + cost_of_debt * (1 - tax_rate) * debt_ratio
    return round(wacc, 4)


# ─── FCF Projection ─────────────────────────────────────

def project_fcf(
    revenue: float,
    ebit_margin: float,
    growth_rate: float,
    years: int = 5,
    capex_ratio: float = 0.05,
    nwc_ratio: float = 0.03,
    depreciation_ratio: float = 0.03,
    tax_rate: float = 0.34,
) -> List[Dict[str, float]]:
    """Projeta FCL com mean-reversion exponencial ao PIB (#1, #10).

    ebit_margin = margem EBIT (antes do imposto).
    NOPAT = EBIT × (1 - t) → evita dupla tributação.
    Crescimento converge exponencialmente: g(t) = g_init*e^(-λt) + g_gdp*(1-e^(-λt))
    """
    projections = []
    prev_revenue = revenue
    decay_lambda = 0.3  # velocidade de convergência

    for year in range(1, years + 1):
        exp_decay = math.exp(-decay_lambda * year)
        adjusted_growth = growth_rate * exp_decay + LONG_TERM_GDP_GROWTH * (1 - exp_decay)
        current_revenue = prev_revenue * (1 + adjusted_growth)

        ebit = current_revenue * ebit_margin
        nopat = ebit * (1 - tax_rate)
        depreciation = current_revenue * depreciation_ratio
        capex = current_revenue * capex_ratio
        delta_nwc = nwc_ratio * (current_revenue - prev_revenue)

        fcf = nopat + depreciation - capex - delta_nwc

        projections.append({
            "year": year,
            "revenue": round(current_revenue, 2),
            "growth_rate": round(adjusted_growth, 4),
            "ebit_margin": round(ebit_margin, 4),
            "ebit": round(ebit, 2),
            "nopat": round(nopat, 2),
            "depreciation": round(depreciation, 2),
            "capex": round(capex, 2),
            "delta_nwc": round(delta_nwc, 2),
            "fcf": round(fcf, 2),
        })
        prev_revenue = current_revenue

    return projections


# ─── Terminal Value ──────────────────────────────────────

def calculate_terminal_value(
    last_fcf: float,
    wacc: float,
    perpetuity_growth: float = 0.035,
) -> Dict[str, Any]:
    """Terminal Value com guard para FCF negativo (#4).

    Retorna dict com tv, method, warnings.
    Se last_fcf <= 0 → TV = 0 com warning.
    """
    warnings: List[str] = []

    if last_fcf <= 0:
        warnings.append("FCF no último ano projetado é negativo/zero. Terminal Value definido como zero.")
        return {"terminal_value": 0, "method": "gordon_growth", "warnings": warnings}

    if wacc <= perpetuity_growth:
        perpetuity_growth = wacc * 0.5
        warnings.append(f"Taxa de crescimento perpétuo ajustada para {perpetuity_growth*100:.1f}% (era maior que WACC).")

    tv = last_fcf * (1 + perpetuity_growth) / (wacc - perpetuity_growth)

    return {
        "terminal_value": round(tv, 2),
        "method": "gordon_growth",
        "warnings": warnings,
    }


# ─── Enterprise Value ───────────────────────────────────

def calculate_enterprise_value(
    fcf_projections: List[Dict[str, float]],
    wacc: float,
    terminal_value: float,
) -> Dict[str, float]:
    """EV com TV % exibido (#8)."""
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

    tv_percentage = (pv_terminal / enterprise_value * 100) if enterprise_value > 0 else 0

    return {
        "pv_fcf": pv_fcf,
        "pv_fcf_total": round(pv_fcf_total, 2),
        "terminal_value": round(terminal_value, 2),
        "pv_terminal_value": round(pv_terminal, 2),
        "enterprise_value": round(enterprise_value, 2),
        "tv_percentage": round(tv_percentage, 1),
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


# ─── Multiples Valuation (#3, #6, #16) ──────────────────

def calculate_multiples_valuation(
    revenue: float,
    ebit_margin: float,
    sector: str,
    debt: float = 0,
    cash: float = 0,
) -> Dict[str, Any]:
    """Cross-check por múltiplos setoriais calibrados para PMEs BR."""
    multiples = get_sector_multiples(sector)
    ev_rev = multiples["ev_revenue"]
    ev_ebitda = multiples["ev_ebitda"]

    ebitda = revenue * ebit_margin  # proxy: EBIT ≈ EBITDA para PMEs

    ev_by_revenue = revenue * ev_rev
    ev_by_ebitda = ebitda * ev_ebitda

    eq_by_revenue = ev_by_revenue + cash - debt
    eq_by_ebitda = ev_by_ebitda + cash - debt

    eq_avg = (eq_by_revenue + eq_by_ebitda) / 2

    return {
        "ev_revenue_multiple": ev_rev,
        "ev_ebitda_multiple": ev_ebitda,
        "ebitda_estimated": round(ebitda, 2),
        "ev_by_revenue": round(ev_by_revenue, 2),
        "ev_by_ebitda": round(ev_by_ebitda, 2),
        "equity_by_revenue": round(eq_by_revenue, 2),
        "equity_by_ebitda": round(eq_by_ebitda, 2),
        "equity_avg_multiples": round(eq_avg, 2),
    }


# ─── Valuation Range ajustada por risco (#2) ────────────

def calculate_valuation_range(
    equity_value: float,
    risk_score: float,
    maturity_index: float,
    founder_dependency: float,
) -> Dict[str, Any]:
    """Faixa não é flat ±20% — depende de risco e maturidade."""
    # spread entre 10% (empresa madura, baixo risco) e 45% (startup, alto risco)
    risk_factor = risk_score / 100  # 0-1
    maturity_factor = (100 - maturity_index) / 100  # 0-1
    raw_spread = 0.10 + 0.35 * (0.5 * risk_factor + 0.3 * maturity_factor + 0.2 * founder_dependency)
    spread = round(max(0.10, min(0.45, raw_spread)), 2)

    return {
        "low": round(equity_value * (1 - spread), 2),
        "mid": equity_value,
        "high": round(equity_value * (1 + spread), 2),
        "spread_pct": round(spread * 100, 1),
    }


# ─── Sensitivity Table 5×5 (#7) ─────────────────────────

def calculate_sensitivity_table(
    revenue: float,
    ebit_margin: float,
    growth_rate: float,
    wacc: float,
    debt: float,
    cash: float,
    founder_dependency: float,
    years_of_data: int,
    projection_years: int,
    sector: str,
) -> Dict[str, Any]:
    """Gera matrix 5×5 de Equity variando WACC e Growth."""
    wacc_steps = [round((wacc + delta) * 100, 1) for delta in [-0.03, -0.015, 0, 0.015, 0.03]]
    growth_steps = [round((growth_rate + delta) * 100, 1) for delta in [-0.04, -0.02, 0, 0.02, 0.04]]

    equity_matrix = []
    for w_pct in wacc_steps:
        row = []
        w = w_pct / 100
        for g_pct in growth_steps:
            g = g_pct / 100
            fcf_proj = project_fcf(revenue=revenue, ebit_margin=ebit_margin, growth_rate=g, years=projection_years)
            last_fcf = fcf_proj[-1]["fcf"]
            tv_result = calculate_terminal_value(last_fcf=last_fcf, wacc=w)
            tv = tv_result["terminal_value"]
            ev_r = calculate_enterprise_value(fcf_projections=fcf_proj, wacc=w, terminal_value=tv)
            eq_raw = calculate_equity_value(enterprise_value=ev_r["enterprise_value"], cash=cash, debt=debt)
            eq = apply_founder_discount(eq_raw, founder_dependency)
            row.append(round(eq, 2))
        equity_matrix.append(row)

    return {
        "wacc_values": wacc_steps,
        "growth_values": growth_steps,
        "equity_matrix": equity_matrix,
    }


# ─── Waterfall data (#14) ───────────────────────────────

def build_waterfall(
    pv_fcf_total: float,
    pv_terminal: float,
    cash: float,
    debt: float,
    founder_discount_pct: float,
    equity_raw: float,
    equity_final: float,
) -> List[Dict[str, Any]]:
    """Dados para waterfall chart: EV → Equity."""
    items = [
        {"label": "VP dos FCFs", "value": round(pv_fcf_total, 2), "type": "positive"},
        {"label": "VP Terminal Value", "value": round(pv_terminal, 2), "type": "positive"},
        {"label": "Enterprise Value", "value": round(pv_fcf_total + pv_terminal, 2), "type": "subtotal"},
    ]
    if cash > 0:
        items.append({"label": "(+) Caixa", "value": round(cash, 2), "type": "positive"})
    if debt > 0:
        items.append({"label": "(-) Dívida", "value": round(-debt, 2), "type": "negative"})
    if founder_discount_pct > 0:
        discount_value = equity_raw - equity_final
        items.append({"label": f"(-) Desc. Fundador ({founder_discount_pct:.0f}%)", "value": round(-discount_value, 2), "type": "negative"})
    items.append({"label": "Equity Value", "value": round(equity_final, 2), "type": "total"})
    return items


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
    """Valuation v2 — DCF + Múltiplos + Sensibilidade + Waterfall."""
    effective_margin_net = custom_margin if custom_margin is not None else net_margin
    effective_growth = custom_growth if custom_growth is not None else (growth_rate or 0.10)

    # 1. Converter net_margin → ebit_margin (#1)
    ebit_margin = net_margin_to_ebit_margin(effective_margin_net)

    # 2. Beta unlevered → re-levered (#11)
    beta_u = get_sector_beta_unlevered(sector)
    equity_proxy = revenue * 3
    beta_l = relever_beta(beta_u, debt, equity_proxy)

    # 3. Debt ratio
    total_capital = equity_proxy
    debt_ratio = debt / (debt + total_capital) if (debt + total_capital) > 0 else 0

    # 4. WACC (#15 — Selic dinâmica)
    wacc = custom_wacc if custom_wacc is not None else calculate_wacc(
        beta_levered=beta_l,
        debt_ratio=debt_ratio,
    )

    # 5. FCF Projections (#1 ebit_margin, #10 mean-reversion)
    fcf_projections = project_fcf(
        revenue=revenue,
        ebit_margin=ebit_margin,
        growth_rate=effective_growth,
        years=projection_years,
    )

    # 6. Terminal Value (#4 guard)
    last_fcf = fcf_projections[-1]["fcf"]
    tv_result = calculate_terminal_value(last_fcf=last_fcf, wacc=wacc)
    terminal_value = tv_result["terminal_value"]

    # 7. Enterprise Value (#8 TV%)
    ev_result = calculate_enterprise_value(
        fcf_projections=fcf_projections,
        wacc=wacc,
        terminal_value=terminal_value,
    )

    # 8. Equity DCF
    equity_raw = calculate_equity_value(
        enterprise_value=ev_result["enterprise_value"],
        cash=cash,
        debt=debt,
    )
    equity_dcf = apply_founder_discount(equity_raw, founder_dependency)

    # 9. Multiples valuation (#3, #16)
    multiples_val = calculate_multiples_valuation(
        revenue=revenue,
        ebit_margin=ebit_margin,
        sector=sector,
        debt=debt,
        cash=cash,
    )

    # 10. Triangulated equity: 70% DCF + 30% Multiples
    equity_multiples = multiples_val["equity_avg_multiples"]
    equity_value = round(equity_dcf * 0.70 + equity_multiples * 0.30, 2)

    # 11. Risk Score
    risk_score = calculate_risk_score(
        net_margin=effective_margin_net,
        growth_rate=effective_growth,
        debt_ratio=debt_ratio,
        founder_dependency=founder_dependency,
        sector_beta=beta_l,
    )

    # 12. Maturity Index
    maturity_index = calculate_maturity_index(
        revenue=revenue,
        net_margin=effective_margin_net,
        growth_rate=effective_growth,
        founder_dependency=founder_dependency,
        years_of_data=years_of_data,
    )

    # 13. Percentile
    percentile = calculate_percentile(
        equity_value=equity_value,
        revenue=revenue,
        sector=sector,
    )

    # 14. Valuation range (#2)
    valuation_range = calculate_valuation_range(equity_value, risk_score, maturity_index, founder_dependency)

    # 15. Sensitivity table (#7)
    sensitivity_table = calculate_sensitivity_table(
        revenue=revenue, ebit_margin=ebit_margin, growth_rate=effective_growth,
        wacc=wacc, debt=debt, cash=cash, founder_dependency=founder_dependency,
        years_of_data=years_of_data, projection_years=projection_years, sector=sector,
    )

    # 16. Waterfall (#14)
    founder_disc_pct = founder_dependency * 0.35 * 100
    waterfall = build_waterfall(
        pv_fcf_total=ev_result["pv_fcf_total"],
        pv_terminal=ev_result["pv_terminal_value"],
        cash=cash, debt=debt,
        founder_discount_pct=founder_disc_pct,
        equity_raw=equity_raw, equity_final=equity_dcf,
    )

    return {
        "equity_value": equity_value,
        "equity_value_dcf": equity_dcf,
        "equity_value_raw": equity_raw,
        "multiples_valuation": multiples_val,
        "valuation_range": valuation_range,
        "enterprise_value": ev_result["enterprise_value"],
        "wacc": wacc,
        "beta_unlevered": beta_u,
        "beta_levered": beta_l,
        "sector": sector,
        "sector_multiples": get_sector_multiples(sector),
        "fcf_projections": fcf_projections,
        "terminal_value": ev_result["terminal_value"],
        "terminal_value_info": tv_result,
        "tv_percentage": ev_result["tv_percentage"],
        "pv_terminal_value": ev_result["pv_terminal_value"],
        "pv_fcf_total": ev_result["pv_fcf_total"],
        "pv_fcf": ev_result["pv_fcf"],
        "founder_discount": round(founder_disc_pct, 1),
        "risk_score": risk_score,
        "maturity_index": maturity_index,
        "percentile": percentile,
        "sensitivity_table": sensitivity_table,
        "waterfall": waterfall,
        "parameters": {
            "revenue": revenue,
            "net_margin": effective_margin_net,
            "ebit_margin": ebit_margin,
            "growth_rate": effective_growth,
            "debt": debt,
            "cash": cash,
            "founder_dependency": founder_dependency,
            "years_of_data": years_of_data,
            "projection_years": projection_years,
            "selic_rate": get_selic(),
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
    """Valuation v2 com ajuste IBGE — mesma lógica do run_valuation."""
    # Crescimento efetivo com IBGE
    if custom_growth is not None:
        effective_growth = custom_growth
    elif ibge_adjustment and ibge_adjustment.get("adjusted_growth_rate") is not None:
        confidence = ibge_adjustment.get("confidence_level", 0.5)
        ibge_growth = ibge_adjustment["adjusted_growth_rate"]
        if growth_rate is not None:
            effective_growth = growth_rate * (1 - confidence * 0.4) + ibge_growth * (confidence * 0.4)
        else:
            effective_growth = ibge_growth
    else:
        effective_growth = growth_rate or 0.10

    effective_margin_net = custom_margin if custom_margin is not None else net_margin
    ebit_margin = net_margin_to_ebit_margin(effective_margin_net)

    # Beta re-alavancado (#11)
    beta_u = get_sector_beta_unlevered(sector)
    equity_proxy = revenue * 3
    beta_l = relever_beta(beta_u, debt, equity_proxy)

    # Debt ratio
    total_capital = equity_proxy
    debt_ratio = debt / (debt + total_capital) if (debt + total_capital) > 0 else 0

    # WACC com IBGE risk premium
    sector_risk_premium = 0.0
    if ibge_adjustment and ibge_adjustment.get("sector_risk_premium"):
        sector_risk_premium = ibge_adjustment["sector_risk_premium"]

    wacc = custom_wacc if custom_wacc is not None else calculate_wacc(
        beta_levered=beta_l,
        debt_ratio=debt_ratio,
        micro_premium=0.04 + sector_risk_premium,
    )

    # FCF (#1, #10)
    fcf_projections = project_fcf(
        revenue=revenue, ebit_margin=ebit_margin,
        growth_rate=effective_growth, years=projection_years,
    )

    # Terminal Value (#4)
    last_fcf = fcf_projections[-1]["fcf"]
    tv_result = calculate_terminal_value(last_fcf=last_fcf, wacc=wacc)
    terminal_value = tv_result["terminal_value"]

    # Enterprise Value (#8)
    ev_result = calculate_enterprise_value(
        fcf_projections=fcf_projections, wacc=wacc, terminal_value=terminal_value,
    )

    # Equity DCF
    equity_raw = calculate_equity_value(
        enterprise_value=ev_result["enterprise_value"], cash=cash, debt=debt,
    )
    equity_dcf = apply_founder_discount(equity_raw, founder_dependency)

    # Multiples (#3, #16)
    multiples_val = calculate_multiples_valuation(
        revenue=revenue, ebit_margin=ebit_margin, sector=sector, debt=debt, cash=cash,
    )
    equity_multiples = multiples_val["equity_avg_multiples"]
    equity_value = round(equity_dcf * 0.70 + equity_multiples * 0.30, 2)

    # Risk, maturity, percentile
    risk_score = calculate_risk_score(
        net_margin=effective_margin_net, growth_rate=effective_growth,
        debt_ratio=debt_ratio, founder_dependency=founder_dependency, sector_beta=beta_l,
    )
    if ibge_adjustment and ibge_adjustment.get("sector_risk_premium"):
        risk_score = round(max(0, min(100, risk_score + ibge_adjustment["sector_risk_premium"] * 100)), 1)

    maturity_index = calculate_maturity_index(
        revenue=revenue, net_margin=effective_margin_net,
        growth_rate=effective_growth, founder_dependency=founder_dependency,
        years_of_data=years_of_data,
    )
    percentile = calculate_percentile(equity_value=equity_value, revenue=revenue, sector=sector)

    # Range (#2)
    valuation_range = calculate_valuation_range(equity_value, risk_score, maturity_index, founder_dependency)

    # Sensitivity (#7)
    sensitivity_table = calculate_sensitivity_table(
        revenue=revenue, ebit_margin=ebit_margin, growth_rate=effective_growth,
        wacc=wacc, debt=debt, cash=cash, founder_dependency=founder_dependency,
        years_of_data=years_of_data, projection_years=projection_years, sector=sector,
    )

    # Waterfall (#14)
    founder_disc_pct = founder_dependency * 0.35 * 100
    waterfall = build_waterfall(
        pv_fcf_total=ev_result["pv_fcf_total"], pv_terminal=ev_result["pv_terminal_value"],
        cash=cash, debt=debt, founder_discount_pct=founder_disc_pct,
        equity_raw=equity_raw, equity_final=equity_dcf,
    )

    result = {
        "equity_value": equity_value,
        "equity_value_dcf": equity_dcf,
        "equity_value_raw": equity_raw,
        "multiples_valuation": multiples_val,
        "valuation_range": valuation_range,
        "enterprise_value": ev_result["enterprise_value"],
        "wacc": wacc,
        "beta_unlevered": beta_u,
        "beta_levered": beta_l,
        "sector": sector,
        "sector_multiples": get_sector_multiples(sector),
        "fcf_projections": fcf_projections,
        "terminal_value": ev_result["terminal_value"],
        "terminal_value_info": tv_result,
        "tv_percentage": ev_result["tv_percentage"],
        "pv_terminal_value": ev_result["pv_terminal_value"],
        "pv_fcf_total": ev_result["pv_fcf_total"],
        "pv_fcf": ev_result["pv_fcf"],
        "founder_discount": round(founder_disc_pct, 1),
        "risk_score": risk_score,
        "maturity_index": maturity_index,
        "percentile": percentile,
        "sensitivity_table": sensitivity_table,
        "waterfall": waterfall,
        "parameters": {
            "revenue": revenue,
            "net_margin": effective_margin_net,
            "ebit_margin": ebit_margin,
            "growth_rate": effective_growth,
            "debt": debt,
            "cash": cash,
            "founder_dependency": founder_dependency,
            "years_of_data": years_of_data,
            "projection_years": projection_years,
            "selic_rate": get_selic(),
        },
    }

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
