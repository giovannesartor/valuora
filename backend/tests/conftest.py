"""
conftest.py — Fixtures compartilhadas para testes de integração.

• SQLite em memória (aiosqlite) — sem dependência de PostgreSQL.
• Todos os serviços externos (Redis, e-mail, Asaas, Selic, IBGE) são mockados.
• Cada teste recebe uma sessão de banco com rollback automático ao final.
"""

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.pool import StaticPool

# ---------------------------------------------------------------------------
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


# ─── Engine único na sessão de testes ──────────────────────────────────────
@pytest_asyncio.fixture(scope="session")
async def engine():
    """Cria o schema SQLite uma única vez por sessão de testes."""
    import app.models.models   # noqa — registra todos os ORM models
    import app.models.cnae     # noqa
    from app.core.database import Base

    eng = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


# ─── Sessão isolada por teste ───────────────────────────────────────────────
@pytest_asyncio.fixture
async def db_session(engine):
    """Sessão de banco revertida (rollback) ao término de cada teste."""
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


# ─── Mock Redis ─────────────────────────────────────────────────────────────
def _make_redis_mock() -> AsyncMock:
    """AsyncMock que imita um cliente Redis; get sempre retorna cache miss."""
    m = AsyncMock()
    m.get.return_value = None
    m.set.return_value = True
    m.delete.return_value = 1
    m.keys.return_value = []
    m.scan.return_value = (0, [])
    return m


# ─── Mock do resultado do motor de valuation ────────────────────────────────
MOCK_VALUATION_RESULT = {
    "equity_value": 5_000_000.0,
    "enterprise_value": 5_200_000.0,
    "risk_score": 42.0,
    "maturity_index": 0.65,
    "percentile": 55.0,
    "wacc": 0.18,
    "fcf_projections": [],
    "terminal_value": 4_000_000.0,
    "warnings": [],
    "dcf_value": 4_800_000.0,
    "multiples_value": 5_500_000.0,
    "sensitivity": {},
    "methodology_weights": {"dcf": 0.6, "multiples": 0.4},
}


# ─── Cliente HTTP com todas as dependências externas mockadas ───────────────
@pytest_asyncio.fixture
async def client(db_session):
    """
    AsyncClient com:
    - banco SQLite injetado via dependency_overrides
    - lifespan do FastAPI completamente mockado
    - Redis, e-mail, Asaas, Selic e motor de valuation mockados
    """
    from app.core.database import get_db
    from app.main import app

    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    redis_mock = _make_redis_mock()

    with (
        patch("app.core.database.init_db", new_callable=AsyncMock),
        patch("app.services.auth_service.seed_admin_user", new_callable=AsyncMock),
        patch("app.services.auth_service.seed_test_partner", new_callable=AsyncMock),
        patch(
            "app.core.valuation_engine.engine.fetch_selic_rate",
            new_callable=AsyncMock,
            return_value=0.1075,
        ),
        patch("app.tasks.benchmark_updater.setup_scheduler", return_value=None),
        patch("app.core.redis.redis_client", redis_mock),
        patch("app.core.cache.redis_client", redis_mock),
        # E-mail (background tasks)
        patch("app.routes.auth.send_verification_email", new_callable=AsyncMock),
        patch("app.routes.auth.send_password_reset_email", new_callable=AsyncMock),
        patch("app.routes.payments.send_payment_confirmation_email", new_callable=AsyncMock),
        patch("app.routes.payments.send_report_ready_email", new_callable=AsyncMock),
        patch("app.routes.payments._generate_and_send_report", new_callable=AsyncMock),
        patch(
            "app.routes.analysis.get_dcf_sector_adjustment",
            new_callable=AsyncMock,
            side_effect=Exception("mocked — use static fallback"),
        ),
        patch(
            "app.routes.analysis.estimate_sector_data_with_ai",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.routes.analysis.generate_strategic_analysis",
            new_callable=AsyncMock,
            return_value="Análise estratégica mockada.",
        ),
        patch(
            "app.routes.analysis.run_valuation",
            return_value=MOCK_VALUATION_RESULT,
        ),
        patch(
            "app.routes.analysis.run_valuation_with_ibge",
            return_value=MOCK_VALUATION_RESULT,
        ),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

    app.dependency_overrides.clear()


# ─── Helpers reutilizáveis ──────────────────────────────────────────────────
async def create_verified_user(
    db_session: AsyncSession,
    email: str = "user@test.com",
    password: str = "Senha123",
    is_admin: bool = False,
) -> "User":  # type: ignore[name-defined]
    """Insere um usuário já verificado diretamente no banco de teste."""
    from app.core.security import hash_password
    from app.models.models import User

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name="User Teste",
        is_verified=True,
        is_active=True,
        is_admin=is_admin,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def get_auth_headers(
    client: AsyncClient,
    email: str = "user@test.com",
    password: str = "Senha123",
) -> dict:
    """Faz login e retorna headers com Bearer token prontos para uso."""
    resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    token = resp.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}
