from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    create_email_token, decode_token,
)
from app.models.models import User, EmailVerification, PasswordReset
from app.schemas.auth import UserRegister, TokenResponse

security_scheme = HTTPBearer()


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: UserRegister) -> User:
        # Check if user exists
        result = await self.db.execute(select(User).where(User.email == data.email))
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            phone=data.phone,
            company_name=data.company_name,
            is_verified=False,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        # Create email verification token
        token = create_email_token(data.email, purpose="verify")
        verification = EmailVerification(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        self.db.add(verification)
        await self.db.commit()

        return user, token

    async def login(self, email: str, password: str) -> TokenResponse:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Credenciais inválidas.")

        if not user.is_verified:
            raise HTTPException(status_code=403, detail="E-mail não confirmado. Verifique sua caixa de entrada.")

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Conta desativada.")

        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token = create_refresh_token(data={"sub": str(user.id)})

        return TokenResponse(access_token=access_token, refresh_token=refresh_token)

    async def verify_email(self, token: str) -> bool:
        payload = decode_token(token)
        if not payload or payload.get("purpose") != "verify":
            raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

        email = payload.get("sub")
        result = await self.db.execute(
            select(EmailVerification).where(
                EmailVerification.token == token,
                EmailVerification.is_used == False,
            )
        )
        verification = result.scalar_one_or_none()
        if not verification:
            raise HTTPException(status_code=400, detail="Token já utilizado ou inválido.")

        # Mark verification as used
        verification.is_used = True

        # Activate user
        user_result = await self.db.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        if user:
            user.is_verified = True

        await self.db.commit()
        return True

    async def request_password_reset(self, email: str) -> Optional[str]:
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            # Don't reveal if user exists
            return None

        token = create_email_token(email, purpose="reset", expires_hours=2)
        reset = PasswordReset(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
        )
        self.db.add(reset)
        await self.db.commit()
        return token

    async def reset_password(self, token: str, new_password: str) -> bool:
        payload = decode_token(token)
        if not payload or payload.get("purpose") != "reset":
            raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

        email = payload.get("sub")
        result = await self.db.execute(
            select(PasswordReset).where(
                PasswordReset.token == token,
                PasswordReset.is_used == False,
            )
        )
        reset = result.scalar_one_or_none()
        if not reset:
            raise HTTPException(status_code=400, detail="Token já utilizado ou inválido.")

        reset.is_used = True

        user_result = await self.db.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        if user:
            user.hashed_password = hash_password(new_password)

        await self.db.commit()
        return True

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Refresh token inválido.")

        user_id = payload.get("sub")
        result = await self.db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Usuário não encontrado.")

        new_access = create_access_token(data={"sub": str(user.id)})
        new_refresh = create_refresh_token(data={"sub": str(user.id)})

        return TokenResponse(access_token=new_access, refresh_token=new_refresh)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")

    return user
