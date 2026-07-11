import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Float, Integer,
    ForeignKey, JSON, Enum as SAEnum, Numeric, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


# ─── Enums ────────────────────────────────────────────────
class PlanType(str, enum.Enum):
    INVESTOR_READY = "investor_ready"
    FUNDRAISING = "fundraising"
    BUNDLE = "bundle"  # Valuation + Pitch Deck bundle


class PitchDeckStatus(str, enum.Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PitchDeckInviteStatus(str, enum.Enum):
    PENDING = "pending"        # invite created, client hasn't filled in yet
    SUBMITTED = "submitted"    # client submitted data
    IN_REVIEW = "in_review"    # admin opened for review
    CONVERTED = "converted"    # turned into an official PitchDeck
    REJECTED = "rejected"
    EXPIRED = "expired"


class PitchDeckConsolidationStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class PitchDeckInviteEventType(str, enum.Enum):
    """Events in the pitch deck invite funnel (full timeline)."""
    CREATED = "created"
    EMAIL_SENT = "email_sent"
    OPENED = "opened"
    DRAFT_STARTED = "draft_started"
    DRAFT_SAVED = "draft_saved"
    SECTION_COMPLETED = "section_completed"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"
    CONVERTED = "converted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    REMINDER_SENT = "reminder_sent"
    AI_SUMMARY_GENERATED = "ai_summary_generated"
    COMMENT_ADDED = "comment_added"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class AnalysisStatus(str, enum.Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PartnerWebhookEventType(str, enum.Enum):
    ANALYSIS_COMPLETED = "analysis.completed"
    PAYMENT_CONFIRMED = "payment.confirmed"
    PITCH_DECK_READY = "pitch_deck.ready"


# ─── Users ────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    cpf_cnpj = Column(String(18), nullable=True)  # CPF (11) or CNPJ (14), formatted
    phone = Column(String(20), nullable=True)
    company_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    is_superadmin = Column(Boolean, default=False)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    instagram = Column(String(100), nullable=True)
    theme_preference = Column(String(10), nullable=True, default=None)  # 'dark' | 'light' | None (system)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    email_verifications = relationship("EmailVerification", back_populates="user", cascade="all, delete-orphan")
    password_resets = relationship("PasswordReset", back_populates="user", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    partner_profile = relationship("Partner", back_populates="user", uselist=False, foreign_keys="Partner.user_id")
    pitch_decks = relationship("PitchDeck", back_populates="user", cascade="all, delete-orphan")


# ─── Email Verifications ─────────────────────────────────
class EmailVerification(Base):
    __tablename__ = "email_verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(500), nullable=False, unique=True)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="email_verifications")


# ─── Password Resets ──────────────────────────────────────
class PasswordReset(Base):
    __tablename__ = "password_resets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(500), nullable=False, unique=True)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="password_resets")


# ─── Analyses ─────────────────────────────────────────────
class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Company info
    company_name = Column(String(255), nullable=False)
    sector = Column(String(100), nullable=False)
    cnpj = Column(String(20), nullable=True)
    company_type = Column(String(30), nullable=True)  # tradicional / nova_economia / startup / equity_pessoal
    website = Column(String(500), nullable=True)
    founding_date = Column(String(7), nullable=True)  # MM/AAAA
    location_state = Column(String(2), nullable=True)
    location_city = Column(String(100), nullable=True)

    # Partner tracking
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)

    # Financial inputs
    revenue = Column(Numeric(15, 2), nullable=False)
    net_margin = Column(Float, nullable=False)
    growth_rate = Column(Float, nullable=True)
    debt = Column(Numeric(15, 2), default=0)
    cash = Column(Numeric(15, 2), default=0)
    founder_dependency = Column(Float, default=0.0)  # 0-1 scale
    projection_years = Column(Integer, default=10)  # v4: 10 years
    # v3 fields
    ebitda = Column(Numeric(15, 2), nullable=True)
    recurring_revenue_pct = Column(Float, default=0.0)
    num_employees = Column(Integer, default=0)
    years_in_business = Column(Integer, default=3)
    previous_investment = Column(Numeric(15, 2), default=0)
    # v8 diagnostic fields
    revenue_ntm = Column(Numeric(15, 2), nullable=True)
    ebitda_margin = Column(Float, nullable=True)  # EBITDA as % of revenue
    tangible_assets = Column(Numeric(15, 2), nullable=True)
    intangible_assets = Column(Numeric(15, 2), nullable=True)
    equity_participations = Column(Numeric(15, 2), nullable=True)
    qualitative_answers = Column(JSON, nullable=True)
    dcf_weight = Column(Float, nullable=True)  # v4: None = engine decides
    custom_exit_multiple = Column(Float, nullable=True)

    # Company logo
    logo_path = Column(String(500), nullable=True)

    # Uploaded files
    uploaded_files = Column(JSON, nullable=True)  # list of file paths

    # DeepSeek extracted data
    extracted_data = Column(JSON, nullable=True)
    ai_analysis = Column(Text, nullable=True)

    # Valuation results
    valuation_result = Column(JSON, nullable=True)
    equity_value = Column(Numeric(15, 2), nullable=True)
    risk_score = Column(Float, nullable=True)
    maturity_index = Column(Float, nullable=True)
    percentile = Column(Float, nullable=True)

    # Status & plan
    status = Column(SAEnum(AnalysisStatus), default=AnalysisStatus.DRAFT)
    plan = Column(SAEnum(PlanType), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True), nullable=True, default=None, index=True)

    # User notes (persisted)
    notes = Column(Text, nullable=True)

    # Share token for public read-only link
    share_token = Column(String(64), unique=True, nullable=True, index=True)

    # Optional bcrypt hash to password-protect shared links
    share_password_hash = Column(String(255), nullable=True)

    # Alert threshold: re-notify when equity_value changes by >= this fraction (e.g. 0.10 = 10%)
    reanalysis_alert_pct = Column(Float, nullable=True)

    # Relationships
    user = relationship("User", back_populates="analyses")
    versions = relationship("AnalysisVersion", back_populates="analysis", cascade="all, delete-orphan")
    simulations = relationship("SimulationLog", back_populates="analysis", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="analysis", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="analysis", uselist=False, cascade="all, delete-orphan")


# ─── Analysis Versions ───────────────────────────────────
class AnalysisVersion(Base):
    __tablename__ = "analysis_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    valuation_result = Column(JSON, nullable=False)
    equity_value = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    analysis = relationship("Analysis", back_populates="versions")


# ─── Sector Data ──────────────────────────────────────────
class SectorData(Base):
    __tablename__ = "sector_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sector_name = Column(String(100), unique=True, nullable=False)
    beta = Column(Float, nullable=False, default=1.0)
    avg_margin = Column(Float, nullable=True)
    avg_growth = Column(Float, nullable=True)
    avg_multiple = Column(Float, nullable=True)
    risk_premium = Column(Float, default=0.0)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Benchmark Data ──────────────────────────────────────
class BenchmarkData(Base):
    __tablename__ = "benchmark_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sector = Column(String(100), nullable=False, index=True)
    metric_name = Column(String(100), nullable=False)
    percentile_25 = Column(Float, nullable=True)
    percentile_50 = Column(Float, nullable=True)
    percentile_75 = Column(Float, nullable=True)
    percentile_90 = Column(Float, nullable=True)
    source = Column(String(100), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Simulation Logs ─────────────────────────────────────
class SimulationLog(Base):
    __tablename__ = "simulation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    parameters = Column(JSON, nullable=False)
    result = Column(JSON, nullable=False)
    equity_value = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    analysis = relationship("Analysis", back_populates="simulations")


# ─── Payments ─────────────────────────────────────────────
class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, unique=True)
    plan = Column(SAEnum(PlanType), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(SAEnum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_method = Column(String(50), nullable=True)
    external_id = Column(String(255), nullable=True)
    stripe_payment_intent_id = Column(String(255), nullable=True)
    stripe_session_id = Column(String(255), nullable=True)
    coupon_code = Column(String(50), nullable=True)  # coupon applied to payment
    net_value = Column(Numeric(10, 2), nullable=True)         # net value after fees
    fee_amount = Column(Numeric(10, 2), nullable=True)        # processing fee
    currency = Column(String(3), default="USD")               # ISO 4217 currency code
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="payments")
    analysis = relationship("Analysis", back_populates="payment")


# ─── Reports ─────────────────────────────────────────────
class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, default=1)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)
    download_token = Column(String(500), nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    download_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    analysis = relationship("Analysis", back_populates="reports")


# ─── Leads (Diagnóstico Gratuito) ────────────────────────
class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    nome = Column(String(255), nullable=True)
    setor = Column(String(100), nullable=False)
    receita_anual = Column(String(50), nullable=False)      # faixa textual
    margem_lucro = Column(Float, nullable=False)             # percentual
    tempo_empresa = Column(Integer, nullable=False)          # anos
    score = Column(Float, nullable=False)                    # 0-100
    score_label = Column(String(50), nullable=False)         # Inicial / Crescimento / Estruturado / Pronto
    coupon_sent = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Partner Status Enum ──────────────────────────────────
class PixKeyType(str, enum.Enum):
    CPF = "cpf"
    CNPJ = "cnpj"
    EMAIL = "email"
    PHONE = "phone"
    RANDOM = "random"


class PartnerStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class ProductType(str, enum.Enum):
    VALUATION = "valuation"
    PITCH_DECK = "pitch_deck"
    BUNDLE = "bundle"  # Valuation + Pitch Deck bundle


class CommissionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PAID = "paid"


class ClientDataStatus(str, enum.Enum):
    PRE_FILLED = "pre_filled"
    COMPLETED = "completed"
    REPORT_SENT = "report_sent"


class PipelineStage(str, enum.Enum):
    LEAD = "lead"
    CONTACTED = "contacted"
    DATA_SENT = "data_sent"
    ANALYSIS = "analysis"
    CLOSED = "closed"
    DELIVERED = "delivered"


# ─── Partners ────────────────────────────────────────────
class Partner(Base):
    __tablename__ = "partners"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    company_name = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    referral_code = Column(String(20), unique=True, nullable=False, index=True)
    referral_link = Column(String(500), nullable=True)
    commission_rate = Column(Float, default=0.30)  # 30% for partner
    pix_key_type = Column(SAEnum(PixKeyType), nullable=True)
    pix_key = Column(String(255), nullable=True)
    payout_day = Column(Integer, default=15)  # dia do mês para receber
    status = Column(SAEnum(PartnerStatus), default=PartnerStatus.ACTIVE)
    total_earnings = Column(Numeric(12, 2), default=0)
    total_sales = Column(Integer, default=0)
    free_report_used = Column(Boolean, default=False)
    brand_color = Column(String(7), nullable=True)  # hex e.g. #10B981
    brand_secondary_color = Column(String(7), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="partner_profile", foreign_keys=[user_id])
    clients = relationship("PartnerClient", back_populates="partner", cascade="all, delete-orphan")
    commissions = relationship("Commission", back_populates="partner", cascade="all, delete-orphan")


# ─── Partner Clients ─────────────────────────────────────
class PartnerClient(Base):
    __tablename__ = "partner_clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    client_name = Column(String(255), nullable=False)
    client_company = Column(String(255), nullable=True)
    client_email = Column(String(255), nullable=False)
    client_phone = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)  # partner's private notes
    data_status = Column(SAEnum(ClientDataStatus), default=ClientDataStatus.PRE_FILLED)
    pipeline_stage = Column(SAEnum(PipelineStage), default=PipelineStage.LEAD)
    plan = Column(SAEnum(PlanType), nullable=True)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)
    utm_source = Column(String(100), nullable=True)
    utm_medium = Column(String(100), nullable=True)
    utm_campaign = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    partner = relationship("Partner", back_populates="clients")


