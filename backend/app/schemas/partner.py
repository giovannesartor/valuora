"""
Partner Mode schemas — Modo Parceiro (contabilidades e consultorias).
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List
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
