"""
Partner CRM routes — Guided Consultation, Client Health, Notes & Tasks,
Report Co-visualization, Action Templates, Follow-up History.
"""
import uuid as _uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import (
    User, Partner, PartnerClient, Analysis, Payment,
    ClientNote, ClientTask, PartnerComment, FollowUpLog, GuidedSession,
    AnalysisStatus, PaymentStatus, NoteType, FollowUpTrigger,
)
from app.schemas.partner import PartnerClientResponse
from app.schemas.partner_crm import (
    NoteCreate, NoteResponse,
    TaskCreate, TaskUpdate, TaskResponse,
    CommentCreate, CommentResponse,
    GuidedSessionUpdate, GuidedSessionResponse,
    ClientHealthResponse, FieldStatus, ConsistencyAlert, ImprovementSuggestion,
    ActionTemplate, ActionTemplatesResponse,
    FollowUpLogResponse,
)
from app.schemas.auth import MessageResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/partners", tags=["Partner CRM"])


# ─── Helper: get partner + verify client ownership ───────
async def _get_partner(db: AsyncSession, user: User) -> Partner:
    result = await db.execute(select(Partner).where(Partner.user_id == user.id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Not a registered partner.")
    return partner


async def _get_client(db: AsyncSession, partner: Partner, client_id: str) -> PartnerClient:
    try:
        cid = _uuid.UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid client ID.")
    result = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == cid,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found.")
    return client


# ═══════════════════════════════════════════════════════════
# 1. GET single client (was missing — detail page needs it)
# ═══════════════════════════════════════════════════════════
@router.get("/clients/{client_id}", response_model=PartnerClientResponse)
async def get_client_detail(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)
    return PartnerClientResponse.model_validate(client)


# ═══════════════════════════════════════════════════════════
# 2. NOTES — structured notes with type and timeline
# ═══════════════════════════════════════════════════════════
@router.get("/clients/{client_id}/notes", response_model=List[NoteResponse])
async def list_notes(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)
    result = await db.execute(
        select(ClientNote)
        .where(ClientNote.client_id == client.id)
        .order_by(ClientNote.created_at.desc())
    )
    return [NoteResponse.model_validate(n) for n in result.scalars().all()]


@router.post("/clients/{client_id}/notes", response_model=NoteResponse, status_code=201)
async def create_note(
    client_id: str,
    body: NoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)
    note = ClientNote(
        client_id=client.id,
        partner_id=partner.id,
        content=body.content.strip(),
        note_type=NoteType(body.note_type) if body.note_type in [e.value for e in NoteType] else NoteType.GENERAL,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteResponse.model_validate(note)


@router.delete("/clients/{client_id}/notes/{note_id}", response_model=MessageResponse)
async def delete_note(
    client_id: str,
    note_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    await _get_client(db, partner, client_id)
    try:
        nid = _uuid.UUID(note_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid note ID.")
    result = await db.execute(
        select(ClientNote).where(ClientNote.id == nid, ClientNote.partner_id == partner.id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    await db.delete(note)
    await db.commit()
    return {"message": "Note deleted."}


# ═══════════════════════════════════════════════════════════
# 3. TASKS — tasks with deadlines and completion tracking
# ═══════════════════════════════════════════════════════════
@router.get("/clients/{client_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)
    result = await db.execute(
        select(ClientTask)
        .where(ClientTask.client_id == client.id)
        .order_by(ClientTask.is_completed.asc(), ClientTask.due_date.asc().nullslast(), ClientTask.created_at.desc())
    )
    return [TaskResponse.model_validate(t) for t in result.scalars().all()]


@router.post("/clients/{client_id}/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    client_id: str,
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)
    task = ClientTask(
        client_id=client.id,
        partner_id=partner.id,
        title=body.title.strip(),
        description=body.description.strip() if body.description else None,
        due_date=body.due_date,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.patch("/clients/{client_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    client_id: str,
    task_id: str,
    body: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    await _get_client(db, partner, client_id)
    try:
        tid = _uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    result = await db.execute(
        select(ClientTask).where(ClientTask.id == tid, ClientTask.partner_id == partner.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    if body.title is not None:
        task.title = body.title.strip()
    if body.description is not None:
        task.description = body.description.strip() if body.description else None
    if body.due_date is not None:
        task.due_date = body.due_date
    if body.is_completed is not None:
        task.is_completed = body.is_completed
        task.completed_at = datetime.now(timezone.utc) if body.is_completed else None

    await db.commit()
    await db.refresh(task)
    return TaskResponse.model_validate(task)


@router.delete("/clients/{client_id}/tasks/{task_id}", response_model=MessageResponse)
async def delete_task(
    client_id: str,
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    await _get_client(db, partner, client_id)
    try:
        tid = _uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task ID.")
    result = await db.execute(
        select(ClientTask).where(ClientTask.id == tid, ClientTask.partner_id == partner.id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    await db.delete(task)
    await db.commit()
    return {"message": "Task deleted."}


# ── All pending tasks across all clients (dashboard widget) ──
@router.get("/tasks/pending", response_model=List[TaskResponse])
async def list_pending_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    result = await db.execute(
        select(ClientTask, PartnerClient.client_name)
        .join(PartnerClient, ClientTask.client_id == PartnerClient.id)
        .where(ClientTask.partner_id == partner.id, ClientTask.is_completed == False)
        .order_by(ClientTask.due_date.asc().nullslast(), ClientTask.created_at.desc())
        .limit(20)
    )
    tasks = []
    for task, client_name in result.all():
        resp = TaskResponse.model_validate(task)
        resp.client_name = client_name
        tasks.append(resp)
    return tasks


# ═══════════════════════════════════════════════════════════
# 4. GUIDED CONSULTATION — wizard for partner to fill data
# ═══════════════════════════════════════════════════════════

# Questions blueprint returned to frontend — maps to Analysis fields
CONSULTATION_QUESTIONS = [
    {
        "step": 0,
        "category": "company_info",
        "fields": [
            {"key": "company_name", "type": "text", "required": True},
            {"key": "sector", "type": "select", "required": True, "options": [
                "Technology", "SaaS", "E-commerce", "Fintech", "Healthcare",
                "Services", "Retail", "Manufacturing", "Logistics", "Education",
                "Food", "Construction", "Agribusiness", "Other",
            ]},
            {"key": "cnpj", "type": "text", "required": False},
        ],
    },
    {
        "step": 1,
        "category": "revenue_growth",
        "fields": [
            {"key": "revenue", "type": "currency", "required": True},
            {"key": "growth_rate", "type": "percent", "required": False},
        ],
    },
    {
        "step": 2,
        "category": "profitability",
        "fields": [
            {"key": "net_margin", "type": "percent", "required": True},
            {"key": "ebitda", "type": "currency", "required": False},
        ],
    },
    {
        "step": 3,
        "category": "balance_sheet",
        "fields": [
            {"key": "debt", "type": "currency", "required": False},
            {"key": "cash", "type": "currency", "required": False},
        ],
    },
    {
        "step": 4,
        "category": "business_profile",
        "fields": [
            {"key": "years_in_business", "type": "number", "required": True},
            {"key": "num_employees", "type": "number", "required": False},
            {"key": "recurring_revenue_pct", "type": "percent", "required": False},
        ],
    },
    {
        "step": 5,
        "category": "risk_factors",
        "fields": [
            {"key": "founder_dependency", "type": "slider", "required": False, "min": 0, "max": 1, "step": 0.1},
            {"key": "previous_investment", "type": "currency", "required": False},
        ],
    },
]


@router.get("/clients/{client_id}/consultation/questions")
async def get_consultation_questions(
    current_user: User = Depends(get_current_user),
):
    """Return the question blueprint for the guided consultation wizard."""
    return {"questions": CONSULTATION_QUESTIONS, "total_steps": len(CONSULTATION_QUESTIONS)}


@router.get("/clients/{client_id}/consultation", response_model=Optional[GuidedSessionResponse])
async def get_consultation(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)
    result = await db.execute(
        select(GuidedSession)
        .where(GuidedSession.client_id == client.id, GuidedSession.partner_id == partner.id)
        .order_by(GuidedSession.updated_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None
    return GuidedSessionResponse.model_validate(session)


@router.post("/clients/{client_id}/consultation", response_model=GuidedSessionResponse)
async def save_consultation(
    client_id: str,
    body: GuidedSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)

    # Upsert: find existing session or create new
    result = await db.execute(
        select(GuidedSession)
        .where(GuidedSession.client_id == client.id, GuidedSession.partner_id == partner.id)
        .order_by(GuidedSession.updated_at.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()

    if session:
        session.responses = body.responses
        session.current_step = body.current_step
        session.is_completed = body.is_completed
        session.updated_at = datetime.now(timezone.utc)
    else:
        session = GuidedSession(
            client_id=client.id,
            partner_id=partner.id,
            responses=body.responses,
            current_step=body.current_step,
            is_completed=body.is_completed,
        )
        db.add(session)

    await db.commit()
    await db.refresh(session)
    return GuidedSessionResponse.model_validate(session)


# ═══════════════════════════════════════════════════════════
# 5. CLIENT HEALTH PANEL — progress, alerts, suggestions
# ═══════════════════════════════════════════════════════════

# Fields tracked for health calculation
_HEALTH_FIELDS = [
    ("company_name", "Company Name", True),
    ("sector", "Sector", True),
    ("revenue", "Revenue", True),
    ("net_margin", "Net Margin", True),
    ("growth_rate", "Growth Rate", False),
    ("debt", "Debt", False),
    ("cash", "Cash", False),
    ("ebitda", "EBITDA", False),
    ("recurring_revenue_pct", "Recurring Revenue %", False),
    ("num_employees", "Employees", False),
    ("years_in_business", "Years in Business", True),
    ("founder_dependency", "Founder Dependency", False),
    ("previous_investment", "Previous Investment", False),
    ("cnpj", "CNPJ", False),
]


@router.get("/clients/{client_id}/health", response_model=ClientHealthResponse)
async def get_client_health(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)

    # Determine stage
    if client.data_status == "report_sent":
        stage = "report_sent"
    elif client.analysis_id:
        # Check analysis status
        a_result = await db.execute(select(Analysis).where(Analysis.id == client.analysis_id))
        analysis = a_result.scalar_one_or_none()
        stage = "analysis_complete" if analysis and analysis.status == AnalysisStatus.COMPLETED else "filling"
    else:
        stage = "registered"

    # If no analysis linked, return minimal health
    if not client.analysis_id:
        return ClientHealthResponse(
            fill_percentage=0.0,
            fields=[FieldStatus(field=f, label=l, filled=False) for f, l, _ in _HEALTH_FIELDS],
            alerts=[],
            suggestions=[ImprovementSuggestion(
                area="Getting Started",
                message="Client hasn't started the analysis yet. Send the registration link.",
                impact="high"
            )],
            stage=stage,
        )

    # Fetch analysis
    a_result = await db.execute(select(Analysis).where(Analysis.id == client.analysis_id))
    analysis = a_result.scalar_one_or_none()
    if not analysis:
        return ClientHealthResponse(
            fill_percentage=0.0,
            fields=[FieldStatus(field=f, label=l, filled=False) for f, l, _ in _HEALTH_FIELDS],
            alerts=[],
            suggestions=[],
            stage=stage,
        )

    # Compute field fill status
    fields = []
    filled_count = 0
    total_fields = len(_HEALTH_FIELDS)
    for field_name, label, _required in _HEALTH_FIELDS:
        val = getattr(analysis, field_name, None)
        is_filled = val is not None and val != "" and val != 0 and val != 0.0
        if is_filled:
            filled_count += 1
        fields.append(FieldStatus(
            field=field_name,
            label=label,
            filled=is_filled,
            value=float(val) if isinstance(val, (int, float)) else str(val) if val else None,
        ))

    fill_pct = round((filled_count / total_fields) * 100, 1) if total_fields > 0 else 0.0

    # Consistency alerts
    alerts = []
    if analysis.net_margin and analysis.net_margin > 100:
        alerts.append(ConsistencyAlert(field="net_margin", message="Net margin above 100% — verify the data.", severity="error"))
    if analysis.net_margin and analysis.net_margin < -50:
        alerts.append(ConsistencyAlert(field="net_margin", message="Net margin below -50% — is this correct?", severity="warning"))
    if analysis.revenue and float(analysis.revenue) < 0:
        alerts.append(ConsistencyAlert(field="revenue", message="Negative revenue — check the value.", severity="error"))
    if analysis.growth_rate and analysis.growth_rate > 500:
        alerts.append(ConsistencyAlert(field="growth_rate", message="Growth rate above 500% — unusual, please verify.", severity="warning"))
    if analysis.debt and analysis.revenue and float(analysis.debt) > float(analysis.revenue) * 5:
        alerts.append(ConsistencyAlert(field="debt", message="Debt exceeds 5x revenue — high leverage risk.", severity="warning"))
    if analysis.founder_dependency and analysis.founder_dependency > 0.8:
        alerts.append(ConsistencyAlert(field="founder_dependency", message="Very high founder dependency — increases risk score.", severity="warning"))

    # Improvement suggestions
    suggestions = []
    if not analysis.ebitda:
        suggestions.append(ImprovementSuggestion(area="EBITDA", message="Add EBITDA to improve valuation accuracy.", impact="high"))
    if not analysis.growth_rate:
        suggestions.append(ImprovementSuggestion(area="Growth Rate", message="Adding growth rate enables better DCF projections.", impact="high"))
    if not analysis.recurring_revenue_pct or analysis.recurring_revenue_pct == 0:
        suggestions.append(ImprovementSuggestion(area="Recurring Revenue", message="Adding recurring revenue % can increase valuation multiples.", impact="medium"))
    if analysis.founder_dependency and analysis.founder_dependency > 0.5:
        suggestions.append(ImprovementSuggestion(area="Founder Risk", message="Suggest building a management team to reduce founder dependency.", impact="high"))
    if analysis.net_margin and analysis.net_margin < 10:
        suggestions.append(ImprovementSuggestion(area="Margins", message="Low margins reduce valuation. Suggest cost optimization strategies.", impact="high"))
    if not analysis.cnpj:
        suggestions.append(ImprovementSuggestion(area="CNPJ", message="Add CNPJ to enable automatic sector benchmarking.", impact="low"))

    return ClientHealthResponse(
        fill_percentage=fill_pct,
        fields=fields,
        alerts=alerts,
        suggestions=suggestions,
        stage=stage,
    )


# ═══════════════════════════════════════════════════════════
# 6. REPORT CO-VISUALIZATION — partner views client's report
# ═══════════════════════════════════════════════════════════
@router.get("/clients/{client_id}/report-data")
async def get_client_report_data(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the valuation results for a partner's client (read-only co-view)."""
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)

    if not client.analysis_id:
        raise HTTPException(status_code=404, detail="No analysis linked to this client.")

    result = await db.execute(select(Analysis).where(Analysis.id == client.analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    return {
        "company_name": analysis.company_name,
        "sector": analysis.sector,
        "status": analysis.status.value if analysis.status else None,
        "equity_value": float(analysis.equity_value) if analysis.equity_value else None,
        "risk_score": analysis.risk_score,
        "maturity_index": analysis.maturity_index,
        "percentile": analysis.percentile,
        "revenue": float(analysis.revenue) if analysis.revenue else None,
        "net_margin": analysis.net_margin,
        "growth_rate": analysis.growth_rate,
        "ebitda": float(analysis.ebitda) if analysis.ebitda else None,
        "debt": float(analysis.debt) if analysis.debt else None,
        "cash": float(analysis.cash) if analysis.cash else None,
        "years_in_business": analysis.years_in_business,
        "founder_dependency": analysis.founder_dependency,
        "valuation_result": analysis.valuation_result,
        "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
    }


# ── Comments on analysis ──
@router.get("/clients/{client_id}/comments", response_model=List[CommentResponse])
async def list_comments(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)
    if not client.analysis_id:
        return []
    result = await db.execute(
        select(PartnerComment)
        .where(PartnerComment.analysis_id == client.analysis_id, PartnerComment.partner_id == partner.id)
        .order_by(PartnerComment.created_at.desc())
    )
    comments = []
    for c in result.scalars().all():
        resp = CommentResponse.model_validate(c)
        # Fetch partner name
        u_result = await db.execute(select(User.full_name).where(User.id == partner.user_id))
        resp.partner_name = u_result.scalar_one_or_none() or "Partner"
        comments.append(resp)
    return comments


@router.post("/clients/{client_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    client_id: str,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)
    if not client.analysis_id:
        raise HTTPException(status_code=400, detail="No analysis linked to this client.")

    comment = PartnerComment(
        partner_id=partner.id,
        analysis_id=client.analysis_id,
        content=body.content.strip(),
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    resp = CommentResponse.model_validate(comment)
    resp.partner_name = current_user.full_name
    return resp


# ═══════════════════════════════════════════════════════════
# 7. ACTION TEMPLATES BY SCENARIO — rule-based suggestions
# ═══════════════════════════════════════════════════════════
@router.get("/clients/{client_id}/action-templates", response_model=ActionTemplatesResponse)
async def get_action_templates(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    client = await _get_client(db, partner, client_id)

    templates = []
    valuation_summary = None

    if not client.analysis_id:
        templates.append(ActionTemplate(
            id="no_analysis",
            title="Start Analysis",
            description="Client hasn't started the valuation yet. Send the registration link and offer to guide them through the data collection.",
            category="opportunity",
            priority="high",
            icon="PlayCircle",
        ))
        return ActionTemplatesResponse(templates=templates, valuation_summary=valuation_summary)

    result = await db.execute(select(Analysis).where(Analysis.id == client.analysis_id))
    analysis = result.scalar_one_or_none()

    if not analysis or analysis.status != AnalysisStatus.COMPLETED:
        templates.append(ActionTemplate(
            id="incomplete_analysis",
            title="Complete Analysis",
            description="The analysis is in progress. Help the client fill in missing fields to get more accurate results.",
            category="optimization",
            priority="high",
            icon="ClipboardList",
        ))
        return ActionTemplatesResponse(templates=templates, valuation_summary=valuation_summary)

    # Build valuation summary
    valuation_summary = {
        "equity_value": float(analysis.equity_value) if analysis.equity_value else 0,
        "risk_score": analysis.risk_score or 0,
        "maturity_index": analysis.maturity_index or 0,
        "net_margin": analysis.net_margin or 0,
        "growth_rate": analysis.growth_rate or 0,
    }

    # Rule-based templates
    # Low valuation
    if analysis.equity_value and float(analysis.equity_value) < 500_000:
        templates.append(ActionTemplate(
            id="low_value_margin",
            title="Optimize Profit Margins",
            description="The company's valuation is below $500K. Suggest cost reduction strategies and pricing optimization to improve net margins.",
            category="optimization",
            priority="high",
            icon="TrendingUp",
        ))

    # High risk score
    if analysis.risk_score and analysis.risk_score > 60:
        templates.append(ActionTemplate(
            id="high_risk_debt",
            title="Review Debt Structure",
            description="Risk score is above 60. Recommend restructuring debt and diversifying revenue streams to lower risk.",
            category="risk",
            priority="high",
            icon="AlertTriangle",
        ))

    # High founder dependency
    if analysis.founder_dependency and analysis.founder_dependency > 0.6:
        templates.append(ActionTemplate(
            id="founder_risk",
            title="Reduce Founder Dependency",
            description="Founder dependency is high ({:.0%}). Suggest delegating key responsibilities and building a management team.".format(analysis.founder_dependency),
            category="risk",
            priority="high",
            icon="Users",
        ))

    # Low margins
    if analysis.net_margin and analysis.net_margin < 10:
        templates.append(ActionTemplate(
            id="low_margin",
            title="Improve Operational Efficiency",
            description="Net margin is {:.1f}%. Suggest lean operations, cost auditing, and price adjustment.".format(analysis.net_margin),
            category="optimization",
            priority="medium",
            icon="Settings",
        ))

    # Good growth
    if analysis.growth_rate and analysis.growth_rate > 20:
        templates.append(ActionTemplate(
            id="growth_momentum",
            title="Capitalize on Growth",
            description="Growth rate is {:.1f}%. This is a great time to raise investment or explore the Pitch Deck module.".format(analysis.growth_rate),
            category="opportunity",
            priority="medium",
            icon="Rocket",
        ))

    # Good health — suggest pitch deck
    if analysis.maturity_index and analysis.maturity_index > 60:
        # Check if client already has a pitch deck
        from app.models.models import PitchDeck
        pd_result = await db.execute(
            select(func.count()).where(
                PitchDeck.analysis_id == analysis.id,
                PitchDeck.deleted_at == None,
            )
        )
        has_pd = pd_result.scalar_one() > 0
        if not has_pd:
            templates.append(ActionTemplate(
                id="offer_pitch_deck",
                title="Offer Pitch Deck",
                description="Company shows good maturity ({:.0f}/100). Suggest creating a Pitch Deck to attract investors.".format(analysis.maturity_index),
                category="opportunity",
                priority="high",
                icon="Presentation",
            ))

    # No growth data
    if not analysis.growth_rate:
        templates.append(ActionTemplate(
            id="add_growth",
            title="Add Growth Data",
            description="Growth rate is missing. Adding this metric can significantly impact valuation accuracy.",
            category="optimization",
            priority="medium",
            icon="BarChart",
        ))

    # Check if analysis is paid
    p_result = await db.execute(
        select(Payment).where(Payment.analysis_id == analysis.id, Payment.status == PaymentStatus.PAID)
    )
    is_paid = p_result.scalar_one_or_none() is not None

    if not is_paid:
        templates.append(ActionTemplate(
            id="close_sale",
            title="Close the Sale",
            description="The analysis has results but hasn't been purchased yet. Schedule a review meeting and present the value.",
            category="opportunity",
            priority="high",
            icon="DollarSign",
        ))

    # If no templates generated (everything looks good)
    if not templates:
        templates.append(ActionTemplate(
            id="healthy_company",
            title="Maintain & Monitor",
            description="This company shows solid metrics. Suggest periodic re-analysis (quarterly) to track progress.",
            category="growth",
            priority="low",
            icon="CheckCircle",
        ))

    return ActionTemplatesResponse(templates=templates, valuation_summary=valuation_summary)


# ═══════════════════════════════════════════════════════════
# 8. FOLLOW-UP HISTORY — log of automated follow-ups
# ═══════════════════════════════════════════════════════════
@router.get("/follow-ups", response_model=List[FollowUpLogResponse])
async def list_followups(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    partner = await _get_partner(db, current_user)
    result = await db.execute(
        select(FollowUpLog, PartnerClient.client_name)
        .join(PartnerClient, FollowUpLog.client_id == PartnerClient.id)
        .where(FollowUpLog.partner_id == partner.id)
        .order_by(FollowUpLog.sent_at.desc())
        .limit(limit)
    )
    logs = []
    for log, client_name in result.all():
        resp = FollowUpLogResponse.model_validate(log)
        resp.client_name = client_name
        logs.append(resp)
    return logs
