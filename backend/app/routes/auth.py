from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.auth import (
    UserRegister, UserLogin, TokenResponse, TokenRefresh,
    PasswordResetRequest, PasswordResetConfirm,
    UserResponse, MessageResponse,
)
from app.services.auth_service import AuthService, get_current_user
from app.services.email_service import send_verification_email, send_password_reset_email
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["Autenticação"])


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
async def logout():
    # JWT is stateless — client removes token
    return MessageResponse(message="Logout realizado com sucesso.")
