"""
Script to generate the Fundraising Package sample report (Company X Digital Services).
Uses the real PDF engine from Valuora without requiring a database.

Usage: python generate_sample_report.py
Output: ~/Downloads/valuora-sample-fundraising.pdf + ../frontend/public/sample-report-fundraising.pdf
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
_models_stub.PlanType      = PlanType
_models_stub.PaymentStatus = PaymentStatus
_models_stub.AnalysisStatus = AnalysisStatus
sys.modules["app.models.models"] = _models_stub

from app.services.pdf_service import generate_report_pdf
from app.core.valuation_engine.engine import run_valuation, ENGINE_VERSION
import app.core.config as cfg


def build_mock_analysis():
    """Create an analysis object using the real valuation engine."""
    valuation_result = run_valuation(
        revenue=3_800_000, net_margin=0.18, sector="technology",
        growth_rate=0.28, debt=420_000, cash=310_000,
        founder_dependency=0.30, years_in_business=6,
        projection_years=10, num_employees=38, ebitda=820_000,
        recurring_revenue_pct=0.72, previous_investment=500_000,
        qualitative_answers={
            "equipe_num_fundadores": {"score": 4, "obs": "3 co-founders with complementary skills (tech, sales, ops)."},
            "equipe_dedicacao": {"score": 5, "obs": "All founders full-time dedicated since day one."},
            "equipe_experiencia": {"score": 5, "obs": "Senior team with 10+ years in B2B tech."},
            "gov_profissional": {"score": 4, "obs": "Professional management with advisory board."},
            "gov_compliance": {"score": 3, "obs": "Internal controls being formalized."},
            "mercado_posicao": {"score": 3, "obs": "Strong niche in B2B SaaS, not absolute leader."},
            "mercado_tendencia": {"score": 5, "obs": "B2B SaaS growing +30% YoY."},
            "mercado_competicao": {"score": 3},
            "clientes_diversificacao": {"score": 3, "obs": "No single client > 15% of MRR."},
            "clientes_recorrencia": {"score": 5, "obs": "72% recurring (MRR), churn < 3%."},
            "produto_moat": {"score": 4, "obs": "High switching cost, proprietary tech."},
            "produto_criticidade": {"score": 4, "obs": "Mission-critical for daily ops."},
            "operacao_escalavel": {"score": 3, "obs": "Core scalable, onboarding still manual."},
            "operacao_automacao": {"score": 3, "obs": "~40% automated, investing in CS automation."},
            "tracao_investimento": {"score": 4, "obs": "$500K seed received, pursuing Series A."},
        },
    )

    if "wacc_breakdown" not in valuation_result:
        ke_detail = valuation_result.get("cost_of_equity_detail", {})
        valuation_result["wacc_breakdown"] = {
            "ke": ke_detail.get("cost_of_equity", 0),
            "kd": 0, "we": 1.0, "wd": 0.0, "tax_rate": 0.34,
        }

    ai_analysis = (
        "Company X Digital Services shows consistent financials typical of B2B SaaS in accelerated "
        "growth. 72% recurring revenue drives strong cash flow predictability.\n\n"
        "The Ke adequately reflects the risk profile with Valuora-adjusted beta. 28% projected growth "
        "is ambitious but defensible given 6-year track record. Sensitivity table shows value range "
        "under different Ke/growth scenarios.\n\n"
        "Qualitative Score highlights team and product as thesis pillars. Critical concern: scalability "
        "— manual onboarding/support compresses margins at scale. CS automation recommended pre-fundraise.\n\n"
        "DLOM is technically adequate. Upside potential via data room prep and pre-M&A governance."
    )

    return SimpleNamespace(
        id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        company_name="Company X Digital Services LLC",
        sector="Technology", cnpj="12-3456789",
        plan=PlanType.ESTRATEGICO,
        revenue=3_800_000, net_margin=0.18, growth_rate=0.28,
        debt=420_000, cash=310_000, ebitda=820_000,
        founder_dependency=0.30, projection_years=10,
        recurring_revenue_pct=0.72, num_employees=38,
        years_in_business=6, previous_investment=500_000,
        dcf_weight=valuation_result.get("gordon_weight", 0.25),
        custom_exit_multiple=None, qualitative_answers=None,
        equity_value=valuation_result["equity_value"],
        risk_score=valuation_result["risk_score"],
        maturity_index=valuation_result["maturity_index"],
        percentile=valuation_result["percentile"],
        valuation_result=valuation_result, ai_analysis=ai_analysis,
        logo_path=None, uploaded_files=None, extracted_data=None,
        status=None, created_at=None, updated_at=None,
    )


if __name__ == "__main__":
    print("⚙️  Generating Strategic sample report...")
    OUTPUT_DIR = BACKEND_DIR.parent / "frontend" / "public"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR = Path("/tmp/valuora_sample")
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    cfg.settings.REPORTS_DIR = str(TMP_DIR)

    DOWNLOADS = Path.home() / "Downloads"

    analysis = build_mock_analysis()
    generate_report_pdf(analysis)

    generated = sorted(
        glob.glob(str(TMP_DIR / "valuora-*.pdf")),
        key=lambda f: Path(f).stat().st_mtime, reverse=True,
    )
    if generated:
        # Save to frontend/public for website
        dest_public = str(OUTPUT_DIR / "sample-report-fundraising.pdf")
        shutil.copy(generated[0], dest_public)
        # Save to ~/Downloads with valuora- prefix
        dest_dl = str(DOWNLOADS / "valuora-sample-fundraising.pdf")
        shutil.move(generated[0], dest_dl)
        size_kb = Path(dest_dl).stat().st_size // 1024
        print(f"✅ Fundraising PDF generated successfully!")
        print(f"   📄 {dest_public}")
        print(f"   📄 {dest_dl}")
        print(f"   📦 {size_kb} KB")
    else:
        print("❌ No PDF found in /tmp/valuora_sample/")
        sys.exit(1)
