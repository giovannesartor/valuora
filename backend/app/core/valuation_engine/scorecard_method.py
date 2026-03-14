"""
Scorecard Valuation Method (Bill Payne Method)

The Scorecard method adjusts the average pre-money valuation of comparable
startups in the region/sector based on qualitative factors.

Source: Bill Payne, "The Scorecard Valuation Methodology" (2011)
        Angel Capital Association guidelines

Methodology:
1. Start with the median pre-money valuation for similar-stage companies in the sector
2. Assign comparison factors with weights:
   - Management Team: 30%
   - Size of the Opportunity: 25%
   - Product/Technology: 15%
   - Competitive Environment: 10%
   - Marketing/Sales Channels: 10%
   - Need for Additional Investment: 5%
   - Other Factors: 5%
3. Rate each factor relative to comparable companies (0.5x to 1.5x)
4. Compute weighted factor sum
5. Multiply median valuation by the factor sum to get adjusted valuation
"""

from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


# Default median pre-money valuations by sector (USD)
# Source: Angel Capital Association, PitchBook, Crunchbase median rounds
SECTOR_MEDIAN_VALUATIONS = {
    "tecnologia": 3_500_000,
    "saas": 4_000_000,
    "ecommerce": 2_500_000,
    "fintech": 5_000_000,
    "saude": 3_000_000,
    "farmacia": 2_800_000,
    "estetica": 1_500_000,
    "varejo": 1_800_000,
    "atacado": 2_000_000,
    "industria": 2_500_000,
    "alimentos_industria": 2_200_000,
    "textil": 1_800_000,
    "quimica": 3_000_000,
    "consultoria": 1_500_000,
    "contabilidade": 1_200_000,
    "marketing": 1_800_000,
    "servicos": 1_500_000,
    "alimentacao": 1_200_000,
    "hotelaria": 2_000_000,
    "educacao": 2_000_000,
    "edtech": 3_000_000,
    "construcao": 2_500_000,
    "imobiliario": 3_000_000,
    "agronegocio": 2_500_000,
    "agritech": 3_500_000,
    "logistica": 2_500_000,
    "entregas": 2_000_000,
    "energia": 3_500_000,
    "energia_solar": 3_000_000,
    "financeiro": 4_000_000,
    "seguros": 3_500_000,
    "midia": 2_000_000,
    "games": 2_500_000,
    "outros": 2_000_000,
}

# Scorecard factor weights (must sum to 1.0)
SCORECARD_WEIGHTS = {
    "management_team": 0.30,
    "market_opportunity": 0.25,
    "product_technology": 0.15,
    "competitive_environment": 0.10,
    "marketing_sales": 0.10,
    "need_additional_investment": 0.05,
    "other_factors": 0.05,
}