# ─── Commissions ─────────────────────────────────────────
class Commission(Base):
    __tablename__ = "commissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id", ondelete="SET NULL"), nullable=True)
    pitch_deck_payment_id = Column(UUID(as_uuid=True), ForeignKey("pitch_deck_payments.id", ondelete="SET NULL"), nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("partner_clients.id", ondelete="SET NULL"), nullable=True)
    product_type = Column(SAEnum(ProductType), default=ProductType.VALUATION, nullable=True)
    total_amount = Column(Numeric(10, 2), nullable=False)   # base de cálculo = net_value do pagamento
    gross_amount = Column(Numeric(10, 2), nullable=True)     # valor bruto (auditoria)
    partner_amount = Column(Numeric(10, 2), nullable=False)  # 50% do líquido
    system_amount = Column(Numeric(10, 2), nullable=False)   # 50% do líquido
    status = Column(SAEnum(CommissionStatus), default=CommissionStatus.PENDING)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    partner = relationship("Partner", back_populates="commissions")


# ─── Error Logs ──────────────────────────────────────
class ErrorLog(Base):
    __tablename__ = "error_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    route = Column(String(500), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=False)
    error_message = Column(Text, nullable=True)
    ip = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    # Relationship
    user = relationship("User", foreign_keys=[user_id])


