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


class CommentResponse(BaseModel):
    id: UUID
    analysis_id: UUID
    content: str
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
