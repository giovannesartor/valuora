"""
Quanto Vale — CNAE Models
Modelos SQLAlchemy para classificação CNAE e benchmarks setoriais IBGE.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, DateTime, Text, Float, Integer,
    Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class CnaeCode(Base):
    """Classificação Nacional de Atividades Econômicas — código CNAE."""

    __tablename__ = "cnae_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(20), nullable=False, index=True)
    description = Column(Text, nullable=False)
    level = Column(String(20), nullable=False)  # secao, divisao, grupo, classe, subclasse
    parent_code = Column(String(20), nullable=True, index=True)
    section_id = Column(String(5), nullable=True)  # Letra da seção (A, B, C...)
    division_id = Column(String(5), nullable=True)
    group_id = Column(String(10), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("code", "level", name="uq_cnae_code_level"),
        Index("ix_cnae_code_level", "code", "level"),
        Index("ix_cnae_section", "section_id"),
    )


class SectorBenchmark(Base):
    """Benchmarks setoriais obtidos via API Agregados (SIDRA) do IBGE."""

    __tablename__ = "sector_benchmarks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cnae_code = Column(String(20), nullable=False, index=True)
    cnae_description = Column(Text, nullable=True)
    year = Column(Integer, nullable=False, index=True)

    # Métricas econômicas setoriais
    revenue_avg = Column(Float, nullable=True)
    growth_rate = Column(Float, nullable=True)
    companies_total = Column(Integer, nullable=True)
    value_added = Column(Float, nullable=True)  # Valor adicionado bruto
    volatility_index = Column(Float, nullable=True)
    sector_risk_score = Column(Float, nullable=True)  # Score 0–100

    # Métricas adicionais
    productivity_index = Column(Float, nullable=True)
    employment_total = Column(Integer, nullable=True)
    avg_salary = Column(Float, nullable=True)

    # Metadata
    data_source = Column(String(100), default="IBGE/SIDRA")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("cnae_code", "year", name="uq_benchmark_cnae_year"),
        Index("ix_benchmark_cnae_year", "cnae_code", "year"),
    )
