"""
Quanto Vale — Tests: IBGE Integration
Testes unitários para serviços CNAE, SIDRA, normalizers e sector analysis.
"""

import pytest
import math
from unittest.mock import AsyncMock, patch, MagicMock

# ─── Tests: Normalizers ─────────────────────────────────

from app.utils.normalizers import (
    safe_float, safe_int, parse_percentage,
    calculate_growth_rate, calculate_volatility, calculate_trend,
    normalize_ibge_response, extract_sidra_values,
    cnae_to_division, cnae_to_group, cnae_to_class,
)


class TestSafeFloat:
    def test_none(self):
        assert safe_float(None) == 0.0

    def test_int(self):
        assert safe_float(42) == 42.0

    def test_float(self):
        assert safe_float(3.14) == 3.14

    def test_string_simple(self):
        assert safe_float("123.45") == 123.45

    def test_string_brazilian(self):
        assert safe_float("1.234.567,89") == 1234567.89

    def test_string_comma_decimal(self):
        assert safe_float("12,5") == 12.5

    def test_ibge_dash(self):
        assert safe_float("-") == 0.0

    def test_ibge_dots(self):
        assert safe_float("...") == 0.0

    def test_ibge_x(self):
        assert safe_float("X") == 0.0

    def test_empty_string(self):
        assert safe_float("") == 0.0

    def test_nan(self):
        assert safe_float(float("nan")) == 0.0

    def test_inf(self):
        assert safe_float(float("inf")) == 0.0

    def test_default(self):
        assert safe_float(None, 10.0) == 10.0


class TestSafeInt:
    def test_from_string(self):
        assert safe_int("42") == 42

    def test_from_float(self):
        assert safe_int(3.7) == 3

    def test_none(self):
        assert safe_int(None) == 0


class TestParsePercentage:
    def test_percentage_string(self):
        assert parse_percentage("15.3%") == pytest.approx(0.153)

    def test_decimal_value(self):
        assert parse_percentage(0.15) == 0.15

    def test_integer_percentage(self):
        assert parse_percentage(15) == 0.15

    def test_none(self):
        assert parse_percentage(None) == 0.0


class TestCalculateGrowthRate:
    def test_positive_growth(self):
        values = [100, 110, 121, 133.1]
        result = calculate_growth_rate(values)
        assert result is not None
        assert result == pytest.approx(0.10, abs=0.01)

    def test_negative_growth(self):
        values = [100, 90, 81]
        result = calculate_growth_rate(values)
        assert result is not None
        assert result < 0

    def test_too_few_values(self):
        assert calculate_growth_rate([100]) is None
        assert calculate_growth_rate([]) is None

    def test_zeros(self):
        assert calculate_growth_rate([0, 0, 0]) is None


class TestCalculateVolatility:
    def test_stable(self):
        values = [100, 100, 100]
        assert calculate_volatility(values) == 0.0

    def test_volatile(self):
        values = [100, 200, 50, 300]
        vol = calculate_volatility(values)
        assert vol > 0
        assert vol <= 1.0

    def test_empty(self):
        assert calculate_volatility([]) == 0.0


class TestCalculateTrend:
    def test_upward(self):
        values = [10, 20, 30, 40, 50]
        trend = calculate_trend(values)
        assert trend > 0

    def test_downward(self):
        values = [50, 40, 30, 20, 10]
        trend = calculate_trend(values)
        assert trend < 0

    def test_flat(self):
        values = [10, 10, 10, 10]
        trend = calculate_trend(values)
        assert trend == pytest.approx(0.0, abs=0.01)


class TestNormalizeIbgeResponse:
    def test_sidra_format(self):
        data = [
            {"D1C": "1", "D1N": "Brasil", "V": "header"},
            {"D1C": "1", "D1N": "Brasil", "V": "100"},
            {"D1C": "1", "D1N": "Brasil", "V": "200"},
        ]
        result = normalize_ibge_response(data)
        assert len(result) == 2

    def test_empty(self):
        assert normalize_ibge_response(None) == []
        assert normalize_ibge_response([]) == []


class TestExtractSidraValues:
    def test_extraction(self):
        data = [
            {"V": "100", "D2N": "2020"},
            {"V": "200", "D2N": "2021"},
            {"V": "-", "D2N": "2022"},
        ]
        values = extract_sidra_values(data)
        assert values == [100.0, 200.0]


class TestCnaeParsing:
    def test_division(self):
        assert cnae_to_division("62.01-5") == "62"
        assert cnae_to_division("47") == "47"

    def test_group(self):
        assert cnae_to_group("62.01-5") == "620"

    def test_class(self):
        assert cnae_to_class("62.01-5") == "62015"


# ─── Tests: Sector Risk Score ────────────────────────────