# ─── Coupons ─────────────────────────────────────────
class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False, index=True)  # ex: PRIMEIRA20
    description = Column(String(255), nullable=True)
    discount_pct = Column(Float, nullable=False)  # 0.10 = 10%
    max_uses = Column(Integer, nullable=True)  # None = ilimitado
    used_count = Column(Integer, default=0, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # None = sem expiração
    is_active = Column(Boolean, default=True, nullable=False)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="SET NULL"), nullable=True, index=True)  # F2: parceiro que criou
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── User Favorites ─────────────────────────────────────
class UserFavorite(Base):
    __tablename__ = "user_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "analysis_id", name="uq_user_favorite"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Notification Reads ──────────────────────────────────
class NotificationRead(Base):
    __tablename__ = "notification_reads"
    __table_args__ = (
        UniqueConstraint("user_id", "notification_key", name="uq_notification_read"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_key = Column(String(255), nullable=False, index=True)  # derived id like 'analysis-done-UUID'
    read_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Pitch Deck ──────────────────────────────────────────
class PitchDeck(Base):
    __tablename__ = "pitch_decks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)  # optional link

    # Company info
    company_name = Column(String(255), nullable=False)
    sector = Column(String(100), nullable=True)
    logo_path = Column(String(500), nullable=True)
    slogan = Column(String(500), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    website = Column(String(500), nullable=True)

    # Pitch sections (user inputs + AI-generated text stored as JSON)
    headline = Column(Text, nullable=True)
    problem = Column(Text, nullable=True)
    solution = Column(Text, nullable=True)
    target_market = Column(JSON, nullable=True)  # {"description": "", "tam": "", "sam": "", "som": ""}
    competitive_landscape = Column(JSON, nullable=True)  # [{"competitor": "", "advantage": ""}]
    business_model = Column(Text, nullable=True)
    sales_channels = Column(Text, nullable=True)
    marketing_activities = Column(Text, nullable=True)
    funding_needs = Column(JSON, nullable=True)  # {"amount": 0, "description": "", "breakdown": [...]}
    financial_projections = Column(JSON, nullable=True)  # [{"year": 2026, "revenue": 0, "expenses": 0, "profit": 0}]
    milestones = Column(JSON, nullable=True)  # [{"title": "", "date": "", "description": "", "status": "completed|in_progress|upcoming"}]
    team = Column(JSON, nullable=True)  # [{"name": "", "role": "", "photo_path": ""}]
    partners_resources = Column(JSON, nullable=True)  # [{"name": "", "logo_path": ""}]

    # AI-generated narratives (DeepSeek)
    ai_headline = Column(Text, nullable=True)
    ai_problem = Column(Text, nullable=True)
    ai_solution = Column(Text, nullable=True)
    ai_business_model = Column(Text, nullable=True)
    ai_sales_channels = Column(Text, nullable=True)
    ai_marketing = Column(Text, nullable=True)
    ai_funding_use = Column(Text, nullable=True)
    ai_competitive_analysis = Column(Text, nullable=True)

    # Customization
    investor_type = Column(String(50), default="geral")   # geral | angel | pe | bank
    theme = Column(String(50), default="corporate")        # corporate | startup | bold | minimal

    # Generated PDF / executive summary
    pdf_path = Column(String(500), nullable=True)
    pdf_generated_at = Column(DateTime(timezone=True), nullable=True)
    executive_summary_path = Column(String(500), nullable=True)

    # Partner attribution
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)

    # Status & payment
    status = Column(SAEnum(PitchDeckStatus), default=PitchDeckStatus.DRAFT)
    is_paid = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # soft delete

    # Relationships
    user = relationship("User", back_populates="pitch_decks")
    analysis = relationship("Analysis", foreign_keys=[analysis_id])
    payment = relationship("PitchDeckPayment", back_populates="pitch_deck", uselist=False, cascade="all, delete-orphan")
    views = relationship("PitchDeckView", back_populates="pitch_deck", cascade="all, delete-orphan")


# ─── Pitch Deck Payments ─────────────────────────────────
class PitchDeckPayment(Base):
    __tablename__ = "pitch_deck_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    pitch_deck_id = Column(UUID(as_uuid=True), ForeignKey("pitch_decks.id", ondelete="CASCADE"), nullable=False, unique=True)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(SAEnum(PaymentStatus), default=PaymentStatus.PENDING)
    payment_method = Column(String(50), nullable=True)
    stripe_payment_intent_id = Column(String(255), nullable=True)
    stripe_session_id = Column(String(255), nullable=True)
    coupon_code = Column(String(50), nullable=True)
    net_value = Column(Numeric(10, 2), nullable=True)
    fee_amount = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(3), default="USD")
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    pitch_deck = relationship("PitchDeck", back_populates="payment")


# ─── Pitch Deck Views ────────────────────────────────────
class PitchDeckView(Base):
    __tablename__ = "pitch_deck_views"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pitch_deck_id = Column(UUID(as_uuid=True), ForeignKey("pitch_decks.id", ondelete="CASCADE"), nullable=False)
    viewed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    ip_hash = Column(String(64), nullable=True)       # SHA-256 hash of IP for privacy
    user_agent = Column(String(500), nullable=True)
    from_share_link = Column(Boolean, default=False)
    slide_count = Column(Integer, nullable=True)      # number of slides viewed (if tracked)

    # Relationships
    pitch_deck = relationship("PitchDeck", back_populates="views")


# ─── User Feedback (NPS) ─────────────────────────────────
class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True, index=True)
    score = Column(Integer, nullable=False)           # 0–10 NPS score
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

