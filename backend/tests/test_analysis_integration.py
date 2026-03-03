"""
Testes de integração — Rotas de Análises (/api/v1/analyses/*)

Cobertura:
  - POST /          (criação com motor de valuation mockado)
  - GET  /          (listagem paginada)
  - GET  /{id}      (busca por ID)
  - DELETE /{id}    (soft-delete / lixeira)
  - GET  /trash     (listar análises na lixeira)
  - GET  /sectors/list
  - GET  /kpis/summary
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import create_verified_user, get_auth_headers

pytestmark = pytest.mark.asyncio

# Payload mínimo válido para criar uma análise
VALID_ANALYSIS_PAYLOAD = {
    "company_name": "Empresa Teste Ltda",
    "sector": "Tecnologia",
    "revenue": 1_000_000.0,
    "net_margin": 0.15,
    "growth_rate": 0.20,
    "debt": 50_000.0,
    "cash": 80_000.0,
    "founder_dependency": 0.3,
    "projection_years": 5,
    "num_employees": 15,
    "years_in_business": 4,
}


# ═══════════════════════════════════════════════════════════
# Criação de análise
# ═══════════════════════════════════════════════════════════

class TestCreateAnalysis:
    async def test_create_analysis_unauthenticated(self, client: AsyncClient):
        resp = await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD)
        assert resp.status_code in (401, 403)

    async def test_create_analysis_success(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="create@test.com")
        headers = await get_auth_headers(client, email="create@test.com")
        resp = await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["company_name"] == "Empresa Teste Ltda"
        assert data["status"] == "completed"
        assert data["equity_value"] == 5_000_000.0
        assert "id" in data

    async def test_create_analysis_returns_uuid(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="uuid@test.com")
        headers = await get_auth_headers(client, email="uuid@test.com")
        resp = await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers)
        assert resp.status_code == 200
        import uuid
        uuid.UUID(resp.json()["id"])  # valida formato UUID

    async def test_create_analysis_invalid_revenue(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="invrev@test.com")
        headers = await get_auth_headers(client, email="invrev@test.com")
        resp = await client.post(
            "/api/v1/analyses/",
            json={**VALID_ANALYSIS_PAYLOAD, "revenue": "nao_e_numero"},
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_create_analysis_missing_required_fields(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="missing@test.com")
        headers = await get_auth_headers(client, email="missing@test.com")
        resp = await client.post(
            "/api/v1/analyses/",
            json={"company_name": "Só o nome"},
            headers=headers,
        )
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════
# Listagem de análises
# ═══════════════════════════════════════════════════════════

class TestListAnalyses:
    async def test_list_analyses_empty(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="empty@test.com")
        headers = await get_auth_headers(client, email="empty@test.com")
        resp = await client.get("/api/v1/analyses/", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data or isinstance(data, list)

    async def test_list_analyses_after_create(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="listafter@test.com")
        headers = await get_auth_headers(client, email="listafter@test.com")
        # Cria duas análises
        for _ in range(2):
            await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers)
        resp = await client.get("/api/v1/analyses/", headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        assert len(items) >= 2

    async def test_list_analyses_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/v1/analyses/")
        assert resp.status_code in (401, 403)

    async def test_list_analyses_isolation(self, client: AsyncClient, db_session: AsyncSession):
        """Análises de um usuário não aparecem para outro."""
        await create_verified_user(db_session, email="iso_a@test.com")
        await create_verified_user(db_session, email="iso_b@test.com")
        headers_a = await get_auth_headers(client, email="iso_a@test.com")
        headers_b = await get_auth_headers(client, email="iso_b@test.com")
        # User A cria uma análise
        await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers_a)
        # User B não deve ver
        resp = await client.get("/api/v1/analyses/", headers=headers_b)
        body = resp.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        assert len(items) == 0


# ═══════════════════════════════════════════════════════════
# Busca por ID
# ═══════════════════════════════════════════════════════════

class TestGetAnalysisById:
    async def test_get_analysis_success(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="getbyid@test.com")
        headers = await get_auth_headers(client, email="getbyid@test.com")
        create_resp = await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers)
        analysis_id = create_resp.json()["id"]

        resp = await client.get(f"/api/v1/analyses/{analysis_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == analysis_id

    async def test_get_analysis_not_found(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="notfound@test.com")
        headers = await get_auth_headers(client, email="notfound@test.com")
        import uuid
        resp = await client.get(f"/api/v1/analyses/{uuid.uuid4()}", headers=headers)
        assert resp.status_code == 404

    async def test_get_analysis_other_user_forbidden(self, client: AsyncClient, db_session: AsyncSession):
        """Usuário não pode acessar análise de outro usuário."""
        await create_verified_user(db_session, email="owner@test.com")
        await create_verified_user(db_session, email="snooper@test.com")
        headers_owner = await get_auth_headers(client, email="owner@test.com")
        headers_snooper = await get_auth_headers(client, email="snooper@test.com")

        create_resp = await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers_owner)
        analysis_id = create_resp.json()["id"]

        resp = await client.get(f"/api/v1/analyses/{analysis_id}", headers=headers_snooper)
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════
# Soft-delete / Lixeira
# ═══════════════════════════════════════════════════════════

class TestDeleteAnalysis:
    async def test_soft_delete_moves_to_trash(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="softdel@test.com")
        headers = await get_auth_headers(client, email="softdel@test.com")
        create_resp = await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers)
        analysis_id = create_resp.json()["id"]

        del_resp = await client.delete(f"/api/v1/analyses/{analysis_id}", headers=headers)
        assert del_resp.status_code == 200

        # Não deve aparecer na listagem normal
        list_resp = await client.get("/api/v1/analyses/", headers=headers)
        body = list_resp.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        ids = [i["id"] for i in items]
        assert analysis_id not in ids

    async def test_trash_contains_deleted_analysis(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="trash@test.com")
        headers = await get_auth_headers(client, email="trash@test.com")
        create_resp = await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers)
        analysis_id = create_resp.json()["id"]
        await client.delete(f"/api/v1/analyses/{analysis_id}", headers=headers)

        trash_resp = await client.get("/api/v1/analyses/trash", headers=headers)
        assert trash_resp.status_code == 200
        body = trash_resp.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        ids = [i["id"] for i in items]
        assert analysis_id in ids

    async def test_delete_other_user_analysis_forbidden(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="delowner@test.com")
        await create_verified_user(db_session, email="delattacker@test.com")
        headers_owner = await get_auth_headers(client, email="delowner@test.com")
        headers_attacker = await get_auth_headers(client, email="delattacker@test.com")

        create_resp = await client.post("/api/v1/analyses/", json=VALID_ANALYSIS_PAYLOAD, headers=headers_owner)
        analysis_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/v1/analyses/{analysis_id}", headers=headers_attacker)
        assert resp.status_code == 404


# ═══════════════════════════════════════════════════════════
# Endpoints informativos
# ═══════════════════════════════════════════════════════════

class TestInfoEndpoints:
    async def test_sectors_list(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="sectors@test.com")
        headers = await get_auth_headers(client, email="sectors@test.com")
        resp = await client.get("/api/v1/analyses/sectors/list", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        # endpoint returns {sectors: [...], groups: {...}, total: int}
        assert isinstance(data, dict)
        assert "sectors" in data
        assert isinstance(data["sectors"], list)
        assert len(data["sectors"]) > 0

    async def test_kpis_summary(self, client: AsyncClient, db_session: AsyncSession):
        await create_verified_user(db_session, email="kpis@test.com")
        headers = await get_auth_headers(client, email="kpis@test.com")
        resp = await client.get("/api/v1/analyses/kpis/summary", headers=headers)
        assert resp.status_code == 200