class TestSectorRiskCalculation:
    """Testes para cálculo de risco setorial (usa mocks para IBGE)."""

    @pytest.mark.asyncio
    async def test_risk_score_with_mocked_data(self):
        with patch("app.services.sector_analysis_service.fetch_sector_growth") as mock_growth, \
             patch("app.services.sector_analysis_service.fetch_sector_revenue_average") as mock_revenue, \
             patch("app.services.sector_analysis_service.fetch_sector_company_count") as mock_companies, \
             patch("app.services.sector_analysis_service.cache_get", return_value=None), \
             patch("app.services.sector_analysis_service.cache_set", return_value=True):

            mock_growth.return_value = {
                "cagr": 0.08,
                "annual_growths": [0.05, 0.10, 0.08, 0.12, 0.06],
                "volatility": 0.3,
            }
            mock_revenue.return_value = {
                "series": {2019: 1000, 2020: 1050, 2021: 1100, 2022: 1200, 2023: 1300},
                "average_revenue": 1130,
            }
            mock_companies.return_value = {
                "latest_count": 50000,
            }

            from app.services.sector_analysis_service import calculate_sector_risk_score
            risk = await calculate_sector_risk_score("62")

            assert 0 <= risk.final_score <= 100
            assert risk.risk_level in ("baixo", "medio", "alto", "muito_alto")
            assert risk.growth_volatility >= 0
            assert risk.fragmentation_score >= 0

    @pytest.mark.asyncio
    async def test_risk_no_data(self):
        """Sem dados IBGE, deve retornar score padrão (50)."""
        with patch("app.services.sector_analysis_service.fetch_sector_growth", return_value=None), \
             patch("app.services.sector_analysis_service.fetch_sector_revenue_average", return_value=None), \
             patch("app.services.sector_analysis_service.fetch_sector_company_count", return_value=None), \
             patch("app.services.sector_analysis_service.cache_get", return_value=None), \
             patch("app.services.sector_analysis_service.cache_set", return_value=True):

            from app.services.sector_analysis_service import calculate_sector_risk_score
            risk = await calculate_sector_risk_score("99")

            assert risk.final_score == pytest.approx(50.0, abs=5)


# ─── Tests: DCF Integration ─────────────────────────────

class TestDCFIntegration:
    @pytest.mark.asyncio
    async def test_adjusted_growth_with_ibge(self):
        with patch("app.services.sector_analysis_service.fetch_sector_growth") as mock_growth, \
             patch("app.services.sector_analysis_service.async_session_maker") as mock_session, \
             patch("app.services.sector_analysis_service.cache_get", return_value=None):

            # Mock DB: no results
            mock_ctx = AsyncMock()
            mock_ctx.__aenter__ = AsyncMock(return_value=mock_ctx)
            mock_ctx.__aexit__ = AsyncMock(return_value=False)
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_ctx.execute = AsyncMock(return_value=mock_result)
            mock_session.return_value = mock_ctx

            mock_growth.return_value = {
                "cagr": 0.08,
                "annual_growths": [0.05, 0.10, 0.08],
            }

            from app.services.sector_analysis_service import get_adjusted_growth_for_dcf
            # Com empresa fornecendo 15% growth
            adjusted = await get_adjusted_growth_for_dcf("62", company_growth=0.15)
            # 60% empresa + 40% setor = 0.60*0.15 + 0.40*0.08 = 0.122
            assert 0.05 <= adjusted <= 0.20

    @pytest.mark.asyncio
    async def test_adjusted_growth_no_data(self):
        with patch("app.services.sector_analysis_service.fetch_sector_growth", return_value=None), \
             patch("app.services.sector_analysis_service.async_session_maker") as mock_session, \
             patch("app.services.sector_analysis_service.cache_get", return_value=None):

            mock_ctx = AsyncMock()
            mock_ctx.__aenter__ = AsyncMock(return_value=mock_ctx)
            mock_ctx.__aexit__ = AsyncMock(return_value=False)
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_ctx.execute = AsyncMock(return_value=mock_result)
            mock_session.return_value = mock_ctx

            from app.services.sector_analysis_service import get_adjusted_growth_for_dcf
            adjusted = await get_adjusted_growth_for_dcf("99")
            assert adjusted == 0.05  # Default conservador


# ─── Tests: CNAE Service (mocked HTTP) ──────────────────

class TestCnaeService:
    @pytest.mark.asyncio
    async def test_get_sections_cached(self):
        cached_data = [
            {"code": "A", "description": "Agricultura", "level": "secao"},
            {"code": "B", "description": "Indústrias extrativas", "level": "secao"},
        ]
        with patch("app.services.ibge_cnae_service.cache_get", return_value=cached_data):
            from app.services.ibge_cnae_service import get_all_sections
            result = await get_all_sections()
            assert len(result) == 2
            assert result[0]["code"] == "A"

    @pytest.mark.asyncio
    async def test_validate_cnae_invalid(self):
        with patch("app.services.ibge_cnae_service._ibge_request", return_value=None):
            from app.services.ibge_cnae_service import validate_cnae
            result = await validate_cnae("99999")
            assert result.is_valid is False

    @pytest.mark.asyncio
    async def test_validate_cnae_valid(self):
        mock_data = [{
            "id": "6201-5",
            "descricao": "Desenvolvimento de software",
            "grupo": {
                "id": "620",
                "descricao": "Tecnologia",
                "divisao": {
                    "id": "62",
                    "descricao": "TI",
                    "secao": {"id": "J", "descricao": "Info"}
                }
            }
        }]
        with patch("app.services.ibge_cnae_service._ibge_request", return_value=mock_data):
            from app.services.ibge_cnae_service import validate_cnae
            result = await validate_cnae("62015")
            assert result.is_valid is True
            assert "software" in result.description.lower()


