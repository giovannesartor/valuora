"""
Diagnóstico Gratuito — Lead magnet endpoint.
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

router = APIRouter(prefix="/diagnostico", tags=["Diagnóstico Gratuito"])

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
                detail="Muitas solicitações. Tente novamente em alguns minutos.",
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
                detail="Muitas solicitações. Tente novamente em alguns minutos.",
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
    "ate_100k": "Até R$ 100 mil",
    "100k_500k": "R$ 100 mil – R$ 500 mil",
    "500k_2m": "R$ 500 mil – R$ 2 milhões",
    "2m_10m": "R$ 2 milhões – R$ 10 milhões",
    "acima_10m": "Acima de R$ 10 milhões",
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
    setores_premium = ["tecnologia", "saas", "fintech", "saúde", "e-commerce"]
    setores_medio = ["serviços", "varejo", "indústria", "logística", "educação"]
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
        label = "Pronto para Valuation"
        mensagem = "Sua empresa tem excelente maturidade para um valuation profissional. Você já possui os fundamentos necessários para apresentar a investidores."
    elif score >= 60:
        label = "Estruturado"
        mensagem = "Sua empresa está bem posicionada. Um valuation agora pode revelar oportunidades de valorização e ajudar em negociações estratégicas."
    elif score >= 40:
        label = "Em Crescimento"
        mensagem = "Sua empresa está no caminho certo. Um valuation pode identificar os principais drivers de valor e orientar seu crescimento."
    else:
        label = "Fase Inicial"
        mensagem = "Sua empresa está em fase inicial, mas já pode se beneficiar de um diagnóstico profissional para traçar um caminho de valorização."

    # Recomendações
    recomendacoes = []
    if data.margem_lucro < 10:
        recomendacoes.append("Trabalhe para aumentar sua margem de lucro acima de 10% — isso impacta diretamente o valuation.")
    if data.tempo_empresa < 3:
        recomendacoes.append("Empresas com 3+ anos de histórico recebem avaliações mais consistentes. Mantenha registros financeiros organizados.")
    if data.receita_anual in ("ate_100k", "100k_500k"):
        recomendacoes.append("Busque escalar sua receita — empresas com receita acima de R$ 500 mil atraem mais investidores.")
    if data.margem_lucro >= 15 and data.tempo_empresa >= 3:
        recomendacoes.append("Com boa margem e histórico, considere um valuation completo para negociações de investimento ou venda de participação.")
    if not recomendacoes:
        recomendacoes.append("Sua empresa está bem posicionada. Um valuation completo pode revelar seu verdadeiro potencial de mercado.")

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
                nome=data.nome or "Empreendedor",
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
        raise HTTPException(status_code=500, detail=f"Erro ao processar diagnóstico: {str(e)}")