# ─── Partner CRM Enums ───────────────────────────────────
class NoteType(str, enum.Enum):
    GENERAL = "general"
    CALL = "call"
    MEETING = "meeting"
    FOLLOW_UP = "follow_up"


class FollowUpTrigger(str, enum.Enum):
    NO_FILL_3D = "no_fill_3d"
    REPORT_7D = "report_7d"
    NO_PURCHASE_7D = "no_purchase_7d"
    NO_REGISTER = "no_register"
    NO_DATA = "no_data"
    NO_MEETING = "no_meeting"
    POST_REPORT = "post_report"


# ─── Client Notes (Partner CRM) ──────────────────────────
class ClientNote(Base):
    __tablename__ = "client_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=False, index=True)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    note_type = Column(SAEnum(NoteType), default=NoteType.GENERAL)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Client Tasks (Partner CRM) ──────────────────────────
class ClientTask(Base):
    __tablename__ = "client_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=False, index=True)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    reminder_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Partner Comments on Analysis ─────────────────────────
class PartnerComment(Base):
    __tablename__ = "partner_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    section = Column(String(50), nullable=True, default="general")  # general | equity_value | ebitda_margin | risk | growth
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Follow-up Logs ──────────────────────────────────────
class FollowUpLog(Base):
    __tablename__ = "follow_up_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=False, index=True)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    trigger_type = Column(SAEnum(FollowUpTrigger), nullable=False)
    message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Guided Consultation Sessions ─────────────────────────
