from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime


# ─── Auth Schemas ─────────────────────────────────────────
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    cpf_cnpj: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    referral_code: Optional[str] = None  # ?ref=QV-XXXX from partner link
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_admin: bool = False
    is_superadmin: bool = False


class TokenRefresh(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    cpf_cnpj: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_admin: bool = False
    is_superadmin: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
