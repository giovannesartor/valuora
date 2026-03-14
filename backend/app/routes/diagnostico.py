"""
Free Diagnostic — Lead magnet endpoint.
Public (no auth required). Calculates a readiness score and sends email with CTA.
"""
import time
import asyncio
import logging
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import Depends

from app.core.database import get_db
from app.models.models import Lead
from app.services.email_service import send_diagnostico_email

router = APIRouter(prefix="/diagnostico", tags=["Free Diagnostic"])

# Background tasks set — keeps task references alive to prevent GC
_bg_tasks: set = set()

def _fire_and_forget(coro) -> None:
    """Schedule a coroutine as a background task without blocking the response."""
    task = asyncio.create_task(coro)
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


# ─── Redis-backed rate limiter (works across workers) ───
RATE_LIMIT_MAX = 5        # max requests
RATE_LIMIT_WINDOW = 60    # per 60 seconds

# In-memory fallback when Redis unavailable
_rate_limit_mem: dict[str, list[float]] = defaultdict(list)

async def _check_rate_limit(client_ip: str) -> None:
    """Raise 429 if client exceeds rate limit. Uses Redis; falls back to in-memory."""
    try:
        from app.core.redis import redis_client
        key = f"qv:rl:diag:{client_ip}"
        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, RATE_LIMIT_WINDOW)
        if current > RATE_LIMIT_MAX:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again in a few minutes.",
            )
    except HTTPException:
        raise
    except Exception:
        # Redis unavailable — fallback to in-memory
        now = time.time()
        window_start = now - RATE_LIMIT_WINDOW
        _rate_limit_mem[client_ip] = [t for t in _rate_limit_mem[client_ip] if t > window_start]
        if len(_rate_limit_mem[client_ip]) >= RATE_LIMIT_MAX:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again in a few minutes.",
            )
        _rate_limit_mem[client_ip].append(now)


# ─── Request / Response schemas ─────────────────────────────
class DiagnosticoRequest(BaseModel):
    email: EmailStr
    nome: Optional[str] = None
    setor: str
    receita_anual: str        # "ate_100k" | "100k_500k" | "500k_2m" | "2m_10m" | "acima_10m"
    margem_lucro: float       # percentual ex: 15.0
    tempo_empresa: int        # anos


class DiagnosticoResponse(BaseModel):
    score: float
    score_label: str
    mensagem: str
    recomendacoes: list[str]


# ─── Score calculation ───────────────────────────────────────
RECEITA_SCORES = {
    "ate_100k": 10,
    "100k_500k": 20,
    "500k_2m": 30,
    "2m_10m": 40,
    "acima_10m": 50,
}

RECEITA_LABELS = {
    "ate_100k": "Up to $100K",
    "100k_500k": "$100K – $500K",
    "500k_2m": "$500K – $2M",
    "2m_10m": "$2M – $10M",
    "acima_10m": "Over $10M",
}


def calculate_score(data: DiagnosticoRequest) -> tuple[float, str, str, list[str]]:
    """Returns (score, label, mensagem, recomendacoes)."""
    score = 0.0

    # 1. Receita (0-50 pts)
    score += RECEITA_SCORES.get(data.receita_anual, 15)

    # 2. Margem (0-20 pts)
    if data.margem_lucro >= 20:
        score += 20
    elif data.margem_lucro >= 10:
        score += 15
    elif data.margem_lucro >= 5:
        score += 10
    elif data.margem_lucro > 0:
        score += 5

    # 3. Tempo de empresa (0-15 pts)
    if data.tempo_empresa >= 10:
        score += 15
    elif data.tempo_empresa >= 5:
        score += 12
    elif data.tempo_empresa >= 3:
        score += 8
    elif data.tempo_empresa >= 1:
        score += 4

    # 4. Setor bonus (0-15 pts) — setores mais "valuation-ready"
    setores_premium = ["technology", "saas", "fintech", "healthcare", "e-commerce"]
    setores_medio = ["services", "retail", "industry", "logistics", "education"]
    setor_lower = data.setor.lower().strip()
    if any(s in setor_lower for s in setores_premium):
        score += 15
    elif any(s in setor_lower for s in setores_medio):
        score += 10
    else:
        score += 5

    # Clamp
    score = min(max(score, 0), 100)

    # Label
    if score >= 80:
        label = "Ready for Valuation"
        mensagem = "Your company has excellent maturity for a professional valuation. You already have the fundamentals needed to present to investors."
    elif score >= 60:
        label = "Structured"
        mensagem = "Your company is well positioned. A valuation can now reveal growth opportunities and help in strategic negotiations."
    elif score >= 40:
        label = "Growing"
        mensagem = "Your company is on the right track. A valuation can identify the main value drivers and guide your growth."
    else:
        label = "Early Stage"
        mensagem = "Your company is in an early stage, but can already benefit from a professional diagnostic to chart a path to higher value."

    # Recomendações
    recomendacoes = []
    if data.margem_lucro < 10:
        recomendacoes.append("Work to increase your profit margin above 10% — this directly impacts the valuation.")
    if data.tempo_empresa < 3:
        recomendacoes.append("Companies with 3+ years of track record receive more consistent valuations. Keep organized financial records.")
    if data.receita_anual in ("ate_100k", "100k_500k"):
        recomendacoes.append("Focus on scaling your revenue — companies with revenue above $500K attract more investors.")
    if data.margem_lucro >= 15 and data.tempo_empresa >= 3:
        recomendacoes.append("With good margin and track record, consider a full valuation for investment negotiations or equity sales.")
    if not recomendacoes:
        recomendacoes.append("Your company is well positioned. A full valuation can reveal your true market potential.")

    return score, label, mensagem, recomendacoes


# ─── Endpoint ────────────────────────────────────────────────
@router.post("/", response_model=DiagnosticoResponse)
async def criar_diagnostico(
    data: DiagnosticoRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Improvement S: Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    await _check_rate_limit(client_ip)

    try:
        score, label, mensagem, recomendacoes = calculate_score(data)

        # Improvement T: Deduplicate leads by email — update if exists
        existing_result = await db.execute(
            select(Lead).where(Lead.email == data.email)
        )
        existing_lead = existing_result.scalar_one_or_none()

        if existing_lead:
            existing_lead.nome = data.nome
            existing_lead.setor = data.setor
            existing_lead.receita_anual = data.receita_anual
            existing_lead.margem_lucro = data.margem_lucro
            existing_lead.tempo_empresa = data.tempo_empresa
            existing_lead.score = score
            existing_lead.score_label = label
        else:
            lead = Lead(
                email=data.email,
                nome=data.nome,
                setor=data.setor,
                receita_anual=data.receita_anual,
                margem_lucro=data.margem_lucro,
                tempo_empresa=data.tempo_empresa,
                score=score,
                score_label=label,
            )
            db.add(lead)
        await db.commit()

        # Send email in background (fire and forget — does NOT block the response)
        try:
            receita_label = RECEITA_LABELS.get(data.receita_anual, data.receita_anual)
            _fire_and_forget(send_diagnostico_email(
                email=data.email,
                nome=data.nome or "Entrepreneur",
                score=score,
                score_label=label,
                mensagem=mensagem,
                recomendacoes=recomendacoes,
                setor=data.setor,
                receita=receita_label,
                margem=data.margem_lucro,
                tempo=data.tempo_empresa,
            ))
        except Exception as e:
            print(f"[DIAGNOSTICO] Failed to schedule email task: {e}")

        return DiagnosticoResponse(
            score=score,
            score_label=label,
            mensagem=mensagem,
            recomendacoes=recomendacoes,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing diagnostic: {str(e)}")
