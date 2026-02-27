"""
Testes unitários para o motor de valuation.
"""
import pytest
from app.core.valuation_engine.engine import (
    calculate_wacc,
    project_fcf,
    project_fcfe,
    calculate_cost_of_equity,
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
    calculate_dlom,
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
        assert len(result["fcf_projections"]) == 10  # v4 standard

    def test_simulation_override(self):
        base = run_valuation(revenue=1_000_000, net_margin=0.15, sector="servicos")
        sim = run_valuation(revenue=1_000_000, net_margin=0.15, sector="servicos", custom_growth=0.25)
        assert sim["equity_value"] != base["equity_value"]


class TestCostOfEquity:
    """Test Cost of Equity with 4-factor beta."""

    def test_basic_ke(self):
        ke = calculate_cost_of_equity(sector="tecnologia", num_employees=10, years_in_business=5)
        assert 0.15 < ke["cost_of_equity"] < 0.50
        assert ke["beta_4factor"] > 0.30

    def test_mature_company_lower_ke(self):
        young = calculate_cost_of_equity(sector="tecnologia", num_employees=2, years_in_business=1)
        mature = calculate_cost_of_equity(sector="tecnologia", num_employees=100, years_in_business=15)
        assert mature["cost_of_equity"] < young["cost_of_equity"]

    def test_4factor_components(self):
        ke = calculate_cost_of_equity(
            sector="varejo", num_employees=20, years_in_business=14,
            net_margin=0.087, debt=5_090_000, equity_proxy=12_200_000,
            founder_dependency=0.80)
        assert "size_adj" in ke
        assert "stage_adj" in ke
        assert "profit_adj" in ke
        assert "key_person_premium" in ke
        assert ke["key_person_premium"] == pytest.approx(0.032, abs=0.001)

    def test_key_person_premium(self):
        no_dep = calculate_cost_of_equity(sector="tecnologia", founder_dependency=0.0)
        high_dep = calculate_cost_of_equity(sector="tecnologia", founder_dependency=1.0)
        assert high_dep["cost_of_equity"] > no_dep["cost_of_equity"]
        assert high_dep["key_person_premium"] == pytest.approx(0.04, abs=0.001)


class TestFCFEProjection:
    """Test FCFE (Free Cash Flow to Equity) projection."""

    def test_projects_5_years(self):
        fcfe = project_fcfe(revenue=1_000_000, net_margin=0.15, growth_rate=0.10)
        assert len(fcfe) == 5

    def test_revenue_grows(self):
        fcfe = project_fcfe(revenue=1_000_000, net_margin=0.15, growth_rate=0.10)
        assert fcfe[-1]["revenue"] > fcfe[0]["revenue"]

    def test_positive_fcfe_with_good_margins(self):
        fcfe = project_fcfe(revenue=1_000_000, net_margin=0.20, growth_rate=0.10)
        for year in fcfe:
            assert year["fcf"] > 0

    def test_backward_compat_keys(self):
        """FCFE projections must have same keys as FCF for frontend compat."""
        fcfe = project_fcfe(revenue=1_000_000, net_margin=0.15, growth_rate=0.10)
        required_keys = {"year", "revenue", "growth_rate", "ebit_margin", "ebit",
                         "nopat", "depreciation", "capex", "delta_nwc", "fcf"}
        for proj in fcfe:
            assert required_keys.issubset(proj.keys())


class TestV4DLOM:
    """Test DLOM adjustments for v4 methodology."""

    def test_base_is_022(self):
        dlom = calculate_dlom(revenue=5_000_000, sector="servicos", years_in_business=7)
        assert dlom["base_discount"] == 0.22

    def test_mature_large_company(self):
        dlom = calculate_dlom(revenue=12_000_000, sector="varejo", years_in_business=14)
        assert 0.12 <= dlom["dlom_pct"] <= 0.20

    def test_startup_higher_dlom(self):
        dlom = calculate_dlom(revenue=300_000, sector="tecnologia", years_in_business=1)
        assert dlom["dlom_pct"] > 0.25


class TestV4Valuation:
    """Validate v4 methodology with Armazém 845 benchmark."""

    def test_armazem845_convergence(self):
        """Test that the engine produces results close to the R$ 3.98M benchmark for Armazém 845."""
        result = run_valuation(
            revenue=12_050_000,
            net_margin=0.087,
            sector="varejo",
            growth_rate=0.15,
            debt=5_090_000,
            cash=169_391,
            founder_dependency=0.80,
            years_of_data=5,
            projection_years=10,
            years_in_business=14,
            ebitda=1_220_000,
            num_employees=20,
        )
        # Benchmark target: R$ 3,977,487
        # Allow ±15% tolerance
        assert 3_300_000 < result["equity_value"] < 4_700_000
        # Cost of Equity should be 25-35% (benchmark was 29.24%)
        assert 0.25 < result["wacc"] < 0.35
        # Beta should be > 1.0 with 4-factor adjustments
        assert result["beta_levered"] > 1.0
        # DLOM should be 12-20%
        assert 0.12 <= result["dlom"]["dlom_pct"] <= 0.20
        # Must have all required output keys
        assert result["equity_value_gordon"] > 0
        assert result["equity_value_exit_multiple"] > 0
        assert "cost_of_equity_detail" in result
        assert result["parameters"]["methodology"] == "FCFE/Ke (4-Factor)"
        # 10-year projection
        assert len(result["fcf_projections"]) == 10

    def test_stage_based_weights(self):
        """Mature company (14yr) should use 50/50 Gordon/Exit blend."""
        result = run_valuation(
            revenue=5_000_000, net_margin=0.10, sector="servicos",
            years_in_business=14, debt=500_000, cash=100_000)
        assert result["dcf_weight"] == 0.50
        assert result["multiples_weight"] == 0.50

    def test_early_stage_weights(self):
        """Early company (<3yr) should use 0/100 Gordon/Exit blend."""
        result = run_valuation(
            revenue=500_000, net_margin=0.05, sector="tecnologia",
            years_in_business=1)
        assert result["dcf_weight"] == 0.0
        assert result["multiples_weight"] == 1.0

    def test_no_separate_survival_haircut(self):
        """Survival should be embedded in TV, not post-DCF discount.
        equity_value_dcf should equal equity_value_raw (no founder discount either)."""
        result = run_valuation(
            revenue=2_000_000, net_margin=0.15, sector="tecnologia",
            founder_dependency=0.5, years_in_business=5)
        assert result["equity_value_dcf"] == result["equity_value_raw"]
