from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.models.models import PlanType, AnalysisStatus


# ─── Analysis Schemas ─────────────────────────────────────
class AnalysisCreate(BaseModel):
    company_name: str
    sector: str
    cnpj: Optional[str] = None
    company_type: Optional[str] = None  # tradicional / nova_economia / startup / equity_pessoal
    website: Optional[str] = None
    founding_date: Optional[str] = None  # MM/AAAA
    location_state: Optional[str] = None
    location_city: Optional[str] = None
    revenue: float
    net_margin: float
    growth_rate: Optional[float] = None
    debt: float = 0
    cash: float = 0
    founder_dependency: float = 0.0
    projection_years: int = 10  # v4 standard: 10 years
    # v3 fields
    ebitda: Optional[float] = None
    recurring_revenue_pct: float = 0.0
    num_employees: int = 0
    years_in_business: int = 3
    previous_investment: float = 0.0
    # v8 diagnostic fields
    revenue_ntm: Optional[float] = None
    ebitda_margin: Optional[float] = None  # EBITDA as % of revenue (0-1)
    tangible_assets: Optional[float] = None
    intangible_assets: Optional[float] = None
    equity_participations: Optional[float] = None
    qualitative_answers: Optional[Dict[str, Any]] = None
    dcf_weight: Optional[float] = None  # v4: engine determines stage-based weights
    custom_exit_multiple: Optional[float] = None


class AnalysisResponse(BaseModel):
    id: UUID
    company_name: str
    sector: str
    cnpj: Optional[str] = None
    company_type: Optional[str] = None
    website: Optional[str] = None
    founding_date: Optional[str] = None
    location_state: Optional[str] = None
    location_city: Optional[str] = None
    revenue: float
    net_margin: float
    growth_rate: Optional[float]
    debt: float
    cash: float
    founder_dependency: float
    projection_years: Optional[int] = 10
    ebitda: Optional[float] = None
    recurring_revenue_pct: Optional[float] = 0.0
    num_employees: Optional[int] = 0
    years_in_business: Optional[int] = 3
    previous_investment: Optional[float] = 0.0
    revenue_ntm: Optional[float] = None
    ebitda_margin: Optional[float] = None
    tangible_assets: Optional[float] = None
    intangible_assets: Optional[float] = None
    equity_participations: Optional[float] = None
    qualitative_answers: Optional[Dict[str, Any]] = None
    dcf_weight: Optional[float] = None
    custom_exit_multiple: Optional[float] = None
    logo_path: Optional[str] = None
    uploaded_files: Optional[List[str]] = None
    extracted_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    share_token: Optional[str] = None
    reanalysis_alert_pct: Optional[float] = None
    status: AnalysisStatus
    plan: Optional[PlanType]
    equity_value: Optional[float]
    risk_score: Optional[float]
    maturity_index: Optional[float]
    percentile: Optional[float]
    valuation_result: Optional[Dict[str, Any]]
    ai_analysis: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnalysisListResponse(BaseModel):
    id: UUID
    company_name: str
    sector: str
    equity_value: Optional[float]
    risk_score: Optional[float] = None
    status: AnalysisStatus
    plan: Optional[PlanType]
    created_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaginatedAnalysesResponse(BaseModel):
    items: list[AnalysisListResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Simulation Schemas ──────────────────────────────────
class SimulationRequest(BaseModel):
    analysis_id: UUID
    growth_rate: Optional[float] = None
    net_margin: Optional[float] = None
    discount_rate: Optional[float] = None
    founder_dependency: Optional[float] = None


class SimulationResponse(BaseModel):
    id: UUID
    analysis_id: UUID
    parameters: Dict[str, Any]
    result: Dict[str, Any]
    equity_value: float
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Payment Schemas ─────────────────────────────────────
class PaymentCreate(BaseModel):
    analysis_id: UUID
    plan: PlanType
    coupon: Optional[str] = None


class PaymentResponse(BaseModel):
    id: UUID
    analysis_id: UUID
    plan: PlanType
    amount: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


PLAN_PRICES = {
    PlanType.PROFESSIONAL: 990.00,
    PlanType.INVESTOR_READY: 2490.00,
    PlanType.FUNDRAISING: 4990.00,
    PlanType.BUNDLE: 5490.00,  # FUNDRAISING + PITCH_DECK
    # Legacy plans (mapped to new pricing)
    PlanType.ESSENCIAL: 990.00,
    PlanType.PROFISSIONAL: 2490.00,
    PlanType.ESTRATEGICO: 4990.00,
}

# Pitch Deck — standalone product
PITCH_DECK_PRICE = 990.00

# Currency
PLAN_CURRENCY = "USD"

PLAN_FEATURES = {
    PlanType.PROFESSIONAL: [
        "valuation_dcf",
        "scorecard_method",
        "checklist_method",
        "risk_score",
        "pdf_basic",
    ],
    PlanType.INVESTOR_READY: [
        "valuation_dcf",
        "scorecard_method",
        "checklist_method",
        "venture_capital_method",
        "multiples_method",
        "risk_score",
        "sector_benchmark",
        "maturity_index",
        "pdf_full",
        "simulator",
    ],
    PlanType.FUNDRAISING: [
        "valuation_dcf",
        "scorecard_method",
        "checklist_method",
        "venture_capital_method",
        "multiples_method",
        "risk_score",
        "sector_benchmark",
        "maturity_index",
        "pdf_full",
        "simulator",
        "ai_analysis",
        "growth_roadmap",
        "priority_support",
    ],
}


# ─── Report Schemas ──────────────────────────────────────
class ReportResponse(BaseModel):
    id: UUID
    analysis_id: UUID
    version: int
    download_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
