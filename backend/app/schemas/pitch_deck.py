"""
Pitch Deck — Schemas (Pydantic)
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# ─── Sub-schemas ──────────────────────────────────────────
class CompetitorEntry(BaseModel):
    competitor: str
    advantage: str


class MilestoneEntry(BaseModel):
    title: str
    date: Optional[str] = None
    description: Optional[str] = None
    status: str = "upcoming"  # completed | in_progress | upcoming


class TeamMember(BaseModel):
    name: str
    role: str
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    linkedin: Optional[str] = None


class PartnerResource(BaseModel):
    name: str
    logo_path: Optional[str] = None


class FundingNeeds(BaseModel):
    amount: float = 0
    description: Optional[str] = None
    breakdown: Optional[List[Dict[str, Any]]] = None  # [{"label": "Estoque", "value": 100000}]


class TargetMarket(BaseModel):
    description: Optional[str] = None
    tam: Optional[str] = None
    sam: Optional[str] = None
    som: Optional[str] = None
    segments: Optional[List[str]] = None


class FinancialProjection(BaseModel):
    year: int
    revenue: float = 0
    expenses: float = 0
    profit: float = 0


# ─── Create / Update ─────────────────────────────────────
class PitchDeckCreate(BaseModel):
    company_name: str
    sector: Optional[str] = None
    slogan: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    analysis_id: Optional[UUID] = None  # link to existing valuation

    headline: Optional[str] = None
    problem: Optional[str] = None
    solution: Optional[str] = None
    target_market: Optional[TargetMarket] = None
    competitive_landscape: Optional[List[CompetitorEntry]] = None
    business_model: Optional[str] = None
    sales_channels: Optional[str] = None
    marketing_activities: Optional[str] = None
    funding_needs: Optional[FundingNeeds] = None
    financial_projections: Optional[List[FinancialProjection]] = None
    milestones: Optional[List[MilestoneEntry]] = None
    team: Optional[List[TeamMember]] = None
    partners_resources: Optional[List[PartnerResource]] = None
    investor_type: Optional[str] = "geral"   # geral | angel | pe | bank
    theme: Optional[str] = "corporate"       # corporate | startup | bold | minimal


class PitchDeckUpdate(BaseModel):
    company_name: Optional[str] = None
    sector: Optional[str] = None
    slogan: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None

    headline: Optional[str] = None
    problem: Optional[str] = None
    solution: Optional[str] = None
    target_market: Optional[TargetMarket] = None
    competitive_landscape: Optional[List[CompetitorEntry]] = None
    business_model: Optional[str] = None
    sales_channels: Optional[str] = None
    marketing_activities: Optional[str] = None
    funding_needs: Optional[FundingNeeds] = None
    financial_projections: Optional[List[FinancialProjection]] = None
    milestones: Optional[List[MilestoneEntry]] = None
    team: Optional[List[TeamMember]] = None
    partners_resources: Optional[List[PartnerResource]] = None
    investor_type: Optional[str] = "geral"   # geral | angel | pe | bank
    theme: Optional[str] = "corporate"        # corporate | startup | bold | minimal


# ─── Response ─────────────────────────────────────────────
class PitchDeckResponse(BaseModel):
    id: UUID
    user_id: UUID
    analysis_id: Optional[UUID] = None
    company_name: str
    sector: Optional[str] = None
    logo_path: Optional[str] = None
    slogan: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None

    headline: Optional[str] = None
    problem: Optional[str] = None
    solution: Optional[str] = None
    target_market: Optional[Dict[str, Any]] = None
    competitive_landscape: Optional[List[Dict[str, Any]]] = None
    business_model: Optional[str] = None
    sales_channels: Optional[str] = None
    marketing_activities: Optional[str] = None
    funding_needs: Optional[Dict[str, Any]] = None
    financial_projections: Optional[List[Dict[str, Any]]] = None
    milestones: Optional[List[Dict[str, Any]]] = None
    team: Optional[List[Dict[str, Any]]] = None
    partners_resources: Optional[List[Dict[str, Any]]] = None

    ai_headline: Optional[str] = None
    ai_problem: Optional[str] = None
    ai_solution: Optional[str] = None
    ai_business_model: Optional[str] = None
    ai_sales_channels: Optional[str] = None
    ai_marketing: Optional[str] = None
    ai_funding_use: Optional[str] = None
    ai_competitive_analysis: Optional[str] = None

    investor_type: Optional[str] = "geral"
    theme: Optional[str] = "corporate"
    executive_summary_path: Optional[str] = None

    pdf_path: Optional[str] = None
    pdf_generated_at: Optional[datetime] = None
    status: str
    is_paid: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PitchDeckListResponse(BaseModel):
    id: UUID
    company_name: str
    sector: Optional[str] = None
    status: str
    is_paid: bool
    analysis_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Payment ─────────────────────────────────────────────
class PitchDeckPaymentCreate(BaseModel):
    pitch_deck_id: UUID
    coupon: Optional[str] = None


class PitchDeckPaymentResponse(BaseModel):
    id: UUID
    pitch_deck_id: UUID
    amount: float
    status: str
    payment_method: Optional[str] = None
    stripe_session_id: Optional[str] = None
    stripe_payment_intent_id: Optional[str] = None
    checkout_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── AI Improve Request ──────────────────────────────────
class PitchDeckAIImproveRequest(BaseModel):
    """Request to improve a specific section using DeepSeek AI."""
    section: str  # headline | problem | solution | business_model | sales_channels | marketing | funding_use
    current_text: Optional[str] = None
    company_name: Optional[str] = None
    sector: Optional[str] = None
    context: Optional[str] = None  # additional context
