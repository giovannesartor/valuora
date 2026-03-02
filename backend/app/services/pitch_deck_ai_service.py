"""
Quanto Vale — Pitch Deck AI Service
Usa DeepSeek para melhorar seções do pitch deck.
"""
import json
import logging
from typing import Dict, Any, Optional
from app.services.deepseek_service import call_deepseek

logger = logging.getLogger(__name__)


# ─── Section Prompts ─────────────────────────────────────

SECTION_PROMPTS = {
    "headline": """Você é um especialista em pitch decks para investidores.

Crie um headline/tagline estratégico e impactante para a empresa abaixo.
O headline deve ser curto (1-2 frases), memorável e comunicar claramente a proposta de valor.
Inspire-se no padrão Y Combinator: "[Empresa] é [analogia] para [mercado]" ou similar.

Empresa: {company_name}
Setor: {sector}
Texto atual do usuário: {current_text}
{context_block}

Retorne APENAS o headline, sem aspas, sem explicação.""",

    "problem": """Você é um especialista em pitch decks para investidores.

Reescreva a seção "Problema" do pitch deck desta empresa para que seja mais clara, impactante e convincente.
O problema deve ser descrito de forma que o investidor sinta a dor do cliente. Use dados quando possível.
Máximo 3 parágrafos.

Empresa: {company_name}
Setor: {sector}
Texto atual do usuário: {current_text}
{context_block}

Retorne APENAS o texto melhorado da seção problema, sem títulos, sem explicação.""",

    "solution": """Você é um especialista em pitch decks para investidores.

Reescreva a seção "Solução" do pitch deck. A solução deve ser descrita de forma clara, 
diferenciada e que mostre por que esta empresa é a melhor posicionada para resolver o problema.
Destaque o diferencial competitivo. Máximo 3 parágrafos.

Empresa: {company_name}
Setor: {sector}
Texto atual do usuário: {current_text}
{context_block}

Retorne APENAS o texto melhorado da seção solução, sem títulos, sem explicação.""",

    "business_model": """Você é um especialista em pitch decks para investidores.

Reescreva a seção "Modelo de Negócios" para que fique clara, estruturada e mostre
escalabilidade. Inclua fontes de receita, modelo de precificação e unit economics se possível.
Máximo 4 parágrafos.

Empresa: {company_name}
Setor: {sector}
Texto atual do usuário: {current_text}
{context_block}

Retorne APENAS o texto melhorado, sem títulos, sem explicação.""",

    "sales_channels": """Você é um especialista em pitch decks para investidores.

Reescreva a seção "Canais de Vendas" do pitch deck. Descreva de forma clara e estratégica
os canais de distribuição, aquisição de clientes e estratégia go-to-market.
Máximo 3 parágrafos.

Empresa: {company_name}
Setor: {sector}
Texto atual do usuário: {current_text}
{context_block}

Retorne APENAS o texto melhorado, sem títulos, sem explicação.""",

    "marketing": """Você é um especialista em pitch decks para investidores.

Reescreva a seção "Marketing & Crescimento" do pitch deck. Descreva as estratégias 
de aquisição, retenção e crescimento. Mencione CAC, LTV e canais específicos quando possível.
Máximo 3 parágrafos.

Empresa: {company_name}
Setor: {sector}
Texto atual do usuário: {current_text}
{context_block}

Retorne APENAS o texto melhorado, sem títulos, sem explicação.""",

    "funding_use": """Você é um especialista em pitch decks para investidores.

Reescreva a seção "Uso dos Recursos" do pitch deck. Descreva de forma clara e detalhada
como o capital será investido, com percentuais por área e justificativas estratégicas.
O investidor precisa sentir que o dinheiro será bem aplicado. Máximo 3 parágrafos.

Empresa: {company_name}
Setor: {sector}
Texto atual do usuário: {current_text}
{context_block}

Retorne APENAS o texto melhorado, sem títulos, sem explicação.""",
}