class GuidedSession(Base):
    __tablename__ = "guided_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("partner_clients.id", ondelete="CASCADE"), nullable=False, index=True)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    responses = Column(JSON, default=dict)
    current_step = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ─── Partner Follow-Up Rules ─────────────────────────────
class PartnerFollowUpRule(Base):
    __tablename__ = "partner_followup_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger = Column(String(50), nullable=False)  # no_register, no_data, no_meeting, no_purchase, post_report
    days_delay = Column(Integer, default=3)
    message_template = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ─── Partner Proposal Templates ──────────────────────────
class PartnerProposalTemplate(Base):
    __tablename__ = "partner_proposal_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=True, default="general")  # general, no_data, high_risk, low_value, healthy, report_ready
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ─── Notification Preferences ────────────────────────────
class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_notification_preference_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email_analysis_done = Column(Boolean, default=True)
    email_payment_confirmation = Column(Boolean, default=True)
    email_report_ready = Column(Boolean, default=True)
    email_pitch_deck_done = Column(Boolean, default=True)
    email_marketing = Column(Boolean, default=True)
    email_partner_updates = Column(Boolean, default=True)
    email_weekly_digest = Column(Boolean, default=False)
    push_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ═══════════════════════════════════════════════════════════
# OAuth2 / API Integration Models
# ═══════════════════════════════════════════════════════════

