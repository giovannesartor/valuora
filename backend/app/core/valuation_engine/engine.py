"""
Quanto Vale — Valuation Engine v5.0 (QuantoVale)
Motor financeiro baseado em DCF (Fluxo de Caixa Descontado) — metodologia FCFE/Ke.

v5 — metodologia QuantoVale:
 - FCFE (Free Cash Flow to Equity) com Ke (Custo de Capital Próprio)
 - Beta 5-fatores (setor + porte + maturidade + rentabilidade + liquidez)
 - Country Risk Premium (EMBI+ dinâmico via BCB)
 - Mid-Year Convention (Goldman Sachs / Big 4)
 - NWC, CapEx e D&A setoriais (35 setores, Damodaran)
 - Effective Tax Rate (Simples/Presumido/Real)
 - Terminal Value Fade (convergência competitiva, McKinsey/Mauboussin)
 - Monte Carlo Simulation (2000 runs, P5-P95)
 - Peer Comparison (EV/Revenue, EV/EBITDA)
 - Control Premium / Minority Discount (Mergerstat)
 - Blend Gordon/Exit por estágio: Matura 50/50, Crescimento 25/75, Early 0/100
 - Sobrevivência embutida no Terminal Value
 - Risco do fundador embutido no Ke (key-person premium 0-4%)
 - DLOM como único desconto pós-DCF
 - Perguntas qualitativas (15 perguntas, 7 dimensões, score 0-100)
 - P&L projetado + Projeção 10 anos + Simulação de rodada
"""

from typing import Dict, Any, Optional, List
import math
import json
import os
import asyncio
import logging
import numpy as np
import httpx

ENGINE_VERSION = "v6.0"
logger = logging.getLogger(__name__)

# ─── Load Damodaran Data ─────────────────────────────────
_DATA_DIR = os.path.dirname(os.path.abspath(__file__))

