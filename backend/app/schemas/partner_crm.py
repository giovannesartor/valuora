"""
Partner CRM schemas — Notes, Tasks, Comments, Guided Consultation, Health, Follow-ups.
"""
from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


# ─── Notes ────────────────────────────────────────────────
class NoteCreate(BaseModel):
    content: str
    note_type: str = "general"  # general | call | meeting | follow_up


class NoteResponse(BaseModel):
    id: UUID
    client_id: UUID
    content: str
    note_type: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Tasks ────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    is_completed: Optional[bool] = None


class TaskResponse(BaseModel):
    id: UUID
    client_id: UUID
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    is_completed: bool
    completed_at: Optional[datetime] = None
    created_at: datetime
    client_name: Optional[str] = None  # populated via JOIN for dashboard widget

    class Config:
        from_attributes = True


# ─── Comments on Analysis ─────────────────────────────────
class CommentCreate(BaseModel):
    content: str
    section: str = "general"  # general | equity_value | ebitda_margin | risk | growth


class CommentResponse(BaseModel):
    id: UUID
    analysis_id: UUID
    content: str
    section: str = "general"
    partner_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Guided Consultation ─────────────────────────────────
class GuidedSessionUpdate(BaseModel):
    responses: dict
    current_step: int = 0
    is_completed: bool = False


class GuidedSessionResponse(BaseModel):
    id: UUID
    client_id: UUID
    responses: dict
    current_step: int
    is_completed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Client Health ────────────────────────────────────────
class FieldStatus(BaseModel):
    field: str
    label: str
    filled: bool
    value: Optional[Any] = None


class ConsistencyAlert(BaseModel):
    field: str
    message: str
    severity: str  # warning | error


class ImprovementSuggestion(BaseModel):
    area: str
    message: str
    impact: str  # high | medium | low


class ClientHealthResponse(BaseModel):
    fill_percentage: float
    fields: List[FieldStatus]
    alerts: List[ConsistencyAlert]
    suggestions: List[ImprovementSuggestion]
    stage: str  # registered | filling | analysis_complete | report_sent


# ─── Action Templates ────────────────────────────────────
class ActionTemplate(BaseModel):
    id: str
    title: str
    description: str
    category: str  # growth | risk | optimization | opportunity
    priority: str  # high | medium | low
    icon: str  # frontend icon name


class ActionTemplatesResponse(BaseModel):
    templates: List[ActionTemplate]
    valuation_summary: Optional[dict] = None


# ─── Follow-up Logs ──────────────────────────────────────
class FollowUpLogResponse(BaseModel):
    id: UUID
    client_id: UUID
    client_name: Optional[str] = None
    trigger_type: str
    message: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True


# ─── Follow-Up Rules ─────────────────────────────────────
class FollowUpRuleCreate(BaseModel):
    trigger: str  # no_register, no_data, no_meeting, no_purchase, post_report
    days_delay: int = 3
    message_template: Optional[str] = None
    is_active: bool = True


class FollowUpRuleUpdate(BaseModel):
    days_delay: Optional[int] = None
    message_template: Optional[str] = None
    is_active: Optional[bool] = None


class FollowUpRuleResponse(BaseModel):
    id: UUID
    trigger: str
    days_delay: int
    message_template: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Proposal Templates ──────────────────────────────────
class ProposalTemplateCreate(BaseModel):
    name: str
    content: str
    category: str = "general"


class ProposalTemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None


class ProposalTemplateResponse(BaseModel):
    id: UUID
    name: str
    content: str
    category: str
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Notification Preferences ────────────────────────────
class NotificationPreferencesUpdate(BaseModel):
    email_analysis_done: Optional[bool] = None
    email_payment_confirmation: Optional[bool] = None
    email_report_ready: Optional[bool] = None
    email_pitch_deck_done: Optional[bool] = None
    email_marketing: Optional[bool] = None
    email_partner_updates: Optional[bool] = None


class NotificationPreferencesResponse(BaseModel):
    email_analysis_done: bool = True
    email_payment_confirmation: bool = True
    email_report_ready: bool = True
    email_pitch_deck_done: bool = True
    email_marketing: bool = True
    email_partner_updates: bool = True

    class Config:
        from_attributes = True


# ─── Partner Brand Colors ────────────────────────────────
class PartnerBrandUpdate(BaseModel):
    brand_color: Optional[str] = None  # hex color e.g. #10B981
    brand_secondary_color: Optional[str] = None


# ─── Pipeline Stage ──────────────────────────────────────
class PipelineStageUpdate(BaseModel):
    pipeline_stage: str  # lead | contacted | data_sent | analysis | closed | delivered
