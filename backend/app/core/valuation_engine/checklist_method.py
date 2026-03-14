"""
Checklist Valuation Method (Dave Berkus Method)

The Berkus Method assigns a dollar value (up to a maximum) to each of five
key risk-reduction areas. Each area addresses a critical business risk.

Source: Dave Berkus, "The Berkus Method" (2009, updated 2016)
        Angel Capital Association

Five Key Risk Areas:
1. Sound Idea (Basic Value / Product Risk)
2. Prototype (Technology Risk)
3. Quality Management Team (Execution Risk)
4. Strategic Relationships (Market Risk)
5. Product Rollout / Sales (Production Risk)

Each factor can contribute $0 to $500K (original) — we scale based on
company revenue/stage for larger companies.
"""

from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

# Default maximum contribution per factor (USD)
# Scaled from Berkus original ($500K per factor for pre-revenue startups)
DEFAULT_MAX_PER_FACTOR = 500_000


def _get_scale_factor(revenue: float) -> float:
    """Scale the max contribution based on revenue.
    Pre-revenue startups use the original Berkus scale.
    Larger companies scale proportionally."""
    if revenue <= 0:
        return 1.0
    elif revenue < 500_000:
        return 1.5
    elif revenue < 1_000_000:
        return 2.0
    elif revenue < 5_000_000:
        return 4.0
    elif revenue < 10_000_000:
        return 7.0
    elif revenue < 50_000_000:
        return 12.0
    else:
        return 20.0


