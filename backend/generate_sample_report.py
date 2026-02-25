"""
Script para gerar o relatório de exemplo (Empresa X Serviços Digitais).
Usa o motor PDF real do Quanto Vale sem precisar do banco de dados.

Uso: python generate_sample_report.py
Saída: ../frontend/public/relatorio-exemplo.pdf
"""
import sys
import os
import uuid
import enum
import shutil
import glob
import types
from types import SimpleNamespace
from pathlib import Path

# ─── Setup de paths ──────────────────────────────────────
BACKEND_DIR = Path(__file__).parent
sys.path.insert(0, str(BACKEND_DIR))

# ─── Env vars mínimas (sem banco) ────────────────────────
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("SECRET_KEY", "sample-key-for-pdf-generation-only")
os.environ.setdefault("ASAAS_API_URL", "https://api.asaas.com/v3")
os.environ.setdefault("ASAAS_API_KEY", "sample")
os.environ.setdefault("ASAAS_WEBHOOK_TOKEN", "sample")
os.environ.setdefault("APP_URL", "https://quantovale.online")
os.environ.setdefault("REPORTS_DIR", "/tmp/qv_sample")
os.environ.setdefault("UPLOADS_DIR", "/tmp/qv_uploads")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("MAIL_USERNAME", "noreply@quantovale.online")
os.environ.setdefault("MAIL_PASSWORD", "sample")
os.environ.setdefault("MAIL_FROM", "noreply@quantovale.online")
os.environ.setdefault("MAIL_SERVER", "smtp.example.com")
os.environ.setdefault("MAIL_PORT", "587")

# ─── Stubs de módulos pesados (evita imports de banco) ───
for mod in [
    "sqlalchemy", "sqlalchemy.orm", "sqlalchemy.dialects",
    "sqlalchemy.dialects.postgresql", "sqlalchemy.ext",
    "sqlalchemy.ext.asyncio",
]:
    sys.modules.setdefault(mod, types.ModuleType(mod))

sys.modules.setdefault("asyncpg", types.ModuleType("asyncpg"))
for mod in ["redis", "redis.asyncio"]:
    sys.modules.setdefault(mod, types.ModuleType(mod))
for mod in ["passlib", "passlib.context", "jose", "cryptography"]:
    sys.modules.setdefault(mod, types.ModuleType(mod))

# ─── Enum local que imita PlanType do models ─────────────
class PlanType(str, enum.Enum):
    ESSENCIAL    = "essencial"
    PROFISSIONAL = "profissional"
    ESTRATEGICO  = "estrategico"

class PaymentStatus(str, enum.Enum):
    PENDING  = "pending"
    PAID     = "paid"
    FAILED   = "failed"
    REFUNDED = "refunded"

class AnalysisStatus(str, enum.Enum):
    DRAFT      = "draft"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"

# Injeta stub do models para que pdf_service possa importar PlanType
_models_stub = types.ModuleType("app.models.models")
_models_stub.PlanType      = PlanType
_models_stub.PaymentStatus = PaymentStatus
_models_stub.AnalysisStatus = AnalysisStatus
sys.modules["app.models.models"] = _models_stub

from app.services.pdf_service import generate_report_pdf
import app.core.config as cfg


