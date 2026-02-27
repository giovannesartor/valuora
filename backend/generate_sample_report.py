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
from app.core.valuation_engine.engine import run_valuation, ENGINE_VERSION
import app.core.config as cfg


def build_mock_analysis():
    """Cria um objeto analysis usando o motor de valuation real (v4.1)."""

    # Run the actual valuation engine — no mock data
    valuation_result = run_valuation(
        revenue=3_800_000,
        net_margin=0.18,
        sector="tecnologia",
        growth_rate=0.28,
        debt=420_000,
        cash=310_000,
        founder_dependency=0.30,
        years_in_business=6,
        projection_years=10,
        num_employees=38,
        ebitda=820_000,
        recurring_revenue_pct=0.72,
        previous_investment=500_000,
        qualitative_answers={
            "gov_profissional": {"score": 5, "obs": "Time experiente com 6 anos no mercado e processos documentados."},
            "gov_compliance": {"score": 3},
            "mercado_lider": {"score": 3},
            "mercado_tendencia": {"score": 5, "obs": "Setor de SaaS B2B com crescimento acelerado no Brasil."},
            "financeiro_crescimento": {"score": 5},
            "financeiro_margens": {"score": 3},
            "clientes_diversificacao": {"score": 3},
            "clientes_recorrencia": {"score": 5, "obs": "72% da receita é recorrente (MRR), reduzindo risco de concentração."},
            "diferenciacao_moat": {"score": 3, "obs": "Produto integrado ao ERP do cliente com alto switching cost."},
            "escala_operacional": {"score": 3},
        },
    )

    # Ensure backward-compat keys exist for PDF service
    if "wacc_breakdown" not in valuation_result:
        ke_detail = valuation_result.get("cost_of_equity_detail", {})
        valuation_result["wacc_breakdown"] = {
            "ke": ke_detail.get("cost_of_equity", 0),
            "kd": 0,
            "we": 1.0,
            "wd": 0.0,
            "tax_rate": 0.34,
        }

    ai_analysis = """A Empresa X Serviços Digitais apresenta fundamentos financeiros consistentes com empresas SaaS B2B em estágio de crescimento acelerado. A receita recorrente representando 72% do faturamento constitui o principal diferencial competitivo do negócio, conferindo previsibilidade ao fluxo de caixa e sustentando a tese de valuation baseada em crescimento perpétuo.

O Ke (custo de capital próprio) reflete adequadamente o perfil de risco da empresa: beta QuantoVale ajustado pela alavancagem, compatível com empresas de tecnologia em expansão no Brasil. A Selic elevada comprime múltiplos de valuation versus benchmarks internacionais — fator estrutural do mercado brasileiro.

A taxa de crescimento projetada de 28% ao ano é ambiciosa mas defensável dado o histórico de crescimento de 6 anos e a expansão do mercado de SaaS B2B no Brasil. A tabela de sensibilidade demonstra a amplitude do valor da empresa sob diferentes cenários de custo de capital e crescimento.

O Score Qualitativo destaca equipe e produto como pilares da tese. O ponto de atenção crítico é escalabilidade: a empresa ainda apresenta dependência de processos manuais em onboarding e suporte, o que tende a comprimir margens conforme a base de clientes escala. Recomenda-se investimento em automação de CS antes de qualquer rodada de captação.

O DLOM aplicado é tecnicamente adequado para uma empresa com 6 anos de operação e receita recorrente. Há um upside potencial no valor final mediante preparação do data room e estruturação de governança pré-M&A."""

    equity_value = valuation_result["equity_value"]

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
        projection_years=10,
        recurring_revenue_pct=0.72,
        num_employees=38,
        years_in_business=6,
        previous_investment=500_000,
        dcf_weight=valuation_result.get("gordon_weight", 0.25),
        custom_exit_multiple=None,
        qualitative_answers=None,
        equity_value=equity_value,
        risk_score=valuation_result["risk_score"],
        maturity_index=valuation_result["maturity_index"],
        percentile=valuation_result["percentile"],
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
