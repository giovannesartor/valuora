import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Float, Integer,
    ForeignKey, JSON, Enum as SAEnum, Numeric
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


# ─── Enums ────────────────────────────────────────────────
class PlanType(str, enum.Enum):
    ESSENCIAL = "essencial"
    PROFISSIONAL = "profissional"
    ESTRATEGICO = "estrategico"


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


# ─── Users ────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    company_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    email_verifications = relationship("EmailVerification", back_populates="user", cascade="all, delete-orphan")
    password_resets = relationship("PasswordReset", back_populates="user", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")


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

    # Financial inputs
    revenue = Column(Numeric(15, 2), nullable=False)
    net_margin = Column(Float, nullable=False)
    growth_rate = Column(Float, nullable=True)
    debt = Column(Numeric(15, 2), default=0)
    cash = Column(Numeric(15, 2), default=0)
    founder_dependency = Column(Float, default=0.0)  # 0-1 scale

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

    # Relationships
    user = relationship("User", back_populates="analyses")
    versions = relationship("AnalysisVersion", back_populates="analysis", cascade="all, delete-orphan")
    simulations = relationship("SimulationLog", back_populates="analysis", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="analysis", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="analysis", uselist=False)


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