def build_mock_analysis():
    """Cria um objeto analysis realista com dados fictícios de uma SaaS B2B."""

    valuation_result = {
        "parameters": {
            "revenue": 3_800_000,
            "net_margin": 0.18,
            "growth_rate": 0.28,
            "wacc": 0.1542,
            "beta": 1.18,
            "selic": 0.1075,
            "risk_premium": 0.055,
            "debt": 420_000,
            "cash": 310_000,
            "founder_dependency": 0.30,
            "projection_years": 5,
            "ebitda": 820_000,
            "recurring_revenue_pct": 0.72,
            "num_employees": 38,
            "years_in_business": 6,
        },
        "wacc": 0.1542,
        "wacc_breakdown": {
            "ke": 0.1842,
            "kd": 0.1050,
            "we": 0.78,
            "wd": 0.22,
            "tax_rate": 0.15,
        },
        "beta_unlevered": 1.18,
        "dcf_weight": 0.60,
        "multiples_weight": 0.40,

        # Gordon
        "equity_value_gordon": 9_840_000,
        "enterprise_value_gordon": 9_950_000,
        "terminal_value_gordon": {
            "terminal_value": 14_200_000,
            "g": 0.045,
            "tv_pct": 0.64,
        },
        "tv_percentage": 0.64,

        # Exit Multiple
        "equity_value_exit_multiple": 10_120_000,
        "enterprise_value_exit": 10_230_000,
        "terminal_value_exit": {
            "exit_multiple": 8.5,
            "ebitda_final": 1_450_000,
            "terminal_value": 12_325_000,
        },

        # DCF blended
        "equity_value_dcf": 9_980_000,
        "enterprise_value_dcf": 10_090_000,

        # Multiples
        "multiples_valuation": {
            "ev_revenue_sector": 2.8,
            "ev_ebitda_sector": 9.2,
            "equity_value_multiples": 9_200_000,
            "enterprise_value_multiples": 9_310_000,
        },

        # Final blended
        "equity_value_final": 9_648_000,
        "enterprise_value": 9_716_000,

        "valuation_range": {
            "low": 7_720_000,
            "mid": 9_648_000,
            "high": 11_580_000,
        },

        # DLOM
        "dlom": {
            "rate": 0.15,
            "raw_equity": 11_350_000,
            "adjusted_equity": 9_648_000,
            "reasoning": "Empresa de capital fechado com 6 anos de operação. DLOM de 15% aplicado considerando liquidez setorial moderada e ausência de preparação para exit.",
        },

        # Survival
        "survival": {
            "rate": 0.76,
            "years": 5,
            "source": "SEBRAE/IBGE",
            "bonus_years": 0.08,
            "final_rate": 0.84,
        },

        # Qualitative
        "qualitative": {
            "total_score": 3.9,
            "adjustment": 0.078,
            "dimensions": {
                "team": 4.2,
                "market": 4.0,
                "product": 4.1,
                "traction": 3.8,
                "operations": 3.4,
            },
        },

        # Risk & Maturity
        "risk_score": 34,
        "maturity_index": 0.68,
        "percentile": 71,

        # Sensitivity
        "sensitivity_table": {
            "base": {"wacc": 0.1542, "g": 0.045, "value": 9_648_000},
            "rows": [
                {"wacc": 0.12, "g": 0.03, "value": 11_200_000},
                {"wacc": 0.12, "g": 0.045, "value": 12_400_000},
                {"wacc": 0.12, "g": 0.06, "value": 13_900_000},
                {"wacc": 0.1542, "g": 0.03, "value": 8_700_000},
                {"wacc": 0.1542, "g": 0.045, "value": 9_648_000},
                {"wacc": 0.1542, "g": 0.06, "value": 10_800_000},
                {"wacc": 0.18, "g": 0.03, "value": 7_100_000},
                {"wacc": 0.18, "g": 0.045, "value": 7_900_000},
                {"wacc": 0.18, "g": 0.06, "value": 8_800_000},
            ],
        },

        # FCF projections
        "fcf_projections": [
            {"year": 1, "revenue": 4_864_000, "ebitda": 1_039_000, "ebit": 880_000,  "nopat": 748_000,  "fcf": 742_000,   "growth_rate": 0.28},
            {"year": 2, "revenue": 6_226_000, "ebitda": 1_367_000, "ebit": 1_161_000,"nopat": 987_000,  "fcf": 976_000,   "growth_rate": 0.28},
            {"year": 3, "revenue": 7_969_000, "ebitda": 1_781_000, "ebit": 1_514_000,"nopat": 1_287_000,"fcf": 1_271_000, "growth_rate": 0.28},
            {"year": 4, "revenue": 9_960_000, "ebitda": 2_271_000, "ebit": 1_930_000,"nopat": 1_641_000,"fcf": 1_622_000, "growth_rate": 0.25},
            {"year": 5, "revenue": 12_450_000,"ebitda": 2_893_000, "ebit": 2_459_000,"nopat": 2_090_000,"fcf": 2_065_000, "growth_rate": 0.25},
        ],

        # P&L projections (todos os campos que o PDF usa)
        "pnl_projections": [
            {"year": 1, "revenue": 4_864_000,  "cogs": -1_312_000, "gross_profit": 3_552_000, "gross_margin": 0.73,
             "opex": -2_513_000, "ebitda": 1_039_000, "ebitda_margin": 0.214, "depreciation": -159_000,
             "ebit": 880_000, "taxes": -132_000, "net_income": 680_000, "net_margin": 0.14},
            {"year": 2, "revenue": 6_226_000,  "cogs": -1_681_000, "gross_profit": 4_545_000, "gross_margin": 0.73,
             "opex": -3_178_000, "ebitda": 1_367_000, "ebitda_margin": 0.220, "depreciation": -206_000,
             "ebit": 1_161_000, "taxes": -174_000, "net_income": 895_000, "net_margin": 0.144},
            {"year": 3, "revenue": 7_969_000,  "cogs": -2_152_000, "gross_profit": 5_817_000, "gross_margin": 0.73,
             "opex": -4_036_000, "ebitda": 1_781_000, "ebitda_margin": 0.224, "depreciation": -267_000,
             "ebit": 1_514_000, "taxes": -227_000, "net_income": 1_164_000, "net_margin": 0.146},
            {"year": 4, "revenue": 9_960_000,  "cogs": -2_689_000, "gross_profit": 7_271_000, "gross_margin": 0.73,
             "opex": -5_000_000, "ebitda": 2_271_000, "ebitda_margin": 0.228, "depreciation": -341_000,
             "ebit": 1_930_000, "taxes": -290_000, "net_income": 1_485_000, "net_margin": 0.149},
            {"year": 5, "revenue": 12_450_000, "cogs": -3_362_000, "gross_profit": 9_088_000, "gross_margin": 0.73,
             "opex": -6_195_000, "ebitda": 2_893_000, "ebitda_margin": 0.232, "depreciation": -434_000,
             "ebit": 2_459_000, "taxes": -369_000, "net_income": 1_892_000, "net_margin": 0.152},
        ],

        # Waterfall
        "waterfall": [
            {"label": "EV Gordon", "value": 9_950_000, "type": "positive"},
            {"label": "EV Exit Multiple", "value": 10_230_000, "type": "positive"},
            {"label": "EV Múltiplos", "value": 9_310_000, "type": "positive"},
            {"label": "EV Blended", "value": 9_716_000, "type": "subtotal"},
            {"label": "(–) Dívida Líquida", "value": -110_000, "type": "negative"},
            {"label": "Equity Bruto", "value": 9_606_000, "type": "subtotal"},
            {"label": "(–) DLOM 15%", "value": -1_441_000, "type": "negative"},
            {"label": "(+) Ajuste Qualitativo", "value": 750_000, "type": "positive"},
            {"label": "Equity Final", "value": 9_648_000, "type": "total"},
        ],

        # Investment round
        "investment_round": {
            "pre_money": 9_648_000,
            "post_money_10": 10_720_000,
            "post_money_20": 12_060_000,
            "dilution_10_pct": 1_072_000,
            "dilution_20_pct": 2_412_000,
            "founders_retention_10": 0.90,
            "founders_retention_20": 0.80,
        },

        # Benchmark
        "benchmark": {
            "sector": "Tecnologia / SaaS B2B",
            "margins": {"company": 0.18, "p25": 0.08, "p50": 0.14, "p75": 0.22},
            "growth": {"company": 0.28, "p25": 0.12, "p50": 0.20, "p75": 0.35},
            "ev_revenue": {"company": 2.54, "p25": 1.8, "p50": 2.6, "p75": 4.1},
        },
    }

    ai_analysis = """A Empresa X Serviços Digitais apresenta fundamentos financeiros consistentes com empresas SaaS B2B em estágio de crescimento acelerado. A receita recorrente representando 72% do faturamento constitui o principal diferencial competitivo do negócio, conferindo previsibilidade ao fluxo de caixa e sustentando a tese de valuation baseada em crescimento perpétuo.

O WACC de 15,42% reflete adequadamente o perfil de risco da empresa: beta setorial de 1,18 acima do mercado geral, ajustado pelo nível de alavancagem de 22%, compatível com empresas de tecnologia em expansão no Brasil. A Selic em 10,75% eleva o custo de capital próprio, comprimindo múltiplos de valuation versus benchmarks internacionais — fator estrutural do mercado brasileiro que os sócios devem considerar em eventuais negociações com fundos estrangeiros.

A taxa de crescimento projetada de 28% ao ano nos próximos 5 anos é ambiciosa mas defensável dado o histórico de crescimento de 6 anos e a expansão do mercado de SaaS B2B no Brasil. O cenário conservador (WACC 18%, g 3%) indica piso de R$ 7,1M, enquanto o cenário otimista (WACC 12%, g 6%) aponta teto de R$ 13,9M — amplitude que demonstra a sensibilidade da tese ao custo de capital, variável exógena não controlável pelos sócios.

O Score Qualitativo de 3,9/5,0 destaca equipe (4,2) e produto (4,1) como pilares da tese. O ponto de atenção crítico é operações (3,4): a empresa ainda apresenta dependência de processos manuais em onboarding e suporte, o que tende a comprimir margens conforme a base de clientes escala. Recomenda-se investimento em automação de CS antes de qualquer rodada de captação.

O DLOM de 15% é tecnicamente conservador para uma empresa com 6 anos de operação e receita recorrente — empresas comparáveis estruturadas para exit recebem desconto de 10% a 12%. Há um upside potencial de R$ 300K a R$ 500K no valor final mediante preparação do data room e estruturação de governança pré-M&A.

Para a simulação de rodada de investimento: captação de 10% por R$ 1,07M eleva o post-money para R$ 10,72M e mantém os fundadores com 90% de participação — estrutura adequada para seed/série A. Captação de 20% por R$ 2,41M viabiliza expansão mais agressiva, porém exige execução nos próximos 18 meses para sustentar o valuation na próxima rodada."""

    analysis = SimpleNamespace(
        id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        company_name="Empresa X Serviços Digitais Ltda.",
        sector="Tecnologia",
        cnpj="12.345.678/0001-90",
        plan=PlanType.ESTRATEGICO,
        revenue=3_800_000,
        net_margin=0.18,
        growth_rate=0.28,
        debt=420_000,
        cash=310_000,
        ebitda=820_000,
        founder_dependency=0.30,
        projection_years=5,
        recurring_revenue_pct=0.72,
        num_employees=38,
        years_in_business=6,
        previous_investment=500_000,
        dcf_weight=0.60,
        custom_exit_multiple=None,
        qualitative_answers=None,
        equity_value=9_648_000,
        risk_score=34,
        maturity_index=0.68,
        percentile=71,
        valuation_result=valuation_result,
        ai_analysis=ai_analysis,
        logo_path=None,
        uploaded_files=None,
        extracted_data=None,
        status=None,
        created_at=None,
        updated_at=None,
    )

    return analysis


if __name__ == "__main__":
    print("⚙️  Gerando relatório de exemplo Estratégico...")

    OUTPUT_DIR = BACKEND_DIR.parent / "frontend" / "public"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    TMP_DIR = Path("/tmp/qv_sample")
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    cfg.settings.REPORTS_DIR = str(TMP_DIR)

    analysis = build_mock_analysis()
    generate_report_pdf(analysis)

    # Move o PDF gerado para o nome fixo no frontend/public/
    generated = sorted(
        glob.glob(str(TMP_DIR / "quantovale-*.pdf")),
        key=lambda f: Path(f).stat().st_mtime,
        reverse=True,
    )
    if generated:
        dest = str(OUTPUT_DIR / "relatorio-exemplo.pdf")
        shutil.move(generated[0], dest)
        size_kb = Path(dest).stat().st_size // 1024
        print(f"✅ PDF gerado com sucesso!")
        print(f"   📄 {dest}")
        print(f"   📦 {size_kb} KB")
    else:
        print("❌ Nenhum PDF encontrado em /tmp/qv_sample/")
        sys.exit(1)
