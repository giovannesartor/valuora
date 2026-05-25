"""
Pitch Deck Invites — Schemas (Pydantic)

Fluxo: Admin cria convite → cliente preenche via link público → admin revisa → converte.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from app.schemas.pitch_deck import (
    TargetMarket, CompetitorEntry, FundingNeeds,
    FinancialProjection, MilestoneEntry, TeamMember, PartnerResource,
)


# ─── Admin: criar convite ────────────────────────────────
class PitchDeckInviteCreate(BaseModel):
    client_email: Optional[EmailStr] = None
    client_name: Optional[str] = None
    company_hint: Optional[str] = None
    admin_message: Optional[str] = None
    expires_in_days: int = Field(default=14, ge=1, le=90)
    send_email: bool = False  # se True e client_email presente, dispara e-mail    # Idioma desejado para o PDF final ("pt" ou "en")
    language: Optional[str] = Field(default="pt", pattern="^(pt|en)$")
    # Pré-preenchimento (vindo de /invites/ai-extract) — cliente recebe como rascunho inicial
    prefill_data: Optional[Dict[str, Any]] = None
    @field_validator("client_name", "company_hint", "admin_message")
    @classmethod
    def _strip_strings(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class PitchDeckInviteUpdate(BaseModel):
    """Admin edita metadata e/ou submission_data antes de converter."""
    client_email: Optional[EmailStr] = None
    client_name: Optional[str] = None
    company_hint: Optional[str] = None
    notes_admin: Optional[str] = None
    submission_data: Optional[Dict[str, Any]] = None  # JSON livre (mesmo shape do form)
    assigned_admin_id: Optional[UUID] = None


class PitchDeckInviteDraft(BaseModel):
    """PATCH público do cliente — salva rascunho no servidor entre devices."""
    submission_data: Dict[str, Any]


class PitchDeckInviteAIExtractRequest(BaseModel):
    url: Optional[str] = None
    raw_text: Optional[str] = None
    # Crawler multi-página: segue links /sobre /about /produto /team /time
    crawl_subpages: bool = True
    # URLs adicionais (ex: pitch antigo hospedado, blog, página de fundadores)
    extra_urls: Optional[List[str]] = None
    # Após extrair, pede à IA para enriquecer bios do time (heurística DeepSeek)
    enrich_team: bool = False
    # Instruções customizadas (ex: "foque em B2B SaaS")
    custom_instructions: Optional[str] = None
    # Idioma desejado da extração
    target_language: Optional[str] = Field(default="pt", pattern="^(pt|en)$")

    @field_validator("url")
    @classmethod
    def _validate_url(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            return None
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL deve começar com http:// ou https://")
        return v


class PitchDeckInviteRequestChanges(BaseModel):
    """Admin pede ajustes ao cliente sem rejeitar o convite."""
    message: str = Field(min_length=10, max_length=4000)
    send_email: bool = True


class PitchDeckInvitePreviewEmail(BaseModel):
    """Renderiza HTML do email de convite com dados do form (sem persistir nada)."""
    client_email: Optional[EmailStr] = None
    client_name: Optional[str] = None
    company_hint: Optional[str] = None
    admin_message: Optional[str] = None
    expires_in_days: int = 14


class PitchDeckInviteBulkRow(BaseModel):
    client_email: EmailStr
    client_name: Optional[str] = None
    company_hint: Optional[str] = None


class PitchDeckInviteBulkCreate(BaseModel):
    rows: List[PitchDeckInviteBulkRow]
    expires_in_days: int = Field(default=14, ge=1, le=90)
    admin_message: Optional[str] = None
    send_email: bool = True


class PitchDeckInviteBulkResult(BaseModel):
    created: int
    skipped: int
    errors: List[str] = Field(default_factory=list)
    invite_ids: List[UUID] = Field(default_factory=list)


class PitchDeckInviteCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class PitchDeckInviteCommentRead(BaseModel):
    id: UUID
    invite_id: UUID
    admin_id: Optional[UUID] = None
    admin_name: Optional[str] = None
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class PitchDeckInviteAssign(BaseModel):
    assigned_admin_id: Optional[UUID] = None  # None desatribui


# ─── Público (cliente preenche) ──────────────────────────
class PitchDeckInvitePublicInfo(BaseModel):
    """Metadata mínima retornada na página pública."""
    token: str
    company_hint: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    admin_message: Optional[str] = None
    status: str
    expires_at: datetime
    is_expired: bool
    can_submit: bool
    is_draft: bool = False
    submission_data: Optional[Dict[str, Any]] = None  # se já submeteu, devolve para edição
    prefill_data: Optional[Dict[str, Any]] = None     # rascunho gerado por IA (admin)

    class Config:
        from_attributes = True


class PitchDeckInviteSubmission(BaseModel):
    """
    Payload enviado pelo cliente. Mesmo shape do PitchDeckCreate, mas
    sem campos restritos (analysis_id, etc.) e com client_email/name livres.
    """
    company_name: str = Field(min_length=1, max_length=255)
    sector: Optional[str] = None
    slogan: Optional[str] = None
    contact_email: Optional[EmailStr] = None
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
    investor_type: Optional[str] = "general"
    theme: Optional[str] = "corporate"

    # Identificação opcional do remetente
    submitter_name: Optional[str] = None
    submitter_email: Optional[EmailStr] = None


# ─── Admin: respostas ────────────────────────────────────
class PitchDeckInviteAdminResponse(BaseModel):
    id: UUID
    token: str
    public_url: str
    created_by_admin_id: Optional[UUID] = None
    assigned_admin_id: Optional[UUID] = None
    assigned_admin_name: Optional[str] = None
    client_email: Optional[str] = None
    client_name: Optional[str] = None
    company_hint: Optional[str] = None
    admin_message: Optional[str] = None
    status: str
    expires_at: datetime
    is_expired: bool
    is_draft: bool = False
    submission_data: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    notes_admin: Optional[str] = None
    converted_pitch_deck_id: Optional[UUID] = None
    opened_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    converted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    last_email_sent_at: Optional[datetime] = None
    last_draft_saved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    score: Optional[Dict[str, Any]] = None  # {"score": 78, "level": "good", ...}
    comments: List[PitchDeckInviteCommentRead] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PitchDeckInviteListItem(BaseModel):
    id: UUID
    token: str
    status: str
    client_email: Optional[str] = None
    client_name: Optional[str] = None
    company_hint: Optional[str] = None
    assigned_admin_id: Optional[UUID] = None
    assigned_admin_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    expires_at: datetime
    is_expired: bool
    is_draft: bool = False
    sla_breached: bool = False  # submitted há > 48h sem revisão
    score: Optional[int] = None  # 0–100 quick view
    converted_pitch_deck_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PitchDeckInviteFunnelStats(BaseModel):
    total: int
    pending: int
    submitted: int
    in_review: int
    converted: int
    rejected: int
    expired: int
    converted_paid: int  # quantos viraram deck COMPLETED
    sla_breached: int    # SUBMITTED há > 48h
    by_month: List[Dict[str, Any]] = Field(default_factory=list)


class PitchDeckInviteScoreResponse(BaseModel):
    score: int
    level: str
    earned: int
    total: int
    filled: List[str]
    missing: List[str]


class PitchDeckInviteConvertResponse(BaseModel):
    pitch_deck_id: UUID
    invite_id: UUID


class PitchDeckInviteResendResponse(BaseModel):
    sent: bool
    public_url: str
    last_email_sent_at: Optional[datetime] = None