def _load_damodaran() -> Dict[str, Any]:
    path = os.path.join(_DATA_DIR, "damodaran_data.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        import logging as _log
        _log.getLogger(__name__).warning("[Engine] damodaran_data.json not found at %s — using hardcoded defaults", path)
        return {}
    except Exception:
        import logging as _log
        _log.getLogger(__name__).warning("[Engine] Failed to load damodaran_data.json — using hardcoded defaults")
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


# ─── Country Risk Premium — Dynamic (EMBI+ / CDS) ───────
_crp_cache: Dict[str, Any] = {"premium": 0.025, "source": "default"}


async def fetch_country_risk_premium() -> float:
    """Fetch Brazil Country Risk Premium via EMBI+ spread (BCB)."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12938/dados/ultimos/1?formato=json"
            )
            if resp.status_code == 200:
                data = resp.json()
                spread_bps = float(data[0]["valor"])
                crp = spread_bps / 10000
                crp = max(0.01, min(0.08, crp))
                _crp_cache.update({"premium": crp, "source": "BCB/EMBI+"})
                return crp
    except Exception as e:
        logger.warning(f"[CRP] BCB/EMBI+ fetch failed: {e!r} — using cached fallback {_crp_cache['premium']:.4f}")
    return _crp_cache["premium"]


def get_crp() -> float:
    return _crp_cache["premium"]


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


def get_sector_nwc_ratio(sector: str) -> float:
    """NWC as % of revenue — sector-specific. Source: Damodaran Working Capital by Industry."""
    ratios = _DAMODARAN.get("nwc_ratios", {})
    return ratios.get(sector.lower(), 0.05)


def get_sector_capex_ratio(sector: str) -> float:
    """CapEx as % of revenue — sector-specific. Source: Damodaran Capital Expenditures."""
    ratios = _DAMODARAN.get("capex_ratios", {})
    return ratios.get(sector.lower(), 0.05)


def get_sector_depreciation_ratio(sector: str) -> float:
    """D&A as % of revenue — sector-specific. Source: Damodaran D&A by Industry."""
    ratios = _DAMODARAN.get("depreciation_ratios", {})
    return ratios.get(sector.lower(), 0.03)


def get_sector_avg_margin(sector: str) -> float:
    """Average sector net margin (Brazil). Source: IBGE + Damodaran."""
    margins = _DAMODARAN.get("sector_net_margins", {})
    return margins.get(sector.lower(), 0.06)


LONG_TERM_GDP_GROWTH = 0.03  # Long-term real GDP growth (Brazil ~2-3%)


# ─── Helper functions ────────────────────────────────────

def relever_beta(beta_unlevered: float, debt: float, equity_proxy: float, tax_rate: float = 0.34) -> float:
    if equity_proxy <= 0:
        return beta_unlevered
    de_ratio = debt / equity_proxy
    return round(beta_unlevered * (1 + (1 - tax_rate) * de_ratio), 4)


def net_margin_to_ebit_margin(net_margin: float, tax_rate: float = 0.34) -> float:
    return net_margin / (1 - tax_rate) if (1 - tax_rate) > 0 else net_margin


# ─── Effective Tax Rate — Brazil ─────────────────────────

def calculate_effective_tax_rate(
    revenue: float, years_in_business: int = 3, net_margin: float = 0.10,
) -> Dict[str, Any]:
    """ETR Brasil — Simples Nacional, Lucro Presumido, Lucro Real.
    Source: RFB, KPMG Tax Monitor Brasil."""
    if revenue <= 4_800_000:
        # Simples Nacional — Anexos I-V, faixas progressivas
        if revenue <= 180_000:     etr = 0.04
        elif revenue <= 360_000:   etr = 0.073
        elif revenue <= 720_000:   etr = 0.095
        elif revenue <= 1_800_000: etr = 0.107
        elif revenue <= 3_600_000: etr = 0.135
        else:                      etr = 0.155
        regime = "simples_nacional"
    elif revenue <= 78_000_000:
        # Lucro Presumido — base presumida × alíquotas
        if net_margin > 0.15:   etr = 0.11   # Serviços alta margem
        elif net_margin > 0.08: etr = 0.1368 # Média
        else:                   etr = 0.16   # Comércio/indústria
        regime = "lucro_presumido"
    else:
        # Lucro Real — 34% nominal, reduzido por NOLs e incentivos
        if years_in_business < 3 and net_margin < 0.05:
            etr = 0.20  # Empresa jovem c/ prejuízo acumulado
        elif years_in_business < 5 and net_margin < 0.10:
            etr = 0.25  # Empresa em crescimento
        else:
            etr = 0.30  # Margem real efetiva (Lei do Bem, SUDENE, etc)
        regime = "lucro_real"

    return {
        "effective_tax_rate": round(etr, 4),
        "regime": regime,
        "nominal_rate": 0.34,
    }


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


# ─── Cost of Equity — QuantoVale Methodology ─────────────

def calculate_cost_of_equity(
    sector: str, num_employees: int = 0, years_in_business: int = 3,
    net_margin: float = 0.10, debt: float = 0, equity_proxy: float = 1,
    founder_dependency: float = 0.0,
    risk_free_rate: Optional[float] = None,
    market_premium: float = 0.065,
    tax_rate: float = 0.34,
) -> Dict[str, Any]:
    """QuantoVale Cost of Equity v5: Rf + beta_5factor x (ERP + CRP) + key-person premium.

    QuantoVale Beta = Industry beta + Size adj + Stage adj + Profitability adj + Liquidity adj
    Market Premium = US ERP (6.5%) + Brazil CRP (dynamic, ~2-3%)
    (source: Damodaran + Dimson + QuantoVale proprietary adjustments)
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

    # Factor 5: Liquidity / Thin-trading adjustment (Dimson, 1979)
    from app.core.valuation_engine.sectors import get_sector_liquidity
    liquidity = get_sector_liquidity(sector)
    if liquidity == "low":      liquidity_adj = 0.20
    elif liquidity == "medium": liquidity_adj = 0.08
    else:                       liquidity_adj = 0.0

    beta_5f = max(0.30, beta_u + size_adj + stage_adj + profit_adj + liquidity_adj)
    beta_levered = relever_beta(beta_5f, debt, equity_proxy, tax_rate=tax_rate)

    # Key-person premium (replaces separate founder discount)
    kp_premium = founder_dependency * 0.04  # 0–4% addition to Ke

    # Market premium = US ERP + Brazil Country Risk Premium (dynamic)
    crp = get_crp()
    total_market_premium = market_premium + crp

    ke = rf + beta_levered * total_market_premium + kp_premium

    return {
        "cost_of_equity": round(ke, 4),
        "risk_free_rate": round(rf, 4),
        "market_premium": round(total_market_premium, 4),
        "erp_base": market_premium,
        "country_risk_premium": round(crp, 4),
        "crp_source": _crp_cache.get("source", "default"),
        "beta_unlevered": round(beta_u, 4),
        "beta_5factor": round(beta_5f, 4),
        "beta_4factor": round(beta_5f, 4),  # backward compat alias
        "beta_levered": round(beta_levered, 4),
        "size_adj": size_adj,
        "stage_adj": stage_adj,
        "profit_adj": profit_adj,
        "liquidity_adj": liquidity_adj,
        "liquidity_level": liquidity,
        "key_person_premium": round(kp_premium, 4),
    }


# ─── FCF Projection ─────────────────────────────────────

def project_fcf(
    revenue: float, ebit_margin: float, growth_rate: float,
    years: int = 5, capex_ratio: float = 0.05, nwc_ratio: float = 0.03,
    depreciation_ratio: float = 0.03, tax_rate: float = 0.34,
    sector: Optional[str] = None,
) -> List[Dict[str, float]]:
    projections = []
    prev_revenue = revenue
    decay_lambda = 0.3

    # Sector-specific ratios override defaults
    if sector:
        capex_ratio = get_sector_capex_ratio(sector)
        nwc_ratio = get_sector_nwc_ratio(sector)
        depreciation_ratio = get_sector_depreciation_ratio(sector)

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
    sector: Optional[str] = None,
) -> List[Dict[str, float]]:
    """Project Free Cash Flow to Equity (FCFE).
    FCFE = Net Income + D&A - Capex - delta_NWC
    Discounted at Cost of Equity → result is equity directly (no EV→Equity bridge).
    Sector-specific CapEx, NWC and D&A ratios when sector is provided.
    """
    projections = []
    prev_revenue = revenue
    decay_lambda = 0.3
    ebit_margin = net_margin_to_ebit_margin(net_margin)

    # Sector-specific ratios override defaults
    if sector:
        capex_ratio = get_sector_capex_ratio(sector)
        nwc_ratio = get_sector_nwc_ratio(sector)
        depreciation_ratio = get_sector_depreciation_ratio(sector)

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
            "revenue": round(max(0, current_revenue), 2),
            "growth_rate": round(adjusted_growth, 4),
            "ebit_margin": round(ebit_margin, 4),
            "ebit": round(current_revenue * ebit_margin, 2),
            "net_income": round(net_income, 2),
            "nopat": round(net_income, 2),  # alias for backward compatibility
            "depreciation": round(depreciation, 2),
            "capex": round(capex, 2),
            "delta_nwc": round(delta_nwc, 2),
            "fcf": round(fcfe, 2),
        })
        prev_revenue = max(0, current_revenue)
    return projections


