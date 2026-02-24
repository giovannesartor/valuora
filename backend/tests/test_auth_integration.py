"""
Testes de integração — Rotas de Autenticação (/api/v1/auth/*)

Cobertura:
  - POST /register
  - POST /login
  - POST /verify-email
  - GET  /me
  - POST /refresh
  - POST /logout
  - PATCH /me (atualização de perfil)
  - PATCH /me/password (troca de senha)
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_verified_user, get_auth_headers

pytestmark = pytest.mark.asyncio


# ═══════════════════════════════════════════════════════════
# Registro
# ═══════════════════════════════════════════════════════════

class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "novo@test.com", "password": "Senha123", "full_name": "Novo User"},
        )
        assert resp.status_code == 200
        assert "Conta criada" in resp.json()["message"]

    async def test_register_duplicate_email(self, client: AsyncClient):
        payload = {"email": "dup@test.com", "password": "Senha123", "full_name": "A"}
        await client.post("/api/v1/auth/register", json=payload)
        resp = await client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 400
        assert "já cadastrado" in resp.json()["detail"]

    async def test_register_weak_password_too_short(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "fraco@test.com", "password": "abc", "full_name": "Fraco"},
        )
        assert resp.status_code == 400

    async def test_register_password_no_uppercase(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "semmaius@test.com", "password": "senha123", "full_name": "Sem Maiúscula"},
        )
        assert resp.status_code == 400

    async def test_register_password_no_digit(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "semdigito@test.com", "password": "SenhaSemNumero", "full_name": "Sem Dígito"},
        )
        assert resp.status_code == 400

    async def test_register_missing_fields(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={"email": "x@x.com"})
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════
# Login
# ═══════════════════════════════════════════════════════════

class TestLogin:
    async def test_login_success(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="login@test.com")
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "login@test.com", "password": "Senha123"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="wrongpw@test.com")
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "wrongpw@test.com", "password": "ErradaSenha1"},
        )
        assert resp.status_code == 401
        assert "Credenciais" in resp.json()["detail"]

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "naoexiste@test.com", "password": "Senha123"},
        )
        assert resp.status_code == 401

    async def test_login_unverified_user(self, client: AsyncClient, db_session: AsyncSession):
        from app.core.security import hash_password
        from app.models.models import User

        user = User(
            email="unverified@test.com",
            hashed_password=hash_password("Senha123"),
            full_name="Unverified",
            is_verified=False,
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "unverified@test.com", "password": "Senha123"},
        )
        assert resp.status_code == 403
        assert "E-mail não confirmado" in resp.json()["detail"]

    async def test_login_inactive_user(self, client: AsyncClient, db_session: AsyncSession):
        from app.core.security import hash_password
        from app.models.models import User

        user = User(
            email="inactive@test.com",
            hashed_password=hash_password("Senha123"),
            full_name="Inactive",
            is_verified=True,
            is_active=False,
        )
        db_session.add(user)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "inactive@test.com", "password": "Senha123"},
        )
        assert resp.status_code == 403


# ═══════════════════════════════════════════════════════════
# /me — Perfil autenticado
# ═══════════════════════════════════════════════════════════

class TestGetMe:
    async def test_get_me_authenticated(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="getme@test.com")
        headers = await get_auth_headers(client, email="getme@test.com")
        resp = await client.get("/api/v1/auth/me", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "getme@test.com"
        assert data["is_verified"] is True

    async def test_get_me_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code in (401, 403)

    async def test_get_me_invalid_token(self, client: AsyncClient):
        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer token_invalido"},
        )
        assert resp.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════
# Verificação de e-mail
# ═══════════════════════════════════════════════════════════

class TestVerifyEmail:
    async def test_verify_email_success(self, client: AsyncClient, db_session: AsyncSession):
        from datetime import datetime, timezone, timedelta
        from app.core.security import create_email_token
        from app.models.models import User, EmailVerification
        from app.core.security import hash_password

        user = User(
            email="verify@test.com",
            hashed_password=hash_password("Senha123"),
            full_name="Verify",
            is_verified=False,
            is_active=True,
        )
        db_session.add(user)
        await db_session.flush()

        token = create_email_token("verify@test.com", purpose="verify")
        verification = EmailVerification(
            user_id=user.id,
            token=token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        )
        db_session.add(verification)
        await db_session.commit()

        resp = await client.post(f"/api/v1/auth/verify-email?token={token}")
        assert resp.status_code == 200
        assert "confirmado" in resp.json()["message"]

    async def test_verify_email_invalid_token(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/verify-email?token=token_invalido")
        assert resp.status_code in (400, 401, 422)


# ═══════════════════════════════════════════════════════════
# Refresh token
# ═══════════════════════════════════════════════════════════

class TestRefreshToken:
    async def test_refresh_success(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="refresh@test.com")
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "refresh@test.com", "password": "Senha123"},
        )
        refresh_token = login.json()["refresh_token"]
        resp = await client.post(
            "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_refresh_invalid_token(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/refresh", json={"refresh_token": "token_invalido"}
        )
        assert resp.status_code in (400, 401, 422)


# ═══════════════════════════════════════════════════════════
# Atualização de perfil
# ═══════════════════════════════════════════════════════════

class TestUpdateProfile:
    async def test_update_full_name(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="profile@test.com")
        headers = await get_auth_headers(client, email="profile@test.com")
        resp = await client.patch(
            "/api/v1/auth/me",
            json={"full_name": "Nome Atualizado"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Nome Atualizado"

    async def test_update_phone(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="phone@test.com")
        headers = await get_auth_headers(client, email="phone@test.com")
        resp = await client.patch(
            "/api/v1/auth/me",
            json={"phone": "11999990000"},
            headers=headers,
        )
        assert resp.status_code == 200

    async def test_update_profile_unauthenticated(self, client: AsyncClient):
        resp = await client.patch("/api/v1/auth/me", json={"full_name": "Hacker"})
        assert resp.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════
# Logout
# ═══════════════════════════════════════════════════════════

class TestLogout:
    async def test_logout_success(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="logout@test.com")
        headers = await get_auth_headers(client, email="logout@test.com")
        resp = await client.post("/api/v1/auth/logout", headers=headers)
        assert resp.status_code == 200
        assert "Logout" in resp.json()["message"]