async def improve_pitch_section(
    section: str,
    current_text: str,
    company_name: str,
    sector: str = "",
    context: str = "",
) -> str:
    """
    Improve a single pitch deck section using AI.
    
    Args:
        section: One of 'headline', 'problem', 'solution', 'business_model',
                 'sales_channels', 'marketing', 'funding_use'
        current_text: The user's current text for this section
        company_name: Company name for context
        sector: Company sector
        context: Additional context from the user
    
    Returns:
        Improved text string
    """
    prompt_template = SECTION_PROMPTS.get(section)
    if not prompt_template:
        raise ValueError(f"Seção inválida para melhoria por IA: {section}")

    context_block = f"Contexto adicional: {context}" if context else ""

    prompt = prompt_template.format(
        company_name=company_name,
        sector=sector,
        current_text=current_text or "(vazio — crie do zero)",
        context_block=context_block,
    )

    try:
        result = await call_deepseek(prompt, max_tokens=1500)
        # Clean up common artifacts
        result = result.strip().strip('"').strip("'")
        return result
    except Exception as e:
        logger.error(f"AI improve_pitch_section failed for {section}: {e}")
        raise


FULL_PITCH_PROMPT = """Você é um especialista em pitch decks para investidores no estilo Y Combinator.

Com base nos dados abaixo da empresa, gere conteúdo profissional para TODAS as seções do pitch deck.
Use tom profissional, direto e orientado a investidores.
Priorize dados concretos. Escreva em português brasileiro.

DADOS DA EMPRESA:
- Nome: {company_name}
- Setor: {sector}
- Slogan: {slogan}
- Problema: {problem}
- Solução: {solution}
- Modelo de Negócios: {business_model}
- Canais de Vendas: {sales_channels}
- Marketing: {marketing}
- Necessidade de Capital: {funding_description}

Retorne um JSON válido com exatamente estas chaves:
{{
  "ai_headline": "tagline impactante de 1-2 frases",
  "ai_problem": "problema reescrito, 2-3 parágrafos",
  "ai_solution": "solução reescrita, 2-3 parágrafos",
  "ai_business_model": "modelo de negócios reescrito, 3-4 parágrafos",
  "ai_sales_channels": "canais de vendas reescritos, 2-3 parágrafos",
  "ai_marketing": "marketing reescrito, 2-3 parágrafos",
  "ai_funding_use": "uso dos recursos reescrito, 2-3 parágrafos"
}}

Retorne APENAS o JSON válido, sem texto adicional, sem markdown code block."""


async def generate_all_ai_sections(deck) -> Dict[str, str]:
    """
    Generate AI-improved content for ALL sections at once.
    Used during PDF generation background task.
    
    Args:
        deck: PitchDeck SQLAlchemy model instance
    
    Returns:
        Dict with keys like 'ai_headline', 'ai_problem', etc.
    """
    funding_desc = ""
    if deck.funding_needs:
        funding_desc = deck.funding_needs.get("description", "")
        amount = deck.funding_needs.get("amount")
        if amount:
            funding_desc = f"R$ {amount:,.2f} — {funding_desc}"

    prompt = FULL_PITCH_PROMPT.format(
        company_name=deck.company_name or "",
        sector=deck.sector or "",
        slogan=deck.slogan or "",
        problem=deck.problem or "",
        solution=deck.solution or "",
        business_model=deck.business_model or "",
        sales_channels=deck.sales_channels or "",
        marketing=deck.marketing_activities or "",
        funding_description=funding_desc,
    )

    try:
        result = await call_deepseek(prompt, max_tokens=4000)

        # Parse JSON
        json_start = result.find("{")
        json_end = result.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            data = json.loads(result[json_start:json_end])
            # Validate keys
            valid_keys = {
                "ai_headline", "ai_problem", "ai_solution",
                "ai_business_model", "ai_sales_channels",
                "ai_marketing", "ai_funding_use",
            }
            return {k: v for k, v in data.items() if k in valid_keys and isinstance(v, str)}

        logger.warning("generate_all_ai_sections: could not parse JSON from DeepSeek response")
        return {}

    except Exception as e:
        logger.error(f"generate_all_ai_sections failed: {e}")
        return {}
