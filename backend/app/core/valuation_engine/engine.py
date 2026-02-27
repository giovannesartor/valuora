"""
Quanto Vale — Valuation Engine v3
Motor financeiro baseado em DCF (Fluxo de Caixa Descontado).

Melhorias v3:
 - DCF Gordon Growth + DCF Exit Multiple (dois métodos)
 - Múltiplos como método independente com peso ajustável
 - DLOM (Discount for Lack of Marketability)
 - Taxa de sobrevivência setorial (SEBRAE/IBGE)
 - Dados Damodaran dinâmicos (betas + múltiplos via JSON)
 - Setores IBGE expandidos (~35 setores)
 - Perguntas qualitativas (score 0-100)
 - P&L projetado completo
 - Simulação de rodada de investimento
 - Projeção 5 ou 10 anos
"""

from typing import Dict, Any, Optional, List
import math
import json
import os
import asyncio
import httpx

# ─── Load Damodaran Data ─────────────────────────────────
_DATA_DIR = os.path.dirname(os.path.abspath(__file__))

def _load_damodaran() -> Dict[str, Any]:
    path = os.path.join(_DATA_DIR, "damodaran_data.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

_DAMODARAN = _load_damodaran()


# ─── Selic Cache ─────────────────────────────────────────
_selic_cache: Dict[str, float] = {"rate": 0.1475}


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


# ─── Sector Data from Damodaran ──────────────────────────

def get_sector_beta_unlevered(sector: str) -> float:
    betas = _DAMODARAN.get("betas_unlevered", {})
    return betas.get(sector.lower(), 0.85)


def get_sector_multiples(sector: str) -> Dict[str, float]:
    multiples = _DAMODARAN.get("multiples", {})
    return multiples.get(sector.lower(), {"ev_revenue": 1.0, "ev_ebitda": 6.0})


def get_survival_rates(sector: str) -> Dict[str, float]:
    rates = _DAMODARAN.get("survival_rates", {})
    return rates.get(sector.lower(), {"1yr": 0.80, "3yr": 0.58, "5yr": 0.45, "10yr": 0.32})


LONG_TERM_GDP_GROWTH = 0.03  # Long-term real GDP growth (Brazil ~2-3%)


# ─── Helper functions ────────────────────────────────────

def relever_beta(beta_unlevered: float, debt: float, equity_proxy: float, tax_rate: float = 0.34) -> float:
    if equity_proxy <= 0:
        return beta_unlevered
    de_ratio = debt / equity_proxy
    return round(beta_unlevered * (1 + (1 - tax_rate) * de_ratio), 4)


def net_margin_to_ebit_margin(net_margin: float, tax_rate: float = 0.34) -> float:
    return net_margin / (1 - tax_rate) if (1 - tax_rate) > 0 else net_margin


# ─── WACC ────────────────────────────────────────────────

def calculate_wacc(
    beta_levered: float,
    risk_free_rate: Optional[float] = None,
    market_premium: float = 0.065,
    micro_premium: float = 0.04,
    debt_ratio: float = 0.0,
    cost_of_debt: float = 0.14,
    tax_rate: float = 0.34,
) -> float:
    rf = risk_free_rate if risk_free_rate is not None else get_selic()
    ke = rf + beta_levered * market_premium + micro_premium
    equity_ratio = 1 - debt_ratio
    wacc = ke * equity_ratio + cost_of_debt * (1 - tax_rate) * debt_ratio
    return round(wacc, 4)


# ─── Cost of Equity — 4-Factor Methodology ──────────────

def calculate_cost_of_equity(
    sector: str, num_employees: int = 0, years_in_business: int = 3,
    net_margin: float = 0.10, debt: float = 0, equity_proxy: float = 1,
    founder_dependency: float = 0.0,
    risk_free_rate: Optional[float] = None,
    market_premium: float = 0.08,
) -> Dict[str, Any]:
    """Cost of Equity (4-factor): Rf + beta_4factor x MRP + key-person premium.

    4-Factor Beta = Industry beta + Size adj + Stage adj + Profitability adj
    (source: Damodaran 4-factor approach)
    """
    rf = risk_free_rate if risk_free_rate is not None else get_selic()
    beta_u = get_sector_beta_unlevered(sector)

    # Factor 2: Size (number of employees as proxy for company size)
    if num_employees >= 100:  size_adj = -0.10
    elif num_employees >= 50: size_adj = 0.0
    elif num_employees >= 20: size_adj = 0.15
    elif num_employees >= 5:  size_adj = 0.35
    elif num_employees >= 1:  size_adj = 0.55
    else:                     size_adj = 0.70

    # Factor 3: Stage (business maturity — years in operation)
    if years_in_business >= 15:  stage_adj = -0.10
    elif years_in_business >= 10: stage_adj = -0.05
    elif years_in_business >= 7:  stage_adj = 0.0
    elif years_in_business >= 5:  stage_adj = 0.10
    elif years_in_business >= 3:  stage_adj = 0.25
    elif years_in_business >= 1:  stage_adj = 0.45
    else:                         stage_adj = 0.65

    # Factor 4: Profitability
    if net_margin > 0.20:    profit_adj = -0.10
    elif net_margin > 0.10:  profit_adj = -0.05
    elif net_margin > 0.05:  profit_adj = 0.0
    elif net_margin > 0:     profit_adj = 0.15
    elif net_margin > -0.10: profit_adj = 0.30
    else:                    profit_adj = 0.50

    beta_4f = max(0.30, beta_u + size_adj + stage_adj + profit_adj)
    beta_levered = relever_beta(beta_4f, debt, equity_proxy)

    # Key-person premium (replaces separate founder discount)
    kp_premium = founder_dependency * 0.04  # 0–4% addition to Ke

    ke = rf + beta_levered * market_premium + kp_premium

    return {
        "cost_of_equity": round(ke, 4),
        "risk_free_rate": round(rf, 4),
        "market_premium": market_premium,
        "beta_unlevered": round(beta_u, 4),
        "beta_4factor": round(beta_4f, 4),
        "beta_levered": round(beta_levered, 4),
        "size_adj": size_adj,
        "stage_adj": stage_adj,
        "profit_adj": profit_adj,
        "key_person_premium": round(kp_premium, 4),
    }


# ─── FCF Projection ─────────────────────────────────────

def project_fcf(
    revenue: float, ebit_margin: float, growth_rate: float,
    years: int = 5, capex_ratio: float = 0.05, nwc_ratio: float = 0.03,
    depreciation_ratio: float = 0.03, tax_rate: float = 0.34,
) -> List[Dict[str, float]]:
    projections = []
    prev_revenue = revenue
    decay_lambda = 0.3

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


# ─── FCFE Projection ─────────────────────────────────────

def project_fcfe(
    revenue: float, net_margin: float, growth_rate: float,
    years: int = 5, capex_ratio: float = 0.05, nwc_ratio: float = 0.03,
    depreciation_ratio: float = 0.03,
) -> List[Dict[str, float]]:
    """Project Free Cash Flow to Equity (FCFE).
    FCFE = Net Income + D&A - Capex - delta_NWC
    Discounted at Cost of Equity → result is equity directly (no EV→Equity bridge).
    """
    projections = []
    prev_revenue = revenue
    decay_lambda = 0.3
    ebit_margin = net_margin_to_ebit_margin(net_margin)

    for year in range(1, years + 1):
        exp_decay = math.exp(-decay_lambda * year)
        adjusted_growth = growth_rate * exp_decay + LONG_TERM_GDP_GROWTH * (1 - exp_decay)
        current_revenue = prev_revenue * (1 + adjusted_growth)
        net_income = current_revenue * net_margin
        depreciation = current_revenue * depreciation_ratio
        capex = current_revenue * capex_ratio
        delta_nwc = nwc_ratio * (current_revenue - prev_revenue)
        fcfe = net_income + depreciation - capex - delta_nwc

        projections.append({
            "year": year,
            "revenue": round(current_revenue, 2),
            "growth_rate": round(adjusted_growth, 4),
            "ebit_margin": round(ebit_margin, 4),
            "ebit": round(current_revenue * ebit_margin, 2),
            "nopat": round(net_income, 2),
            "depreciation": round(depreciation, 2),
            "capex": round(capex, 2),
            "delta_nwc": round(delta_nwc, 2),
            "fcf": round(fcfe, 2),
        })
        prev_revenue = current_revenue
    return projections


# ─── P&L Projetado ───────────────────────────────────────

def project_pnl(
    revenue: float, ebit_margin: float, growth_rate: float,
    net_margin: float, years: int = 5,
    cogs_pct: float = 0.55, opex_pct: float = 0.15, tax_rate: float = 0.34,
) -> List[Dict[str, float]]:
    pnl = []
    prev_revenue = revenue
    decay_lambda = 0.3

    for year in range(1, years + 1):
        exp_decay = math.exp(-decay_lambda * year)
        adj_growth = growth_rate * exp_decay + LONG_TERM_GDP_GROWTH * (1 - exp_decay)
        r = prev_revenue * (1 + adj_growth)
        cogs = r * cogs_pct
        gross_profit = r - cogs
        gross_margin = gross_profit / r if r > 0 else 0
        opex = r * opex_pct
        ebitda = gross_profit - opex
        ebitda_margin = ebitda / r if r > 0 else 0
        depreciation = r * 0.03
        ebit = ebitda - depreciation
        taxes = max(ebit * tax_rate, 0)
        net_income = ebit - taxes

        pnl.append({
            "year": year, "revenue": round(r, 2), "cogs": round(cogs, 2),
            "gross_profit": round(gross_profit, 2), "gross_margin": round(gross_margin, 4),
            "opex": round(opex, 2), "ebitda": round(ebitda, 2),
            "ebitda_margin": round(ebitda_margin, 4), "depreciation": round(depreciation, 2),
            "ebit": round(ebit, 2), "taxes": round(taxes, 2),
            "net_income": round(net_income, 2),
            "net_margin": round(net_income / r if r > 0 else 0, 4),
        })
        prev_revenue = r
    return pnl


# ─── Terminal Value — Gordon Growth ──────────────────────

def calculate_terminal_value_gordon(last_fcf: float, wacc: float, perpetuity_growth: float = 0.035) -> Dict[str, Any]:
    warnings: List[str] = []
    if last_fcf <= 0:
        warnings.append("FCF no último ano é negativo/zero. TV = 0.")
        return {"terminal_value": 0, "method": "gordon_growth", "perpetuity_growth": perpetuity_growth, "warnings": warnings}
    if wacc <= perpetuity_growth:
        perpetuity_growth = wacc * 0.5
        warnings.append(f"Crescimento perpétuo ajustado para {perpetuity_growth*100:.1f}%.")
    tv = last_fcf * (1 + perpetuity_growth) / (wacc - perpetuity_growth)
    return {"terminal_value": round(tv, 2), "method": "gordon_growth", "perpetuity_growth": perpetuity_growth, "warnings": warnings}


# ─── Terminal Value — Exit Multiple ──────────────────────

def calculate_terminal_value_exit_multiple(last_year_ebitda: float, sector: str, custom_multiple: Optional[float] = None) -> Dict[str, Any]:
    warnings: List[str] = []
    multiples = get_sector_multiples(sector)
    exit_multiple = custom_multiple if custom_multiple is not None else multiples.get("ev_ebitda", 6.0)
    if last_year_ebitda <= 0:
        warnings.append("EBITDA negativo/zero. TV Exit Multiple = 0.")
        return {"terminal_value": 0, "method": "exit_multiple", "exit_multiple": exit_multiple, "warnings": warnings}
    tv = last_year_ebitda * exit_multiple
    return {"terminal_value": round(tv, 2), "method": "exit_multiple", "exit_multiple": exit_multiple, "warnings": warnings}


# ─── Enterprise Value ───────────────────────────────────

def calculate_enterprise_value(fcf_projections: List[Dict[str, float]], wacc: float, terminal_value: float) -> Dict[str, float]:
    pv_fcf = []
    for proj in fcf_projections:
        year = proj["year"]
        pv = proj["fcf"] / ((1 + wacc) ** year)
        pv_fcf.append(round(pv, 2))
    pv_fcf_total = sum(pv_fcf)
    last_year = len(fcf_projections)
    pv_terminal = terminal_value / ((1 + wacc) ** last_year)
    enterprise_value = pv_fcf_total + pv_terminal
    tv_percentage = (pv_terminal / enterprise_value * 100) if enterprise_value > 0 else 0
    return {
        "pv_fcf": pv_fcf, "pv_fcf_total": round(pv_fcf_total, 2),
        "terminal_value": round(terminal_value, 2), "pv_terminal_value": round(pv_terminal, 2),
        "enterprise_value": round(enterprise_value, 2), "tv_percentage": round(tv_percentage, 1),
    }


def calculate_equity_value(enterprise_value: float, cash: float, debt: float) -> float:
    return round(enterprise_value + cash - debt, 2)


def apply_founder_discount(equity: float, founder_dependency: float) -> float:
    # Tapered discount: max 25% (was 35%). Aligned with market key-person discount studies.
    discount = founder_dependency * 0.25
    return round(equity * (1 - discount), 2)


# ─── DLOM ────────────────────────────────────────────────

def calculate_dlom(revenue: float, sector: str, years_in_business: int = 3) -> Dict[str, Any]:
    """Illiquidity / Marketability Discount — sole post-DCF discount."""
    base_discount = 0.22
    if revenue < 500_000: size_adj = 0.05
    elif revenue < 2_000_000: size_adj = 0.02
    elif revenue < 10_000_000: size_adj = 0.0
    else: size_adj = -0.03

    if years_in_business < 2: maturity_adj = 0.06
    elif years_in_business < 3: maturity_adj = 0.04
    elif years_in_business < 5: maturity_adj = 0.02
    elif years_in_business < 10: maturity_adj = 0.0
    else: maturity_adj = -0.04

    from app.core.valuation_engine.sectors import get_sector_liquidity
    liquidity = get_sector_liquidity(sector)
    dlom_adj = _DAMODARAN.get("dlom_sector_adjustment", {})
    sector_adj = dlom_adj.get(liquidity, 0.0)
    total = max(0.12, min(0.35, base_discount + size_adj + maturity_adj + sector_adj))

    return {"dlom_pct": round(total, 4), "base_discount": base_discount, "size_adjustment": size_adj,
            "maturity_adjustment": maturity_adj, "sector_adjustment": sector_adj, "sector_liquidity": liquidity}


# ─── Survival Rate ───────────────────────────────────────

def calculate_survival_discount(
    sector: str, years_in_business: int = 3, projection_years: int = 10,
    num_employees: int = 0, is_profitable: bool = True,
) -> Dict[str, Any]:
    rates = get_survival_rates(sector)
    if projection_years <= 1: base_rate, horizon = rates.get("1yr", 0.80), "1yr"
    elif projection_years <= 3: base_rate, horizon = rates.get("3yr", 0.58), "3yr"
    elif projection_years <= 5: base_rate, horizon = rates.get("5yr", 0.45), "5yr"
    else: base_rate, horizon = rates.get("10yr", 0.32), "10yr"

    # For established companies (>= 7 years, profitable), override base_rate
    # SEBRAE/IBGE survival stats apply to NEW companies, not established ones.
    # A 14-year profitable company has near-zero going-concern risk.
    if years_in_business >= 10 and is_profitable:
        base_rate = max(base_rate, 0.85)
    elif years_in_business >= 7 and is_profitable:
        base_rate = max(base_rate, 0.70)

    # Age bonus — established companies have very low failure risk
    if years_in_business >= 15: age_bonus = 0.12
    elif years_in_business >= 10: age_bonus = 0.10
    elif years_in_business >= 7: age_bonus = 0.08
    elif years_in_business >= 5: age_bonus = 0.05
    elif years_in_business >= 3: age_bonus = 0.02
    else: age_bonus = 0.0

    # Employee bonus — companies with staff are more resilient
    if num_employees >= 50: emp_bonus = 0.03
    elif num_employees >= 20: emp_bonus = 0.02
    elif num_employees >= 5: emp_bonus = 0.01
    else: emp_bonus = 0.0

    # Profitability bonus — profitable companies rarely fail
    profit_bonus = 0.02 if is_profitable else 0.0

    adjusted_rate = min(0.99, base_rate + age_bonus + emp_bonus + profit_bonus)

    return {"survival_rate": round(adjusted_rate, 4), "base_rate": base_rate,
            "age_bonus": age_bonus, "emp_bonus": emp_bonus, "profit_bonus": profit_bonus,
            "horizon": horizon, "sector": sector}


# ─── Qualitative Score ──────────────────────────────────

def calculate_qualitative_score(answers: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not answers:
        return {"score": 50, "adjustment": 0.0, "dimensions": {}, "has_data": False, "observations": {}}

    # Extract scores — supports both flat int values and nested {score, obs} dicts
    scores = {}
    observations = {}
    for k, v in answers.items():
        if isinstance(v, dict):
            scores[k] = v.get("score", 3)
            if v.get("obs"):
                observations[k] = v["obs"]
        else:
            scores[k] = v

    dimension_keys = {
        "governanca": ["gov_profissional", "gov_compliance"],
        "mercado": ["mercado_lider", "mercado_tendencia"],
        "financeiro": ["financeiro_crescimento", "financeiro_margens"],
        "clientes": ["clientes_diversificacao", "clientes_recorrencia"],
        "diferenciacao": ["diferenciacao_moat"],
        "escalabilidade": ["escala_operacional"],
    }
    dimensions = {}
    total_score = 0
    total_questions = 0
    for dim, keys in dimension_keys.items():
        dim_score = 0
        dim_count = 0
        for key in keys:
            if key in scores:
                dim_score += scores[key]
                dim_count += 1
        if dim_count > 0:
            dimensions[dim] = round(dim_score / dim_count, 1)
            total_score += dim_score
            total_questions += dim_count
    score = round((total_score / (total_questions * 5)) * 100 if total_questions > 0 else 50, 1)
    score = max(0, min(100, score))
    adjustment = (score - 50) / 50 * 0.15
    return {"score": score, "adjustment": round(adjustment, 4), "dimensions": dimensions, "has_data": total_questions > 0, "observations": observations}


# ─── Risk / Maturity / Percentile ────────────────────────

def calculate_risk_score(net_margin, growth_rate, debt_ratio, founder_dependency, sector_beta):
    risk = 50.0
    if net_margin < 0.05: risk += 15
    elif net_margin < 0.10: risk += 8
    elif net_margin > 0.25: risk -= 10
    elif net_margin > 0.15: risk -= 5
    if growth_rate < 0: risk += 15
    elif growth_rate < 0.05: risk += 5
    elif growth_rate > 0.30: risk += 8
    elif growth_rate > 0.20: risk += 3
    risk += debt_ratio * 20
    risk += founder_dependency * 15
    risk += (sector_beta - 1.0) * 10
    return round(max(0, min(100, risk)), 1)


def calculate_maturity_index(revenue, net_margin, growth_rate, founder_dependency, years_of_data):
    score = 0.0
    if revenue >= 10_000_000: score += 30
    elif revenue >= 2_000_000: score += 22
    elif revenue >= 500_000: score += 15
    elif revenue >= 100_000: score += 8
    else: score += 3
    if net_margin > 0.20: score += 20
    elif net_margin > 0.10: score += 15
    elif net_margin > 0.05: score += 10
    elif net_margin > 0: score += 5
    if 0.05 < growth_rate < 0.25: score += 20
    elif growth_rate >= 0.25: score += 12
    elif growth_rate > 0: score += 8
    score += (1 - founder_dependency) * 15
    score += min(years_of_data, 5) * 3
    return round(max(0, min(100, score)), 1)


def calculate_percentile(equity_value, revenue, sector):
    multiples = get_sector_multiples(sector)
    ev_rev_sector = multiples.get("ev_revenue", 1.0)
    ev_rev_company = equity_value / revenue if revenue > 0 else 0
    ratio = ev_rev_company / ev_rev_sector if ev_rev_sector > 0 else 1
    percentile = 50 + 40 * (1 / (1 + math.exp(-2 * (ratio - 1))))
    return round(max(1, min(99, percentile)), 1)


# ─── Multiples Valuation ─────────────────────────────────

def calculate_multiples_valuation(revenue, ebit_margin, sector, debt=0, cash=0, ebitda=None):
    multiples = get_sector_multiples(sector)
    ev_revenue_multiple = multiples.get("ev_revenue", 1.0)
    ev_ebitda_multiple = multiples.get("ev_ebitda", 6.0)
    ev_by_revenue = revenue * ev_revenue_multiple
    # Use actual EBITDA when provided; otherwise estimate from margin
    effective_ebitda = ebitda if (ebitda and ebitda > 0) else revenue * ebit_margin * 0.85
    ev_by_ebitda = effective_ebitda * ev_ebitda_multiple if effective_ebitda > 0 else 0
    ev_avg = (ev_by_revenue + ev_by_ebitda) / 2 if ev_by_ebitda > 0 else ev_by_revenue
    equity_avg = ev_avg + cash - debt
    return {
        "ev_by_revenue": round(ev_by_revenue, 2), "ev_by_ebitda": round(ev_by_ebitda, 2),
        "ev_avg_multiples": round(ev_avg, 2), "equity_avg_multiples": round(max(equity_avg, 0), 2),
        "multiples_used": {"ev_revenue": ev_revenue_multiple, "ev_ebitda": ev_ebitda_multiple, "source": "Damodaran/NYU Stern"},
    }


def calculate_valuation_range(equity_value, risk_score, maturity_index, founder_dependency):
    risk_factor = risk_score / 100
    maturity_factor = maturity_index / 100
    base_spread = 0.10 + risk_factor * 0.25 + (1 - maturity_factor) * 0.10 + founder_dependency * 0.05
    base_spread = max(0.10, min(0.45, base_spread))
    return {"low": round(max(0, equity_value * (1 - base_spread)), 2), "mid": round(equity_value, 2),
            "high": round(equity_value * (1 + base_spread), 2), "spread_pct": round(base_spread * 100, 1)}


def calculate_sensitivity_table(revenue, net_margin, growth_rate, discount_rate, cash,
                                 projection_years, survival_rate=0.99,
                                 # Legacy params kept for backward compat:
                                 ebit_margin=None, wacc=None, debt=0,
                                 founder_dependency=0, years_of_data=1, sector="Varejo"):
    """Sensitivity analysis — FCFE/Ke methodology."""
    dr = discount_rate if discount_rate else (wacc or 0.20)
    dr_steps = [round((dr - 0.04 + i * 0.02) * 100, 1) for i in range(5)]
    growth_steps = [round((growth_rate - 0.04 + i * 0.02) * 100, 1) for i in range(5)]
    equity_matrix = []
    for dr_pct in dr_steps:
        row = []
        d = dr_pct / 100
        for g_pct in growth_steps:
            g = g_pct / 100
            fcfe_proj = project_fcfe(revenue=revenue, net_margin=net_margin, growth_rate=g, years=projection_years)
            last_fcfe = fcfe_proj[-1]["fcf"]
            tv_result = calculate_terminal_value_gordon(last_fcf=last_fcfe, wacc=d)
            tv_adjusted = tv_result["terminal_value"] * survival_rate
            ev_r = calculate_enterprise_value(fcf_projections=fcfe_proj, wacc=d, terminal_value=tv_adjusted)
            eq = ev_r["enterprise_value"] + cash  # FCFE -> equity directly
            row.append(round(max(0, eq), 2))
        equity_matrix.append(row)
    return {"wacc_values": dr_steps, "growth_values": growth_steps, "equity_matrix": equity_matrix}


# ─── Waterfall ───────────────────────────────────────────

def build_waterfall(pv_fcf_total, pv_terminal, cash, equity_dcf,
                    dlom_pct=0, dlom_value=0, qualitative_adj_value=0, equity_final=0,
                    # Legacy params kept for backward compat:
                    debt=0, founder_discount_pct=0, equity_raw=0,
                    survival_rate=1.0, survival_discount=0):
    """Waterfall chart — FCFE methodology.
    Survival is embedded in TV; founder risk is in Ke; debt is in FCFE interest.
    """
    items = [
        {"label": "VP dos FCFEs", "value": round(pv_fcf_total, 2), "type": "positive"},
        {"label": "VP Terminal Value", "value": round(pv_terminal, 2), "type": "positive"},
        {"label": "DCF Equity", "value": round(pv_fcf_total + pv_terminal, 2), "type": "subtotal"},
    ]
    if cash > 0:
        items.append({"label": "(+) Caixa", "value": round(cash, 2), "type": "positive"})
    if dlom_pct > 0 and dlom_value > 0:
        items.append({"label": f"(-) Iliquidez ({dlom_pct*100:.0f}%)", "value": round(-dlom_value, 2), "type": "negative"})
    if qualitative_adj_value != 0:
        sign = "+" if qualitative_adj_value > 0 else ""
        items.append({"label": f"({sign}) Qualitativo", "value": round(qualitative_adj_value, 2), "type": "positive" if qualitative_adj_value > 0 else "negative"})
    items.append({"label": "Equity Value Final", "value": round(equity_final, 2), "type": "total"})
    return items


# ─── Investment Round ────────────────────────────────────

def simulate_investment_round(equity_value, desired_raise=1_000_000):
    pre_money = equity_value
    post_money = pre_money + desired_raise
    dilution = (desired_raise / post_money) * 100 if post_money > 0 else 0
    return {
        "pre_money_valuation": round(pre_money, 2), "investment_amount": round(desired_raise, 2),
        "post_money_valuation": round(post_money, 2), "dilution_pct": round(dilution, 2),
        "investor_equity_pct": round(dilution, 2), "founder_equity_pct": round(100 - dilution, 2),
        "price_per_1pct": round(pre_money / 100, 2) if pre_money > 0 else 0,
    }


# ─── Main Valuation Function ────────────────────────────

def run_valuation(
    revenue: float, net_margin: float, sector: str,
    growth_rate: Optional[float] = None, debt: float = 0, cash: float = 0,
    founder_dependency: float = 0.0, years_of_data: int = 1, projection_years: int = 10,
    custom_wacc: Optional[float] = None, custom_growth: Optional[float] = None,
    custom_margin: Optional[float] = None, custom_exit_multiple: Optional[float] = None,
    dcf_weight: float = 0.60, qualitative_answers: Optional[Dict[str, Any]] = None,
    years_in_business: int = 3, ebitda: Optional[float] = None,
    recurring_revenue_pct: float = 0.0, num_employees: int = 0, previous_investment: float = 0.0,
) -> Dict[str, Any]:
    """Valuation v4 — FCFE/Ke methodology.

    Key changes from v3:
    - Cost of Equity (4-factor beta + key-person premium) instead of WACC
    - FCFE (Net Income based) instead of FCFF (NOPAT based)
    - Survival rate embedded IN Terminal Value, not as post-DCF haircut
    - Founder dependency embedded in Ke, not as separate discount
    - Stage-based Gordon/Exit blend (Maturity 50/50, Growth 25/75, Early 0/100)
    - Single post-DCF discount: Illiquidity (DLOM)
    """
    effective_margin_net = custom_margin if custom_margin is not None else net_margin
    effective_growth = custom_growth if custom_growth is not None else (growth_rate or 0.10)
    ebit_margin = net_margin_to_ebit_margin(effective_margin_net)

    # If actual EBITDA is provided, derive a more accurate EBITDA margin
    actual_ebitda_margin = (ebitda / revenue) if (ebitda and revenue > 0) else None

    # ── 1. Equity proxy & sector multiples ──────────────────
    sector_mults = get_sector_multiples(sector)
    if ebitda and ebitda > 0:
        equity_proxy = ebitda * sector_mults.get("ev_ebitda", 10.0)
    else:
        equity_proxy = revenue * sector_mults.get("ev_revenue", 1.0)
    equity_proxy = max(equity_proxy, revenue * 0.5)

    # ── 2. Cost of Equity (Ke) with 4-factor beta ───────────
    ke_info = calculate_cost_of_equity(
        sector=sector, num_employees=num_employees, years_in_business=years_in_business,
        net_margin=effective_margin_net, debt=debt, equity_proxy=equity_proxy,
        founder_dependency=founder_dependency,
    )
    discount_rate = custom_wacc if custom_wacc is not None else ke_info["cost_of_equity"]

    # ── 3. Project FCFE (Free Cash Flow to Equity) ──────────
    fcfe_projections = project_fcfe(
        revenue=revenue, net_margin=effective_margin_net,
        growth_rate=effective_growth, years=projection_years,
    )

    # ── 4. PnL projection (for EBITDA in Exit Multiple TV) ──
    if actual_ebitda_margin is not None:
        total_costs_pct = 1 - actual_ebitda_margin
        pnl_cogs_pct = total_costs_pct * 0.78
        pnl_opex_pct = total_costs_pct * 0.22
    else:
        pnl_cogs_pct = 0.55
        pnl_opex_pct = 0.15

    pnl_projections = project_pnl(
        revenue=revenue, ebit_margin=ebit_margin, growth_rate=effective_growth,
        net_margin=effective_margin_net, years=projection_years,
        cogs_pct=pnl_cogs_pct, opex_pct=pnl_opex_pct,
    )

    # ── 5. Survival rate (embedded IN Terminal Value) ───────
    is_profitable = effective_margin_net > 0
    survival = calculate_survival_discount(
        sector=sector, years_in_business=years_in_business,
        projection_years=projection_years, num_employees=num_employees,
        is_profitable=is_profitable,
    )

    # ── 6. Terminal Values with embedded survival ───────────
    last_fcfe = fcfe_projections[-1]["fcf"]
    tv_gordon_raw = calculate_terminal_value_gordon(last_fcf=last_fcfe, wacc=discount_rate)
    tv_gordon_adjusted = tv_gordon_raw["terminal_value"] * survival["survival_rate"]

    last_ebitda = pnl_projections[-1]["ebitda"] if pnl_projections else (ebitda or revenue * ebit_margin * 0.66)
    tv_exit_raw = calculate_terminal_value_exit_multiple(
        last_year_ebitda=last_ebitda, sector=sector, custom_multiple=custom_exit_multiple)
    tv_exit_adjusted = tv_exit_raw["terminal_value"] * survival["survival_rate"]

    # ── 7. DCF = PV(FCFEs) + PV(TV) ────────────────────────
    dcf_gordon = calculate_enterprise_value(
        fcf_projections=fcfe_projections, wacc=discount_rate, terminal_value=tv_gordon_adjusted)
    dcf_exit = calculate_enterprise_value(
        fcf_projections=fcfe_projections, wacc=discount_rate, terminal_value=tv_exit_adjusted)

    # ── 8. Equity — FCFE result IS equity; add only cash ────
    # (Debt is NOT subtracted — already reflected in net income via interest)
    eq_gordon = dcf_gordon["enterprise_value"] + cash
    eq_exit = dcf_exit["enterprise_value"] + cash

    # ── 9. Stage-based blend ────────────────────────────────
    if years_in_business >= 7:      # Maturity
        w_ltg, w_mult = 0.50, 0.50
    elif years_in_business >= 3:    # Growth
        w_ltg, w_mult = 0.25, 0.75
    else:                            # Early stage
        w_ltg, w_mult = 0.0, 1.0

    equity_dcf = round(eq_gordon * w_ltg + eq_exit * w_mult, 2)

    # ── 10. DLOM — sole post-DCF discount ──────────────────
    dlom = calculate_dlom(revenue=revenue, sector=sector, years_in_business=years_in_business)
    dlom_value = equity_dcf * dlom["dlom_pct"]
    equity_after_dlom = equity_dcf - dlom_value

    # ── 11. Qualitative adjustment ─────────────────────────
    qual = calculate_qualitative_score(qualitative_answers)
    qual_adj = equity_after_dlom * qual["adjustment"] if qual["has_data"] else 0
    equity_value = round(max(0, equity_after_dlom + qual_adj), 2)

    # ── 12. Multiples (informational — NOT blended) ────────
    multiples_val = calculate_multiples_valuation(
        revenue=revenue, ebit_margin=ebit_margin, sector=sector,
        debt=debt, cash=cash, ebitda=ebitda)

    # ── 13. Scoring & analysis ─────────────────────────────
    debt_ratio = debt / (debt + equity_proxy) if (debt + equity_proxy) > 0 else 0
    risk_score = calculate_risk_score(
        effective_margin_net, effective_growth, debt_ratio,
        founder_dependency, ke_info["beta_levered"])
    maturity_index = calculate_maturity_index(
        revenue, effective_margin_net, effective_growth, founder_dependency, years_of_data)
    percentile = calculate_percentile(equity_value, revenue, sector)
    valuation_range = calculate_valuation_range(
        equity_value, risk_score, maturity_index, founder_dependency)

    sensitivity_table = calculate_sensitivity_table(
        revenue=revenue, net_margin=effective_margin_net, growth_rate=effective_growth,
        discount_rate=discount_rate, cash=cash, projection_years=projection_years,
        survival_rate=survival["survival_rate"])

    # ── 14. Waterfall ──────────────────────────────────────
    wf_dcf = dcf_gordon if w_ltg >= 0.50 else dcf_exit
    waterfall = build_waterfall(
        pv_fcf_total=wf_dcf["pv_fcf_total"], pv_terminal=wf_dcf["pv_terminal_value"],
        cash=cash, equity_dcf=equity_dcf,
        dlom_pct=dlom["dlom_pct"], dlom_value=dlom_value,
        qualitative_adj_value=qual_adj, equity_final=equity_value,
    )
    round_sim = simulate_investment_round(equity_value=equity_value)

    kp_premium_pct = ke_info["key_person_premium"] * 100

    return {
        "equity_value": equity_value, "equity_value_dcf": equity_dcf,
        "equity_value_raw": equity_dcf,
        "equity_value_gordon": round(eq_gordon, 2), "equity_value_exit_multiple": round(eq_exit, 2),
        "multiples_valuation": multiples_val, "dcf_weight": w_ltg, "multiples_weight": w_mult,
        "valuation_range": valuation_range,
        "enterprise_value": dcf_gordon["enterprise_value"],
        "enterprise_value_gordon": dcf_gordon["enterprise_value"],
        "enterprise_value_exit": dcf_exit["enterprise_value"],
        "wacc": discount_rate,
        "beta_unlevered": ke_info["beta_unlevered"], "beta_levered": ke_info["beta_levered"],
        "cost_of_equity_detail": ke_info,
        "sector": sector, "sector_multiples": sector_mults,
        "fcf_projections": fcfe_projections, "pnl_projections": pnl_projections,
        "terminal_value": dcf_gordon["terminal_value"],
        "terminal_value_gordon": tv_gordon_raw, "terminal_value_exit": tv_exit_raw,
        "tv_percentage": dcf_gordon["tv_percentage"],
        "pv_terminal_value": dcf_gordon["pv_terminal_value"],
        "pv_fcf_total": dcf_gordon["pv_fcf_total"], "pv_fcf": dcf_gordon["pv_fcf"],
        "founder_discount": round(kp_premium_pct, 1),
        "dlom": dlom, "survival": survival, "qualitative": qual,
        "risk_score": risk_score, "maturity_index": maturity_index, "percentile": percentile,
        "sensitivity_table": sensitivity_table, "waterfall": waterfall, "investment_round": round_sim,
        "parameters": {
            "revenue": revenue, "net_margin": effective_margin_net, "ebit_margin": ebit_margin,
            "growth_rate": effective_growth, "debt": debt, "cash": cash,
            "founder_dependency": founder_dependency, "years_of_data": years_of_data,
            "projection_years": projection_years, "years_in_business": years_in_business,
            "recurring_revenue_pct": recurring_revenue_pct, "num_employees": num_employees,
            "previous_investment": previous_investment, "selic_rate": get_selic(),
            "dcf_weight": w_ltg, "exit_weight": w_mult,
            "methodology": "FCFE/Ke (4-Factor)",
            "data_source": "Damodaran/NYU Stern + BCB/Selic + IBGE",
        },
    }


# ─── IBGE-Enhanced Valuation ────────────────────────────

def run_valuation_with_ibge(
    revenue: float, net_margin: float, sector: str,
    ibge_adjustment: Optional[Dict[str, Any]] = None,
    growth_rate: Optional[float] = None, debt: float = 0, cash: float = 0,
    founder_dependency: float = 0.0, years_of_data: int = 1, projection_years: int = 10,
    custom_wacc: Optional[float] = None, custom_growth: Optional[float] = None,
    custom_margin: Optional[float] = None, custom_exit_multiple: Optional[float] = None,
    dcf_weight: float = 0.60, qualitative_answers: Optional[Dict[str, Any]] = None,
    years_in_business: int = 3, ebitda: Optional[float] = None,
    recurring_revenue_pct: float = 0.0, num_employees: int = 0, previous_investment: float = 0.0,
) -> Dict[str, Any]:
    if custom_growth is not None:
        effective_growth = custom_growth
    elif ibge_adjustment and ibge_adjustment.get("adjusted_growth_rate") is not None:
        confidence = ibge_adjustment.get("confidence_level", 0.5)
        ibge_growth = ibge_adjustment["adjusted_growth_rate"]
        effective_growth = (growth_rate * (1 - confidence * 0.4) + ibge_growth * (confidence * 0.4)) if growth_rate is not None else ibge_growth
    else:
        effective_growth = growth_rate or 0.10

    result = run_valuation(
        revenue=revenue, net_margin=net_margin, sector=sector, growth_rate=effective_growth,
        debt=debt, cash=cash, founder_dependency=founder_dependency, years_of_data=years_of_data,
        projection_years=projection_years, custom_wacc=custom_wacc, custom_growth=effective_growth,
        custom_margin=custom_margin, custom_exit_multiple=custom_exit_multiple, dcf_weight=dcf_weight,
        qualitative_answers=qualitative_answers, years_in_business=years_in_business, ebitda=ebitda,
        recurring_revenue_pct=recurring_revenue_pct, num_employees=num_employees, previous_investment=previous_investment,
    )
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