# ─── P&L Projetado ───────────────────────────────────────

def project_pnl(
    revenue: float, ebit_margin: float, growth_rate: float,
    net_margin: float, years: int = 5,
    cogs_pct: float = 0.55, opex_pct: float = 0.15, tax_rate: float = 0.34,
) -> List[Dict[str, float]]:
    """Project P&L. Uses cogs_pct and opex_pct as cost drivers, then calibrates
    the tax rate so that the resulting net margin approximates the input net_margin."""
    pnl = []
    prev_revenue = revenue
    decay_lambda = 0.3

    for year in range(1, years + 1):
        exp_decay = math.exp(-decay_lambda * year)
        adj_growth = growth_rate * exp_decay + LONG_TERM_GDP_GROWTH * (1 - exp_decay)
        r = max(0, prev_revenue * (1 + adj_growth))
        cogs = r * cogs_pct
        gross_profit = r - cogs
        gross_margin = gross_profit / r if r > 0 else 0
        opex = r * opex_pct
        ebitda = gross_profit - opex
        ebitda_margin = ebitda / r if r > 0 else 0
        depreciation = r * 0.03
        ebit = ebitda - depreciation
        # Calibrate: target net_income = r * net_margin, derive effective taxes
        target_net = r * net_margin
        taxes = max(ebit - target_net, 0) if ebit > 0 else 0
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

def calculate_terminal_value_gordon(last_fcf: float, wacc: float, perpetuity_growth: float = 0.03) -> Dict[str, Any]:
    warnings: List[str] = []
    if last_fcf <= 0:
        warnings.append("FCF no último ano é negativo/zero. TV = 0.")
        return {"terminal_value": 0, "method": "gordon_growth", "perpetuity_growth": perpetuity_growth, "warnings": warnings}
    if wacc <= 0.001:
        wacc = 0.001
        warnings.append("Ke ajustado para 0,1% (mínimo técnico).")
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

def calculate_enterprise_value(fcf_projections: List[Dict[str, float]], wacc: float, terminal_value: float, mid_year: bool = True) -> Dict[str, float]:
    """PV of projected FCFs + PV of Terminal Value.
    Mid-year convention (default): cash flows discounted at year - 0.5.
    Adopted by Goldman Sachs, BCG, all Big 4."""
    wacc = max(wacc, 0.001)  # Guard against division by zero / negative wacc
    pv_fcf = []
    for proj in fcf_projections:
        year = proj["year"]
        discount_period = year - 0.5 if mid_year else year
        pv = proj["fcf"] / ((1 + wacc) ** discount_period)
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
        "mid_year_convention": mid_year,
    }


def calculate_equity_value(enterprise_value: float, cash: float, debt: float) -> float:
    return round(enterprise_value + cash - debt, 2)


