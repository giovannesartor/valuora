"""
Generate two sample reports:
  - sample-report-professional.pdf   (essencial plan → LP "Professional Valuation")
  - sample-report-investor-ready.pdf (profissional plan → LP "Investor Ready")

Output: ~/Downloads/ (valuora- prefix) + frontend/public/
Usage: python generate_sample_essential_professional.py
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

# ─── Path setup ──────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent
sys.path.insert(0, str(BACKEND_DIR))

# ─── Minimal env vars (no database required) ─────────────
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("SECRET_KEY", "sample-key-for-pdf-generation-only")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_sample")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_sample")
os.environ.setdefault("APP_URL", "https://valuora.online")
os.environ.setdefault("REPORTS_DIR", "/tmp/valuora_sample")
os.environ.setdefault("UPLOADS_DIR", "/tmp/valuora_uploads")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("MAIL_USERNAME", "noreply@valuora.online")
os.environ.setdefault("MAIL_PASSWORD", "sample")
os.environ.setdefault("MAIL_FROM", "noreply@valuora.online")
os.environ.setdefault("MAIL_SERVER", "smtp.example.com")
os.environ.setdefault("MAIL_PORT", "587")

# ─── Heavy module stubs (avoids DB imports) ──────────────
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

# ─── Local enum that mirrors PlanType from models ────────
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

# ─── Base financial data (smaller fictional company) ─────
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
    "equipe_num_fundadores": {"score": 3, "obs": "2 co-founders with complementary profiles (commercial and technical)."},
    "equipe_dedicacao":      {"score": 4, "obs": "Both founders are full-time dedicated."},
    "equipe_experiencia":    {"score": 3, "obs": "Average industry experience; growing team."},
    "gov_profissional":      {"score": 2, "obs": "Informal management, no structured board yet."},
    "gov_compliance":        {"score": 2, "obs": "Basic compliance in early implementation."},
    "mercado_posicao":       {"score": 3, "obs": "Solid regional presence in the target segment."},
    "mercado_tendencia":     {"score": 4, "obs": "Sector growing at double digits."},
    "mercado_competicao":    {"score": 3},
    "clientes_diversificacao": {"score": 3, "obs": "~20 active clients; largest represents 22% of revenue."},
    "clientes_recorrencia":    {"score": 3, "obs": "40% recurring revenue; growing base."},
    "produto_moat":            {"score": 3, "obs": "Differentiated product but no very high technical barriers."},
    "produto_criticidade":     {"score": 3, "obs": "Important for client workflow, but alternatives exist."},
    "operacao_escalavel":      {"score": 2, "obs": "Reasonably scalable; still dependent on manual processes."},
    "operacao_automacao":      {"score": 2, "obs": "Early-stage automation (~20%); significant improvement opportunity."},
    "tracao_investimento":     {"score": 2, "obs": "Bootstrapped company, no formal fundraising to date."},
}

AI_ANALYSIS_PROFESSIONAL = (
    "Company Y Commerce & Services presents a typical profile of an SME consolidating its market "
    "position. Revenue of $1.2M reflects an operation still concentrated among a few anchor clients, "
    "representing significant revenue concentration risk.\n\n"
    "Founder dependency (55%) is the primary value compression factor. High key-person dependency leads "
    "to significant discounts in M&A and fundraising, as investors price key-person risk.\n\n"
    "The 18% annual growth rate is consistent with the segment but below the average for companies "
    "attracting venture capital. The recommended evolution path involves reducing founder dependency, "
    "increasing revenue recurrence, and formalizing governance processes — steps that tend to "
    "significantly increase the implied business multiple.\n\n"
    "The calculated equity value positions the company in the percentile of similarly sized and "
    "mature businesses in the Valuora database. The central recommendation is to structure a "
    "management professionalization plan over the next 12-18 months to maximize value in any "
    "potential fundraising or exit process."
)


def build_analysis(plan: PlanType) -> SimpleNamespace:
    valuation_result = run_valuation(
        revenue=REVENUE, net_margin=NET_MARGIN, sector="services",
        growth_rate=GROWTH_RATE, debt=DEBT, cash=CASH,
        founder_dependency=FOUNDER_DEP, years_in_business=YEARS_IN_BUSI,
        projection_years=PROJ_YEARS, num_employees=NUM_EMPLOYEES,
        ebitda=EBITDA, recurring_revenue_pct=RECURRENT_PCT,
        previous_investment=PREV_INVESTMENT,
        qualitative_answers=QUALITATIVE,
    )

    if "wacc_breakdown" not in valuation_result:
        ke_detail = valuation_result.get("cost_of_equity_detail", {})
        valuation_result["wacc_breakdown"] = {
            "ke": ke_detail.get("cost_of_equity", 0),
            "kd": 0, "we": 1.0, "wd": 0.0, "tax_rate": 0.34,
        }

    ai = AI_ANALYSIS_PROFESSIONAL if plan == PlanType.PROFISSIONAL else None

    return SimpleNamespace(
        id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
        company_name="Company Y Commerce & Services LLC",
        sector="Services", cnpj="98-7654321",
        plan=plan,
        revenue=REVENUE, net_margin=NET_MARGIN, growth_rate=GROWTH_RATE,
        debt=DEBT, cash=CASH, ebitda=EBITDA,
        founder_dependency=FOUNDER_DEP, projection_years=PROJ_YEARS,
        recurring_revenue_pct=RECURRENT_PCT, num_employees=NUM_EMPLOYEES,
        years_in_business=YEARS_IN_BUSI, previous_investment=PREV_INVESTMENT,
        dcf_weight=valuation_result.get("gordon_weight", 0.25),
        custom_exit_multiple=None, qualitative_answers=None,
        equity_value=valuation_result["equity_value"],
        risk_score=valuation_result["risk_score"],
        maturity_index=valuation_result["maturity_index"],
        percentile=valuation_result["percentile"],
        valuation_result=valuation_result, ai_analysis=ai,
        logo_path=None, uploaded_files=None, extracted_data=None,
        status=None, created_at=None, updated_at=None,
    )


def generate(plan: PlanType, dest_name: str, downloads: Path, tmp: Path):
    label = plan.value.capitalize()
    print(f"\n⚙️  Generating {label} sample report...")

    analysis = build_analysis(plan)
    generate_report_pdf(analysis)

    generated = sorted(
        glob.glob(str(tmp / "valuora-*.pdf")),
        key=lambda f: Path(f).stat().st_mtime, reverse=True,
    )
    if not generated:
        print(f"❌ No PDF found for {label}")
        sys.exit(1)

    dest = downloads / dest_name
    shutil.move(generated[0], str(dest))
    size_kb = dest.stat().st_size // 1024
    print(f"✅ {label} generated successfully!")
    print(f"   📄 {dest}")
    print(f"   📦 {size_kb} KB")


if __name__ == "__main__":
    DOWNLOADS = Path.home() / "Downloads"
    PUBLIC = BACKEND_DIR.parent / "frontend" / "public"
    PUBLIC.mkdir(parents=True, exist_ok=True)
    TMP = Path("/tmp/valuora_sample")
    TMP.mkdir(parents=True, exist_ok=True)
    cfg.settings.REPORTS_DIR = str(TMP)

    generate(PlanType.ESSENCIAL,    "valuora-sample-professional.pdf",    DOWNLOADS, TMP)
    generate(PlanType.PROFISSIONAL, "valuora-sample-investor-ready.pdf", DOWNLOADS, TMP)

    # Also copy to frontend/public for the website (without valuora- prefix)
    import shutil as _sh
    _sh.copy(str(DOWNLOADS / "valuora-sample-professional.pdf"),    str(PUBLIC / "sample-report-professional.pdf"))
    _sh.copy(str(DOWNLOADS / "valuora-sample-investor-ready.pdf"), str(PUBLIC / "sample-report-investor-ready.pdf"))
    print("\n🎉 Both PDFs saved to ~/Downloads/ and frontend/public/")
