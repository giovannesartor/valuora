"""
ROI Calculator — Public endpoint for quick ROI/payback estimation.
No authentication required (lead generation tool).
"""

from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter

router = APIRouter(prefix="/roi-calculator", tags=["ROI Calculator"])


class ROIRequest(BaseModel):
    current_revenue: float = Field(..., gt=0, description="Current annual revenue (USD)")
    current_net_margin: float = Field(..., ge=-1, le=1, description="Current net margin (decimal)")
    expected_growth_rate: float = Field(0.10, ge=-0.5, le=2.0, description="Expected annual growth rate")
    investment_amount: float = Field(..., gt=0, description="Investment amount (USD)")
    investment_horizon_years: int = Field(5, ge=1, le=20, description="Investment horizon in years")
    sector: str = Field("outros", description="Business sector")
    exit_multiple: Optional[float] = Field(None, ge=0.5, le=30, description="Expected exit EV/EBITDA multiple")


class ROIResponse(BaseModel):
    investment_amount: float
    horizon_years: int
    projected_revenue_at_exit: float
    projected_ebitda_at_exit: float
    projected_equity_value: float
    total_return: float
    roi_pct: float
    irr_pct: float
    payback_years: Optional[float]
    moic: float  # Multiple on Invested Capital
    annual_cash_flows: list
    exit_multiple_used: float
    summary: str


@router.post("/calculate", response_model=ROIResponse)
async def calculate_roi(req: ROIRequest):
    """Calculate ROI, IRR, payback period, and MOIC for an investment."""
    from app.core.valuation_engine.engine import get_sector_multiples

    sector_mults = get_sector_multiples(req.sector)
    exit_mult = req.exit_multiple or sector_mults.get("ev_ebitda", 8.0)

    revenue = req.current_revenue
    margin = req.current_net_margin
    ebitda_margin = min(margin * 1.4, 0.50)  # Approximate EBITDA margin
    growth = req.expected_growth_rate
    inv = req.investment_amount
    years = req.investment_horizon_years

    annual_flows = []
    cumulative_return = 0
    payback_year = None

    for y in range(1, years + 1):
        rev = revenue * ((1 + growth) ** y)
        ebitda = rev * ebitda_margin
        net_income = rev * margin
        annual_cash = net_income  # Simplified to net profit
        cumulative_return += annual_cash

        annual_flows.append({
            "year": y,
            "revenue": round(rev, 2),
            "ebitda": round(ebitda, 2),
            "net_income": round(net_income, 2),
            "cumulative_return": round(cumulative_return, 2),
        })

        if payback_year is None and cumulative_return >= inv:
            # Linear interpolation for fractional payback year
            prev_cum = cumulative_return - annual_cash
            remaining = inv - prev_cum
            fraction = remaining / annual_cash if annual_cash > 0 else 1
            payback_year = round(y - 1 + fraction, 1)

    # Exit valuation
    exit_revenue = revenue * ((1 + growth) ** years)
    exit_ebitda = exit_revenue * ebitda_margin
    exit_equity = exit_ebitda * exit_mult

    total_return = exit_equity - inv
    roi_pct = (total_return / inv) * 100 if inv > 0 else 0
    moic = exit_equity / inv if inv > 0 else 0

    # IRR calculation (Newton-Raphson approximation)
    irr = _calculate_irr(inv, [f["net_income"] for f in annual_flows], exit_equity)

    # Summary text
    if roi_pct > 200:
        verdict = "exceptional"
    elif roi_pct > 100:
        verdict = "strong"
    elif roi_pct > 30:
        verdict = "moderate"
    else:
        verdict = "conservative"

    summary = (
        f"A ${inv:,.0f} investment in this business could yield a {verdict} "
        f"return of {roi_pct:.0f}% over {years} years (MOIC: {moic:.1f}x). "
        f"Projected exit value: ${exit_equity:,.0f} at {exit_mult:.1f}x EV/EBITDA. "
    )
    if payback_year:
        summary += f"Estimated payback in {payback_year} years."
    else:
        summary += "Payback extends beyond the investment horizon."

    return ROIResponse(
        investment_amount=inv,
        horizon_years=years,
        projected_revenue_at_exit=round(exit_revenue, 2),
        projected_ebitda_at_exit=round(exit_ebitda, 2),
        projected_equity_value=round(exit_equity, 2),
        total_return=round(total_return, 2),
        roi_pct=round(roi_pct, 1),
        irr_pct=round(irr * 100, 1),
        payback_years=payback_year,
        moic=round(moic, 2),
        annual_cash_flows=annual_flows,
        exit_multiple_used=exit_mult,
        summary=summary,
    )


def _calculate_irr(investment: float, cash_flows: list, terminal: float, max_iter: int = 100) -> float:
    """Newton-Raphson IRR. Cash flows exclude terminal; terminal added at last year."""
    if not cash_flows:
        return 0.0

    def npv(rate):
        total = -investment
        for i, cf in enumerate(cash_flows):
            total += cf / ((1 + rate) ** (i + 1))
        # Add terminal value at end
        total += terminal / ((1 + rate) ** len(cash_flows))
        return total

    def npv_deriv(rate):
        total = 0
        for i, cf in enumerate(cash_flows):
            n = i + 1
            total -= n * cf / ((1 + rate) ** (n + 1))
        n = len(cash_flows)
        total -= n * terminal / ((1 + rate) ** (n + 1))
        return total

    rate = 0.15  # Initial guess
    for _ in range(max_iter):
        f = npv(rate)
        fp = npv_deriv(rate)
        if abs(fp) < 1e-12:
            break
        new_rate = rate - f / fp
        if new_rate <= -0.99:
            new_rate = -0.5
        if new_rate > 10:
            new_rate = 5.0
        if abs(new_rate - rate) < 1e-8:
            rate = new_rate
            break
        rate = new_rate

    return max(-0.99, min(rate, 10.0))
