"""
Generate an example Pitch Deck PDF for the landing page download.
Run: python generate_sample_pitchdeck.py
Output: ../frontend/public/sample-pitchdeck.pdf
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Mock settings
class MockSettings:
    REPORTS_DIR = "/tmp/pitchdeck_temp"
    UPLOADS_DIR = "/tmp/uploads"
    DEEPSEEK_API_KEY = ""
    DEEPSEEK_API_URL = ""

# Patch settings before importing
import app.core.config as config_module
config_module.settings = MockSettings()

from app.services.pitch_deck_pdf_service import generate_pitch_deck_pdf
from pathlib import Path


class MockDeck:
    """Mock PitchDeck model with sample data."""
    id = "sample"
    company_name = "TechFlow Solutions"
    sector = "Technology / SaaS B2B"
    slogan = "Automating processes for the future of growing businesses"
    logo_path = None
    website = "www.techflow.io"
    contact_email = "hello@techflow.io"
    contact_phone = "+1 (555) 987-6543"

    headline = "TechFlow is the affordable Salesforce for growing businesses — CRM + automation + BI at 10x less cost."

    ai_headline = "TechFlow is the affordable Salesforce for growing businesses — CRM + automation + BI at 10x less cost."

    problem = (
        "Over 30 million SMBs worldwide operate without an adequate CRM. "
        "Manual processes, disorganized spreadsheets, and lack of structured data "
        "cost up to 30% of sales productivity. Enterprise solutions like Salesforce "
        "are inaccessible for companies with revenue below $10M/year — both "
        "in cost ($500-2,000/month/user) and implementation complexity.\n\n"
        "The result: sales teams that miss opportunities, managers making "
        "decisions without data, and businesses growing less than they could."
    )
    ai_problem = None

    solution = (
        "TechFlow offers an all-in-one platform for CRM, process automation, "
        "and business intelligence designed exclusively for growing SMBs. With "
        "setup in under 24 hours, intuitive interface, and pricing starting at $49/month "
        "per user, we eliminate traditional adoption barriers.\n\n"
        "Our differentiator: predictive AI that analyzes sales patterns and suggests "
        "automated actions — like follow-ups, dormant lead re-engagement, and "
        "opportunity prioritization by close probability."
    )
    ai_solution = None

    target_market = {
        "description": "SMBs with 5 to 200 employees in services, retail, "
                       "manufacturing, and technology sectors. Focus on companies with revenue "
                       "between $1M and $50M/year that already have a structured sales team.",
        "tam": "$42 billion",
        "sam": "$8.5 billion",
        "som": "$340 million",
        "segments": [
            "Professional services firms (accounting, legal, consulting)",
            "E-commerce and retailers with sales teams",
            "Light manufacturing with channel management",
            "Early-stage startups scaling up",
        ],
    }

    competitive_landscape = [
        {"competitor": "Salesforce", "advantage": "10x cheaper, 24h setup vs 3 months"},
        {"competitor": "HubSpot", "advantage": "More affordable pricing, dedicated support"},
        {"competitor": "Pipedrive", "advantage": "Integrated BI + automation + predictive AI"},
        {"competitor": "Monday CRM", "advantage": "Superior AI engine + advanced BI analytics"},
        {"competitor": "Spreadsheets", "advantage": "Automation, centralization, and real-time insights"},
    ]

    business_model = (
        "B2B SaaS model with monthly recurring subscription (MRR). Three plans:\n\n"
        "• Starter ($49/month/user): Basic CRM + visual pipeline\n"
        "• Professional ($99/month/user): + automation + BI reports\n"
        "• Enterprise ($199/month/user): + predictive AI + API + customization\n\n"
        "Additional revenue mix: premium onboarding ($2,000 setup fee), "
        "custom integrations, and add-on marketplace (30% rev share).\n\n"
        "Current unit economics:\n"
        "• ARPU: $890/month\n"
        "• LTV: $32,000\n"
        "• CAC: $1,800\n"
        "• LTV/CAC: 17.8x\n"
        "• Monthly churn: 2.8%"
    )
    ai_business_model = None

    sales_channels = (
        "Multi-channel strategy focused on product-led growth (PLG):\n\n"
        "1. Self-service (45% of sales): 14-day free trial → conversion via in-app\n"
        "2. Inside Sales (35%): SDRs qualify inbound leads via content marketing\n"
        "3. Partnerships (15%): partner program with accountants and consultancies\n"
        "4. Marketplace (5%): listing on SaaS directories and integration platforms"
    )
    ai_sales_channels = None

    marketing_activities = (
        "Inbound-first strategy with CAC payback < 6 months:\n\n"
        "• Content Marketing: blog with 200+ SEO articles (45K organic visits/month)\n"
        "• Weekly webinars with 8.5% conversion rate\n"
        "• YouTube channel with tutorials and case studies (12K subscribers)\n"
        "• LinkedIn: CEO thought leadership (18K followers)\n"
        "• Referral program: 20% of sales come from referrals"
    )
    ai_marketing = None

    financial_projections = [
        {"year": 2025, "revenue": 2400000, "expenses": 2800000, "profit": -400000},
        {"year": 2026, "revenue": 6500000, "expenses": 5200000, "profit": 1300000},
        {"year": 2027, "revenue": 15000000, "expenses": 10500000, "profit": 4500000},
        {"year": 2028, "revenue": 30000000, "expenses": 19500000, "profit": 10500000},
        {"year": 2029, "revenue": 52000000, "expenses": 31200000, "profit": 20800000},
    ]

    funding_needs = {
        "amount": 5000000,
        "description": (
            "We are seeking $5M in a Seed round to accelerate growth and reach "
            "breakeven by Q3 2026. Capital will be primarily allocated to "
            "engineering (product + AI) and customer acquisition."
        ),
        "breakdown": [
            {"label": "Engineering & Product", "value": 2000000},
            {"label": "Marketing & Sales", "value": 1500000},
            {"label": "Operations & Support", "value": 750000},
            {"label": "Strategic Reserve", "value": 750000},
        ],
    }
    ai_funding_use = None

    milestones = [
        {"title": "MVP Launched", "date": "Jan 2024", "description": "First CRM version with visual pipeline", "status": "completed"},
        {"title": "100 Paying Customers", "date": "Jun 2024", "description": "Product-market fit milestone", "status": "completed"},
        {"title": "AI Module v1", "date": "Nov 2024", "description": "Predictive AI for lead scoring", "status": "completed"},
        {"title": "Seed Round $5M", "date": "Q1 2025", "description": "Capital to scale team and marketing", "status": "in_progress"},
        {"title": "1,000 Customers", "date": "Q3 2025", "description": "Scale with healthy unit economics", "status": "upcoming"},
        {"title": "$1M MRR", "date": "Q1 2026", "description": "Series A milestone", "status": "upcoming"},
        {"title": "Operational Breakeven", "date": "Q3 2026", "description": "Financial sustainability", "status": "upcoming"},
        {"title": "International Expansion", "date": "Q1 2027", "description": "UK and Canada as first markets", "status": "upcoming"},
    ]

    team = [
        {
            "name": "Sarah Mitchell",
            "role": "CEO & Co-founder",
            "bio": "12 years in SaaS. Ex-Salesforce, led enterprise operations with 200+ clients.",
            "linkedin": "https://linkedin.com/in/sarahmitchell",
            "photo_url": "",
        },
        {
            "name": "James Chen",
            "role": "CTO & Co-founder",
            "bio": "PhD in AI from MIT. Ex-Twilio, architected platform processing 50M requests/day.",
            "linkedin": "https://linkedin.com/in/jameschen",
            "photo_url": "",
        },
        {
            "name": "Emily Rodriguez",
            "role": "VP Sales",
            "bio": "8 years in B2B SaaS sales. Ex-HubSpot, built inside sales team from 0 to 40 reps.",
            "linkedin": "https://linkedin.com/in/emilyrodriguez",
            "photo_url": "",
        },
        {
            "name": "David Park",
            "role": "VP Product",
            "bio": "10 years in product. Ex-Stripe, led payments squad with 15M+ active users.",
            "linkedin": "https://linkedin.com/in/davidpark",
            "photo_url": "",
        },
    ]

    partners_resources = [
        {"name": "AWS Activate — cloud credits and technical support"},
        {"name": "Y Combinator Alumni Network"},
        {"name": "National Small Business Association (NSBA)"},
        {"name": "Sage Accounting — distribution partnership"},
    ]

    pdf_path = None
    pdf_generated_at = None
    status = "completed"
    is_paid = True
    analysis_id = None


def main():
    output_dir = Path(__file__).parent.parent / "frontend" / "public"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Temp dir for generation
    Path("/tmp/pitchdeck_temp").mkdir(exist_ok=True)

    deck = MockDeck()

    # Mock analysis data for valuation section
    analysis_data = {
        "equity_value": 18500000,
        "revenue": 2400000,
        "net_margin": -0.167,
        "growth_rate": 1.71,
        "ebitda": -200000,
        "risk_score": 45,
        "valuation_result": {
            "wacc": 0.185,
            "fcf_projections": [
                {"year": 1, "revenue": 6500000, "fcf": 800000},
                {"year": 2, "revenue": 15000000, "fcf": 3200000},
                {"year": 3, "revenue": 30000000, "fcf": 7500000},
                {"year": 4, "revenue": 52000000, "fcf": 15000000},
                {"year": 5, "revenue": 80000000, "fcf": 24000000},
            ],
            "valuation_range": {
                "low": 12000000,
                "mid": 18500000,
                "high": 28000000,
            },
        },
    }

    filepath = generate_pitch_deck_pdf(deck, analysis_data)

    # Move to public dir + Downloads
    import shutil
    dest_public = str(output_dir / "sample-pitchdeck.pdf")
    shutil.copy(filepath, dest_public)
    dest_dl = str(Path.home() / "Downloads" / "valuora-sample-pitchdeck.pdf")
    shutil.move(filepath, dest_dl)
    print(f"✅ Example pitch deck generated:")
    print(f"   📄 {dest_public}")
    print(f"   📄 {dest_dl}")


if __name__ == "__main__":
    main()
