"""
Partner CRM routes — Consultoria Guiada, Painel de Saúde, CRM Mini,
Co-visualização, Templates de Ação, Follow-up Automático,
Criar Análise pelo Parceiro, Relatório Gratuito.
"""
import uuid
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.config import settings
from app.models.models import (
    User, Partner, PartnerClient, Analysis, AnalysisVersion, Payment,
    PartnerTask, PartnerClientNote, PartnerReportComment,
    PartnerFollowUpRule, ClientDataStatus, AnalysisStatus,
    PaymentStatus, FollowUpTrigger, PlanType, SampleDownload, Commission,
)
from app.schemas.partner import (
    TaskCreate, TaskUpdate, TaskResponse,
    ClientNoteCreate, ClientNoteResponse,
    ReportCommentCreate, ReportCommentResponse,
    ClientHealthResponse,
    GuidedQuestionnaireSubmit, GuidedQuestionnaireResponse,
    ActionTemplateResponse,
    FollowUpRuleUpdate, FollowUpRuleResponse,
    FollowUpAlertResponse,
)
from app.schemas.auth import MessageResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/partners", tags=["Parceiro CRM"])


# ─── Helper: get partner or 403 ──────────────────────────
async def _get_partner(db: AsyncSession, user_id) -> Partner:
    result = await db.execute(select(Partner).where(Partner.user_id == user_id))
    partner = result.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=403, detail="Parceiro não encontrado.")
    return partner


# ═══════════════════════════════════════════════════════════
# 1. CONSULTORIA GUIADA (Wizard de preenchimento)
# ═══════════════════════════════════════════════════════════

GUIDED_QUESTIONS = [
    {
        "step": 1,
        "id": "company_info",
        "title": "Company Information",
        "description": "Basic information about the client's company",
        "fields": [
            {"key": "company_name", "label": "Company name", "type": "text", "required": True,
             "hint": "What is your client's company name?"},
            {"key": "sector", "label": "Sector", "type": "text", "required": True,
             "hint": "Which sector does the company operate in? (e.g. Technology, Retail, Healthcare)"},
            {"key": "cnpj", "label": "Tax ID", "type": "text", "required": False,
             "hint": "Enter the tax ID if available"},
            {"key": "years_in_business", "label": "Years in operation", "type": "number", "required": False,
             "hint": "How many years has the company been operating?"},
        ],
    },
    {
        "step": 2,
        "id": "financials",
        "title": "Financial Data",
        "description": "Revenue, margin, and EBITDA",
        "fields": [
            {"key": "revenue", "label": "Annual revenue ($)", "type": "currency", "required": True,
             "hint": "What is the company's annual gross revenue?"},
            {"key": "net_margin", "label": "Net margin (%)", "type": "percentage", "required": True,
             "hint": "What % of revenue is net profit? (e.g. 15 for 15%)"},
            {"key": "ebitda", "label": "EBITDA ($)", "type": "currency", "required": False,
             "hint": "If available, enter annual EBITDA. Leave blank if unknown."},
            {"key": "growth_rate", "label": "Annual growth (%)", "type": "percentage", "required": False,
             "hint": "By what % did the company grow last year?"},
        ],
    },
    {
        "step": 3,
        "id": "balance_sheet",
        "title": "Balance Sheet",
        "description": "Debt, cash, and founder dependency",
        "fields": [
            {"key": "debt", "label": "Total debt ($)", "type": "currency", "required": False,
             "hint": "How much does the company owe? (loans, financing)"},
            {"key": "cash", "label": "Available cash ($)", "type": "currency", "required": False,
             "hint": "How much cash/equivalents does it have?"},
            {"key": "founder_dependency", "label": "Founder dependency (0-100%)", "type": "percentage", "required": False,
             "hint": "How dependent is the company on the founder? 100% = fully dependent"},
        ],
    },
    {
        "step": 4,
        "id": "advanced",
        "title": "Additional Data",
        "description": "Extra information for a more accurate analysis",
        "fields": [
            {"key": "num_employees", "label": "Number of employees", "type": "number", "required": False,
             "hint": "How many employees does the company have?"},
            {"key": "recurring_revenue_pct", "label": "Recurring revenue (%)", "type": "percentage", "required": False,
             "hint": "What % of revenue is recurring (subscriptions, contracts)?"},
            {"key": "previous_investment", "label": "Previous investment ($)", "type": "currency", "required": False,
             "hint": "Has the company received investment? How much?"},
        ],
    },
]


@router.get("/guided-questionnaire")
async def get_guided_questionnaire():
    """Return the guided questionnaire structure for the partner wizard."""
    return {"steps": GUIDED_QUESTIONS, "total_steps": len(GUIDED_QUESTIONS)}


