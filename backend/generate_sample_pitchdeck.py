"""
Generate an example Pitch Deck PDF for the landing page download.
Run: python generate_sample_pitchdeck.py
Output: ../frontend/public/pitchdeck-exemplo.pdf
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
    id = "exemplo"
    company_name = "TechFlow Solutions"
    sector = "Tecnologia / SaaS B2B"
    slogan = "Automatizando processos para o futuro das PMEs brasileiras"
    logo_path = None
    website = "www.techflow.com.br"
    contact_email = "contato@techflow.com.br"
    contact_phone = "(11) 99999-8888"

    headline = "TechFlow é o Salesforce acessível para PMEs brasileiras — CRM + automação + BI por 10x menos."

    ai_headline = "TechFlow é o Salesforce acessível para PMEs brasileiras — CRM + automação + BI por 10x menos."

    problem = (
        "Mais de 6 milhões de PMEs no Brasil operam sem um CRM adequado. "
        "Processos manuais, planilhas desorganizadas e falta de dados estruturados "
        "custam até 30% da produtividade comercial. Soluções enterprise como Salesforce "
        "são inacessíveis para empresas com faturamento abaixo de R$ 10M/ano — tanto "
        "pelo custo (R$ 500-2.000/mês/usuário) quanto pela complexidade de implantação.\n\n"
        "O resultado: equipes de vendas que perdem oportunidades, gestores que tomam "
        "decisões sem dados e empresas que crescem menos do que poderiam."
    )
    ai_problem = None

    solution = (
        "A TechFlow oferece uma plataforma all-in-one de CRM, automação de processos "
        "e business intelligence desenhada exclusivamente para PMEs brasileiras. Com "
        "setup em menos de 24 horas, interface intuitiva e preço a partir de R$ 49/mês "
        "por usuário, eliminamos as barreiras tradicionais de adoção.\n\n"
        "Nosso diferencial: IA preditiva que analisa padrões de vendas e sugere ações "
        "automáticas — como follow-ups, re-engajamento de leads dormentes e priorização "
        "de oportunidades por probabilidade de fechamento."
    )
    ai_solution = None

    target_market = {
        "description": "PMEs brasileiras com 5 a 200 funcionários nos setores de serviços, "
                       "varejo, indústria e tecnologia. Foco em empresas com faturamento "
                       "entre R$ 1M e R$ 50M/ano que já possuem equipe comercial estruturada.",
        "tam": "R$ 42 bilhões",
        "sam": "R$ 8,5 bilhões",
        "som": "R$ 340 milhões",
        "segments": [
            "Empresas de serviços profissionais (contabilidade, advocacia, consultoria)",
            "E-commerces e varejistas com equipe de vendas",
            "Indústrias leves com channel management",
            "Startups early-stage em escala",
        ],
    }

    competitive_landscape = [
        {"competitor": "Salesforce", "advantage": "10x mais barato, setup 24h vs 3 meses"},
        {"competitor": "HubSpot", "advantage": "Preço acessível em BRL, suporte local em PT-BR"},
        {"competitor": "Pipedrive", "advantage": "BI integrado + automação + IA preditiva"},
        {"competitor": "RD Station CRM", "advantage": "Motor de IA superiore + BI avançado"},
        {"competitor": "Planilhas Excel", "advantage": "Automação, centralização e insights em tempo real"},
    ]

    business_model = (
        "Modelo SaaS B2B com assinatura mensal recorrente (MRR). Três planos:\n\n"
        "• Starter (R$ 49/mês/usuário): CRM básico + pipeline visual\n"
        "• Professional (R$ 99/mês/usuário): + automação + relatórios BI\n"
        "• Enterprise (R$ 199/mês/usuário): + IA preditiva + API + customização\n\n"
        "Revenue mix adicional: onboarding premium (R$ 2.000 setup fee), "
        "integrações customizadas e marketplace de add-ons (rev share 30%).\n\n"
        "Unit economics atuais:\n"
        "• ARPU: R$ 890/mês\n"
        "• LTV: R$ 32.000\n"
        "• CAC: R$ 1.800\n"
        "• LTV/CAC: 17,8x\n"
        "• Churn mensal: 2,8%"
    )
    ai_business_model = None

    sales_channels = (
        "Estratégia multi-channel com foco em product-led growth (PLG):\n\n"
        "1. Self-service (45% das vendas): trial grátis de 14 dias → conversão via in-app\n"
        "2. Inside Sales (35%): SDRs qualificam leads inbound via content marketing\n"
        "3. Parcerias (15%): programa de parceiros com contadores e consultorias\n"
        "4. Marketplace (5%): listagem em diretórios SaaS e plataformas de integração"
    )
    ai_sales_channels = None

    marketing_activities = (
        "Estratégia inbound-first com CAC payback < 6 meses:\n\n"
        "• Content Marketing: blog com 200+ artigos SEO (45K visitas/mês orgânicas)\n"
        "• Webinars semanais com taxa de conversão de 8,5%\n"
        "• YouTube channel com tutoriais e cases (12K inscritos)\n"
        "• LinkedIn: thought leadership do CEO (18K seguidores)\n"
        "• Programa de indicação: 20% das vendas vêm de referral"
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
            "Buscamos R$ 5M em rodada Seed para acelerar crescimento e alcançar "
            "breakeven no Q3 2026. O capital será destinado principalmente a "
            "engenharia (produto + IA) e aquisição de clientes."
        ),
        "breakdown": [
            {"label": "Engenharia & Produto", "value": 2000000},
            {"label": "Marketing & Vendas", "value": 1500000},
            {"label": "Operações & Suporte", "value": 750000},
            {"label": "Reserva Estratégica", "value": 750000},
        ],
    }
    ai_funding_use = None

    milestones = [
        {"title": "MVP lançado", "date": "Jan 2024", "description": "Primeira versão do CRM com pipeline visual", "status": "completed"},
        {"title": "100 clientes pagantes", "date": "Jun 2024", "description": "Marco de product-market fit", "status": "completed"},
        {"title": "Módulo de IA v1", "date": "Nov 2024", "description": "IA preditiva para scoring de leads", "status": "completed"},
        {"title": "Rodada Seed R$ 5M", "date": "Q1 2025", "description": "Capital para escalar time e marketing", "status": "in_progress"},
        {"title": "1.000 clientes", "date": "Q3 2025", "description": "Escala com unit economics saudável", "status": "upcoming"},
        {"title": "MRR R$ 1M", "date": "Q1 2026", "description": "Milestone para Series A", "status": "upcoming"},
        {"title": "Breakeven operacional", "date": "Q3 2026", "description": "Sustentabilidade financeira", "status": "upcoming"},
        {"title": "Expansão LATAM", "date": "Q1 2027", "description": "Colômbia e México como primeiros mercados", "status": "upcoming"},
    ]

    team = [
        {"name": "Ana Silva", "role": "CEO & Co-founder — Ex-Salesforce, 12 anos em SaaS"},
        {"name": "Carlos Mendes", "role": "CTO & Co-founder — Ex-VTEX, PhD em IA (USP)"},
        {"name": "Fernanda Lima", "role": "VP Sales — Ex-RD Station, 8 anos em vendas B2B"},
        {"name": "Ricardo Oliveira", "role": "VP Product — Ex-Nubank, 10 anos em produto"},
        {"name": "Juliana Santos", "role": "Head of Marketing — Ex-Rock Content, growth"},
        {"name": "Pedro Costa", "role": "Head of Engineering — Ex-iFood, infra & DevOps"},
    ]

    partners_resources = [
        {"name": "AWS Activate — créditos cloud e suporte técnico"},
        {"name": "Y Combinator Alumni Network"},
        {"name": "Associação de PMEs do Brasil (APMB)"},
        {"name": "Sage Contabilidade — parceria de distribuição"},
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
    
    # Move to public dir
    import shutil
    dest = str(output_dir / "pitchdeck-exemplo.pdf")
    shutil.move(filepath, dest)
    print(f"✅ Example pitch deck generated: {dest}")


if __name__ == "__main__":
    main()
