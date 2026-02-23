"""
Quanto Vale — CNAE & Benchmark Schemas
Pydantic schemas para API CNAE e benchmarks setoriais.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime


# ─── CNAE Schemas ─────────────────────────────────────────

class CnaeCodeResponse(BaseModel):
    """Resposta de um código CNAE."""
    id: Optional[UUID] = None
    code: str
    description: str
    level: str
    parent_code: Optional[str] = None
    section_id: Optional[str] = None

    class Config:
        from_attributes = True


class CnaeHierarchyResponse(BaseModel):
    """Hierarquia CNAE com filhos."""
    code: str
    description: str
    level: str
    children: List["CnaeCodeResponse"] = []


class CnaeSearchRequest(BaseModel):
    """Busca de CNAE por texto ou código."""
    query: str = Field(..., min_length=1, description="Código ou descrição para buscar")


class CnaeValidationResponse(BaseModel):
    """Resultado da validação de um código CNAE."""
    code: str
    is_valid: bool
    description: Optional[str] = None
    level: Optional[str] = None
    section: Optional[str] = None
    division: Optional[str] = None
    group: Optional[str] = None


# ─── Benchmark Schemas ────────────────────────────────────

class SectorBenchmarkResponse(BaseModel):
    """Resposta de benchmark setorial."""
    cnae_code: str
    cnae_description: Optional[str] = None
    year: int
    revenue_avg: Optional[float] = None
    growth_rate: Optional[float] = None
    companies_total: Optional[int] = None
    value_added: Optional[float] = None
    volatility_index: Optional[float] = None
    sector_risk_score: Optional[float] = None
    data_source: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SectorBenchmarkSummary(BaseModel):
    """Resumo de benchmark para integração com DCF."""
    cnae_code: str
    sector_name: Optional[str] = None
    avg_growth_rate: Optional[float] = None
    avg_revenue: Optional[float] = None
    total_companies: Optional[int] = None
    risk_score: Optional[float] = None
    volatility: Optional[float] = None
    benchmark_position: Optional[str] = None  # "acima", "abaixo", "na_media"
    years_available: List[int] = []


class DCFSectorAdjustment(BaseModel):
    """Ajuste setorial para o motor DCF."""
    adjusted_growth_rate: float = Field(..., description="Taxa de crescimento ajustada pelo setor")
    sector_risk_premium: float = Field(..., description="Prêmio de risco setorial")
    sector_beta: Optional[float] = None
    benchmark_revenue: Optional[float] = None
    benchmark_growth: Optional[float] = None
    sector_position: Optional[str] = None
    confidence_level: float = Field(default=0.5, description="Nível de confiança (0-1)")
    data_source: str = "IBGE/SIDRA"


class SectorRiskDetail(BaseModel):
    """Detalhes do cálculo de risco setorial."""
    cnae_code: str
    growth_volatility: float = 0.0
    revenue_std_dev: float = 0.0
    fragmentation_score: float = 0.0
    trend_score: float = 0.0
    final_score: float = 0.0
    risk_level: str = "medio"  # baixo, medio, alto, muito_alto
    components: Dict[str, float] = {}
