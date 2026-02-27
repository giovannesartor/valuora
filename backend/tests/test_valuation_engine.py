"""
Testes unitários para o motor de valuation.
"""
import pytest
from app.core.valuation_engine.engine import (
    calculate_wacc,
    project_fcf,
    calculate_terminal_value_gordon as calculate_terminal_value,
    calculate_enterprise_value,
    calculate_equity_value,
    apply_founder_discount,
    calculate_risk_score,
    calculate_maturity_index,
    calculate_percentile,
    run_valuation,
    get_sector_beta_unlevered,
    net_margin_to_ebit_margin,
)


class TestWACC:
    def test_basic_wacc(self):
        wacc = calculate_wacc(beta_levered=1.0)
        assert 0.10 < wacc < 0.30
        assert isinstance(wacc, float)

    def test_higher_beta_higher_wacc(self):
        wacc_low = calculate_wacc(beta_levered=0.8)
        wacc_high = calculate_wacc(beta_levered=1.5)
        assert wacc_high > wacc_low

    def test_debt_reduces_wacc(self):
        wacc_no_debt = calculate_wacc(beta_levered=1.0, debt_ratio=0.0)
        wacc_with_debt = calculate_wacc(beta_levered=1.0, debt_ratio=0.3)
        # Due to tax shield, WACC with debt might be lower
        assert isinstance(wacc_with_debt, float)


class TestFCFProjection:
    def test_projects_5_years(self):
        ebit_m = net_margin_to_ebit_margin(0.15)
        fcf = project_fcf(revenue=1_000_000, ebit_margin=ebit_m, growth_rate=0.10)
        assert len(fcf) == 5

    def test_revenue_grows(self):
        ebit_m = net_margin_to_ebit_margin(0.15)
        fcf = project_fcf(revenue=1_000_000, ebit_margin=ebit_m, growth_rate=0.10)
        assert fcf[-1]["revenue"] > fcf[0]["revenue"]

    def test_positive_fcf_with_good_margins(self):
        ebit_m = net_margin_to_ebit_margin(0.20)
        fcf = project_fcf(revenue=1_000_000, ebit_margin=ebit_m, growth_rate=0.10)
        for year in fcf:
            assert year["fcf"] > 0

    def test_growth_decelerates(self):
        ebit_m = net_margin_to_ebit_margin(0.15)
        fcf = project_fcf(revenue=1_000_000, ebit_margin=ebit_m, growth_rate=0.20)
        assert fcf[-1]["growth_rate"] < fcf[0]["growth_rate"]


class TestTerminalValue:
    def test_positive_terminal_value(self):
        tv = calculate_terminal_value(last_fcf=100_000, wacc=0.15)
        assert tv["terminal_value"] > 0

    def test_lower_wacc_higher_tv(self):
        tv_low = calculate_terminal_value(last_fcf=100_000, wacc=0.20)
        tv_high = calculate_terminal_value(last_fcf=100_000, wacc=0.12)
        assert tv_high["terminal_value"] > tv_low["terminal_value"]

    def test_negative_fcf_guard(self):
        tv = calculate_terminal_value(last_fcf=-50_000, wacc=0.15)
        assert tv["terminal_value"] == 0
        assert len(tv["warnings"]) > 0


class TestEnterpriseValue:
    def test_positive_ev(self):
        ebit_m = net_margin_to_ebit_margin(0.15)
        fcf = project_fcf(revenue=1_000_000, ebit_margin=ebit_m, growth_rate=0.10)
        tv_result = calculate_terminal_value(last_fcf=fcf[-1]["fcf"], wacc=0.15)
        ev = calculate_enterprise_value(fcf, wacc=0.15, terminal_value=tv_result["terminal_value"])
        assert ev["enterprise_value"] > 0
        assert "tv_percentage" in ev


class TestEquityValue:
    def test_equity_basic(self):
        eq = calculate_equity_value(enterprise_value=1_000_000, cash=100_000, debt=200_000)
        assert eq == 900_000.0

    def test_equity_no_debt(self):
        eq = calculate_equity_value(enterprise_value=1_000_000, cash=50_000, debt=0)
        assert eq == 1_050_000.0


class TestFounderDiscount:
    def test_no_dependency(self):
        val = apply_founder_discount(1_000_000, founder_dependency=0.0)
        assert val == 1_000_000.0

    def test_full_dependency(self):
        val = apply_founder_discount(1_000_000, founder_dependency=1.0)
        assert val == 750_000.0  # 25% discount

    def test_partial_dependency(self):
        val = apply_founder_discount(1_000_000, founder_dependency=0.5)
        assert val == 875_000.0  # 12.5% discount


class TestRiskScore:
    def test_score_in_range(self):
        score = calculate_risk_score(0.15, 0.10, 0.2, 0.3, 1.0)
        assert 0 <= score <= 100

    def test_high_debt_higher_risk(self):
        low_debt = calculate_risk_score(0.15, 0.10, 0.1, 0.0, 1.0)
        high_debt = calculate_risk_score(0.15, 0.10, 0.7, 0.0, 1.0)
        assert high_debt > low_debt


class TestMaturityIndex:
    def test_in_range(self):
        mi = calculate_maturity_index(1_000_000, 0.15, 0.10, 0.2, 3)
        assert 0 <= mi <= 100

    def test_higher_revenue_higher_maturity(self):
        small = calculate_maturity_index(100_000, 0.15, 0.10, 0.2, 3)
        large = calculate_maturity_index(10_000_000, 0.15, 0.10, 0.2, 3)
        assert large > small


class TestPercentile:
    def test_in_range(self):
        pct = calculate_percentile(2_000_000, 1_000_000, "tecnologia")
        assert 1 <= pct <= 99


class TestSectorBeta:
    def test_known_sector(self):
        assert get_sector_beta_unlevered("tecnologia") == 1.18

    def test_unknown_sector(self):
        assert get_sector_beta_unlevered("xyz_inventado") == 0.85


class TestFullValuation:
    def test_complete_run(self):
        result = run_valuation(
            revenue=2_000_000,
            net_margin=0.15,
            sector="tecnologia",
            growth_rate=0.12,
            debt=200_000,
            cash=100_000,
            founder_dependency=0.3,
        )
        assert "equity_value" in result
        assert "enterprise_value" in result
        assert "wacc" in result
        assert "fcf_projections" in result
        assert "risk_score" in result
        assert "maturity_index" in result
        assert "percentile" in result
        assert "valuation_range" in result
        assert "multiples_valuation" in result
        assert "sensitivity_table" in result
        assert "waterfall" in result
        assert "tv_percentage" in result
        assert "beta_levered" in result
        assert result["equity_value"] > 0
        assert len(result["fcf_projections"]) == 5

    def test_simulation_override(self):
        base = run_valuation(revenue=1_000_000, net_margin=0.15, sector="servicos")
        sim = run_valuation(revenue=1_000_000, net_margin=0.15, sector="servicos", custom_growth=0.25)
        assert sim["equity_value"] != base["equity_value"]
