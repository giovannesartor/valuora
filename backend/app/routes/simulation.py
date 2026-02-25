"""
simulation.py — Rotas de simulação de valuation.

Extraído de analysis.py para manter o arquivo principal enxuto.
Prefixo compartilhado: /analyses (mesmo do router principal).
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.valuation_engine.engine import run_valuation
from app.models.models import User, Analysis, SimulationLog
from app.schemas.analysis import SimulationRequest, SimulationResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/analyses", tags=["Simulações"])


@router.post("/simulate", response_model=SimulationResponse)
async def simulate_analysis(
    req: SimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recalcula o valuation com parâmetros customizados sem sobrescrever a análise original."""
    result = await db.execute(
        select(Analysis).where(
            Analysis.id == req.analysis_id,
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    if not analysis.plan:
        raise HTTPException(status_code=403, detail="O simulador requer um plano pago. Desbloqueie o relatório primeiro.")

    growth_rate   = req.growth_rate      if req.growth_rate      is not None else analysis.growth_rate
    net_margin    = req.net_margin       if req.net_margin       is not None else analysis.net_margin
    discount_rate = req.discount_rate    # None = engine escolhe WACC automaticamente
    founder_dep   = req.founder_dependency if req.founder_dependency is not None else (analysis.founder_dependency or 0.0)

    sim_result = run_valuation(
        revenue=float(analysis.revenue),
        net_margin=net_margin,
        sector=analysis.sector or "outros",
        growth_rate=growth_rate,
        debt=float(analysis.debt or 0),
        cash=float(analysis.cash or 0),
        founder_dependency=founder_dep,
        projection_years=analysis.projection_years or 5,
        custom_wacc=discount_rate,
        custom_growth=growth_rate,
        custom_margin=net_margin,
        custom_exit_multiple=analysis.custom_exit_multiple,
        dcf_weight=analysis.dcf_weight or 0.60,
        qualitative_answers=analysis.qualitative_answers,
        years_in_business=analysis.years_in_business or 3,
        ebitda=float(analysis.ebitda) if analysis.ebitda else None,
        recurring_revenue_pct=float(analysis.recurring_revenue_pct or 0.0),
        num_employees=analysis.num_employees or 0,
        previous_investment=float(analysis.previous_investment or 0.0),
    )

    parameters = {
        "growth_rate": growth_rate,
        "net_margin": net_margin,
        "discount_rate": discount_rate,
        "founder_dependency": founder_dep,
    }

    log = SimulationLog(
        analysis_id=analysis.id,
        parameters=parameters,
        result=sim_result,
        equity_value=sim_result.get("equity_value", 0),
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


@router.get("/{analysis_id}/simulations")
async def list_simulations(
    analysis_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna o histórico de simulações de uma análise do usuário."""
    analysis_result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
            Analysis.deleted_at.is_(None),
        )
    )
    if not analysis_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    sims = await db.execute(
        select(SimulationLog)
        .where(SimulationLog.analysis_id == analysis_id)
        .order_by(SimulationLog.created_at.desc())
        .limit(50)
    )
    rows = sims.scalars().all()
    return [
        {
            "id": str(s.id),
            "equity_value": float(s.equity_value),
            "parameters": s.parameters,
            "created_at": s.created_at.isoformat(),
        }
        for s in rows
    ]
