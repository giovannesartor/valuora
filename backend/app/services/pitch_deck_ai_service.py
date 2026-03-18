"""
Quanto Vale — Pitch Deck AI Service
Uses DeepSeek to improve pitch deck sections.
"""
import json
import logging
from typing import Dict, Any, Optional
from app.services.deepseek_service import call_deepseek

logger = logging.getLogger(__name__)


# ─── Section Prompts ─────────────────────────────────────

SECTION_PROMPTS = {
    "headline": """You are an expert in investor pitch decks.

Create a strategic and impactful headline/tagline for the company below.
The headline should be short (1-2 sentences), memorable, and clearly communicate the value proposition.
Follow the Y Combinator pattern: "[Company] is [analogy] for [market]" or similar.

Company: {company_name}
Sector: {sector}
Current user text: {current_text}
{context_block}

Return ONLY the headline, no quotes, no explanation.""",

    "problem": """You are an expert in investor pitch decks.

Rewrite the "Problem" section of this company's pitch deck to be clearer, more impactful, and convincing.
The problem should be described in a way that makes the investor feel the customer's pain. Use data when possible.
Maximum 3 paragraphs.

Company: {company_name}
Sector: {sector}
Current user text: {current_text}
{context_block}

Return ONLY the improved problem section text, no titles, no explanation.""",

    "solution": """You are an expert in investor pitch decks.

Rewrite the "Solution" section of the pitch deck. The solution should be described clearly,
differentiated, and show why this company is best positioned to solve the problem.
Highlight the competitive advantage. Maximum 3 paragraphs.

Company: {company_name}
Sector: {sector}
Current user text: {current_text}
{context_block}

Return ONLY the improved solution section text, no titles, no explanation.""",

    "business_model": """You are an expert in investor pitch decks.

Rewrite the "Business Model" section to be clear, structured, and show
scalability. Include revenue sources, pricing model, and unit economics if possible.
Maximum 4 paragraphs.

Company: {company_name}
Sector: {sector}
Current user text: {current_text}
{context_block}

Return ONLY the improved text, no titles, no explanation.""",

    "sales_channels": """You are an expert in investor pitch decks.

Rewrite the "Sales Channels" section of the pitch deck. Clearly and strategically describe
distribution channels, customer acquisition, and go-to-market strategy.
Maximum 3 paragraphs.

Company: {company_name}
Sector: {sector}
Current user text: {current_text}
{context_block}

Return ONLY the improved text, no titles, no explanation.""",

    "marketing": """You are an expert in investor pitch decks.

Rewrite the "Marketing & Growth" section of the pitch deck. Describe acquisition,
retention, and growth strategies. Mention CAC, LTV, and specific channels when possible.
Maximum 3 paragraphs.

Company: {company_name}
Sector: {sector}
Current user text: {current_text}
{context_block}

Return ONLY the improved text, no titles, no explanation.""",

    "funding_use": """You are an expert in investor pitch decks.

Rewrite the "Use of Funds" section of the pitch deck. Clearly and in detail describe
how the capital will be invested, with percentages by area and strategic justifications.
The investor needs to feel the money will be well applied. Maximum 3 paragraphs.

Company: {company_name}
Sector: {sector}
Current user text: {current_text}
{context_block}

Return ONLY the improved text, no titles, no explanation.""",
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
        raise ValueError(f"Invalid section for AI improvement: {section}")

    context_block = f"Additional context: {context}" if context else ""

    prompt = prompt_template.format(
        company_name=company_name,
        sector=sector,
        current_text=current_text or "(empty — create from scratch)",
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


FULL_PITCH_PROMPT = """You are an expert in Y Combinator-style investor pitch decks.

Based on the company data below, generate professional content for ALL pitch deck sections.
Use a professional, direct, investor-oriented tone.
Prioritize concrete data. Write in English.

COMPANY DATA:
- Name: {company_name}
- Sector: {sector}
- Slogan: {slogan}
- Problem: {problem}
- Solution: {solution}
- Business Model: {business_model}
- Sales Channels: {sales_channels}
- Marketing: {marketing}
- Funding Needs: {funding_description}

Return a valid JSON with exactly these keys:
{{
  "ai_headline": "impactful 1-2 sentence tagline",
  "ai_problem": "rewritten problem, 2-3 paragraphs",
  "ai_solution": "rewritten solution, 2-3 paragraphs",
  "ai_business_model": "rewritten business model, 3-4 paragraphs",
  "ai_sales_channels": "rewritten sales channels, 2-3 paragraphs",
  "ai_marketing": "rewritten marketing, 2-3 paragraphs",
  "ai_funding_use": "rewritten use of funds, 2-3 paragraphs"
}}

Return ONLY the valid JSON, no additional text, no markdown code block."""


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