def _rate_management_team(
    num_employees: int,
    years_in_business: int,
    founder_dependency: float,
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Rate management team relative to comparables (0.5 to 1.5)."""
    score = 1.0

    # Team experience from qualitative answers
    if qualitative_answers:
        team_scores = []
        for key in ["equipe_num_fundadores", "equipe_dedicacao", "equipe_experiencia"]:
            val = qualitative_answers.get(key)
            if isinstance(val, dict):
                team_scores.append(val.get("score", 3))
            elif isinstance(val, (int, float)):
                team_scores.append(val)
        if team_scores:
            avg_team = sum(team_scores) / len(team_scores)
            score = 0.5 + (avg_team / 5.0)  # Maps 1-5 → 0.7-1.5

    # Adjust for founder dependency (high dependency = risk)
    score -= founder_dependency * 0.3

    # Adjust for team size
    if num_employees >= 20:
        score += 0.1
    elif num_employees <= 2:
        score -= 0.1

    # Adjust for experience (years in business as proxy)
    if years_in_business >= 10:
        score += 0.1
    elif years_in_business <= 1:
        score -= 0.15

    return max(0.5, min(1.5, round(score, 2)))


def _rate_market_opportunity(
    revenue: float,
    growth_rate: float,
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Rate market opportunity relative to comparables."""
    score = 1.0

    # Revenue as proxy for market traction
    if revenue >= 10_000_000:
        score += 0.2
    elif revenue >= 5_000_000:
        score += 0.1
    elif revenue < 500_000:
        score -= 0.15

    # Growth rate indicates market expansion
    if growth_rate > 0.30:
        score += 0.2
    elif growth_rate > 0.15:
        score += 0.1
    elif growth_rate < 0:
        score -= 0.2

    # Qualitative market assessment
    if qualitative_answers:
        market_scores = []
        for key in ["mercado_posicao", "mercado_tendencia", "mercado_competicao"]:
            val = qualitative_answers.get(key)
            if isinstance(val, dict):
                market_scores.append(val.get("score", 3))
            elif isinstance(val, (int, float)):
                market_scores.append(val)
        if market_scores:
            avg = sum(market_scores) / len(market_scores)
            score = 0.5 + (avg / 5.0) * 0.5 + score * 0.5  # Blend

    return max(0.5, min(1.5, round(score, 2)))


def _rate_product_technology(
    recurring_revenue_pct: float,
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Rate product/technology strength."""
    score = 1.0

    # Recurring revenue indicates product stickiness
    if recurring_revenue_pct > 0.70:
        score += 0.2
    elif recurring_revenue_pct > 0.40:
        score += 0.1

    if qualitative_answers:
        prod_scores = []
        for key in ["produto_moat", "produto_criticidade"]:
            val = qualitative_answers.get(key)
            if isinstance(val, dict):
                prod_scores.append(val.get("score", 3))
            elif isinstance(val, (int, float)):
                prod_scores.append(val)
        if prod_scores:
            avg = sum(prod_scores) / len(prod_scores)
            score = 0.5 + (avg / 5.0)

    return max(0.5, min(1.5, round(score, 2)))


def _rate_competitive_environment(
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Rate competitive positioning."""
    score = 1.0

    if qualitative_answers:
        val = qualitative_answers.get("mercado_competicao")
        if isinstance(val, dict):
            comp = val.get("score", 3)
        elif isinstance(val, (int, float)):
            comp = val
        else:
            comp = 3
        score = 0.5 + (comp / 5.0)

    return max(0.5, min(1.5, round(score, 2)))


def _rate_marketing_sales(
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Rate marketing and sales channels."""
    score = 1.0

    if qualitative_answers:
        sales_scores = []
        for key in ["clientes_diversificacao", "clientes_recorrencia", "operacao_escalavel"]:
            val = qualitative_answers.get(key)
            if isinstance(val, dict):
                sales_scores.append(val.get("score", 3))
            elif isinstance(val, (int, float)):
                sales_scores.append(val)
        if sales_scores:
            avg = sum(sales_scores) / len(sales_scores)
            score = 0.5 + (avg / 5.0)

    return max(0.5, min(1.5, round(score, 2)))


def _rate_investment_need(
    net_margin: float,
    cash: float,
    revenue: float,
) -> float:
    """Rate need for additional investment (lower need = higher score)."""
    score = 1.0

    # Profitable companies need less investment
    if net_margin > 0.20:
        score += 0.2
    elif net_margin > 0.10:
        score += 0.1
    elif net_margin < 0:
        score -= 0.2

    # Cash runway
    if revenue > 0:
        cash_ratio = cash / revenue
        if cash_ratio > 0.5:
            score += 0.1
        elif cash_ratio < 0.1:
            score -= 0.1

    return max(0.5, min(1.5, round(score, 2)))


def calculate_scorecard_valuation(
    revenue: float,
    net_margin: float,
    growth_rate: float,
    sector: str,
    num_employees: int = 0,
    years_in_business: int = 3,
    founder_dependency: float = 0.0,
    recurring_revenue_pct: float = 0.0,
    cash: float = 0,
    qualitative_answers: Optional[Dict[str, Any]] = None,
    custom_median_valuation: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Calculate company valuation using the Scorecard (Bill Payne) method.

    Returns the adjusted valuation and detailed factor breakdown.
    """
    # 1. Get median valuation for sector
    median_val = custom_median_valuation or SECTOR_MEDIAN_VALUATIONS.get(
        sector.lower(), 2_000_000
    )

    # Scale median based on revenue (larger companies get higher median)
    if revenue >= 50_000_000:
        revenue_scale = 5.0
    elif revenue >= 10_000_000:
        revenue_scale = 3.0
    elif revenue >= 5_000_000:
        revenue_scale = 2.0
    elif revenue >= 1_000_000:
        revenue_scale = 1.5
    else:
        revenue_scale = 1.0
    adjusted_median = median_val * revenue_scale

    # 2. Rate each factor
    factors = {
        "management_team": {
            "weight": SCORECARD_WEIGHTS["management_team"],
            "rating": _rate_management_team(
                num_employees, years_in_business, founder_dependency, qualitative_answers
            ),
            "label": "Management Team",
        },
        "market_opportunity": {
            "weight": SCORECARD_WEIGHTS["market_opportunity"],
            "rating": _rate_market_opportunity(revenue, growth_rate, qualitative_answers),
            "label": "Market Opportunity",
        },
        "product_technology": {
            "weight": SCORECARD_WEIGHTS["product_technology"],
            "rating": _rate_product_technology(recurring_revenue_pct, qualitative_answers),
            "label": "Product / Technology",
        },
        "competitive_environment": {
            "weight": SCORECARD_WEIGHTS["competitive_environment"],
            "rating": _rate_competitive_environment(qualitative_answers),
            "label": "Competitive Environment",
        },
        "marketing_sales": {
            "weight": SCORECARD_WEIGHTS["marketing_sales"],
            "rating": _rate_marketing_sales(qualitative_answers),
            "label": "Marketing & Sales Channels",
        },
        "need_additional_investment": {
            "weight": SCORECARD_WEIGHTS["need_additional_investment"],
            "rating": _rate_investment_need(net_margin, cash, revenue),
            "label": "Need for Additional Investment",
        },
        "other_factors": {
            "weight": SCORECARD_WEIGHTS["other_factors"],
            "rating": 1.0,  # Neutral by default
            "label": "Other Factors",
        },
    }

    # 3. Calculate weighted factor sum
    weighted_sum = sum(
        f["weight"] * f["rating"] for f in factors.values()
    )

    # 4. Adjusted valuation
    scorecard_valuation = round(adjusted_median * weighted_sum, 2)

    return {
        "method": "scorecard",
        "method_name": "Scorecard (Bill Payne Method)",
        "valuation": scorecard_valuation,
        "median_valuation": round(adjusted_median, 2),
        "weighted_factor_sum": round(weighted_sum, 4),
        "factors": {
            k: {
                "label": v["label"],
                "weight": v["weight"],
                "weight_pct": round(v["weight"] * 100, 1),
                "rating": v["rating"],
                "weighted_contribution": round(v["weight"] * v["rating"], 4),
            }
            for k, v in factors.items()
        },
        "source": "Bill Payne Scorecard Method — Angel Capital Association",
        "description": (
            "Adjusts the median pre-money valuation for comparable companies "
            "based on weighted qualitative factors including team, market, "
            "product, competition, and sales channels."
        ),
    }
