"""
Gera dois relatórios de exemplo:
  - relatorio-exemplo-essencial.pdf
  - relatorio-exemplo-profissional.pdf

Saída: ~/Downloads/
Uso  : python generate_sample_essencial_profissional.py
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

_models_stub = types.ModuleType("app.models.models")
_models_stub.PlanType       = PlanType
_models_stub.PaymentStatus  = PaymentStatus
_models_stub.AnalysisStatus = AnalysisStatus
sys.modules["app.models.models"] = _models_stub

from app.services.pdf_service import generate_report_pdf
from app.core.valuation_engine.engine import run_valuation
import app.core.config as cfg

# ─── Dados financeiros base (empresa fictícia menor) ─────
REVENUE          = 1_200_000
NET_MARGIN       = 0.14
GROWTH_RATE      = 0.18
DEBT             = 180_000
CASH             = 95_000
EBITDA           = 210_000
FOUNDER_DEP      = 0.55
YEARS_IN_BUSI    = 3
PROJ_YEARS       = 5
NUM_EMPLOYEES    = 12
RECURRENT_PCT    = 0.40
PREV_INVESTMENT  = 0

QUALITATIVE = {
    "equipe_num_fundadores": {"score": 3, "obs": "2 sócios-fundadores com perfis complementares (comercial e técnico)."},
    "equipe_dedicacao":      {"score": 4, "obs": "Fundadores em dedicação exclusiva."},
    "equipe_experiencia":    {"score": 3, "obs": "Experiência média no setor; time em crescimento."},
    "gov_profissional":      {"score": 2, "obs": "Gestão ainda informal, sem board estruturado."},
    "gov_compliance":        {"score": 2, "obs": "Compliance básico em implementação."},
    "mercado_posicao":       {"score": 3, "obs": "Presença regional sólida no segmento-alvo."},
    "mercado_tendencia":     {"score": 4, "obs": "Setor com crescimento de dois dígitos no Brasil."},
    "mercado_competicao":    {"score": 3},
    "clientes_diversificacao": {"score": 3, "obs": "~20 clientes ativos; maior cliente representa 22% da receita."},
    "clientes_recorrencia":    {"score": 3, "obs": "40% de receita recorrente; base em expansão."},
    "produto_moat":            {"score": 3, "obs": "Produto diferenciado, mas sem barreiras técnicas muito altas."},
    "produto_criticidade":     {"score": 3, "obs": "Produto importante para o fluxo do cliente, mas com alternativas no mercado."},
    "operacao_escalavel":      {"score": 2, "obs": "Operação razoavelmente escalável; ainda dependente de processos manuais."},
    "operacao_automacao":      {"score": 2, "obs": "Automação incipiente (~20%); oportunidade de melhoria relevante."},
    "tracao_investimento":     {"score": 2, "obs": "Empresa bootstrapped, sem captação formal até o momento."},
}

AI_ANALYSIS_PROFISSIONAL = """A Empresa Y Comércio e Serviços apresenta perfil típico de PME em fase de consolidação de mercado. A receita de R$ 1,2 milhão reflete uma operação ainda concentrada em poucos clientes-âncora, o que representa risco relevante de concentração de receita.

A dependência de fundador (55%) é o principal fator de compressão de valor neste momento. Negócios com alta dependência de pessoas-chave enfrentam desconto expressivo em processos de M&A e captação, pois investidores precificam o risco de chave.

A taxa de crescimento de 18% ao ano é consistente com o segmento, mas abaixo da média de empresas que atraem capital de risco. O ciclo de evolução recomendado passa pela redução da dependência do fundador, aumento da recorrência de receita e formalização dos processos de governança — etapas que tendem a elevar o múltiplo implícito do negócio de forma significativa.

