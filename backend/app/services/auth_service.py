from datetime import datetime, timedelta, timezone
import os
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
from app.models.models import User, EmailVerification, PasswordReset, Partner, PartnerStatus
from app.schemas.auth import UserRegister, TokenResponse

security_scheme = HTTPBearer()


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: UserRegister) -> User:
        # Password strength validation
        if len(data.password) < 8:
            raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 8 caracteres.")
        if not any(c.isupper() for c in data.password):
            raise HTTPException(status_code=400, detail="A senha deve conter ao menos uma letra maiúscula.")
        if not any(c.isdigit() for c in data.password):
            raise HTTPException(status_code=400, detail="A senha deve conter ao menos um número.")

        # Check if user exists
        result = await self.db.execute(select(User).where(User.email == data.email))
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

        # Resolve referral code → partner
        referred_by_partner_id = None
        if getattr(data, 'referral_code', None):
            partner_result = await self.db.execute(
                select(Partner).where(
                    Partner.referral_code == data.referral_code,
                    Partner.status == PartnerStatus.ACTIVE,
                )
            )
            ref_partner = partner_result.scalar_one_or_none()
            if ref_partner:
                referred_by_partner_id = ref_partner.id

        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            cpf_cnpj=data.cpf_cnpj,
            phone=data.phone,
            company_name=data.company_name,
            is_verified=False,
            partner_id=referred_by_partner_id,  # track which partner referred this user
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

        # Admins skip email verification
        if not user.is_verified and not user.is_admin:
            raise HTTPException(status_code=403, detail="E-mail não confirmado. Verifique sua caixa de entrada.")

        if not user.is_active:
            raise HTTPException(status_code=403, detail="Conta desativada.")

        # Check if user is a partner
        partner_result = await self.db.execute(select(Partner).where(Partner.user_id == user.id))
        is_partner = partner_result.scalar_one_or_none() is not None

        access_token = create_access_token(data={"sub": str(user.id), "admin": user.is_admin, "superadmin": user.is_superadmin, "partner": is_partner})
        refresh_token = create_refresh_token(data={"sub": str(user.id), "admin": user.is_admin, "superadmin": user.is_superadmin, "partner": is_partner})

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            is_admin=user.is_admin,
            is_superadmin=user.is_superadmin,
        )

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

        # Check expiration (Improvement V)
        if verification.expires_at and verification.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Token expirado. Solicite um novo.")

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
        # Validação de senha (mesmas regras do cadastro)
        if len(new_password) < 8:
            raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 8 caracteres.")
        if not any(c.isupper() for c in new_password):
            raise HTTPException(status_code=400, detail="A senha deve conter ao menos uma letra maiúscula.")
        if not any(c.isdigit() for c in new_password):
            raise HTTPException(status_code=400, detail="A senha deve conter ao menos um número.")

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

        # Improvement V: Check expiration from DB record
        if reset.expires_at and reset.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Token expirado. Solicite uma nova redefinição.")

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

        # Check if user is a partner
        partner_result = await self.db.execute(select(Partner).where(Partner.user_id == user.id))
        is_partner = partner_result.scalar_one_or_none() is not None

        new_access = create_access_token(data={"sub": str(user.id), "admin": user.is_admin, "superadmin": user.is_superadmin, "partner": is_partner})
        new_refresh = create_refresh_token(data={"sub": str(user.id), "admin": user.is_admin, "superadmin": user.is_superadmin, "partner": is_partner})

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
            is_admin=user.is_admin,
            is_superadmin=user.is_superadmin,
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")

    # Check JWT blacklist
    jti = payload.get("jti")
    if jti:
        from app.core.cache import is_token_blacklisted
        try:
            if await is_token_blacklisted(jti):
                raise HTTPException(status_code=401, detail="Token revogado. Faça login novamente.")
        except HTTPException:
            raise
        except Exception:
            pass  # Redis down — allow request (graceful degradation)

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")

    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency that requires admin privileges."""
    if not current_user.is_admin and not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    return current_user


async def seed_admin_user():
    """Create admin user on startup if it doesn't exist."""
    from app.core.database import async_session_maker
    from app.core.config import settings

    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        print("[ADMIN] ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed.")
        return

    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
        admin = result.scalar_one_or_none()

        if not admin:
            admin = User(
                email=settings.ADMIN_EMAIL,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                full_name=settings.ADMIN_NAME,
                is_active=True,
                is_verified=True,
                is_admin=True,
                is_superadmin=True,
            )
            db.add(admin)
            await db.commit()
            print(f"[ADMIN] Superadmin criado: {settings.ADMIN_EMAIL}")
        else:
            # Ensure admin privileges
            if not admin.is_superadmin:
                admin.is_admin = True
                admin.is_superadmin = True
                admin.is_verified = True
                await db.commit()
                print(f"[ADMIN] Privilégios atualizados: {settings.ADMIN_EMAIL}")


async def seed_test_partner():
    """Create a test partner user on startup for testing."""
    from app.core.database import async_session_maker

    TEST_EMAIL = os.environ.get("TEST_PARTNER_EMAIL", "teste@quantovale.online")
    TEST_PASSWORD = os.environ.get("TEST_PARTNER_PASSWORD", "TestPartner!2026")
    TEST_NAME = "Parceiro Teste"
    TEST_REFERRAL = "QV-TESTE"

    async with async_session_maker() as db:
        result = await db.execute(select(User).where(User.email == TEST_EMAIL))
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                email=TEST_EMAIL,
                hashed_password=hash_password(TEST_PASSWORD),
                full_name=TEST_NAME,
                company_name="Teste Consultoria",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()

            partner = Partner(
                user_id=user.id,
                company_name="Teste Consultoria",
                referral_code=TEST_REFERRAL,
                referral_link=f"https://quantovale.online/cadastro?ref={TEST_REFERRAL}",
                commission_rate=0.50,
                status=PartnerStatus.ACTIVE,
            )
            db.add(partner)
            await db.commit()
            print(f"[SEED] Parceiro teste criado: {TEST_EMAIL}")
        else:
            # Ensure partner profile exists
            pr = await db.execute(select(Partner).where(Partner.user_id == user.id))
            if not pr.scalar_one_or_none():
                partner = Partner(
                    user_id=user.id,
                    company_name="Teste Consultoria",
                    referral_code=TEST_REFERRAL,
                    referral_link=f"https://quantovale.online/cadastro?ref={TEST_REFERRAL}",
                    commission_rate=0.50,
                    status=PartnerStatus.ACTIVE,
                )
                db.add(partner)
                await db.commit()
                print(f"[SEED] Partner profile criado para: {TEST_EMAIL}")
            # Ensure verified
            if not user.is_verified:
                user.is_verified = True
                await db.commit()