def apply_founder_discount(equity_value: float, founder_dependency: float) -> float:
    """Backward-compat shim: key-person discount applied to equity value.
    The key-person premium now adjusts Ke within WACC; this shim preserves
    the old interface used by tests and external callers.
    """
    discount = founder_dependency * 0.15  # 0% at full independence, 15% at full dependency
    return round(equity_value * (1.0 - discount), 2)


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

    # New 7-dimension structure (15 questions total)
    dimension_keys = {
        "equipe": ["equipe_num_fundadores", "equipe_dedicacao", "equipe_experiencia"],
        "governanca": ["gov_profissional", "gov_compliance"],
        "mercado": ["mercado_posicao", "mercado_tendencia", "mercado_competicao"],
        "clientes": ["clientes_diversificacao", "clientes_recorrencia"],
        "produto": ["produto_moat", "produto_criticidade"],
        "operacao": ["operacao_escalavel", "operacao_automacao"],
        "tracao": ["tracao_investimento"],
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


def calculate_percentile(equity_value, revenue, sector, debt=0, cash=0):
    multiples = get_sector_multiples(sector)
    ev_rev_sector = multiples.get("ev_revenue", 1.0)
    # Use EV (equity + debt - cash) for proper comparison with EV/Revenue multiples
    ev_company = equity_value + debt - cash
    ev_rev_company = ev_company / revenue if revenue > 0 else 0
    ratio = ev_rev_company / ev_rev_sector if ev_rev_sector > 0 else 1
    percentile = 50 + 40 * (1 / (1 + math.exp(-2 * (ratio - 1))))
    return round(max(1, min(99, percentile)), 1)


# ─── Multiples Valuation ─────────────────────────────────

def calculate_multiples_valuation(revenue, ebit_margin, sector, debt=0, cash=0, ebitda=None, recurring_revenue_pct=0.0):
    """Multiples valuation with optional recurring revenue premium on EV/Revenue.

    Recurring premium source: Bessemer Venture Partners SaaS benchmarks;
    Damodaran internet/software notes — subscription companies trade at 1.3-1.5x
    the transactional EV/Revenue multiple for the same sector.
    Premium formula: +50% max at 100% recurring (linear).
    """
    multiples = get_sector_multiples(sector)
    base_ev_revenue = multiples.get("ev_revenue", 1.0)
    ev_ebitda_multiple = multiples.get("ev_ebitda", 6.0)

    # Recurring revenue premium on EV/Revenue multiple
    recurring_premium = recurring_revenue_pct * 0.50  # 0% → 0%, 100% → +50%
    ev_revenue_multiple = round(base_ev_revenue * (1 + recurring_premium), 3)

    ev_by_revenue = revenue * ev_revenue_multiple
    # Use actual EBITDA when provided; otherwise estimate from margin
    effective_ebitda = ebitda if (ebitda and ebitda > 0) else revenue * ebit_margin * 0.85
    ev_by_ebitda = effective_ebitda * ev_ebitda_multiple if effective_ebitda > 0 else 0
    ev_avg = (ev_by_revenue + ev_by_ebitda) / 2 if ev_by_ebitda > 0 else ev_by_revenue
    equity_avg = ev_avg + cash - debt
    return {
        "ev_by_revenue": round(ev_by_revenue, 2), "ev_by_ebitda": round(ev_by_ebitda, 2),
        "ev_avg_multiples": round(ev_avg, 2), "equity_avg_multiples": round(max(equity_avg, 0), 2),
        "multiples_used": {
            "ev_revenue": base_ev_revenue,
            "ev_revenue_adjusted": ev_revenue_multiple,
            "ev_ebitda": ev_ebitda_multiple,
            "recurring_premium_pct": round(recurring_premium * 100, 1),
            "source": "Damodaran/NYU Stern + Bessemer SaaS benchmarks",
        },
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
                                 years_in_business=3,
                                 # Legacy params kept for backward compat:
                                 ebit_margin=None, wacc=None, debt=0,
                                 founder_dependency=0, years_of_data=1, sector="Varejo"):
    """Sensitivity analysis — FCFE/Ke methodology with stage-based blending."""
    dr = discount_rate if discount_rate else (wacc or 0.20)
    dr = max(dr, 0.05)  # Guard: floor at 5% to avoid ≤0 steps
    dr_steps = [round((dr - 0.04 + i * 0.02) * 100, 1) for i in range(5)]
    growth_steps = [round((growth_rate - 0.04 + i * 0.02) * 100, 1) for i in range(5)]

    # Stage-based blend weights (same as main valuation)
    if years_in_business >= 7:      w_ltg, w_mult = 0.50, 0.50
    elif years_in_business >= 3:    w_ltg, w_mult = 0.25, 0.75
    else:                           w_ltg, w_mult = 0.0, 1.0

    # Estimate EBITDA margin from net_margin for exit-multiple TV
    em = net_margin_to_ebit_margin(net_margin)

    equity_matrix = []
    for dr_pct in dr_steps:
        row = []
        d = dr_pct / 100
        for g_pct in growth_steps:
            g = g_pct / 100
            fcfe_proj = project_fcfe(revenue=revenue, net_margin=net_margin, growth_rate=g, years=projection_years)
            last_fcfe = fcfe_proj[-1]["fcf"]

            # Gordon TV
            tv_gordon = calculate_terminal_value_gordon(last_fcf=last_fcfe, wacc=d)
            tv_gordon_adj = tv_gordon["terminal_value"] * survival_rate
            ev_gordon = calculate_enterprise_value(fcf_projections=fcfe_proj, wacc=d, terminal_value=tv_gordon_adj)

            # Exit Multiple TV
            pnl_proj = project_pnl(revenue=revenue, ebit_margin=em, growth_rate=g, net_margin=net_margin, years=projection_years)
            last_ebitda = pnl_proj[-1]["ebitda"] if pnl_proj else revenue * em * 0.66
            tv_exit = calculate_terminal_value_exit_multiple(last_year_ebitda=last_ebitda, sector=sector)
            tv_exit_adj = tv_exit["terminal_value"] * survival_rate
            ev_exit = calculate_enterprise_value(fcf_projections=fcfe_proj, wacc=d, terminal_value=tv_exit_adj)

            # Blended equity
            eq = (ev_gordon["enterprise_value"] + cash) * w_ltg + (ev_exit["enterprise_value"] + cash) * w_mult
            row.append(round(max(0, eq), 2))
        equity_matrix.append(row)
    return {"wacc_values": dr_steps, "growth_values": growth_steps, "equity_matrix": equity_matrix}


# ─── Terminal Value Fade (Competitive Convergence) ───────

def fade_terminal_margin(
    current_margin: float, sector: str, years_in_business: int = 3,
) -> Dict[str, Any]:
    """Competitive fade: converge margin toward sector average over time.
    McKinsey / Mauboussin Competitive Advantage Period methodology.
    Young companies fade faster; established ones retain more margin."""
    sector_avg = get_sector_avg_margin(sector)

    # Competitive Advantage Period (CAP) — retention factor
    if years_in_business >= 15:   retention = 0.85
    elif years_in_business >= 10: retention = 0.75
    elif years_in_business >= 7:  retention = 0.65
    elif years_in_business >= 5:  retention = 0.55
    elif years_in_business >= 3:  retention = 0.45
    else:                         retention = 0.30

    excess = current_margin - sector_avg
    if excess > 0:
        # Above average: fade toward sector average (competition erodes advantage)
        faded = sector_avg + excess * retention
    else:
        # Below average: converge upward (recovery / regression to mean)
        faded = sector_avg + excess * (1 - retention * 0.5)

    return {
        "faded_margin": round(faded, 4),
        "original_margin": round(current_margin, 4),
        "sector_avg_margin": round(sector_avg, 4),
        "retention": retention,
        "fade_impact_pct": round((faded - current_margin) * 100, 2),
    }


# ─── Monte Carlo Simulation ─────────────────────────────

def _build_histogram(values: List[float], bins: int = 20) -> List[Dict[str, Any]]:
    """Build histogram buckets for frontend bar chart."""
    if not values:
        return []
    min_val = values[0]
    max_val = values[-1]
    if max_val <= min_val:
        return [{"range_start": min_val, "range_end": max_val, "count": len(values), "pct": 100}]
    bin_width = (max_val - min_val) / bins
    histogram = []
    for i in range(bins):
        start = min_val + i * bin_width
        end = start + bin_width
        if i < bins - 1:
            count = sum(1 for v in values if start <= v < end)
        else:
            count = sum(1 for v in values if start <= v <= end)
        histogram.append({
            "range_start": round(start, 2),
            "range_end": round(end, 2),
            "count": count,
            "pct": round(count / len(values) * 100, 1),
        })
    return histogram


def monte_carlo_valuation(
    revenue: float, net_margin: float, sector: str,
    growth_rate: float, discount_rate: float,
    cash: float, projection_years: int,
    survival_rate: float, years_in_business: int,
    n_simulations: int = 2000,
) -> Dict[str, Any]:
    """Monte Carlo simulation with parameter perturbation.
    Varies growth, margin, and discount rate around base case.
    Source: McKinsey, Goldman Sachs quantitative valuation methodology."""
    results = []
    # Stage-based blend weights
    if years_in_business >= 7:      w_ltg, w_mult = 0.50, 0.50
    elif years_in_business >= 3:    w_ltg, w_mult = 0.25, 0.75
    else:                           w_ltg, w_mult = 0.0, 1.0

    # Pre-generate all random perturbations at once (vectorized, ~20x faster than stdlib random)
    rng = np.random.default_rng()
    g_noise  = rng.normal(0, max(abs(growth_rate) * 0.30, 0.01), n_simulations)
    m_noise  = rng.normal(0, max(abs(net_margin) * 0.20, 0.005), n_simulations)
    dr_noise = rng.normal(0, discount_rate * 0.15, n_simulations)

    for i in range(n_simulations):
        # Perturb parameters (normal distribution around base case)
        g  = max(-0.20, growth_rate + float(g_noise[i]))
        m  = max(-0.50, min(0.60, net_margin + float(m_noise[i])))
        dr = max(0.05, discount_rate + float(dr_noise[i]))

        fcfe = project_fcfe(revenue=revenue, net_margin=m, growth_rate=g,
                            years=projection_years, sector=sector)
        last_fcfe = fcfe[-1]["fcf"]

        # Gordon TV
        tv_g = calculate_terminal_value_gordon(last_fcf=last_fcfe, wacc=dr)
        tv_g_adj = tv_g["terminal_value"] * survival_rate
        dcf_g = calculate_enterprise_value(fcf_projections=fcfe, wacc=dr, terminal_value=tv_g_adj)

        # Exit Multiple TV (simplified for speed)
        ebit_m = net_margin_to_ebit_margin(m)
        last_rev = fcfe[-1]["revenue"]
        est_ebitda = last_rev * ebit_m * 0.85
        tv_e = calculate_terminal_value_exit_multiple(last_year_ebitda=max(0, est_ebitda), sector=sector)
        tv_e_adj = tv_e["terminal_value"] * survival_rate
        dcf_e = calculate_enterprise_value(fcf_projections=fcfe, wacc=dr, terminal_value=tv_e_adj)

        eq = max(0, (dcf_g["enterprise_value"] + cash) * w_ltg +
                     (dcf_e["enterprise_value"] + cash) * w_mult)
        results.append(eq)

    results.sort()
    n = len(results)
    mean = sum(results) / n
    variance = sum((x - mean) ** 2 for x in results) / n

    return {
        "n_simulations": n_simulations,
        "p5":  round(results[int(n * 0.05)], 2),
        "p10": round(results[int(n * 0.10)], 2),
        "p25": round(results[int(n * 0.25)], 2),
        "p50": round(results[int(n * 0.50)], 2),
        "p75": round(results[int(n * 0.75)], 2),
        "p90": round(results[int(n * 0.90)], 2),
        "p95": round(results[int(n * 0.95)], 2),
        "mean": round(mean, 2),
        "std_dev": round(variance ** 0.5, 2),
        "min": round(results[0], 2),
        "max": round(results[-1], 2),
        "histogram": _build_histogram(results, bins=20),
    }


# ─── Control Premium / Minority Discount ─────────────────

def calculate_control_premium(equity_value: float) -> Dict[str, Any]:
    """Control premium / minority discount analysis.
    Source: Mergerstat Review, Houlihan Lokey Control Premium Studies."""
    return {
        "full_control_100pct": round(equity_value, 2),
        "majority_51pct": round(equity_value * 0.90, 2),
        "significant_33pct": round(equity_value * 0.78, 2),
        "minority_25pct": round(equity_value * 0.72, 2),
        "minority_10pct": round(equity_value * 0.65, 2),
        "minority_5pct": round(equity_value * 0.60, 2),
        "reference": "Mergerstat / Houlihan Lokey Control Premium Studies",
        "note": "Valores consideram desconto de minoria — investidor sem controle paga menos.",
    }


# ─── Peer Comparison ─────────────────────────────────────

def calculate_peer_comparison(
    revenue: float, net_margin: float, sector: str,
    equity_value: float, ebitda: Optional[float] = None,
) -> Dict[str, Any]:
    """Cross-reference DCF with sector multiples for peer-based valuation.
    Source: Damodaran/NYU Stern Emerging Market Multiples."""
    multiples = get_sector_multiples(sector)
    ev_rev_mult = multiples.get("ev_revenue", 1.0)
    ev_ebitda_mult = multiples.get("ev_ebitda", 6.0)

    ev_by_revenue = revenue * ev_rev_mult
    effective_ebitda = ebitda if (ebitda and ebitda > 0) else revenue * net_margin * 1.5
    ev_by_ebitda = effective_ebitda * ev_ebitda_mult if effective_ebitda > 0 else 0

    # Sector spread — typical ±35% around median (interquartile range)
    spread = 0.35
    peer_median = (ev_by_revenue + ev_by_ebitda) / 2 if ev_by_ebitda > 0 else ev_by_revenue

    dcf_vs_peers_pct = round(((equity_value / peer_median) - 1) * 100, 1) if peer_median > 0 else 0

    return {
        "ev_revenue": {
            "multiple": ev_rev_mult,
            "value": round(ev_by_revenue, 2),
            "p25": round(ev_by_revenue * (1 - spread), 2),
            "p50": round(ev_by_revenue, 2),
            "p75": round(ev_by_revenue * (1 + spread), 2),
        },
        "ev_ebitda": {
            "multiple": ev_ebitda_mult,
            "value": round(ev_by_ebitda, 2),
            "p25": round(ev_by_ebitda * (1 - spread), 2),
            "p50": round(ev_by_ebitda, 2),
            "p75": round(ev_by_ebitda * (1 + spread), 2),
        },
        "dcf_vs_peers": {
            "dcf_value": round(equity_value, 2),
            "peer_median": round(peer_median, 2),
            "premium_discount_pct": dcf_vs_peers_pct,
            "assessment": "aligned" if abs(dcf_vs_peers_pct) < 30 else ("premium" if dcf_vs_peers_pct > 0 else "discount"),
        },
        "source": "Damodaran/NYU Stern — Emerging Market Multiples 2025",
    }


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
    """Valuation v5.0 — FCFE/Ke methodology with 10 institutional-grade improvements.

    v5 improvements over v4:
    1. Mid-Year Convention — cash flows discounted mid-year (Goldman Sachs standard)
    2. Sector-specific NWC — working capital by industry cycle (Damodaran)
    3. Sector-specific CapEx — capital expenditure by industry (IRS/BNDES)
    4. Effective Tax Rate — Simples/Presumido/Real instead of flat 34%
    5. Liquidity-adjusted Beta — 5-factor beta with Dimson thin-trading adjustment
    6. Country Risk Premium — dynamic Brazil CRP via EMBI+ (BCB)
    7. Terminal Value Fade — competitive margin convergence (McKinsey/Mauboussin)
    8. Peer Comparison — sector multiples cross-reference
    9. Control Premium — minority discount analysis (Mergerstat)
    10. Monte Carlo Simulation — probabilistic valuation distribution
    """
    effective_margin_net = custom_margin if custom_margin is not None else net_margin
    effective_growth = custom_growth if custom_growth is not None else (growth_rate or 0.10)

    # ── 0. Effective Tax Rate (replaces fixed 34%) ──────────
    tax_info = calculate_effective_tax_rate(
        revenue=revenue, years_in_business=years_in_business, net_margin=effective_margin_net)
    etr = tax_info["effective_tax_rate"]
    ebit_margin = net_margin_to_ebit_margin(effective_margin_net, tax_rate=etr)

    # If actual EBITDA is provided, derive a more accurate EBITDA margin
    actual_ebitda_margin = (ebitda / revenue) if (ebitda and revenue > 0) else None

    # ── 1. Equity proxy & sector multiples ──────────────────
    sector_mults = get_sector_multiples(sector)
    if ebitda and ebitda > 0:
        equity_proxy = ebitda * sector_mults.get("ev_ebitda", 10.0)
    else:
        equity_proxy = revenue * sector_mults.get("ev_revenue", 1.0)
    equity_proxy = max(equity_proxy, revenue * 0.5)

    # ── 2. Cost of Equity (Ke) v5 — 5-factor beta + CRP ────
    ke_info = calculate_cost_of_equity(
        sector=sector, num_employees=num_employees, years_in_business=years_in_business,
        net_margin=effective_margin_net, debt=debt, equity_proxy=equity_proxy,
        founder_dependency=founder_dependency, tax_rate=etr,
    )
    discount_rate = custom_wacc if custom_wacc is not None else ke_info["cost_of_equity"]

    # ── 3. Project FCFE with sector-specific NWC/CapEx/D&A ─
    fcfe_projections = project_fcfe(
        revenue=revenue, net_margin=effective_margin_net,
        growth_rate=effective_growth, years=projection_years,
        sector=sector,
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

    # ── 6. Terminal Value Fade — competitive convergence ────
    tv_fade = fade_terminal_margin(
        current_margin=effective_margin_net, sector=sector,
        years_in_business=years_in_business,
    )
    faded_margin = tv_fade["faded_margin"]

    # ── 7. Terminal Values with fade + embedded survival ────
    # Gordon TV uses faded margin for terminal FCF (competitive convergence)
    faded_fcfe_last = fcfe_projections[-1]["revenue"] * faded_margin
    dep_ratio = get_sector_depreciation_ratio(sector)
    capex_ratio = get_sector_capex_ratio(sector)
    nwc_ratio = get_sector_nwc_ratio(sector)
    faded_last_rev = fcfe_projections[-1]["revenue"]
    faded_fcfe_terminal = (faded_last_rev * faded_margin +
                           faded_last_rev * dep_ratio -
                           faded_last_rev * capex_ratio -
                           faded_last_rev * nwc_ratio * effective_growth)
    # Use faded terminal FCF for Gordon (more conservative/realistic)
    tv_gordon_raw = calculate_terminal_value_gordon(last_fcf=faded_fcfe_terminal, wacc=discount_rate)
    tv_gordon_adjusted = tv_gordon_raw["terminal_value"] * survival["survival_rate"]

    last_ebitda = pnl_projections[-1]["ebitda"] if pnl_projections else (ebitda or revenue * ebit_margin * 0.66)
    # Recurring revenue justifies higher exit multiple (lower churn risk, predictable cash flows)
    # Source: Bessemer / SaaS Capital — subscription premium on exit multiple up to +30%
    effective_exit_multiple = custom_exit_multiple
    if custom_exit_multiple is None and recurring_revenue_pct > 0.20:
        base_mult = sector_mults.get("ev_ebitda", 6.0)
        effective_exit_multiple = round(base_mult * (1 + recurring_revenue_pct * 0.30), 2)
    tv_exit_raw = calculate_terminal_value_exit_multiple(
        last_year_ebitda=last_ebitda, sector=sector, custom_multiple=effective_exit_multiple)
    tv_exit_adjusted = tv_exit_raw["terminal_value"] * survival["survival_rate"]

    # ── 8. DCF = PV(FCFEs) + PV(TV) — Mid-Year Convention ──
    dcf_gordon = calculate_enterprise_value(
        fcf_projections=fcfe_projections, wacc=discount_rate,
        terminal_value=tv_gordon_adjusted, mid_year=True)
    dcf_exit = calculate_enterprise_value(
        fcf_projections=fcfe_projections, wacc=discount_rate,
        terminal_value=tv_exit_adjusted, mid_year=True)

    # ── 9. Equity — FCFE result IS equity; add only cash ────
    eq_gordon = dcf_gordon["enterprise_value"] + cash
    eq_exit = dcf_exit["enterprise_value"] + cash

    # ── 10. Stage-based blend ───────────────────────────────
    if years_in_business >= 7:      # Maturity
        w_ltg, w_mult = 0.50, 0.50
    elif years_in_business >= 3:    # Growth
        w_ltg, w_mult = 0.25, 0.75
    else:                            # Early stage
        w_ltg, w_mult = 0.0, 1.0

    equity_dcf = round(eq_gordon * w_ltg + eq_exit * w_mult, 2)

    # ── 11. DLOM — sole post-DCF discount ──────────────────
    dlom = calculate_dlom(revenue=revenue, sector=sector, years_in_business=years_in_business)
    dlom_value = equity_dcf * dlom["dlom_pct"]
    equity_after_dlom = equity_dcf - dlom_value

    # ── 12. Qualitative adjustment ─────────────────────────
    qual = calculate_qualitative_score(qualitative_answers)
    qual_adj = equity_after_dlom * qual["adjustment"] if qual["has_data"] else 0
    equity_value = round(max(0, equity_after_dlom + qual_adj), 2)

    # ── 13. Multiples (informational — NOT blended) ────────
    multiples_val = calculate_multiples_valuation(
        revenue=revenue, ebit_margin=ebit_margin, sector=sector,
        debt=debt, cash=cash, ebitda=ebitda,
        recurring_revenue_pct=recurring_revenue_pct)

    # ── 14. Scoring & analysis ─────────────────────────────
    debt_ratio = debt / (debt + equity_proxy) if (debt + equity_proxy) > 0 else 0
    risk_score = calculate_risk_score(
        effective_margin_net, effective_growth, debt_ratio,
        founder_dependency, ke_info["beta_levered"])
    maturity_index = calculate_maturity_index(
        revenue, effective_margin_net, effective_growth, founder_dependency, years_of_data)
    percentile = calculate_percentile(equity_value, revenue, sector, debt=debt, cash=cash)
    valuation_range = calculate_valuation_range(
        equity_value, risk_score, maturity_index, founder_dependency)

    sensitivity_table = calculate_sensitivity_table(
        revenue=revenue, net_margin=effective_margin_net, growth_rate=effective_growth,
        discount_rate=discount_rate, cash=cash, projection_years=projection_years,
        survival_rate=survival["survival_rate"], years_in_business=years_in_business,
        sector=sector)

    # ── 15. Peer Comparison ────────────────────────────────
    peers = calculate_peer_comparison(
        revenue=revenue, net_margin=effective_margin_net, sector=sector,
        equity_value=equity_value, ebitda=ebitda)

    # ── 16. Control Premium Analysis ───────────────────────
    control_premium = calculate_control_premium(equity_value)

    # ── 17. Monte Carlo Simulation ─────────────────────────
    monte_carlo = monte_carlo_valuation(
        revenue=revenue, net_margin=effective_margin_net, sector=sector,
        growth_rate=effective_growth, discount_rate=discount_rate,
        cash=cash, projection_years=projection_years,
        survival_rate=survival["survival_rate"],
        years_in_business=years_in_business,
    )

    # ── 18. Waterfall — use blended PV components ──────────
    blended_pv_fcf = round(dcf_gordon["pv_fcf_total"] * w_ltg + dcf_exit["pv_fcf_total"] * w_mult, 2)
    blended_pv_tv = round(dcf_gordon["pv_terminal_value"] * w_ltg + dcf_exit["pv_terminal_value"] * w_mult, 2)
    waterfall = build_waterfall(
        pv_fcf_total=blended_pv_fcf, pv_terminal=blended_pv_tv,
        cash=cash, equity_dcf=equity_dcf,
        dlom_pct=dlom["dlom_pct"], dlom_value=dlom_value,
        qualitative_adj_value=qual_adj, equity_final=equity_value,
    )
    round_sim = simulate_investment_round(equity_value=equity_value)

    kp_premium_pct = ke_info["key_person_premium"] * 100

    return {
        "engine_version": ENGINE_VERSION,
        "equity_value": equity_value, "equity_value_dcf": equity_dcf,
        "equity_value_raw": equity_dcf,
        "equity_value_gordon": round(eq_gordon, 2), "equity_value_exit_multiple": round(eq_exit, 2),
        "multiples_valuation": multiples_val,
        "gordon_weight": w_ltg, "exit_multiple_weight": w_mult,
        "dcf_weight": w_ltg, "multiples_weight": w_mult,  # backward compat aliases
        "valuation_range": valuation_range,
        "enterprise_value": dcf_gordon["enterprise_value"],
        "enterprise_value_gordon": dcf_gordon["enterprise_value"],
        "enterprise_value_exit": dcf_exit["enterprise_value"],
        "wacc": discount_rate,
        "beta_unlevered": ke_info["beta_unlevered"], "beta_levered": ke_info["beta_levered"],
        "cost_of_equity_detail": ke_info,
        "tax_info": tax_info,
        "tv_fade": tv_fade,
        "sector": sector, "sector_multiples": sector_mults,
        "fcf_projections": fcfe_projections, "pnl_projections": pnl_projections,
        "terminal_value": dcf_gordon["terminal_value"],
        "terminal_value_gordon": tv_gordon_raw, "terminal_value_exit": tv_exit_raw,
        "tv_percentage": dcf_gordon["tv_percentage"],
        "pv_terminal_value": blended_pv_tv,
        "pv_fcf_total": blended_pv_fcf, "pv_fcf": dcf_gordon["pv_fcf"],
        "founder_discount": round(kp_premium_pct, 1),
        "dlom": dlom, "survival": survival, "qualitative": qual,
        "peers": peers,
        "control_premium": control_premium,
        "monte_carlo": monte_carlo,
        "mid_year_convention": True,
        "risk_score": risk_score, "maturity_index": maturity_index, "percentile": percentile,
        "sensitivity_table": sensitivity_table, "waterfall": waterfall, "investment_round": round_sim,
        "parameters": {
            "revenue": revenue, "net_margin": effective_margin_net, "ebit_margin": ebit_margin,
            "growth_rate": effective_growth, "debt": debt, "cash": cash,
            "founder_dependency": founder_dependency, "years_of_data": years_of_data,
            "projection_years": projection_years, "years_in_business": years_in_business,
            "recurring_revenue_pct": recurring_revenue_pct, "num_employees": num_employees,
            "previous_investment": previous_investment, "selic_rate": get_selic(),
            "gordon_weight": w_ltg, "exit_multiple_weight": w_mult,
            "dcf_weight": w_ltg, "exit_weight": w_mult,  # backward compat
            "engine_version": ENGINE_VERSION,
            "methodology": "FCFE/Ke (QuantoVale v5)",
            "data_source": "Damodaran/NYU Stern + BCB/Selic + BCB/EMBI+ + IBGE",
            "effective_tax_rate": etr,
            "tax_regime": tax_info["regime"],
            "capex_ratio": get_sector_capex_ratio(sector),
            "nwc_ratio": get_sector_nwc_ratio(sector),
            "depreciation_ratio": get_sector_depreciation_ratio(sector),
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
            "ibge_data_quality": ibge_adjustment.get("ibge_data_quality", "indisponivel"),
            "ibge_data_label": ibge_adjustment.get("ibge_data_label", "IBGE/SIDRA: indisponível"),
        }
    return result
