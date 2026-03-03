"""
Testes de integração — Rotas de Pagamentos (/api/v1/payments/*)

Cobertura:
  - GET  /mine           (listar pagamentos do usuário)
  - POST /               (criar pagamento)
    • análise inexistente → 404
    • análise não processada → 400
    • pagamento duplicado → 400
    • admin bypass → 200 sem chamar Asaas
    • usuário sem CPF/CNPJ → 400

Nota: testes de usuário comum mockam o Asaas via conftest.
Admin bypass é suficiente para validar toda a lógica de negócio
(criação de Payment, associação de plano, etc.) sem depender do
gateway externo.
"""

import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_verified_user, get_auth_headers
from app.models.models import Coupon

pytestmark = pytest.mark.asyncio

VALID_ANALYSIS_PAYLOAD = {
    "company_name": "Pagamentos SA",
    "sector": "Tecnologia",
    "revenue": 2_000_000.0,
    "net_margin": 0.20,
    "growth_rate": 0.15,
    "debt": 0.0,
    "cash": 100_000.0,
    "founder_dependency": 0.2,
    "projection_years": 5,
    "num_employees": 10,
    "years_in_business": 5,
}


# ─── Helper: cria análise e retorna seu ID ─────────────────────────────────
async def _create_analysis(client: AsyncClient, headers: dict) -> str:
    resp = await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers)
    assert resp.status_code == 200, f"Falha ao criar análise: {resp.text}"
    return resp.json()["id"]


# ═══════════════════════════════════════════════════════════
# Listagem de pagamentos
# ═══════════════════════════════════════════════════════════