def _score_sound_idea(
    net_margin: float,
    growth_rate: float,
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Score the soundness of the business idea (0.0 to 1.0).
    Addresses basic product-market risk."""
    score = 0.5  # Base

    # Profitability validates the business concept
    if net_margin > 0.20:
        score += 0.25
    elif net_margin > 0.10:
        score += 0.15
    elif net_margin > 0.05:
        score += 0.08
    elif net_margin > 0:
        score += 0.03
    elif net_margin < -0.10:
        score -= 0.15

    # Growth validates market demand
    if growth_rate > 0.25:
        score += 0.15
    elif growth_rate > 0.10:
        score += 0.08
    elif growth_rate < 0:
        score -= 0.10

    # Qualitative product assessment
    if qualitative_answers:
        for key in ["produto_moat", "produto_criticidade"]:
            val = qualitative_answers.get(key)
            s = val.get("score", 3) if isinstance(val, dict) else (val if isinstance(val, (int, float)) else 3)
            score += (s - 3) * 0.05  # Adjust ±0.05 per point from neutral

    return max(0.0, min(1.0, round(score, 3)))


def _score_prototype(
    years_in_business: int,
    recurring_revenue_pct: float,
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Score prototype / technology development (0.0 to 1.0).
    Addresses technology risk — proven product reduces risk."""
    score = 0.5

    # Years in business → product maturity
    if years_in_business >= 10:
        score += 0.3
    elif years_in_business >= 5:
        score += 0.2
    elif years_in_business >= 3:
        score += 0.1
    elif years_in_business < 1:
        score -= 0.2

    # Recurring revenue = sticky, proven product
    if recurring_revenue_pct > 0.70:
        score += 0.15
    elif recurring_revenue_pct > 0.40:
        score += 0.08

    # Qualitative — scalability and automation
    if qualitative_answers:
        for key in ["operacao_escalavel", "operacao_automacao"]:
            val = qualitative_answers.get(key)
            s = val.get("score", 3) if isinstance(val, dict) else (val if isinstance(val, (int, float)) else 3)
            score += (s - 3) * 0.05

    return max(0.0, min(1.0, round(score, 3)))


def _score_management_team(
    num_employees: int,
    founder_dependency: float,
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Score management team quality (0.0 to 1.0).
    Addresses execution risk."""
    score = 0.5

    # Team size
    if num_employees >= 50:
        score += 0.15
    elif num_employees >= 20:
        score += 0.1
    elif num_employees >= 5:
        score += 0.05
    elif num_employees <= 1:
        score -= 0.1

    # Founder dependency (high = risky)
    score -= founder_dependency * 0.25

    # Qualitative team assessment
    if qualitative_answers:
        for key in ["equipe_num_fundadores", "equipe_dedicacao", "equipe_experiencia",
                     "gov_profissional", "gov_compliance"]:
            val = qualitative_answers.get(key)
            s = val.get("score", 3) if isinstance(val, dict) else (val if isinstance(val, (int, float)) else 3)
            score += (s - 3) * 0.04

    return max(0.0, min(1.0, round(score, 3)))


def _score_strategic_relationships(
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Score strategic relationships / market position (0.0 to 1.0).
    Addresses market risk."""
    score = 0.5

    if qualitative_answers:
        for key in ["mercado_posicao", "mercado_tendencia", "clientes_diversificacao",
                     "clientes_recorrencia"]:
            val = qualitative_answers.get(key)
            s = val.get("score", 3) if isinstance(val, dict) else (val if isinstance(val, (int, float)) else 3)
            score += (s - 3) * 0.06

    return max(0.0, min(1.0, round(score, 3)))


def _score_product_rollout(
    revenue: float,
    growth_rate: float,
    qualitative_answers: Optional[Dict] = None,
) -> float:
    """Score product rollout / sales traction (0.0 to 1.0).
    Addresses production/scaling risk."""
    score = 0.5

    # Revenue traction
    if revenue >= 10_000_000:
        score += 0.25
    elif revenue >= 5_000_000:
        score += 0.15
    elif revenue >= 1_000_000:
        score += 0.1
    elif revenue >= 500_000:
        score += 0.05
    elif revenue < 100_000:
        score -= 0.15

    # Growth rate validates customer acquisition
    if growth_rate > 0.30:
        score += 0.15
    elif growth_rate > 0.15:
        score += 0.08
    elif growth_rate < 0:
        score -= 0.1

    if qualitative_answers:
        val = qualitative_answers.get("tracao_investimento")
        s = val.get("score", 3) if isinstance(val, dict) else (val if isinstance(val, (int, float)) else 3)
        score += (s - 3) * 0.05

    return max(0.0, min(1.0, round(score, 3)))


def calculate_checklist_valuation(
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
) -> Dict[str, Any]:
    """
    Calculate company valuation using the Berkus/Checklist method.

    Each of 5 risk areas can contribute $0 to max_per_factor (scaled by revenue).
    Total valuation = sum of all factor contributions.
    """
    scale = _get_scale_factor(revenue)
    max_per_factor = DEFAULT_MAX_PER_FACTOR * scale

    # Score each factor (0.0 to 1.0)
    factors = {
        "sound_idea": {
            "label": "Sound Idea (Product Risk)",
            "score": _score_sound_idea(net_margin, growth_rate, qualitative_answers),
            "risk_addressed": "Product-market fit validation",
        },
        "prototype": {
            "label": "Prototype / Technology (Technology Risk)",
            "score": _score_prototype(years_in_business, recurring_revenue_pct, qualitative_answers),
            "risk_addressed": "Technology development and scalability",
        },
        "management_team": {
            "label": "Quality Management Team (Execution Risk)",
            "score": _score_management_team(num_employees, founder_dependency, qualitative_answers),
            "risk_addressed": "Team capability and leadership",
        },
        "strategic_relationships": {
            "label": "Strategic Relationships (Market Risk)",
            "score": _score_strategic_relationships(qualitative_answers),
            "risk_addressed": "Market access and competitive position",
        },
        "product_rollout": {
            "label": "Product Rollout / Sales (Production Risk)",
            "score": _score_product_rollout(revenue, growth_rate, qualitative_answers),
            "risk_addressed": "Revenue traction and scaling capacity",
        },
    }

    # Calculate contributions
    total_valuation = 0
    for key, factor in factors.items():
        contribution = round(factor["score"] * max_per_factor, 2)
        factor["max_contribution"] = round(max_per_factor, 2)
        factor["contribution"] = contribution
        factor["pct_of_max"] = round(factor["score"] * 100, 1)
        total_valuation += contribution

    return {
        "method": "checklist",
        "method_name": "Checklist (Berkus Method)",
        "valuation": round(total_valuation, 2),
        "max_possible_valuation": round(max_per_factor * 5, 2),
        "achievement_pct": round(
            (total_valuation / (max_per_factor * 5)) * 100, 1
        ) if max_per_factor > 0 else 0,
        "scale_factor": scale,
        "max_per_factor": round(max_per_factor, 2),
        "factors": {
            k: {
                "label": v["label"],
                "score": v["score"],
                "contribution": v["contribution"],
                "max_contribution": v["max_contribution"],
                "pct_of_max": v["pct_of_max"],
                "risk_addressed": v["risk_addressed"],
            }
            for k, v in factors.items()
        },
        "source": "Dave Berkus Method — Angel Capital Association (2016 update)",
        "description": (
            "Assigns a monetary value to each of five key risk-reduction areas. "
            "The sum represents the pre-money valuation based on risk mitigation "
            "achieved by the company."
        ),
    }