O valor de equity calculado posiciona a empresa no percentil de empresas de porte e maturidade similares na base QuantoVale. A recomendação central é estruturar um plano de profissionalização da gestão nos próximos 12-18 meses para maximizar valor em eventual processo de captação ou venda."""


def build_analysis(plan: PlanType) -> SimpleNamespace:
    valuation_result = run_valuation(
        revenue=REVENUE,
        net_margin=NET_MARGIN,
        sector="servicos",
        growth_rate=GROWTH_RATE,
        debt=DEBT,
        cash=CASH,
        founder_dependency=FOUNDER_DEP,
        years_in_business=YEARS_IN_BUSI,
        projection_years=PROJ_YEARS,
        num_employees=NUM_EMPLOYEES,
        ebitda=EBITDA,
        recurring_revenue_pct=RECURRENT_PCT,
        previous_investment=PREV_INVESTMENT,
        qualitative_answers=QUALITATIVE,
    )

    if "wacc_breakdown" not in valuation_result:
        ke_detail = valuation_result.get("cost_of_equity_detail", {})
        valuation_result["wacc_breakdown"] = {
            "ke": ke_detail.get("cost_of_equity", 0),
            "kd": 0,
            "we": 1.0,
            "wd": 0.0,
            "tax_rate": 0.34,
        }

    ai = AI_ANALYSIS_PROFISSIONAL if plan == PlanType.PROFISSIONAL else None

    return SimpleNamespace(
        id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
        company_name="Empresa Y Comércio e Serviços Ltda.",
        sector="Serviços",
        cnpj="98.765.432/0001-10",
        plan=plan,
        revenue=REVENUE,
        net_margin=NET_MARGIN,
        growth_rate=GROWTH_RATE,
        debt=DEBT,
        cash=CASH,
        ebitda=EBITDA,
        founder_dependency=FOUNDER_DEP,
        projection_years=PROJ_YEARS,
        recurring_revenue_pct=RECURRENT_PCT,
        num_employees=NUM_EMPLOYEES,
        years_in_business=YEARS_IN_BUSI,
        previous_investment=PREV_INVESTMENT,
        dcf_weight=valuation_result.get("gordon_weight", 0.25),
        custom_exit_multiple=None,
        qualitative_answers=None,
        equity_value=valuation_result["equity_value"],
        risk_score=valuation_result["risk_score"],
        maturity_index=valuation_result["maturity_index"],
        percentile=valuation_result["percentile"],
        valuation_result=valuation_result,
        ai_analysis=ai,
        logo_path=None,
        uploaded_files=None,
        extracted_data=None,
        status=None,
        created_at=None,
        updated_at=None,
    )


def generate(plan: PlanType, dest_name: str, downloads: Path, tmp: Path):
    label = plan.value.capitalize()
    print(f"\n⚙️  Gerando relatório de exemplo {label}...")

    analysis = build_analysis(plan)
    generate_report_pdf(analysis)

    generated = sorted(
        glob.glob(str(tmp / "quantovale-*.pdf")),
        key=lambda f: Path(f).stat().st_mtime,
        reverse=True,
    )
    if not generated:
        print(f"❌ Nenhum PDF encontrado para {label}")
        sys.exit(1)

    dest = downloads / dest_name
    shutil.move(generated[0], str(dest))
    size_kb = dest.stat().st_size // 1024
    print(f"✅ {label} gerado com sucesso!")
    print(f"   📄 {dest}")
    print(f"   📦 {size_kb} KB")


if __name__ == "__main__":
    DOWNLOADS = Path.home() / "Downloads"
    PUBLIC = BACKEND_DIR.parent / "frontend" / "public"
    PUBLIC.mkdir(parents=True, exist_ok=True)
    TMP = Path("/tmp/qv_sample")
    TMP.mkdir(parents=True, exist_ok=True)
    cfg.settings.REPORTS_DIR = str(TMP)

    generate(PlanType.ESSENCIAL,    "relatorio-exemplo-essencial.pdf",    DOWNLOADS, TMP)
    generate(PlanType.PROFISSIONAL, "relatorio-exemplo-profissional.pdf", DOWNLOADS, TMP)

    # Also copy to frontend/public for the website
    import shutil as _sh
    _sh.copy(str(DOWNLOADS / "relatorio-exemplo-essencial.pdf"),    str(PUBLIC / "relatorio-exemplo-essencial.pdf"))
    _sh.copy(str(DOWNLOADS / "relatorio-exemplo-profissional.pdf"), str(PUBLIC / "relatorio-exemplo-profissional.pdf"))
    print("\n🎉 Ambos os PDFs salvos em ~/Downloads/ e frontend/public/")
