from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.auth import (
    UserRegister, UserLogin, TokenResponse, TokenRefresh,
    PasswordResetRequest, PasswordResetConfirm,
    UserResponse, MessageResponse,
)
from app.services.auth_service import AuthService, get_current_user
from app.services.email_service import send_verification_email, send_password_reset_email
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["Autenticação"])
_bearer = HTTPBearer(auto_error=False)


@router.post("/register", response_model=MessageResponse)
async def register(data: UserRegister, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    user, token = await service.register(data)
    background_tasks.add_task(send_verification_email, user.email, user.full_name, token)
    return MessageResponse(message="Conta criada! Verifique seu e-mail para confirmar.")


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.login(data.email, data.password)


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    await service.verify_email(token)
    return MessageResponse(message="E-mail confirmado com sucesso!")


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.refresh_tokens(data.refresh_token)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    data: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    token = await service.request_password_reset(data.email)
    if token:
        # BUG #8: Lookup user name instead of passing empty string
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()
        nome = user.full_name if user and user.full_name else "Usuário"
        background_tasks.add_task(send_password_reset_email, data.email, nome, token)
    return MessageResponse(message="Se o e-mail existir, enviaremos instruções para redefinição.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(data: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    await service.reset_password(data.token, data.new_password)
    return MessageResponse(message="Senha redefinida com sucesso!")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout", response_model=MessageResponse)
async def logout(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    """Logout — blacklists the JWT token in Redis."""
    if credentials:
        payload = decode_token(credentials.credentials)
        if payload and payload.get("jti"):
            try:
                from app.core.cache import blacklist_token
                # Blacklist for remaining token lifetime (max 30 min)
                exp = payload.get("exp", 0)
                import time
                remaining = max(int(exp - time.time()), 0)
                await blacklist_token(payload["jti"], ttl=remaining or 1800)
            except Exception:
                pass  # Redis down — graceful degradation
    return MessageResponse(message="Logout realizado com sucesso.")


# ─── Profile Update ──────────────────────────────────────

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

from pydantic import BaseModel
from typing import Optional


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Atualiza perfil do usuário logado."""
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.phone is not None:
        current_user.phone = data.phone
    if data.company_name is not None:
        current_user.company_name = data.company_name
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/change-password", response_model=MessageResponse)
async def change_password(
    data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Altera a senha do usuário logado."""
    from app.core.security import verify_password, hash_password
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Nova senha deve ter no mínimo 8 caracteres.")
    if not any(c.isupper() for c in data.new_password):
        raise HTTPException(status_code=400, detail="Nova senha deve conter ao menos uma letra maiúscula.")
    if not any(c.isdigit() for c in data.new_password):
        raise HTTPException(status_code=400, detail="Nova senha deve conter ao menos um número.")
    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return MessageResponse(message="Senha alterada com sucesso.")


# ─── LGPD Endpoints ──────────────────────────────────────

@router.get("/export-data")
async def export_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """LGPD: Exporta todos os dados do usuário em JSON."""
    from sqlalchemy import select as sel
    from app.models.models import Analysis, Payment
    import json

    analyses = (await db.execute(
        sel(Analysis).where(Analysis.user_id == current_user.id)
    )).scalars().all()

    payments = (await db.execute(
        sel(Payment).where(Payment.user_id == current_user.id)
    )).scalars().all()

    data = {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "cpf_cnpj": current_user.cpf_cnpj,
            "phone": current_user.phone,
            "company_name": current_user.company_name,
            "created_at": str(current_user.created_at),
        },
        "analyses": [
            {
                "id": str(a.id),
                "company_name": a.company_name,
                "sector": a.sector,
                "equity_value": float(a.equity_value) if a.equity_value else None,
                "status": a.status.value,
                "created_at": str(a.created_at),
            }
            for a in analyses
        ],
        "payments": [
            {
                "id": str(p.id),
                "plan": p.plan.value,
                "amount": float(p.amount),
                "status": p.status.value,
                "created_at": str(p.created_at),
            }
            for p in payments
        ],
    }

    from fastapi.responses import JSONResponse
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": "attachment; filename=meus-dados-quantovale.json"},
    )


@router.delete("/me", response_model=MessageResponse)
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """LGPD: Exclui permanentemente a conta e todos os dados do usuário."""
    await db.delete(current_user)
    await db.commit()
    return MessageResponse(message="Conta e todos os dados excluídos permanentemente.")


# ─── Resend Verification Email ────────────────────────────

class ResendVerification(BaseModel):
    email: str

from fastapi import HTTPException

@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    data: ResendVerification,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Reenvia e-mail de verificação para um usuário não verificado."""
    from sqlalchemy import select as sel
    result = await db.execute(sel(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user:
        # Don't reveal that user doesn't exist
        return MessageResponse(message="Se o e-mail existir e não estiver verificado, enviaremos um novo link.")

    if user.is_verified:
        return MessageResponse(message="Este e-mail já está verificado.")

    from app.core.security import create_email_token
    from app.models.models import EmailVerification
    from datetime import datetime, timedelta, timezone

    token = create_email_token(user.email, purpose="verify")
    ev = EmailVerification(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(ev)
    await db.commit()

    background_tasks.add_task(send_verification_email, user.email, user.full_name, token)
    return MessageResponse(message="Se o e-mail existir e não estiver verificado, enviaremos um novo link.")