@router.post("/guided-questionnaire/submit", response_model=GuidedQuestionnaireResponse)
async def submit_guided_questionnaire(
    data: GuidedQuestionnaireSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit guided questionnaire answers, pre-filling client analysis data."""
    partner = await _get_partner(db, current_user.id)

    # Verify client belongs to partner
    result = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == data.client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    answers = data.answers

    # Map answers to analysis fields
    field_mapping = {
        "company_name": "company_name",
        "sector": "sector",
        "cnpj": "cnpj",
        "revenue": "revenue",
        "net_margin": "net_margin",
        "ebitda": "ebitda",
        "growth_rate": "growth_rate",
        "debt": "debt",
        "cash": "cash",
        "founder_dependency": "founder_dependency",
        "num_employees": "num_employees",
        "recurring_revenue_pct": "recurring_revenue_pct",
        "previous_investment": "previous_investment",
        "years_in_business": "years_in_business",
    }

    pre_filled = {}
    for q_key, a_key in field_mapping.items():
        if q_key in answers and answers[q_key] is not None and answers[q_key] != "":
            val = answers[q_key]
            # Convert percentages from 0-100 to 0-1 for float fields
            if q_key in ("net_margin", "growth_rate", "founder_dependency", "recurring_revenue_pct"):
                try:
                    val = float(val) / 100.0
                except (ValueError, TypeError):
                    pass
            pre_filled[a_key] = val

    # If client already has a user_id and analysis, update that analysis
    if client.analysis_id:
        result = await db.execute(select(Analysis).where(Analysis.id == client.analysis_id))
        analysis = result.scalar_one_or_none()
        if analysis:
            for key, val in pre_filled.items():
                setattr(analysis, key, val)
            await db.commit()
            return GuidedQuestionnaireResponse(
                message="Dados da análise atualizados com sucesso!",
                analysis_id=analysis.id,
                pre_filled_fields=pre_filled,
            )

    # If client has user_id, create a draft analysis for them
    if client.user_id:
        required_fields = {"company_name", "sector", "revenue", "net_margin"}
        if required_fields.issubset(set(pre_filled.keys())):
            analysis = Analysis(
                user_id=client.user_id,
                partner_id=partner.id,
                status=AnalysisStatus.DRAFT,
                **{k: v for k, v in pre_filled.items()},
            )
            db.add(analysis)
            await db.flush()
            client.analysis_id = analysis.id
            client.data_status = ClientDataStatus.COMPLETED
            await db.commit()
            return GuidedQuestionnaireResponse(
                message="Análise criada com sucesso! O cliente pode completar e pagar.",
                analysis_id=analysis.id,
                pre_filled_fields=pre_filled,
            )

    # Otherwise just store the pre-filled data in notes
    notes_text = "📋 Dados da consultoria guiada:\n"
    for key, val in pre_filled.items():
        notes_text += f"  • {key}: {val}\n"
    client.notes = (client.notes or "") + "\n" + notes_text
    await db.commit()

    return GuidedQuestionnaireResponse(
        message="Dados salvos nas notas do cliente. Quando ele se registrar, serão aplicados automaticamente.",
        pre_filled_fields=pre_filled,
    )


# ═══════════════════════════════════════════════════════════
# 2. PAINEL DE SAÚDE DO CLIENTE
# ═══════════════════════════════════════════════════════════

@router.get("/clients/health", response_model=List[ClientHealthResponse])
async def get_clients_health(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get health overview: missing fields, alerts, suggestions per client."""
    partner = await _get_partner(db, current_user.id)

    result = await db.execute(
        select(PartnerClient)
        .where(PartnerClient.partner_id == partner.id)
        .order_by(PartnerClient.created_at.desc())
    )
    clients = result.scalars().all()

    now = datetime.now(timezone.utc)
    health_list = []

    # Batch-load analyses to avoid N+1
    analysis_ids = [c.analysis_id for c in clients if c.analysis_id]
    analyses_map = {}
    if analysis_ids:
        analyses_res = await db.execute(select(Analysis).where(Analysis.id.in_(analysis_ids)))
        analyses_map = {a.id: a for a in analyses_res.scalars().all()}

    # Batch-load payments for those analyses
    payments_map = {}
    if analysis_ids:
        pay_res = await db.execute(
            select(Payment).where(
                Payment.analysis_id.in_(analysis_ids),
                Payment.status == PaymentStatus.PAID,
            )
        )
        for p in pay_res.scalars().all():
            payments_map[p.analysis_id] = p

    for client in clients:
        analysis = analyses_map.get(client.analysis_id) if client.analysis_id else None

        days_since_reg = (now - client.created_at).days
        days_since_update = (now - client.updated_at).days if client.updated_at else days_since_reg

        missing_fields = []
        alerts = []
        suggestions = []

        # Check basic info
        if not client.client_company:
            missing_fields.append("Empresa do cliente")
        if not client.client_phone:
            missing_fields.append("Telefone do cliente")

        # Check if user registered
        if not client.user_id:
            missing_fields.append("Cadastro na plataforma")
            if days_since_reg > 3:
                alerts.append(f"⚠️ Cliente cadastrado há {days_since_reg} dias e ainda não se registrou")
                suggestions.append("Envie o link de convite novamente ou ligue para o cliente")

        # Check analysis status
        if client.user_id and not client.analysis_id:
            missing_fields.append("Análise de valuation")
            alerts.append("⚠️ Cliente registrado mas sem análise criada")
            suggestions.append("Use a Consultoria Guiada para preencher os dados com o cliente")

        if analysis:
            # Check for missing key fields
            if not analysis.ebitda:
                missing_fields.append("EBITDA")
            if not analysis.growth_rate:
                missing_fields.append("Taxa de crescimento")
            if analysis.debt is None or analysis.debt == 0:
                missing_fields.append("Informação de dívidas")
            if analysis.cash is None or analysis.cash == 0:
                missing_fields.append("Caixa disponível")
            if not analysis.num_employees:
                missing_fields.append("Número de funcionários")

            if analysis.status == AnalysisStatus.DRAFT:
                alerts.append("📝 Análise em rascunho — dados incompletos")
                suggestions.append("Complete os dados financeiros para gerar o relatório")
            elif analysis.status == AnalysisStatus.COMPLETED:
                # Check for improvement opportunities
                if analysis.risk_score and analysis.risk_score > 7:
                    alerts.append("🔴 Risco alto no valuation")
                    suggestions.append("Revise dívidas e dependência do fundador com o cliente")
                if analysis.equity_value and float(analysis.equity_value) < float(analysis.revenue or 1):
                    alerts.append("⚠️ Valor abaixo do faturamento anual")
                    suggestions.append("Sugira otimização de margem e redução de custos")
                if not analysis.ai_analysis:
                    suggestions.append("Solicite a análise por IA para insights adicionais")

            # Check payment (use batch-loaded map)
            paid_payment = payments_map.get(analysis.id)
            if not paid_payment:
                if analysis.status == AnalysisStatus.COMPLETED:
                    alerts.append("💳 Análise completa mas não paga")
                    suggestions.append("Entre em contato para concluir o pagamento")

        # Status-specific suggestions  
        if client.data_status == ClientDataStatus.PRE_FILLED:
            suggestions.append("Agende uma chamada para completar os dados financeiros")
        elif client.data_status == ClientDataStatus.COMPLETED:
            suggestions.append("Verifique se o relatório foi gerado e envie ao cliente")
        elif client.data_status == ClientDataStatus.REPORT_SENT:
            suggestions.append("Acompanhe se o cliente tem dúvidas sobre o relatório")
            suggestions.append("Ofereça o Pitch Deck para captar investidor")

        health_list.append(ClientHealthResponse(
            client_id=client.id,
            client_name=client.client_name,
            client_company=client.client_company,
            data_status=client.data_status.value if hasattr(client.data_status, 'value') else str(client.data_status),
            has_analysis=analysis is not None,
            analysis_status=analysis.status.value if analysis and hasattr(analysis.status, 'value') else (str(analysis.status) if analysis else None),
            missing_fields=missing_fields,
            alerts=alerts,
            suggestions=suggestions,
            days_since_registration=days_since_reg,
            days_since_last_update=days_since_update,
            equity_value=float(analysis.equity_value) if analysis and analysis.equity_value else None,
            risk_score=analysis.risk_score if analysis else None,
        ))

    return health_list


# ═══════════════════════════════════════════════════════════
# 3. CRM MINI — Tarefas
# ═══════════════════════════════════════════════════════════

@router.get("/tasks", response_model=List[TaskResponse])
async def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status: pending, done, cancelled"),
    client_id: Optional[uuid.UUID] = Query(None, description="Filter by client ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all partner tasks, optionally filtered."""
    partner = await _get_partner(db, current_user.id)

    query = select(PartnerTask, PartnerClient.client_name).outerjoin(
        PartnerClient, PartnerTask.client_id == PartnerClient.id
    ).where(PartnerTask.partner_id == partner.id)

    if status:
        query = query.where(PartnerTask.status == status)
    if client_id:
        query = query.where(PartnerTask.client_id == client_id)

    query = query.order_by(
        PartnerTask.status.asc(),  # pending first
        PartnerTask.due_date.asc().nulls_last(),
        PartnerTask.created_at.desc(),
    )

    result = await db.execute(query)
    rows = result.all()

    tasks = []
    for task, client_name in rows:
        resp = TaskResponse.model_validate(task)
        resp.client_name = client_name
        tasks.append(resp)
    return tasks


@router.post("/tasks", response_model=TaskResponse)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new task."""
    partner = await _get_partner(db, current_user.id)

    # Validate client if provided
    if data.client_id:
        res = await db.execute(
            select(PartnerClient).where(
                PartnerClient.id == data.client_id,
                PartnerClient.partner_id == partner.id,
            )
        )
        if not res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    task = PartnerTask(
        partner_id=partner.id,
        client_id=data.client_id,
        title=data.title,
        description=data.description,
        due_date=data.due_date,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Fetch client name
    client_name = None
    if task.client_id:
        res = await db.execute(select(PartnerClient.client_name).where(PartnerClient.id == task.client_id))
        client_name = res.scalar_one_or_none()

    resp = TaskResponse.model_validate(task)
    resp.client_name = client_name
    return resp


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a task (title, description, due_date, status)."""
    partner = await _get_partner(db, current_user.id)

    result = await db.execute(
        select(PartnerTask).where(
            PartnerTask.id == task_id,
            PartnerTask.partner_id == partner.id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.due_date is not None:
        task.due_date = data.due_date
    if data.status is not None:
        task.status = data.status
        if data.status == "done":
            task.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(task)

    client_name = None
    if task.client_id:
        res = await db.execute(select(PartnerClient.client_name).where(PartnerClient.id == task.client_id))
        client_name = res.scalar_one_or_none()

    resp = TaskResponse.model_validate(task)
    resp.client_name = client_name
    return resp


@router.delete("/tasks/{task_id}", response_model=MessageResponse)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a task."""
    partner = await _get_partner(db, current_user.id)

    result = await db.execute(
        select(PartnerTask).where(
            PartnerTask.id == task_id,
            PartnerTask.partner_id == partner.id,
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada.")

    await db.delete(task)
    await db.commit()
    return MessageResponse(message="Tarefa excluída.")


# ═══════════════════════════════════════════════════════════
# 3b. CRM MINI — Client Notes (histórico)
# ═══════════════════════════════════════════════════════════

@router.get("/clients/{client_id}/notes", response_model=List[ClientNoteResponse])
async def list_client_notes(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all notes for a client, most recent first."""
    partner = await _get_partner(db, current_user.id)

    # Verify client
    res = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    result = await db.execute(
        select(PartnerClientNote)
        .where(PartnerClientNote.client_id == client_id, PartnerClientNote.partner_id == partner.id)
        .order_by(PartnerClientNote.created_at.desc())
    )
    return result.scalars().all()


@router.post("/clients/{client_id}/notes", response_model=ClientNoteResponse)
async def create_client_note(
    client_id: str,
    data: ClientNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a note to a client's history."""
    partner = await _get_partner(db, current_user.id)

    res = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    note = PartnerClientNote(
        partner_id=partner.id,
        client_id=client_id,
        content=data.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/clients/{client_id}/notes/{note_id}", response_model=MessageResponse)
async def delete_client_note(
    client_id: str,
    note_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a client note."""
    partner = await _get_partner(db, current_user.id)

    result = await db.execute(
        select(PartnerClientNote).where(
            PartnerClientNote.id == note_id,
            PartnerClientNote.client_id == client_id,
            PartnerClientNote.partner_id == partner.id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Anotação não encontrada.")

    await db.delete(note)
    await db.commit()
    return MessageResponse(message="Anotação excluída.")


# ═══════════════════════════════════════════════════════════
# 4. CO-VISUALIZAÇÃO DO RELATÓRIO
# ═══════════════════════════════════════════════════════════

@router.get("/clients/{client_id}/report")
async def get_client_report(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the valuation report data for a partner's client."""
    partner = await _get_partner(db, current_user.id)

    res = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    if not client.analysis_id:
        raise HTTPException(status_code=404, detail="Cliente ainda não possui análise.")

    result = await db.execute(select(Analysis).where(Analysis.id == client.analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")

    # Get existing comments
    comments_result = await db.execute(
        select(PartnerReportComment)
        .where(
            PartnerReportComment.analysis_id == analysis.id,
            PartnerReportComment.partner_id == partner.id,
        )
        .order_by(PartnerReportComment.created_at.desc())
    )
    comments = comments_result.scalars().all()

    return {
        "client": {
            "id": str(client.id),
            "name": client.client_name,
            "company": client.client_company,
            "email": client.client_email,
        },
        "analysis": {
            "id": str(analysis.id),
            "company_name": analysis.company_name,
            "sector": analysis.sector,
            "status": analysis.status.value if hasattr(analysis.status, 'value') else str(analysis.status),
            "revenue": float(analysis.revenue) if analysis.revenue else None,
            "net_margin": analysis.net_margin,
            "ebitda": float(analysis.ebitda) if analysis.ebitda else None,
            "growth_rate": analysis.growth_rate,
            "debt": float(analysis.debt) if analysis.debt else None,
            "cash": float(analysis.cash) if analysis.cash else None,
            "founder_dependency": analysis.founder_dependency,
            "equity_value": float(analysis.equity_value) if analysis.equity_value else None,
            "risk_score": analysis.risk_score,
            "maturity_index": analysis.maturity_index,
            "plan": analysis.plan.value if analysis.plan and hasattr(analysis.plan, 'value') else str(analysis.plan) if analysis.plan else None,
            "valuation_result": analysis.valuation_result,
            "ai_analysis": analysis.ai_analysis,
            "created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        },
        "comments": [
            {
                "id": str(c.id),
                "section": c.section,
                "content": c.content,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in comments
        ],
    }


@router.post("/clients/{client_id}/report/comments", response_model=ReportCommentResponse)
async def add_report_comment(
    client_id: str,
    data: ReportCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a comment/annotation to a client's valuation report."""
    partner = await _get_partner(db, current_user.id)

    res = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    if not client.analysis_id:
        raise HTTPException(status_code=404, detail="Cliente ainda não possui análise.")

    comment = PartnerReportComment(
        partner_id=partner.id,
        analysis_id=client.analysis_id,
        client_id=client.id,
        section=data.section,
        content=data.content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.delete("/clients/{client_id}/report/comments/{comment_id}", response_model=MessageResponse)
async def delete_report_comment(
    client_id: str,
    comment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a report comment."""
    partner = await _get_partner(db, current_user.id)

    result = await db.execute(
        select(PartnerReportComment).where(
            PartnerReportComment.id == comment_id,
            PartnerReportComment.partner_id == partner.id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado.")

    await db.delete(comment)
    await db.commit()
    return MessageResponse(message="Comentário excluído.")


# ═══════════════════════════════════════════════════════════
# 5. TEMPLATES DE AÇÃO POR CENÁRIO
# ═══════════════════════════════════════════════════════════

ACTION_TEMPLATES = {
    "sem_dados": ActionTemplateResponse(
        category="sem_dados",
        title="🔵 Sem Dados — Cliente novo",
        description="O cliente ainda não preencheu os dados financeiros.",
        actions=[
            "Agende uma chamada de 15min para preencher juntos",
            "Use a Consultoria Guiada para fazer as perguntas certas",
            "Envie o link de convite com os dados pré-preenchidos",
            "Explique que o processo leva apenas 5 minutos",
        ],
        suggested_product="valuation",
    ),
    "risco_alto": ActionTemplateResponse(
        category="risco_alto",
        title="🔴 Risco Alto — Atenção necessária",
        description="O valuation identificou riscos significativos na empresa.",
        actions=[
            "Revise a estrutura de dívidas — negocie taxas",
            "Reduza a dependência do fundador (plano de sucessão)",
            "Diversifique fontes de receita",
            "Considere reestruturação operacional para reduzir custos fixos",
            "Sugira nova avaliação em 6 meses após ajustes",
        ],
        suggested_product=None,
    ),
    "valor_baixo": ActionTemplateResponse(
        category="valor_baixo",
        title="⚠️ Valor Abaixo do Esperado",
        description="O valor da empresa ficou abaixo de 1x o faturamento anual.",
        actions=[
            "Analise a margem líquida — está abaixo da média do setor?",
            "Otimize a operação para melhorar o EBITDA",
            "Invista em aumento de receita recorrente",
            "Reduza custos fixos não essenciais",
            "Implemente processos para reduzir risco operacional",
        ],
        suggested_product=None,
    ),
    "boa_saude": ActionTemplateResponse(
        category="boa_saude",
        title="🟢 Boa Saúde — Crescimento",
        description="A empresa tem bons indicadores e potencial de crescimento.",
        actions=[
            "Ofereça o Pitch Deck para captar investidor",
            "Sugira um plano de expansão documentado",
            "Explore M&A — a empresa pode ser alvo de aquisição",
            "Considere rodada de investimento anjo",
            "Atualize o valuation trimestralmente para acompanhar evolução",
        ],
        suggested_product="pitch_deck",
    ),
    "relatorio_pronto": ActionTemplateResponse(
        category="relatorio_pronto",
        title="📊 Relatório Pronto",
        description="O relatório de valuation foi gerado. Próximos passos:",
        actions=[
            "Agende reunião para apresentar os resultados ao cliente",
            "Destaque os pontos fortes e fracos encontrados",
            "Proponha um plano de ação para aumentar o valor em 12 meses",
            "Ofereça o pacote Bundle (Valuation + Pitch Deck) com desconto",
            "Pergunte se o cliente quer simular cenários alternativos",
        ],
        suggested_product="pitch_deck",
    ),
}


@router.get("/action-templates", response_model=List[ActionTemplateResponse])
async def get_action_templates():
    """Return all available action templates."""
    return list(ACTION_TEMPLATES.values())


@router.get("/clients/{client_id}/action-template", response_model=ActionTemplateResponse)
async def get_client_action_template(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the best matching action template for a specific client based on their status."""
    partner = await _get_partner(db, current_user.id)

    res = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    # Determine the best template based on client's current situation
    if not client.analysis_id:
        return ACTION_TEMPLATES["sem_dados"]

    result = await db.execute(select(Analysis).where(Analysis.id == client.analysis_id))
    analysis = result.scalar_one_or_none()

    if not analysis or analysis.status == AnalysisStatus.DRAFT:
        return ACTION_TEMPLATES["sem_dados"]

    if analysis.status == AnalysisStatus.COMPLETED:
        # Determine category based on metrics
        if analysis.risk_score and analysis.risk_score > 7:
            return ACTION_TEMPLATES["risco_alto"]
        if analysis.equity_value and analysis.revenue and \
                float(analysis.equity_value) < float(analysis.revenue):
            return ACTION_TEMPLATES["valor_baixo"]

        # Check if report was recently generated
        if client.data_status == ClientDataStatus.REPORT_SENT:
            return ACTION_TEMPLATES["boa_saude"]

        return ACTION_TEMPLATES["relatorio_pronto"]

    return ACTION_TEMPLATES["sem_dados"]


# ═══════════════════════════════════════════════════════════
# 6. FOLLOW-UP AUTOMÁTICO INTELIGENTE
# ═══════════════════════════════════════════════════════════

TRIGGER_LABELS = {
    "client_no_register": "Cliente não se registrou",
    "client_no_data": "Cliente sem dados preenchidos",
    "report_no_meeting": "Relatório gerado, sem reunião",
    "client_no_purchase": "Cliente não comprou",
    "post_report": "Follow-up pós-relatório",
}

DEFAULT_MESSAGES = {
    "client_no_register": "Hi {nome}! 👋 I noticed you haven't completed your registration yet on Valuora. Can I help? It's quick — in 2 minutes you'll have access to the platform. Link: {link}",
    "client_no_data": "Oi {nome}! Sua conta está criada, mas faltam os dados financeiros para gerar seu valuation. Podemos agendar 15min para eu te ajudar a preencher? Fica muito mais fácil juntos!",
    "report_no_meeting": "Olá {nome}! 📊 Seu relatório de valuation já está pronto! Que tal agendarmos uma conversa rápida para eu te explicar os resultados e como aumentar o valor da sua empresa?",
    "client_no_purchase": "Oi {nome}! Vi que você verificou os dados do valuation mas ainda não gerou o relatório completo. Precisa de ajuda? Posso tirar suas dúvidas sobre os planos disponíveis.",
    "post_report": "Olá {nome}! Passaram-se alguns dias desde que entregamos o relatório. Tem alguma dúvida sobre os resultados? Quero garantir que você aproveite ao máximo a análise!",
}

DEFAULT_RULES = [
    {"trigger": "client_no_register", "days_delay": 3},
    {"trigger": "client_no_data", "days_delay": 5},
    {"trigger": "report_no_meeting", "days_delay": 7},
    {"trigger": "client_no_purchase", "days_delay": 4},
    {"trigger": "post_report", "days_delay": 10},
]


@router.get("/followup/rules", response_model=List[FollowUpRuleResponse])
async def list_followup_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all follow-up rules. If none, create defaults."""
    partner = await _get_partner(db, current_user.id)

    result = await db.execute(
        select(PartnerFollowUpRule)
        .where(PartnerFollowUpRule.partner_id == partner.id)
        .order_by(PartnerFollowUpRule.created_at.asc())
    )
    rules = result.scalars().all()

    # Auto-create default rules if none exist (lock partner row to prevent race condition)
    if not rules:
        partner_id_str = str(partner.id)  # Save before try to avoid PendingRollbackError
        try:
            # Lock the partner row to serialize concurrent requests
            await db.execute(
                select(Partner).where(Partner.id == partner.id).with_for_update()
            )
            # Re-check after acquiring lock
            recheck = await db.execute(
                select(PartnerFollowUpRule)
                .where(PartnerFollowUpRule.partner_id == partner.id)
            )
            if not recheck.scalars().all():
                for rd in DEFAULT_RULES:
                    rule = PartnerFollowUpRule(
                        partner_id=partner.id,
                        trigger=FollowUpTrigger(rd["trigger"]),
                        days_delay=rd["days_delay"],
                        message_template=DEFAULT_MESSAGES.get(rd["trigger"]),
                        is_active=True,
                    )
                    db.add(rule)
                await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.error("Failed to auto-create follow-up rules for partner %s: %s", partner_id_str, exc)

        result = await db.execute(
            select(PartnerFollowUpRule)
            .where(PartnerFollowUpRule.partner_id == partner.id)
            .order_by(PartnerFollowUpRule.created_at.asc())
        )
        rules = result.scalars().all()

    # Explicitly serialize trigger enum to str for Pydantic
    return [
        FollowUpRuleResponse(
            id=r.id,
            partner_id=r.partner_id,
            trigger=r.trigger.value if hasattr(r.trigger, 'value') else str(r.trigger),
            days_delay=r.days_delay,
            message_template=r.message_template,
            is_active=r.is_active,
            created_at=r.created_at,
        ) for r in rules
    ]


@router.put("/followup/rules/{rule_id}", response_model=FollowUpRuleResponse)
async def update_followup_rule(
    rule_id: str,
    data: FollowUpRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a follow-up rule."""
    partner = await _get_partner(db, current_user.id)

    result = await db.execute(
        select(PartnerFollowUpRule).where(
            PartnerFollowUpRule.id == rule_id,
            PartnerFollowUpRule.partner_id == partner.id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Regra não encontrada.")

    if data.days_delay is not None:
        rule.days_delay = data.days_delay
    if data.message_template is not None:
        rule.message_template = data.message_template
    if data.is_active is not None:
        rule.is_active = data.is_active

    await db.commit()
    await db.refresh(rule)
    return FollowUpRuleResponse(
        id=rule.id,
        partner_id=rule.partner_id,
        trigger=rule.trigger.value if hasattr(rule.trigger, 'value') else str(rule.trigger),
        days_delay=rule.days_delay,
        message_template=rule.message_template,
        is_active=rule.is_active,
        created_at=rule.created_at,
    )


@router.get("/followup/alerts", response_model=List[FollowUpAlertResponse])
async def get_followup_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check all clients against follow-up rules and return alerts."""
    partner = await _get_partner(db, current_user.id)

    # Get active rules
    rules_result = await db.execute(
        select(PartnerFollowUpRule).where(
            PartnerFollowUpRule.partner_id == partner.id,
            PartnerFollowUpRule.is_active == True,
        )
    )
    rules = {r.trigger.value if hasattr(r.trigger, 'value') else str(r.trigger): r
             for r in rules_result.scalars().all()}

    if not rules:
        return []

    # Get all clients
    clients_result = await db.execute(
        select(PartnerClient)
        .where(PartnerClient.partner_id == partner.id)
    )
    clients = clients_result.scalars().all()

    # Batch-load analyses and payments to avoid N+1
    analysis_ids = [c.analysis_id for c in clients if c.analysis_id]
    analyses_map = {}
    payments_map = {}
    if analysis_ids:
        analyses_res = await db.execute(select(Analysis).where(Analysis.id.in_(analysis_ids)))
        analyses_map = {a.id: a for a in analyses_res.scalars().all()}
        pay_res = await db.execute(
            select(Payment).where(
                Payment.analysis_id.in_(analysis_ids),
                Payment.status == PaymentStatus.PAID,
            )
        )
        for p in pay_res.scalars().all():
            payments_map[p.analysis_id] = p

    now = datetime.now(timezone.utc)
    alerts = []

    for client in clients:
        days_since_reg = (now - client.created_at).days

        # Rule: client_no_register — registered in partner CRM but no user_id
        rule = rules.get("client_no_register")
        if rule and not client.user_id and days_since_reg >= rule.days_delay:
            msg = (rule.message_template or DEFAULT_MESSAGES["client_no_register"]).replace(
                "{nome}", client.client_name
            ).replace("{link}", "")
            alerts.append(FollowUpAlertResponse(
                client_id=client.id,
                client_name=client.client_name,
                client_email=client.client_email,
                client_phone=client.client_phone,
                trigger="client_no_register",
                trigger_label=TRIGGER_LABELS["client_no_register"],
                days_overdue=days_since_reg - rule.days_delay,
                suggested_message=msg,
            ))
            continue

        # Rule: client_no_data — has user but no analysis
        rule = rules.get("client_no_data")
        if rule and client.user_id and not client.analysis_id and days_since_reg >= rule.days_delay:
            msg = (rule.message_template or DEFAULT_MESSAGES["client_no_data"]).replace(
                "{nome}", client.client_name
            )
            alerts.append(FollowUpAlertResponse(
                client_id=client.id,
                client_name=client.client_name,
                client_email=client.client_email,
                client_phone=client.client_phone,
                trigger="client_no_data",
                trigger_label=TRIGGER_LABELS["client_no_data"],
                days_overdue=days_since_reg - rule.days_delay,
                suggested_message=msg,
            ))
            continue

        # Rule: client_no_purchase — has analysis but not paid
        if client.analysis_id:
            analysis = analyses_map.get(client.analysis_id)

            if analysis:
                rule = rules.get("client_no_purchase")
                if rule and analysis.status == AnalysisStatus.COMPLETED:
                    paid_payment = payments_map.get(analysis.id)
                    if not paid_payment:
                        analysis_age = (now - analysis.created_at).days if analysis.created_at else 0
                        if analysis_age >= rule.days_delay:
                            msg = (rule.message_template or DEFAULT_MESSAGES["client_no_purchase"]).replace(
                                "{nome}", client.client_name
                            )
                            alerts.append(FollowUpAlertResponse(
                                client_id=client.id,
                                client_name=client.client_name,
                                client_email=client.client_email,
                                client_phone=client.client_phone,
                                trigger="client_no_purchase",
                                trigger_label=TRIGGER_LABELS["client_no_purchase"],
                                days_overdue=analysis_age - rule.days_delay,
                                suggested_message=msg,
                            ))
                            continue

                # Rule: report_no_meeting
                rule_report = rules.get("report_no_meeting")
                if rule_report and client.data_status == ClientDataStatus.REPORT_SENT:
                    days_since_update = (now - client.updated_at).days if client.updated_at else days_since_reg
                    if days_since_update >= rule_report.days_delay:
                        msg = (rule_report.message_template or DEFAULT_MESSAGES["report_no_meeting"]).replace(
                            "{nome}", client.client_name
                        )
                        alerts.append(FollowUpAlertResponse(
                            client_id=client.id,
                            client_name=client.client_name,
                            client_email=client.client_email,
                            client_phone=client.client_phone,
                            trigger="report_no_meeting",
                            trigger_label=TRIGGER_LABELS["report_no_meeting"],
                            days_overdue=days_since_update - rule_report.days_delay,
                            suggested_message=msg,
                        ))
                        continue

                # Rule: post_report — follow-up after report delivered
                rule_post = rules.get("post_report")
                if rule_post and analysis.status == AnalysisStatus.COMPLETED:
                    paid = payments_map.get(analysis.id)
                    if paid and paid.paid_at:
                        days_since_paid = (now - paid.paid_at).days
                        if days_since_paid >= rule_post.days_delay:
                            msg = (rule_post.message_template or DEFAULT_MESSAGES["post_report"]).replace(
                                "{nome}", client.client_name
                            )
                            alerts.append(FollowUpAlertResponse(
                                client_id=client.id,
                                client_name=client.client_name,
                                client_email=client.client_email,
                                client_phone=client.client_phone,
                                trigger="post_report",
                                trigger_label=TRIGGER_LABELS["post_report"],
                                days_overdue=days_since_paid - rule_post.days_delay,
                                suggested_message=msg,
                            ))

    # Sort by days_overdue descending (most urgent first)
    alerts.sort(key=lambda a: a.days_overdue, reverse=True)
    return alerts


# ═══════════════════════════════════════════════════════════
# 8. CRIAR ANÁLISE PELO PARCEIRO (para um cliente)
# ═══════════════════════════════════════════════════════════

from pydantic import BaseModel


class PartnerAnalysisCreate(BaseModel):
    client_id: uuid.UUID
    company_name: str
    sector: str
    cnpj: Optional[str] = None
    revenue: float
    net_margin: float
    growth_rate: Optional[float] = None
    debt: float = 0
    cash: float = 0
    founder_dependency: float = 0.0
    projection_years: int = 5
    ebitda: Optional[float] = None
    recurring_revenue_pct: float = 0.0
    num_employees: int = 0
    years_in_business: int = 3
    previous_investment: float = 0.0
    qualitative_answers: Optional[Dict[str, Any]] = None
    dcf_weight: Optional[float] = None
    custom_exit_multiple: Optional[float] = None
    company_type: Optional[str] = None
    revenue_ntm: Optional[float] = None
    ebitda_margin: Optional[float] = None
    tangible_assets: float = 0
    intangible_assets: float = 0
    equity_participations: float = 0
    monthly_burn_rate: Optional[float] = None


@router.post("/clients/{client_id}/analysis")
async def create_analysis_for_client(
    client_id: str,
    data: PartnerAnalysisCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Partner creates an analysis on behalf of a client.
    The analysis is owned by the client's user_id (so the client sees it on their dashboard).
    The client then just needs to choose a plan and pay.
    """
    from app.core.valuation_engine.engine import run_valuation, run_valuation_with_ibge
    from app.services.sector_analysis_service import get_dcf_sector_adjustment, _sector_to_cnae
    from app.services.deepseek_service import estimate_sector_data_with_ai
    from app.core.cache import cache_delete_pattern

    partner = await _get_partner(db, current_user.id)

    # Verify client belongs to this partner
    result = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id == client_id,
            PartnerClient.partner_id == partner.id,
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    if not client.user_id:
        raise HTTPException(
            status_code=400,
            detail="Este cliente ainda não ativou a conta. Use 'Nova Análise Guiada' para enviar a análise e criar a conta automaticamente.",
        )

    # Create analysis owned by the CLIENT's user_id
    analysis = Analysis(
        user_id=client.user_id,
        partner_id=partner.id,
        company_name=data.company_name,
        sector=data.sector,
        cnpj=data.cnpj,
        revenue=max(1, data.revenue),
        net_margin=data.net_margin,
        growth_rate=data.growth_rate,
        debt=data.debt,
        cash=data.cash,
        founder_dependency=data.founder_dependency,
        projection_years=data.projection_years,
        ebitda=data.ebitda,
        recurring_revenue_pct=data.recurring_revenue_pct,
        num_employees=data.num_employees,
        years_in_business=data.years_in_business,
        previous_investment=data.previous_investment,
        qualitative_answers=data.qualitative_answers,
        dcf_weight=data.dcf_weight,
        custom_exit_multiple=data.custom_exit_multiple,
        company_type=data.company_type,
        revenue_ntm=data.revenue_ntm,
        ebitda_margin=data.ebitda_margin,
        tangible_assets=data.tangible_assets,
        intangible_assets=data.intangible_assets,
        equity_participations=data.equity_participations,
        monthly_burn_rate=data.monthly_burn_rate,
        status=AnalysisStatus.PROCESSING,
    )
    db.add(analysis)
    await db.flush()

    # Run valuation engine
    ibge_adj = None
    try:
        cnae_code = _sector_to_cnae(data.sector)
        adjustment = await get_dcf_sector_adjustment(
            cnae_code=cnae_code,
            company_revenue=float(data.revenue),
            company_growth=data.growth_rate,
        )
        ibge_adj = adjustment.model_dump()
    except Exception as e:
        logger.warning(f"[PARTNER-ANALYSIS] IBGE adjustment failed: {e}")
        try:
            cnae_code = _sector_to_cnae(data.sector)
            ai_sector = await estimate_sector_data_with_ai(data.sector, cnae_code)
            if ai_sector:
                ibge_adj = ai_sector
        except Exception as e2:
            logger.warning(f"[PARTNER-ANALYSIS] DeepSeek fallback failed: {e2}")

    engine_kwargs = dict(
        years_in_business=data.years_in_business,
        ebitda=float(data.ebitda) if data.ebitda else None,
        recurring_revenue_pct=data.recurring_revenue_pct,
        num_employees=data.num_employees,
        previous_investment=float(data.previous_investment),
        qualitative_answers=data.qualitative_answers,
        dcf_weight=data.dcf_weight,
        custom_exit_multiple=data.custom_exit_multiple,
        company_type=data.company_type,
        revenue_ntm=float(data.revenue_ntm) if data.revenue_ntm else None,
        ebitda_margin=data.ebitda_margin,
        tangible_assets=float(data.tangible_assets) if data.tangible_assets else 0,
        intangible_assets=float(data.intangible_assets) if data.intangible_assets else 0,
        equity_participations=float(data.equity_participations) if data.equity_participations else 0,
        monthly_burn_rate=float(data.monthly_burn_rate) if data.monthly_burn_rate else None,
    )

    try:
        if ibge_adj:
            result_val = await asyncio.to_thread(
                run_valuation_with_ibge,
                revenue=float(data.revenue),
                net_margin=data.net_margin,
                sector=data.sector,
                ibge_adjustment=ibge_adj,
                growth_rate=data.growth_rate,
                debt=float(data.debt),
                cash=float(data.cash),
                founder_dependency=data.founder_dependency,
                projection_years=data.projection_years,
                **engine_kwargs,
            )
        else:
            result_val = await asyncio.to_thread(
                run_valuation,
                revenue=float(data.revenue),
                net_margin=data.net_margin,
                sector=data.sector,
                growth_rate=data.growth_rate,
                debt=float(data.debt),
                cash=float(data.cash),
                founder_dependency=data.founder_dependency,
                projection_years=data.projection_years,
                **engine_kwargs,
            )
    except Exception as engine_err:
        logger.error(f"[PARTNER-ANALYSIS] Valuation engine error: {engine_err}")
        analysis.status = AnalysisStatus.FAILED
        await db.commit()
        raise HTTPException(status_code=500, detail="Erro no motor de valuation. Tente novamente.")

    analysis.valuation_result = result_val
    analysis.equity_value = result_val["equity_value"]
    analysis.risk_score = result_val["risk_score"]
    analysis.maturity_index = result_val["maturity_index"]
    analysis.percentile = result_val["percentile"]
    analysis.status = AnalysisStatus.COMPLETED

    version = AnalysisVersion(
        analysis_id=analysis.id,
        version_number=1,
        valuation_result=result_val,
        equity_value=result_val["equity_value"],
    )
    db.add(version)

    # Update client record
    client.analysis_id = analysis.id
    client.data_status = ClientDataStatus.COMPLETED

    await db.commit()
    await db.refresh(analysis)
    await cache_delete_pattern(f"qv:kpis:{client.user_id}")

    return {
        "id": str(analysis.id),
        "company_name": analysis.company_name,
        "equity_value": analysis.equity_value,
        "risk_score": analysis.risk_score,
        "status": analysis.status.value,
        "message": f"Análise criada com sucesso para {client.client_name}. O cliente pode escolher o plano e pagar.",
    }


# ═══════════════════════════════════════════════════════════
# 9. KIT DE PROSPECÇÃO — EXEMPLOS PARA COMPARTILHAR
# ═══════════════════════════════════════════════════════════

# Catálogo dos arquivos de exemplo disponíveis para parceiros
PARTNER_SAMPLE_FILES = [
    {
        "id": "profissional",
        "title": "Relatório Profissional",
        "description": "Análise completa com benchmark setorial, índice de maturidade e comparativo de múltiplos. Ideal para PMEs.",
        "what_includes": ["Valuation por DCF", "Benchmark Setorial", "Índice de Maturidade", "Comparativo de Múltiplos"],
        "filename": "relatorio-exemplo-profissional.pdf",
        "plan": "profissional",
        "price": 7997.00,
        "commission": 2399.10,
        "color": "blue",
    },
    {
        "id": "estrategico",
        "title": "Relatório Estratégico",
        "description": "A versão mais completa: todas as metodologias, análise qualitativa, tornado de sensibilidade e tese de captação.",
        "what_includes": ["Tudo do Profissional", "Análise Qualitativa", "Tornado de Sensibilidade", "Tese de Captação"],
        "filename": "relatorio-exemplo-estrategico.pdf",
        "plan": "estrategico",
        "price": 12997.00,
        "commission": 3899.10,
        "color": "purple",
    },
    {
        "id": "pitchdeck",
        "title": "Pitch Deck de Captação",
        "description": "Documento visual profissional para apresentar o negócio a investidores. Gerado por IA com tese de investimento e projeções financeiras.",
        "what_includes": ["Design Profissional", "Tese de Investimento", "Projeções Financeiras", "Gerado por IA"],
        "filename": "pitchdeck-exemplo.pdf",
        "plan": None,
        "price": 3997.00,
        "commission": 1199.10,
        "color": "amber",
    },
]


@router.get("/samples", summary="Listar exemplos disponíveis para o parceiro")
async def list_partner_samples(
    current_user: User = Depends(get_current_user),
):
    """Return catalogue of sample files available for partner to download and share."""
    return {"samples": PARTNER_SAMPLE_FILES}


@router.get("/samples/{sample_id}/download", summary="Baixar exemplo com marca do parceiro")
async def download_partner_sample(
    sample_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Download a sample PDF stamped with the partner's name in the footer.
    Combines static file serving, partner branding overlay and download tracking.
    """
    import io
    from pathlib import Path
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.pagesizes import A4

    sample = next((s for s in PARTNER_SAMPLE_FILES if s["id"] == sample_id), None)
    if not sample:
        raise HTTPException(status_code=404, detail="Exemplo não encontrado.")

    partner = await _get_partner(db, current_user.id)

    samples_dir = Path(settings.SAMPLES_DIR)
    pdf_path = samples_dir / sample["filename"]
    if not pdf_path.exists():
        logger.error(f"[SAMPLES] Arquivo não encontrado: {pdf_path}")
        raise HTTPException(status_code=404, detail="Arquivo de exemplo não encontrado no servidor.")

    pdf_bytes = pdf_path.read_bytes()

    # Stamp partner name in the footer of every page
    partner_label = partner.company_name or current_user.full_name or "Valuora Partner"
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        writer = PdfWriter()

        # Build a single-page stamp in A4 with the partner footer
        packet = io.BytesIO()
        c = rl_canvas.Canvas(packet, pagesize=A4)
        page_w, _ = A4
        c.setFont("Helvetica", 7)
        c.setFillColorRGB(0.55, 0.55, 0.55)
        c.drawCentredString(page_w / 2, 12, f"Compartilhado por {partner_label} · valuora.com.br")
        c.save()
        packet.seek(0)

        stamp_page = PdfReader(packet).pages[0]
        for page in reader.pages:
            page.merge_page(stamp_page)
            writer.add_page(page)

        out = io.BytesIO()
        writer.write(out)
        branded_bytes = out.getvalue()
    except Exception as e:
        logger.warning(f"[SAMPLES] Erro ao estampar PDF (servindo original): {e}")
        branded_bytes = pdf_bytes

    # Track download in DB (fire-and-forget, never fails the response)
    try:
        db.add(SampleDownload(partner_id=partner.id, sample_id=sample_id))
        await db.commit()
    except Exception as _e:
        logger.warning(f"[SAMPLES] DB tracking failed: {_e}")

    # Application log
    logger.info(f"[SAMPLES] partner_id={partner.id} user_id={current_user.id} downloaded={sample_id}")

    safe_name = partner_label.replace(" ", "_")[:30]
    filename = f"valuora-{sample_id}-exemplo-{safe_name}.pdf"
    return StreamingResponse(
        io.BytesIO(branded_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/samples/funnel", summary="Funil de conversão por tipo de exemplo")
async def get_sample_funnel(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns per-sample download counts and matched commission counts for funnel analysis.
    Commission matching: profissional/estrategico → valuation commissions by plan,
    pitchdeck → pitch_deck commissions.
    """
    partner = await _get_partner(db, current_user.id)

    # Count downloads per sample_id
    downloads_result = await db.execute(
        select(SampleDownload.sample_id, func.count(SampleDownload.id).label("total"))
        .where(SampleDownload.partner_id == partner.id)
        .group_by(SampleDownload.sample_id)
    )
    downloads_map = {row.sample_id: row.total for row in downloads_result.all()}

    # Count commissions earned (all time) — use payment plan to match sample type
    commissions_result = await db.execute(
        select(Commission.product_type, func.count(Commission.id).label("total"))
        .where(Commission.partner_id == partner.id)
        .group_by(Commission.product_type)
    )
    comm_map = {row.product_type: row.total for row in commissions_result.all()}

    funnel = []
    for s in PARTNER_SAMPLE_FILES:
        sid = s["id"]
        dl = downloads_map.get(sid, 0)
        # Map sample_id to product_type string for commission lookup
        if sid == "pitchdeck":
            conversions = comm_map.get("pitch_deck", 0)
        elif sid in ("profissional", "estrategico"):
            conversions = comm_map.get("valuation", 0) + comm_map.get("bundle", 0)
        else:
            conversions = 0
        funnel.append({
            "sample_id": sid,
            "title": s["title"],
            "color": s["color"],
            "downloads": dl,
            "conversions": conversions,
            "conversion_rate": round(conversions / dl * 100, 1) if dl > 0 else 0,
        })

    return {"funnel": funnel}


# ═══════════════════════════════════════════════════════════
# 10. P1 — PIPELINE STAGE (Kanban)
# ═══════════════════════════════════════════════════════════

PIPELINE_STAGES = ["lead", "proposta", "negociacao", "fechado", "analise_feita", "entregue"]

@router.patch("/clients/{client_id}/pipeline", summary="Atualizar estágio do pipeline")
async def update_pipeline_stage(
    client_id: uuid.UUID,
    stage: str = Query(..., description="Novo estágio do pipeline"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P1: Move client to a different pipeline stage (Kanban)."""
    if stage not in PIPELINE_STAGES:
        raise HTTPException(status_code=400, detail=f"Estágio inválido. Válidos: {', '.join(PIPELINE_STAGES)}")
    partner = await _get_partner(db, current_user.id)
    result = await db.execute(
        select(PartnerClient).where(PartnerClient.id == client_id, PartnerClient.partner_id == partner.id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    client.pipeline_stage = stage
    await db.commit()
    return {"id": str(client.id), "pipeline_stage": stage}


# ═══════════════════════════════════════════════════════════
# 11. P4 — PERFORMANCE STATS
# ═══════════════════════════════════════════════════════════

@router.get("/performance", summary="Relatório de performance do parceiro")
async def get_performance_stats(
    months: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P4: Conversion funnel, revenue/month, ticket médio, client growth."""
    partner = await _get_partner(db, current_user.id)
    since = datetime.now(timezone.utc) - timedelta(days=months * 30)

    # Total clients
    total_clients_q = await db.execute(
        select(func.count(PartnerClient.id)).where(PartnerClient.partner_id == partner.id)
    )
    total_clients = total_clients_q.scalar() or 0

    # Clients by pipeline stage
    stage_q = await db.execute(
        select(PartnerClient.pipeline_stage, func.count(PartnerClient.id))
        .where(PartnerClient.partner_id == partner.id)
        .group_by(PartnerClient.pipeline_stage)
    )
    pipeline_distribution = {row[0]: row[1] for row in stage_q.all()}

    # Monthly revenue (from commissions)
    from app.models.models import Commission
    revenue_q = await db.execute(
        select(
            func.date_trunc("month", Commission.created_at).label("month"),
            func.sum(Commission.partner_amount).label("revenue"),
            func.count(Commission.id).label("count"),
        )
        .where(Commission.partner_id == partner.id, Commission.created_at >= since)
        .group_by("month")
        .order_by("month")
    )
    monthly_revenue = [
        {
            "month": row.month.isoformat() if row.month else None,
            "revenue": float(row.revenue or 0),
            "count": row.count,
        }
        for row in revenue_q.all()
    ]

    # Conversion funnel
    leads = pipeline_distribution.get("lead", 0)
    propostas = pipeline_distribution.get("proposta", 0) + pipeline_distribution.get("negociacao", 0)
    fechados = pipeline_distribution.get("fechado", 0) + pipeline_distribution.get("analise_feita", 0) + pipeline_distribution.get("entregue", 0)

    # Clients with analysis (completed)
    with_analysis_q = await db.execute(
        select(func.count(PartnerClient.id)).where(
            PartnerClient.partner_id == partner.id,
            PartnerClient.analysis_id.isnot(None),
        )
    )
    with_analysis = with_analysis_q.scalar() or 0

    # Paid clients
    paid_client_ids = await db.execute(
        select(func.count(func.distinct(Payment.user_id)))
        .join(PartnerClient, PartnerClient.user_id == Payment.user_id)
        .where(
            PartnerClient.partner_id == partner.id,
            Payment.status == PaymentStatus.PAID,
        )
    )
    paid_count = paid_client_ids.scalar() or 0

    # Ticket médio
    avg_ticket_q = await db.execute(
        select(func.avg(Commission.total_amount))
        .where(Commission.partner_id == partner.id, Commission.created_at >= since)
    )
    avg_ticket = float(avg_ticket_q.scalar() or 0)

    # UTM source distribution
    utm_q = await db.execute(
        select(PartnerClient.utm_source, func.count(PartnerClient.id))
        .where(PartnerClient.partner_id == partner.id, PartnerClient.utm_source.isnot(None))
        .group_by(PartnerClient.utm_source)
    )
    utm_sources = {row[0]: row[1] for row in utm_q.all()}

    # Client growth (new clients per month)
    growth_q = await db.execute(
        select(
            func.date_trunc("month", PartnerClient.created_at).label("month"),
            func.count(PartnerClient.id).label("count"),
        )
        .where(PartnerClient.partner_id == partner.id, PartnerClient.created_at >= since)
        .group_by("month")
        .order_by("month")
    )
    client_growth = [
        {"month": row.month.isoformat(), "count": row.count}
        for row in growth_q.all()
    ]

    return {
        "total_clients": total_clients,
        "pipeline_distribution": pipeline_distribution,
        "funnel": {
            "leads": leads,
            "propostas": propostas,
            "fechados": fechados,
            "com_analise": with_analysis,
            "pagos": paid_count,
        },
        "monthly_revenue": monthly_revenue,
        "avg_ticket": round(avg_ticket, 2),
        "utm_sources": utm_sources,
        "client_growth": client_growth,
    }


# ═══════════════════════════════════════════════════════════
# 12. P5 — PROPOSAL TEMPLATES
# ═══════════════════════════════════════════════════════════

from app.models.models import PartnerProposalTemplate
from pydantic import BaseModel as ProposalBase

class ProposalTemplateCreate(ProposalBase):
    name: str
    content: str
    is_default: bool = False

class ProposalTemplateUpdate(ProposalBase):
    name: Optional[str] = None
    content: Optional[str] = None
    is_default: Optional[bool] = None


@router.get("/proposal-templates", summary="Listar templates de proposta")
async def list_proposal_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P5: List partner's proposal templates."""
    partner = await _get_partner(db, current_user.id)
    result = await db.execute(
        select(PartnerProposalTemplate)
        .where(PartnerProposalTemplate.partner_id == partner.id)
        .order_by(PartnerProposalTemplate.created_at.desc())
    )
    templates = result.scalars().all()
    return [
        {
            "id": str(t.id), "name": t.name, "content": t.content,
            "is_default": t.is_default, "created_at": t.created_at.isoformat(),
        }
        for t in templates
    ]


@router.post("/proposal-templates", summary="Criar template de proposta")
async def create_proposal_template(
    data: ProposalTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P5: Create a new proposal template."""
    partner = await _get_partner(db, current_user.id)
    template = PartnerProposalTemplate(
        partner_id=partner.id,
        name=data.name,
        content=data.content,
        is_default=data.is_default,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return {"id": str(template.id), "name": template.name, "created_at": template.created_at.isoformat()}


@router.put("/proposal-templates/{template_id}", summary="Atualizar template")
async def update_proposal_template(
    template_id: uuid.UUID,
    data: ProposalTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P5: Update proposal template."""
    partner = await _get_partner(db, current_user.id)
    result = await db.execute(
        select(PartnerProposalTemplate).where(
            PartnerProposalTemplate.id == template_id,
            PartnerProposalTemplate.partner_id == partner.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado.")
    if data.name is not None: template.name = data.name
    if data.content is not None: template.content = data.content
    if data.is_default is not None: template.is_default = data.is_default
    await db.commit()
    return {"id": str(template.id), "name": template.name}


@router.delete("/proposal-templates/{template_id}", summary="Excluir template")
async def delete_proposal_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P5: Delete proposal template."""
    partner = await _get_partner(db, current_user.id)
    result = await db.execute(
        select(PartnerProposalTemplate).where(
            PartnerProposalTemplate.id == template_id,
            PartnerProposalTemplate.partner_id == partner.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template não encontrado.")
    await db.delete(template)
    await db.commit()
    return {"deleted": True}


# ═══════════════════════════════════════════════════════════
# 13. P8 — BULK ACTIONS
# ═══════════════════════════════════════════════════════════

class BulkActionRequest(ProposalBase):
    client_ids: List[uuid.UUID]
    action: str  # delete, update_stage, export
    stage: Optional[str] = None


@router.post("/clients/bulk", summary="Ações em massa para clientes")
async def bulk_client_action(
    data: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P8: Bulk actions — delete, update pipeline stage, or export clients."""
    partner = await _get_partner(db, current_user.id)

    result = await db.execute(
        select(PartnerClient).where(
            PartnerClient.id.in_(data.client_ids),
            PartnerClient.partner_id == partner.id,
        )
    )
    clients = result.scalars().all()

    if not clients:
        raise HTTPException(status_code=404, detail="Nenhum cliente encontrado.")

    if data.action == "delete":
        for c in clients:
            await db.delete(c)
        await db.commit()
        return {"action": "delete", "affected": len(clients)}

    elif data.action == "update_stage":
        if not data.stage or data.stage not in PIPELINE_STAGES:
            raise HTTPException(status_code=400, detail=f"Estágio inválido. Válidos: {', '.join(PIPELINE_STAGES)}")
        for c in clients:
            c.pipeline_stage = data.stage
        await db.commit()
        return {"action": "update_stage", "stage": data.stage, "affected": len(clients)}

    elif data.action == "export":
        import csv
        import io as csv_io
        output = csv_io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Nome", "Email", "Empresa", "Telefone", "Status", "Pipeline", "UTM Source"])
        for c in clients:
            writer.writerow([c.client_name, c.client_email, c.client_company or "",
                           c.client_phone or "", c.data_status.value if c.data_status else "",
                           c.pipeline_stage or "", c.utm_source or ""])
        csv_content = output.getvalue()
        return StreamingResponse(
            csv_io.BytesIO(csv_content.encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="clientes_parceiro.csv"'},
        )
    else:
        raise HTTPException(status_code=400, detail="Ação inválida. Use: delete, update_stage, export")


# ═══════════════════════════════════════════════════════════
# 14. P2 — PARTNER BRANDING
# ═══════════════════════════════════════════════════════════

class BrandingUpdate(ProposalBase):
    brand_color: Optional[str] = None
    brand_secondary_color: Optional[str] = None

@router.get("/branding", summary="Buscar configurações de branding")
async def get_branding(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P2: Get partner branding settings."""
    import os
    partner = await _get_partner(db, current_user.id)
    logo_path = partner.logo_path if hasattr(partner, "logo_path") else None
    logo_url = None
    if logo_path:
        if not logo_path.startswith("/"):
            # New relative format: partner_logos/uuid.ext
            logo_url = f"{settings.APP_URL}/uploads/{logo_path}"
        else:
            # Legacy absolute path: extract relative portion safely
            try:
                uploads_abs = os.path.abspath(settings.UPLOADS_DIR)
                logo_abs = os.path.abspath(logo_path)
                rel = os.path.relpath(logo_abs, uploads_abs)
                # Guard against path traversal (e.g. ../../etc)
                if not rel.startswith(".."):
                    logo_url = f"{settings.APP_URL}/uploads/{rel}"
            except ValueError:
                logo_url = None
    return {
        "logo_url": logo_url,
        "brand_color": partner.brand_color,
        "brand_secondary_color": partner.brand_secondary_color,
        "company_name": partner.company_name,
    }


@router.put("/branding", summary="Atualizar configurações de branding")
async def update_branding(
    data: BrandingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P2: Update partner branding colors."""
    partner = await _get_partner(db, current_user.id)
    if data.brand_color is not None:
        if not data.brand_color.startswith("#") or len(data.brand_color) != 7:
            raise HTTPException(status_code=400, detail="Cor inválida. Use formato hex: #RRGGBB")
        partner.brand_color = data.brand_color
    if data.brand_secondary_color is not None:
        if not data.brand_secondary_color.startswith("#") or len(data.brand_secondary_color) != 7:
            raise HTTPException(status_code=400, detail="Cor secundária inválida.")
        partner.brand_secondary_color = data.brand_secondary_color
    await db.commit()
    return {"brand_color": partner.brand_color, "brand_secondary_color": partner.brand_secondary_color}


@router.post("/branding/logo", summary="Upload de logo do parceiro")
async def upload_partner_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P2: Upload partner logo for white-label PDF."""
    import os
    import io as _io
    partner = await _get_partner(db, current_user.id)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Apenas imagens são aceitas.")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Tamanho máximo: 2MB.")

    raw_ext = (file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "png")
    ext = raw_ext if raw_ext in ("png", "jpg", "jpeg", "gif", "webp") else "png"
    upload_dir = os.path.join(settings.UPLOADS_DIR, "partner_logos")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{partner.id}.{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # Extract dominant colors from the uploaded image
    extracted_primary: str | None = None
    extracted_secondary: str | None = None
    try:
        from PIL import Image as _PilImage
        img = _PilImage.open(_io.BytesIO(content)).convert("RGB")
        img.thumbnail((150, 150), _PilImage.LANCZOS)
        quantized = img.quantize(colors=16, method=_PilImage.Quantize.MEDIANCUT).convert("RGB")
        color_counts = quantized.getcolors(maxcolors=256)
        if color_counts:
            dominant = sorted(color_counts, key=lambda x: x[0], reverse=True)
            candidates = [
                (r, g, b) for _, (r, g, b) in dominant
                if not (r > 220 and g > 220 and b > 220)
                and not (r < 35 and g < 35 and b < 35)
            ]
            if candidates:
                extracted_primary = "#{:02x}{:02x}{:02x}".format(*candidates[0])
                extracted_secondary = "#{:02x}{:02x}{:02x}".format(*candidates[1]) if len(candidates) > 1 else extracted_primary
    except Exception:
        pass

    # Store relative path so URL construction is portable across environments
    relative_path = f"partner_logos/{filename}"
    partner.logo_path = relative_path
    if extracted_primary:
        partner.brand_color = extracted_primary
        partner.brand_secondary_color = extracted_secondary or extracted_primary
    await db.commit()

    logo_url = f"{settings.APP_URL}/uploads/{relative_path}"
    return {
        "logo_url": logo_url,
        "brand_color": partner.brand_color,
        "brand_secondary_color": partner.brand_secondary_color,
        "colors_extracted": extracted_primary is not None,
    }


@router.delete("/branding/logo", summary="Remover logo do parceiro")
async def delete_partner_logo(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """P2: Remove partner logo."""
    import os
    partner = await _get_partner(db, current_user.id)
    if partner.logo_path:
        try:
            if partner.logo_path.startswith("/"):
                full_path = partner.logo_path
            else:
                full_path = os.path.join(settings.UPLOADS_DIR, partner.logo_path)
            if os.path.exists(full_path):
                os.remove(full_path)
        except Exception:
            pass
        partner.logo_path = None
        await db.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════
# 15. U7 — NOTIFICATION PREFERENCES (partial — email dispatch is separate)
# ═══════════════════════════════════════════════════════════

from app.models.models import NotificationPreference

class NotifPrefUpdate(ProposalBase):
    email_report_ready: Optional[bool] = None
    email_partner_analysis: Optional[bool] = None
    email_payment_confirmed: Optional[bool] = None
    email_weekly_digest: Optional[bool] = None
    push_enabled: Optional[bool] = None


@router.get("/notification-preferences", summary="Buscar preferências de notificação")
async def get_notification_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """U7: Get notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        return {
            "email_report_ready": True, "email_partner_analysis": True,
            "email_payment_confirmed": True, "email_weekly_digest": False,
            "push_enabled": True,
        }
    return {
        "email_report_ready": pref.email_report_ready,
        "email_partner_analysis": pref.email_partner_analysis,
        "email_payment_confirmed": pref.email_payment_confirmed,
        "email_weekly_digest": pref.email_weekly_digest,
        "push_enabled": pref.push_enabled,
    }


@router.put("/notification-preferences", summary="Atualizar preferências de notificação")
async def update_notification_preferences(
    data: NotifPrefUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """U7: Update notification preferences."""
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        pref = NotificationPreference(user_id=current_user.id)
        db.add(pref)

    for field in ["email_report_ready", "email_partner_analysis", "email_payment_confirmed", "email_weekly_digest", "push_enabled"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(pref, field, val)

    await db.commit()
    return {"updated": True}
