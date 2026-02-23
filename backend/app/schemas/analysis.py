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
    revenue: float
    net_margin: float
    growth_rate: Optional[float] = None
    debt: float = 0
    cash: float = 0
    founder_dependency: float = 0.0


class AnalysisResponse(BaseModel):
    id: UUID
    company_name: str
    sector: str
    revenue: float
    net_margin: float
    growth_rate: Optional[float]
    debt: float
    cash: float
    founder_dependency: float
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
    status: AnalysisStatus
    plan: Optional[PlanType]
    created_at: datetime

    class Config:
        from_attributes = True


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
    PlanType.ESSENCIAL: 499.00,
    PlanType.PROFISSIONAL: 899.00,
    PlanType.ESTRATEGICO: 1999.00,
}

PLAN_FEATURES = {
    PlanType.ESSENCIAL: [
        "valuation_dcf",
        "risk_score",
        "pdf_basic",
    ],
    PlanType.PROFISSIONAL: [
        "valuation_dcf",
        "risk_score",
        "benchmark_setorial",
        "maturity_index",
        "pdf_completo",
        "simulador",
    ],
    PlanType.ESTRATEGICO: [
        "valuation_dcf",
        "risk_score",
        "benchmark_setorial",
        "maturity_index",
        "pdf_completo",
        "simulador",
        "analise_ia",
        "timeline_valorizacao",
        "suporte_prioritario",
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
