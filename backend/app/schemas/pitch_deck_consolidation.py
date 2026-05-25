"""Schemas para o relatório consolidado de Pitch Decks."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel, Field, EmailStr, field_validator


class PitchDeckConsolidationCreate(BaseModel):
    invite_ids: List[uuid.UUID] = Field(..., min_length=2, max_length=10)
    title: Optional[str] = Field(None, max_length=255)
    language: str = Field("pt", max_length=8)
    include_pptx: bool = False
    email_recipients: List[EmailStr] = Field(default_factory=list, max_length=20)

    @field_validator("invite_ids")
    @classmethod
    def _unique_ids(cls, v):
        if len(set(v)) != len(v):
            raise ValueError("invite_ids contém duplicatas.")
        return v


class PitchDeckConsolidationRead(BaseModel):
    id: uuid.UUID
    title: Optional[str]
    language: str
    status: str
    invite_ids: List[uuid.UUID]
    progress_pct: int
    progress_message: Optional[str]
    has_pdf: bool
    has_pptx: bool
    error: Optional[str]
    meta_json: Optional[Any] = None
    created_at: datetime
    ready_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class GroupSuggestionRequest(BaseModel):
    """Pede sugestão de agrupamento de invites antes de criar consolidações."""
    invite_ids: List[uuid.UUID] = Field(..., min_length=2, max_length=20)


class GroupSuggestion(BaseModel):
    label: str
    rationale: str
    invite_ids: List[uuid.UUID]


class GroupSuggestionResponse(BaseModel):
    groups: List[GroupSuggestion]
    ungrouped: List[uuid.UUID] = Field(default_factory=list)
