"""
Venture Capital Valuation Method

The VC method works backward from an expected exit value.
It estimates the company's future value at exit, then discounts back to
present using a target return rate typical for VC investors.

Source:
  - William A. Sahlman, Harvard Business School
  - Damodaran, "Valuing Young, Start-up and Growth Companies"
  - First Round Capital, Sequoia Capital frameworks

Methodology:
1. Estimate exit (terminal) value at a future date (typically 5-7 years)
   using revenue multiples or EBITDA multiples
2. Apply a target ROI (typically 10x-30x for early stage, 3x-10x for growth)
3. Discount the exit value back to present: Pre-money = Exit Value / Target ROI
4. Adjust for dilution from future funding rounds
"""

from typing import Dict, Any, Optional, List
import math
import logging

logger = logging.getLogger(__name__)

# Target return multiples by stage
# Source: Cambridge Associates VC benchmarks, AngelList data
TARGET_ROI_BY_STAGE = {
    "pre_seed": 30.0,    # Pre-seed: 30x target
    "seed": 20.0,        # Seed: 20x
    "early": 15.0,       # Series A: 15x
    "growth": 8.0,       # Series B-C: 8x
    "late": 4.0,         # Late stage: 4x
    "mature": 2.5,       # Mature/pre-IPO: 2.5x
}

# Expected dilution from future rounds
EXPECTED_DILUTION_BY_STAGE = {
    "pre_seed": 0.70,    # 70% dilution through multiple rounds
    "seed": 0.55,        # 55% dilution
    "early": 0.40,       # 40%
    "growth": 0.25,      # 25%
    "late": 0.15,        # 15%
    "mature": 0.05,      # 5%
}

# Exit revenue multiples by sector (median exit multiples)
# Source: PitchBook, CB Insights exit data
EXIT_REVENUE_MULTIPLES = {
    "tecnologia": 5.0,
    "saas": 8.0,
    "ecommerce": 2.5,
    "fintech": 6.0,
    "saude": 4.0,
    "farmacia": 3.5,
    "estetica": 2.0,
    "varejo": 1.5,
    "atacado": 1.2,
    "industria": 2.0,
    "alimentos_industria": 1.8,
    "textil": 1.5,
    "quimica": 2.5,
    "consultoria": 2.5,
    "contabilidade": 2.0,
    "marketing": 3.0,
    "servicos": 2.0,
    "alimentacao": 1.5,
    "hotelaria": 2.5,
    "educacao": 3.0,
    "edtech": 5.0,
    "construcao": 1.5,
    "imobiliario": 2.0,
    "agronegocio": 2.0,
    "agritech": 4.0,
    "logistica": 2.5,
    "entregas": 3.0,
    "energia": 3.0,
    "energia_solar": 3.5,
    "financeiro": 4.0,
    "seguros": 3.0,
    "midia": 2.5,
    "games": 4.0,
    "outros": 2.0,
}


def _determine_company_stage(
    revenue: float,
    years_in_business: int,
    num_employees: int,
    net_margin: float,
    previous_investment: float = 0,
) -> str:
    """Determine company stage for VC method."""
    if revenue <= 0 and years_in_business < 1:
        return "pre_seed"
    elif revenue < 500_000 and years_in_business <= 2:
        return "seed"
    elif revenue < 2_000_000 and years_in_business <= 4:
        return "early"
    elif revenue < 10_000_000 and years_in_business <= 7:
        return "growth"
    elif revenue < 50_000_000:
        return "late"
    else:
        return "mature"