class OAuthApp(Base):
    """Third-party applications registered to use the Valuora API."""
    __tablename__ = "oauth_apps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    website_url = Column(String(500), nullable=True)
    logo_url = Column(String(500), nullable=True)
    client_id = Column(String(64), nullable=False, unique=True, index=True)
    client_secret_hash = Column(String(255), nullable=False)
    redirect_uris = Column(JSON, nullable=False, default=list)
    scopes = Column(JSON, nullable=False, default=lambda: [
        "read:user", "read:valuations", "write:valuations",
        "read:pitch_decks", "write:pitch_decks", "read:plans",
    ])
    allowed_origins = Column(JSON, nullable=True, default=list)
    is_active = Column(Boolean, default=True)
    is_first_party = Column(Boolean, default=False)
    rate_limit_per_minute = Column(Integer, default=60)
    rate_limit_per_day = Column(Integer, default=10000)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", foreign_keys=[user_id])
    tokens = relationship("OAuthToken", back_populates="app", cascade="all, delete-orphan")
    authorization_codes = relationship("OAuthAuthorizationCode", back_populates="app", cascade="all, delete-orphan")
    webhooks = relationship("OAuthWebhook", back_populates="app", cascade="all, delete-orphan")


class OAuthAuthorizationCode(Base):
    """Short-lived authorization codes exchanged for access tokens (OAuth2 auth code flow)."""
    __tablename__ = "oauth_authorization_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(128), nullable=False, unique=True, index=True)
    app_id = Column(UUID(as_uuid=True), ForeignKey("oauth_apps.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    redirect_uri = Column(String(500), nullable=False)
    scopes = Column(JSON, nullable=False, default=list)
    state = Column(String(256), nullable=True)
    code_challenge = Column(String(256), nullable=True)
    code_challenge_method = Column(String(10), nullable=True)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    app = relationship("OAuthApp", back_populates="authorization_codes")
    user = relationship("User", foreign_keys=[user_id])


class OAuthToken(Base):
    """OAuth2 access/refresh tokens for third-party app access."""
    __tablename__ = "oauth_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id = Column(UUID(as_uuid=True), ForeignKey("oauth_apps.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    access_token_hash = Column(String(255), nullable=False, unique=True, index=True)
    refresh_token_hash = Column(String(255), nullable=True, unique=True, index=True)
    scopes = Column(JSON, nullable=False, default=list)
    access_token_expires_at = Column(DateTime(timezone=True), nullable=False)
    refresh_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    app = relationship("OAuthApp", back_populates="tokens")
    user = relationship("User", foreign_keys=[user_id])


class APIUsageLog(Base):
    """Tracks API usage per app for rate limiting and analytics."""
    __tablename__ = "api_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id = Column(UUID(as_uuid=True), ForeignKey("oauth_apps.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    ip = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ═══════════════════════════════════════════════════════════
# Partner Webhooks
# ═══════════════════════════════════════════════════════════

class PartnerWebhook(Base):
    """Webhook URL registered by a partner to receive event notifications."""
    __tablename__ = "partner_webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    secret = Column(String(255), nullable=False)
    events = Column(JSON, nullable=False, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    partner = relationship("Partner", foreign_keys=[partner_id])


class PartnerWebhookDelivery(Base):
    """Log of partner webhook delivery attempts."""
    __tablename__ = "partner_webhook_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("partner_webhooks.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=False)
    status_code = Column(Integer, nullable=True)
    response_body = Column(String(1000), nullable=True)
    success = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    webhook = relationship("PartnerWebhook", foreign_keys=[webhook_id])


# ═══════════════════════════════════════════════════════════
# OAuth App Webhooks
# ═══════════════════════════════════════════════════════════

class OAuthWebhook(Base):
    """Webhook URL registered by an OAuth app to receive event notifications."""
    __tablename__ = "oauth_webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    app_id = Column(UUID(as_uuid=True), ForeignKey("oauth_apps.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    secret = Column(String(255), nullable=False)
    events = Column(JSON, nullable=False, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    app = relationship("OAuthApp", back_populates="webhooks")
    deliveries = relationship("OAuthWebhookDelivery", back_populates="webhook", cascade="all, delete-orphan")


class OAuthWebhookDelivery(Base):
    """Log of OAuth webhook delivery attempts."""
    __tablename__ = "oauth_webhook_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    webhook_id = Column(UUID(as_uuid=True), ForeignKey("oauth_webhooks.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=False)
    status_code = Column(Integer, nullable=True)
    response_body = Column(String(1000), nullable=True)
    success = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    webhook = relationship("OAuthWebhook", back_populates="deliveries")


# ═══════════════════════════════════════════════════════════
# Pitch Deck Invites (remote client data collection)
# ═══════════════════════════════════════════════════════════

class PitchDeckInvite(Base):
    __tablename__ = "pitch_deck_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(String(64), unique=True, nullable=False, index=True)

    # Admin who created the invite
    created_by_admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Pre-filled by admin (all optional)
    client_email = Column(String(255), nullable=True)
    client_name = Column(String(255), nullable=True)
    company_hint = Column(String(255), nullable=True)
    admin_message = Column(Text, nullable=True)

    # Assignment (which admin is responsible for review)
    assigned_admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Invite state
    status = Column(
        SAEnum(
            PitchDeckInviteStatus,
            name="pitchdeckinvitestatus",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=PitchDeckInviteStatus.PENDING,
        nullable=False,
        index=True,
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_draft = Column(Boolean, default=False, nullable=False)
    locale = Column(String(8), default="en-US", nullable=False)
    language = Column(String(8), default="en", nullable=False)

    # AI pre-fill data (DeepSeek) generated from URL/PDF before the client opens the link
    prefill_data = Column(JSON, nullable=True)

    # Data submitted by the client — free JSON with same shape as PitchDeckCreate
    submission_data = Column(JSON, nullable=True)
    submission_meta = Column(JSON, nullable=True)

    # Optional attachments (list of already-saved paths/URLs via /upload)
    attachments = Column(JSON, nullable=True)

    # Admin internal notes
    notes_admin = Column(Text, nullable=True)

    # Conversion result
    converted_pitch_deck_id = Column(UUID(as_uuid=True), ForeignKey("pitch_decks.id", ondelete="SET NULL"), nullable=True)

    # Transition timestamps
    opened_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    last_email_sent_at = Column(DateTime(timezone=True), nullable=True)
    last_draft_saved_at = Column(DateTime(timezone=True), nullable=True)

    # AI summary cache (DeepSeek) — invalidated by submission_data hash
    ai_summary_json = Column(JSON, nullable=True)
    ai_summary_generated_at = Column(DateTime(timezone=True), nullable=True)
    ai_summary_hash = Column(String(64), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    created_by_admin = relationship("User", foreign_keys=[created_by_admin_id])
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id])
    converted_pitch_deck = relationship("PitchDeck", foreign_keys=[converted_pitch_deck_id])
    comments = relationship("PitchDeckInviteComment", back_populates="invite", cascade="all, delete-orphan", order_by="PitchDeckInviteComment.created_at")
    events = relationship("PitchDeckInviteEvent", back_populates="invite", cascade="all, delete-orphan", order_by="PitchDeckInviteEvent.created_at")


class PitchDeckInviteComment(Base):
    """Internal comment timeline between admins on an invite."""
    __tablename__ = "pitch_deck_invite_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invite_id = Column(UUID(as_uuid=True), ForeignKey("pitch_deck_invites.id", ondelete="CASCADE"), nullable=False, index=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    invite = relationship("PitchDeckInvite", back_populates="comments")
    admin = relationship("User")


class PitchDeckInviteEvent(Base):
    """Append-only event log for the pitch deck invite funnel (rich timeline)."""
    __tablename__ = "pitch_deck_invite_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invite_id = Column(UUID(as_uuid=True), ForeignKey("pitch_deck_invites.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(
        SAEnum(
            PitchDeckInviteEventType,
            name="pitchdeckinviteeventtype",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        index=True,
    )
    payload = Column(JSON, nullable=True)
    ip_hash = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    actor_admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    invite = relationship("PitchDeckInvite", back_populates="events")
    actor_admin = relationship("User")


# ═══════════════════════════════════════════════════════════
# Pitch Deck Consolidation (executive cross-deck report)
# ═══════════════════════════════════════════════════════════

class PitchDeckConsolidation(Base):
    """Executive report consolidating N invites/decks with AI cross-analysis."""
    __tablename__ = "pitch_deck_consolidations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by_admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=True)
    language = Column(String(8), default="en", nullable=False)
    status = Column(
        SAEnum(
            PitchDeckConsolidationStatus,
            name="pitchdeckconsolidationstatus",
            values_callable=lambda e: [m.value for m in e],
        ),
        default=PitchDeckConsolidationStatus.PENDING,
        nullable=False,
        index=True,
    )
    invite_ids = Column(JSON, nullable=False)
    options = Column(JSON, nullable=True)
    meta_json = Column(JSON, nullable=True)
    pdf_path = Column(String(500), nullable=True)
    pptx_path = Column(String(500), nullable=True)
    error = Column(Text, nullable=True)
    progress_pct = Column(Integer, default=0, nullable=False)
    progress_message = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    ready_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    created_by_admin = relationship("User", foreign_keys=[created_by_admin_id])


# ─── Analysis Invite ─────────────────────────────────────
class AnalysisInviteStatus(str, enum.Enum):
    PENDING = "pending"
    OPENED = "opened"
    ACCEPTED = "accepted"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class AnalysisInvite(Base):
    __tablename__ = "analysis_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token = Column(String(64), unique=True, nullable=False, index=True)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True)
    partner_client_id = Column(UUID(as_uuid=True), ForeignKey("partner_clients.id", ondelete="SET NULL"), nullable=True)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)
    suggested_plan = Column(SAEnum(PlanType), nullable=True)
    status = Column(SAEnum(AnalysisInviteStatus), default=AnalysisInviteStatus.PENDING, nullable=False, index=True)
    client_email = Column(String(255), nullable=False)
    client_name = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    partner = relationship("Partner", foreign_keys=[partner_id])