# ─── Tests: IBGE Enhanced Valuation Engine ───────────────

class TestIBGEEnhancedValuation:
    def test_valuation_with_ibge_adjustment(self):
        from app.core.valuation_engine.engine import run_valuation_with_ibge

        ibge_adj = {
            "adjusted_growth_rate": 0.08,
            "sector_risk_premium": 0.02,
            "benchmark_revenue": 5000000,
            "benchmark_growth": 0.06,
            "sector_position": "acima",
            "confidence_level": 0.7,
            "data_source": "IBGE/SIDRA",
        }

        result = run_valuation_with_ibge(
            revenue=1000000,
            net_margin=0.15,
            sector="tecnologia",
            ibge_adjustment=ibge_adj,
            growth_rate=0.12,
        )

        assert result["equity_value"] > 0
        assert "ibge_sector_data" in result
        assert result["ibge_sector_data"]["data_source"] == "IBGE/SIDRA"
        assert result["ibge_sector_data"]["sector_position"] == "acima"

    def test_valuation_without_ibge(self):
        from app.core.valuation_engine.engine import run_valuation_with_ibge

        result = run_valuation_with_ibge(
            revenue=1000000,
            net_margin=0.15,
            sector="tecnologia",
            growth_rate=0.10,
        )

        assert result["equity_value"] > 0
        assert "ibge_sector_data" not in result

    def test_ibge_affects_wacc(self):
        from app.core.valuation_engine.engine import run_valuation, run_valuation_with_ibge

        # Sem IBGE
        r1 = run_valuation(
            revenue=1000000,
            net_margin=0.15,
            sector="tecnologia",
            growth_rate=0.10,
        )

        # Com risk premium IBGE +3%
        r2 = run_valuation_with_ibge(
            revenue=1000000,
            net_margin=0.15,
            sector="tecnologia",
            ibge_adjustment={
                "adjusted_growth_rate": 0.10,
                "sector_risk_premium": 0.03,
                "confidence_level": 0.8,
            },
            growth_rate=0.10,
        )

        # WACC com IBGE deve ser maior (mais risco)
        assert r2["wacc"] > r1["wacc"]
        # Valuation menor com mais risco
        assert r2["equity_value"] < r1["equity_value"]


# ─── Tests: Cache ────────────────────────────────────────

class TestCache:
    @pytest.mark.asyncio
    async def test_cache_miss_returns_none(self):
        with patch("app.core.cache.redis_client") as mock_redis:
            mock_redis.get = AsyncMock(return_value=None)
            from app.core.cache import cache_get
            result = await cache_get("test:key")
            assert result is None

    @pytest.mark.asyncio
    async def test_cache_hit(self):
        import json
        with patch("app.core.cache.redis_client") as mock_redis:
            mock_redis.get = AsyncMock(return_value=json.dumps({"test": "value"}))
            from app.core.cache import cache_get
            result = await cache_get("test:key")
            assert result == {"test": "value"}

    @pytest.mark.asyncio
    async def test_cache_error_returns_none(self):
        with patch("app.core.cache.redis_client") as mock_redis:
            mock_redis.get = AsyncMock(side_effect=Exception("Redis down"))
            from app.core.cache import cache_get
            result = await cache_get("test:key")
            assert result is None


# ─── Tests: Fallback Logic ──────────────────────────────

class TestFallback:
    @pytest.mark.asyncio
    async def test_aggregates_fallback(self):
        """Testa se o fallback hierárquico funciona (classe → grupo → divisão)."""
        call_count = 0

        async def mock_request(url, retries=3):
            nonlocal call_count
            call_count += 1
            # Primeira chamada (código completo): sem dados
            if call_count <= 1:
                return None
            # Segunda chamada (grupo): sem dados
            if call_count <= 2:
                return None
            # Terceira chamada (divisão): dados!
            return [
                {"D1C": "header", "V": "header"},
                {"D1C": "1", "D3N": "2022", "V": "500"},
            ]

        with patch("app.services.ibge_aggregates_service._sidra_request", side_effect=mock_request), \
             patch("app.services.ibge_aggregates_service.cache_get", return_value=None), \
             patch("app.services.ibge_aggregates_service.cache_set", return_value=True):

            from app.services.ibge_aggregates_service import _fetch_with_fallback
            result = await _fetch_with_fallback(
                cnae_code="62015",
                tabela="1842",
                variavel="630",
                classificacao_template="C12762/{code}",
            )

            assert result is not None
            assert call_count == 3  # Tentou 3 vezes (completo → grupo → divisão)