def calculate_venture_capital_valuation(
    revenue: float,
    net_margin: float,
    growth_rate: float,
    sector: str,
    num_employees: int = 0,
    years_in_business: int = 3,
    founder_dependency: float = 0.0,
    recurring_revenue_pct: float = 0.0,
    cash: float = 0,
    debt: float = 0,
    ebitda: Optional[float] = None,
    previous_investment: float = 0.0,
    projection_years: int = 5,
    custom_target_roi: Optional[float] = None,
    custom_exit_multiple: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Calculate company valuation using the Venture Capital method.

    Steps:
    1. Project revenue at exit (projection_years into future)
    2. Apply sector exit multiple to get exit value
    3. Adjust for expected dilution
    4. Discount back using target ROI
    """
    # Determine company stage
    stage = _determine_company_stage(
        revenue, years_in_business, num_employees, net_margin, previous_investment
    )

    # Target ROI
    target_roi = custom_target_roi or TARGET_ROI_BY_STAGE.get(stage, 10.0)

    # Exit multiple
    exit_multiple = custom_exit_multiple or EXIT_REVENUE_MULTIPLES.get(
        sector.lower(), 2.0
    )

    # Recurring revenue premium on exit multiple
    if recurring_revenue_pct > 0.50:
        exit_multiple *= 1 + (recurring_revenue_pct * 0.30)
        exit_multiple = round(exit_multiple, 2)

    # Project revenue at exit using growth with decay
    exit_years = min(projection_years, 7)  # VC typically looks 5-7 years
    decay_lambda = 0.25
    projected_revenue = revenue
    annual_revenues = [revenue]

    for year in range(1, exit_years + 1):
        exp_decay = math.exp(-decay_lambda * year)
        adjusted_growth = growth_rate * exp_decay + 0.03 * (1 - exp_decay)
        projected_revenue *= (1 + adjusted_growth)
        annual_revenues.append(round(projected_revenue, 2))

    # Exit value
    exit_revenue = projected_revenue
    exit_value = exit_revenue * exit_multiple

    # EBITDA-based exit (alternative)
    if ebitda and ebitda > 0:
        ebitda_growth = growth_rate * 0.8  # EBITDA grows slightly slower
        exit_ebitda = ebitda * ((1 + ebitda_growth) ** exit_years)
        from app.core.valuation_engine.engine import get_sector_multiples
        sector_mults = get_sector_multiples(sector)
        ebitda_exit_multiple = sector_mults.get("ev_ebitda", 6.0)
        exit_value_ebitda = exit_ebitda * ebitda_exit_multiple
        # Use higher of revenue-based or EBITDA-based exit
        exit_value = max(exit_value, exit_value_ebitda)

    # Expected dilution
    expected_dilution = EXPECTED_DILUTION_BY_STAGE.get(stage, 0.30)
    retention_factor = 1 - expected_dilution

    # Pre-money valuation = Exit Value × Retention / Target ROI
    pre_money_valuation = (exit_value * retention_factor) / target_roi

    # Post-money = Pre-money + cash
    post_money_valuation = pre_money_valuation + cash

    # Implied IRR
    irr = (exit_value / pre_money_valuation) ** (1 / exit_years) - 1 if pre_money_valuation > 0 else 0

    # What an investor would pay today
    investor_entry_price = pre_money_valuation

    return {
        "method": "venture_capital",
        "method_name": "Venture Capital Method",
        "valuation": round(pre_money_valuation, 2),
        "post_money_valuation": round(post_money_valuation, 2),
        "company_stage": stage,
        "exit_analysis": {
            "exit_years": exit_years,
            "current_revenue": round(revenue, 2),
            "projected_exit_revenue": round(exit_revenue, 2),
            "revenue_cagr_pct": round(
                ((exit_revenue / revenue) ** (1 / exit_years) - 1) * 100, 2
            ) if revenue > 0 else 0,
            "exit_multiple": exit_multiple,
            "exit_value": round(exit_value, 2),
            "annual_revenue_projection": annual_revenues,
        },
        "return_analysis": {
            "target_roi": target_roi,
            "target_roi_label": f"{target_roi:.0f}x",
            "expected_dilution_pct": round(expected_dilution * 100, 1),
            "retention_factor": round(retention_factor, 4),
            "implied_irr_pct": round(irr * 100, 2),
            "investor_entry_price": round(investor_entry_price, 2),
        },
        "source": (
            "Venture Capital Method — Sahlman (HBS), "
            "Cambridge Associates benchmarks, "
            "Damodaran Young Company Valuation"
        ),
        "description": (
            "Estimates present value by working backward from an expected exit value. "
            "Projects revenue growth, applies sector exit multiples, adjusts for "
            "expected dilution from future funding rounds, and discounts using "
            "stage-appropriate target return multiples."
        ),
    }