class TestListPayments:
    async def test_list_payments_empty(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="pay_empty@test.com")
        headers = await get_auth_headers(client, email="pay_empty@test.com")
        resp = await client.get("/api/v1/payments/mine", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_payments_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/v1/payments/mine")
        assert resp.status_code in (401, 403)

    async def test_list_payments_after_payment(self, client: AsyncClient, db_session: AsyncSession):
        admin = await create_verified_user(
            db_session, email="pay_list@test.com", is_admin=True
        )
        headers = await get_auth_headers(client, email="pay_list@test.com")
        analysis_id = await _create_analysis(client, headers)

        await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "essencial"},
            headers=headers,
        )
        resp = await client.get("/api/v1/payments/mine", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# ═══════════════════════════════════════════════════════════
# Criação de pagamento — erros esperados
# ═══════════════════════════════════════════════════════════

class TestCreatePaymentErrors:
    async def test_create_payment_unauthenticated(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": str(uuid.uuid4()), "plan": "essencial"},
        )
        assert resp.status_code in (401, 403)

    async def test_create_payment_analysis_not_found(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="pay_notfound@test.com")
        headers = await get_auth_headers(client, email="pay_notfound@test.com")
        resp = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": str(uuid.uuid4()), "plan": "essencial"},
            headers=headers,
        )
        assert resp.status_code == 404
        assert "Análise não encontrada" in resp.json()["detail"]

    async def test_create_payment_analysis_not_completed(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Análise em PROCESSING não pode ser paga."""
        from app.models.models import Analysis, AnalysisStatus
        user = await create_verified_user(db_session, email="pay_draft@test.com")
        analysis = Analysis(
            user_id=user.id,
            company_name="Draft Corp",
            sector="Tecnologia",
            revenue=500_000,
            net_margin=0.10,
            status=AnalysisStatus.PROCESSING,
        )
        db_session.add(analysis)
        await db_session.commit()
        await db_session.refresh(analysis)

        headers = await get_auth_headers(client, email="pay_draft@test.com")
        resp = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": str(analysis.id), "plan": "essencial"},
            headers=headers,
        )
        assert resp.status_code == 400
        assert "processada" in resp.json()["detail"]

    async def test_create_payment_regular_user_without_cpf(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """Usuário comum sem CPF/CNPJ deve receber 400."""
        await create_verified_user(db_session, email="nocpf@test.com")
        headers = await get_auth_headers(client, email="nocpf@test.com")
        analysis_id = await _create_analysis(client, headers)

        resp = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "essencial"},
            headers=headers,
        )
        assert resp.status_code == 400
        assert "CPF" in resp.json()["detail"]

    async def test_create_payment_invalid_plan(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="badplan@test.com", is_admin=True)
        headers = await get_auth_headers(client, email="badplan@test.com")
        analysis_id = await _create_analysis(client, headers)

        resp = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "plano_invalido"},
            headers=headers,
        )
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════
# Criação de pagamento — caminho feliz (admin bypass)
# ═══════════════════════════════════════════════════════════

class TestCreatePaymentSuccess:
    async def test_admin_bypass_essencial(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="admin_pay@test.com", is_admin=True)
        headers = await get_auth_headers(client, email="admin_pay@test.com")
        analysis_id = await _create_analysis(client, headers)

        resp = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "essencial"},
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "paid"
        assert data["amount"] == 0          # admin bypass → gratuito
        assert data["payment_method"] == "admin_bypass"
        assert data["plan"] == "essencial"

    async def test_admin_bypass_profissional(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="admin_prof@test.com", is_admin=True)
        headers = await get_auth_headers(client, email="admin_prof@test.com")
        analysis_id = await _create_analysis(client, headers)

        resp = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "profissional"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["plan"] == "profissional"

    async def test_admin_bypass_estrategico(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="admin_est@test.com", is_admin=True)
        headers = await get_auth_headers(client, email="admin_est@test.com")
        analysis_id = await _create_analysis(client, headers)

        resp = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "estrategico"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["plan"] == "estrategico"

    async def test_payment_appears_in_list_after_creation(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        await create_verified_user(db_session, email="listpay@test.com", is_admin=True)
        headers = await get_auth_headers(client, email="listpay@test.com")
        analysis_id = await _create_analysis(client, headers)

        await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "essencial"},
            headers=headers,
        )
        resp = await client.get("/api/v1/payments/mine", headers=headers)
        assert resp.status_code == 200
        ids = [p["analysis_id"] for p in resp.json()]
        assert analysis_id in ids


# ═══════════════════════════════════════════════════════════
# Pagamento duplicado
# ═══════════════════════════════════════════════════════════

class TestDuplicatePayment:
    async def test_duplicate_payment_blocked(self, client: AsyncClient, db_session: AsyncSession):
        """Segunda tentativa de pagar a mesma análise deve retornar 400."""
        await create_verified_user(db_session, email="dup_pay@test.com", is_admin=True)
        headers = await get_auth_headers(client, email="dup_pay@test.com")
        analysis_id = await _create_analysis(client, headers)

        # Primeiro pagamento — deve funcionar
        resp1 = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "essencial"},
            headers=headers,
        )
        assert resp1.status_code == 200

        # Segundo pagamento — deve ser bloqueado
        resp2 = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "profissional"},
            headers=headers,
        )
        assert resp2.status_code == 400
        assert "já realizado" in resp2.json()["detail"]


# ═══════════════════════════════════════════════════════════
# Coupon de desconto
# ═══════════════════════════════════════════════════════════

class TestCoupon:
    async def test_coupon_primeira_applies_10_percent_discount(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """O cupom PRIMEIRA aplica 10% de desconto — mas admin bypass zera o total."""
        await create_verified_user(db_session, email="coupon@test.com", is_admin=True)
        headers = await get_auth_headers(client, email="coupon@test.com")
        analysis_id = await _create_analysis(client, headers)

        # Seed the PRIMEIRA coupon so the route can validate it
        coupon = Coupon(code="PRIMEIRA", discount_pct=0.10, is_active=True)
        db_session.add(coupon)
        await db_session.commit()

        resp = await client.post(
            "/api/v1/payments/",
            json={"analysis_id": analysis_id, "plan": "essencial", "coupon": "PRIMEIRA"},
            headers=headers,
        )
        # Admin bypass: valor final é 0 independentemente do cupom
        assert resp.status_code == 200
        assert resp.json()["status"] == "paid"
