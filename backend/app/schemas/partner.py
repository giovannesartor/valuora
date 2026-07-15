"""
Partner Mode schemas — Modo Parceiro (contabilidades e consultorias).
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# ─── Partner Registration ─────────────────────────────────
class PartnerRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: Optional[str] = None
    phone: Optional[str] = None
    cpf_cnpj: Optional[str] = None


class PartnerResponse(BaseModel):
    id: UUID
    user_id: UUID
    company_name: Optional[str] = None
    phone: Optional[str] = None
    referral_code: str
    referral_link: Optional[str] = None
    commission_rate: float
    pix_key_type: Optional[str] = None
    pix_key: Optional[str] = None
    payout_day: int = 15
    status: str
    total_earnings: float
    total_sales: int
    created_at: datetime

    class Config:
        from_attributes = True


class PartnerDashboardResponse(BaseModel):
    partner: PartnerResponse
    clients: List["PartnerClientResponse"]
    commissions: List["CommissionResponse"]
    summary: "PartnerSummary"


class PartnerSummary(BaseModel):
    total_clients: int
    total_sales: int
    total_earnings: float
    pending_commissions: float
    conversion_rate: float


# ─── Partner Client ───────────────────────────────────────
class PartnerClientCreate(BaseModel):
    client_name: str
    client_company: Optional[str] = None
    client_email: EmailStr
    client_phone: Optional[str] = None
    notes: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None


class PartnerClientResponse(BaseModel):
    id: UUID
    partner_id: UUID
    client_name: str
    client_company: Optional[str] = None
    client_email: str
    client_phone: Optional[str] = None
    notes: Optional[str] = None
    data_status: str
    plan: Optional[str] = None
    analysis_id: Optional[UUID] = None
    has_pitch_deck: Optional[bool] = False  # F3: has a paid pitch deck
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedClientsResponse(BaseModel):
    items: List[PartnerClientResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Commission ──────────────────────────────────────────
class CommissionResponse(BaseModel):
    id: UUID
    partner_id: UUID
    total_amount: float          # base de cálculo = valor líquido
    gross_amount: Optional[float] = None   # valor bruto (para exibição)
    partner_amount: float
    system_amount: float
    status: str
    paid_at: Optional[datetime] = None
    created_at: datetime
    # Campos do Payment (via JOIN na rota)
    payment_method: Optional[str] = None
    fee_amount: Optional[float] = None
    installment_count: Optional[int] = None
    settlement_label: Optional[str] = None  # "Instantâneo" | "1 dia útil" | "32 dias"
    settlement_days: Optional[int] = None
    # Produto da comissão
    product_type: Optional[str] = None  # "valuation" | "pitch_deck"
    # Empresa relacionada (via Commission → Payment → Analysis ou PitchDeck)
    company_name: Optional[str] = None

    class Config:
        from_attributes = True


# ─── PIX Key Update ───────────────────────────────────────
class PixKeyUpdate(BaseModel):
    pix_key_type: str  # cpf, cnpj, email, phone, random
    pix_key: str
    payout_day: Optional[int] = None  # 1-28


# ─── Tasks (CRM Mini) ────────────────────────────────────
class TaskCreate(BaseModel):
    client_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None  # "pending", "done", "cancelled"


class TaskResponse(BaseModel):
    id: UUID
    partner_id: UUID
    client_id: Optional[UUID] = None
    client_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str
    auto_generated: bool = False
    trigger_type: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Client Notes (histórico) ────────────────────────────
class ClientNoteCreate(BaseModel):
    content: str


class ClientNoteResponse(BaseModel):
    id: UUID
    partner_id: UUID
    client_id: UUID
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Report Comments (co-visualização) ───────────────────
class ReportCommentCreate(BaseModel):
    section: Optional[str] = None  # "ebitda", "risk", "equity", "general"
    content: str


class ReportCommentResponse(BaseModel):
    id: UUID
    partner_id: UUID
    analysis_id: UUID
    client_id: Optional[UUID] = None
    section: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Client Health (Painel de Saúde) ─────────────────────
class ClientHealthResponse(BaseModel):
    client_id: UUID
    client_name: str
    client_company: Optional[str] = None
    data_status: str
    has_analysis: bool = False
    analysis_status: Optional[str] = None
    missing_fields: List[str] = []
    alerts: List[str] = []
    suggestions: List[str] = []
    days_since_registration: int = 0
    days_since_last_update: int = 0
    equity_value: Optional[float] = None
    risk_score: Optional[float] = None


# ─── Consultoria Guiada (Wizard) ─────────────────────────
class GuidedQuestionnaireSubmit(BaseModel):
    client_id: UUID
    answers: Dict[str, Any]  # { "revenue": 500000, "sector": "Technology", ... }


class GuidedQuestionnaireResponse(BaseModel):
    message: str
    analysis_id: Optional[UUID] = None
    pre_filled_fields: Dict[str, Any] = {}


# ─── Action Templates ────────────────────────────────────
class ActionTemplateResponse(BaseModel):
    category: str        # "valor_baixo", "risco_alto", "boa_saude", "sem_dados"
    title: str
    description: str
    actions: List[str]
    suggested_product: Optional[str] = None  # "pitch_deck", "valuation", None


# ─── Follow-up Rules ─────────────────────────────────────
class FollowUpRuleCreate(BaseModel):
    trigger: str  # FollowUpTrigger enum value
    days_delay: int = 3
    message_template: Optional[str] = None
    is_active: bool = True


class FollowUpRuleUpdate(BaseModel):
    days_delay: Optional[int] = None
    message_template: Optional[str] = None
    is_active: Optional[bool] = None


class FollowUpRuleResponse(BaseModel):
    id: UUID
    partner_id: UUID
    trigger: str
    days_delay: int
    message_template: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FollowUpAlertResponse(BaseModel):
    client_id: UUID
    client_name: str
    client_email: str
    client_phone: Optional[str] = None
    trigger: str
    trigger_label: str
    days_overdue: int
    suggested_message: str
    task_id: Optional[UUID] = None
