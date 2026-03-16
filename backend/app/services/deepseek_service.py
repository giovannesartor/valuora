"""
DeepSeek API Integration
Financial data extraction from PDFs/Excel and strategic analysis.
Does NOT calculate valuation — only extracts and analyses.
"""
import asyncio
import httpx
import json
import logging
from pypdf import PdfReader
import openpyxl
import io
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


EXTRACTION_PROMPT = """You are a financial analyst specialized in SME valuation and financial statement analysis.

Analyze the following document and extract the information below in JSON format:

{
  "document_type": "Income Statement" | "Balance Sheet" | "Trial Balance" | "Other" (document type),
  "fiscal_year": 2024 (fiscal year — integer, e.g.: 2024),
  "company_name": "company name if found",
  "revenue": number (annual net revenue in $),
  "cogs": number (cost of goods/services sold),
  "gross_profit": number (gross profit),
  "operating_expenses": number (operating expenses),
  "ebit": number (EBIT),
  "net_income": number (net income),
  "net_margin": number (net margin as decimal, e.g.: 0.15),
  "total_assets": number,
  "total_liabilities": number (total debts),
  "cash": number (cash and equivalents),
  "equity": number (shareholders' equity),
  "growth_rate": number (growth rate if available, as decimal),
  "years_available": number (how many years of data are available),
  "notes": "relevant observations"
}

Return ONLY valid JSON, no additional text.
If any value is not available, use null.
DO NOT calculate valuation. Only extract the data.
If the document is in a non-English language, still extract the numeric values and translate labels to English.

DOCUMENT:
"""

ANALYSIS_PROMPT = """You are a strategic consultant specialized in valuation and M&A for small and medium enterprises.

Based on the following financial data and valuation results, provide a professional strategic analysis.

FINANCIAL DATA:
{data}

VALUATION RESULTS:
- Equity Value DCF (Gordon Growth): $ {equity_gordon}
- Equity Value DCF (Exit Multiple): $ {equity_exit}
- Weighted Equity Value DCF: $ {equity_dcf}
- Equity Value (Multiples): $ {equity_multiples}
- Final Equity Value (composite + adjustments): $ {equity_final}
- Enterprise Value (DCF): $ {enterprise_value}
- Ke (Cost of Equity): {wacc}%
- Risk Score: {risk_score}/100
- Maturity Index: {maturity_index}/100
- DLOM (Discount for Lack of Marketability): {dlom_pct}%
- Survival Rate (embedded in TV): {survival_rate}%
- Qualitative Score: {qual_score}/100
- Terminal Value as % of EV: {tv_pct}%
- Range: $ {range_low} to $ {range_high} (±{spread_pct}%)

Structure EXACTLY in this format (use the headings as given):

## Financial Health & Positioning
Assess margins, leverage, and operational efficiency.

## Valuation Interpretation
What the different methods (DCF Gordon, Exit Multiple, Multiples) reveal.
If they diverge significantly, explain why.

## Key Strengths
List 3-5 identified strengths of the business.

## Risks & Vulnerabilities
List 3-5 risks. Use the risk_score and DLOM as reference.
If TV > 75% of EV, flag it as a concern.
If risk_score > 60, emphasize the risks.

## Strategic Recommendations
5 actionable recommendations to increase the company's value.
Include target metrics when possible.

## Scenarios & Growth Potential
Describe conservative, base, and optimistic valuation scenarios over the next 3-5 years.

## Investment Round Considerations
If the company were to seek investment, comment on fair valuation (pre-money),
acceptable dilution, and how to position for investors.

Write in professional, objective English.
DO NOT recalculate values — use the numbers provided.
Use Markdown for formatting.
"""


async def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts text from PDF with intelligent page selection for large files.
    For PDFs > 5MB, filters only pages with financial content."""
    reader = PdfReader(io.BytesIO(file_bytes))
    LARGE_THRESHOLD = 5 * 1024 * 1024  # 5 MB

    # Keywords indicating a financial page (Income Statement / Balance Sheet)
    FIN_KEYWORDS = [
        "receita", "revenue", "lucro", "profit", "ebit", "resultado",
        "ativo", "passivo", "assets", "liabilities", "balanço", "balance",
        "caixa", "cash", "patrimônio", "equity", "despesa", "custo",
        "demonstração", "dre", "exercício", "competência",
        "income", "expenses", "net income", "gross profit", "operating",
        "total assets", "total liabilities", "shareholders",
    ]

    def _is_financial_page(text: str) -> bool:
        t = text.lower()
        return sum(1 for kw in FIN_KEYWORDS if kw in t) >= 3

    all_pages = [(page.extract_text() or "") for page in reader.pages]

    if len(file_bytes) > LARGE_THRESHOLD:
        # Select only financial pages to avoid truncating critical data
        financial_pages = [t for t in all_pages if _is_financial_page(t)]
        selected = financial_pages if financial_pages else all_pages  # fallback
        logger.info(f"[PDF] Large file ({len(file_bytes)//1024}KB): {len(financial_pages)}/{len(all_pages)} financial pages selected")
        return "\n".join(selected)

    return "".join(all_pages)


async def extract_text_from_excel(file_bytes: bytes) -> str:
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    text = ""
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        text += f"\n--- {sheet_name} ---\n"
        for row in ws.iter_rows(values_only=True):
            values = [str(v) if v is not None else "" for v in row]
            text += " | ".join(values) + "\n"
    return text


async def call_deepseek(prompt: str, max_tokens: int = 4000, retries: int = 3) -> str:
    """Calls the DeepSeek API with retry and exponential backoff.

    Retries on network errors and 429/5xx responses.
    """
    last_err: Exception = RuntimeError("No attempts made")
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    f"{settings.DEEPSEEK_API_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "deepseek-chat",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": max_tokens,
                        "temperature": 0.3,
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
        except httpx.TimeoutException as e:
            last_err = e
            logger.warning(f"[DeepSeek] Timeout attempt {attempt + 1}/{retries}")
        except httpx.HTTPStatusError as e:
            last_err = e
            status = e.response.status_code
            logger.warning(f"[DeepSeek] HTTP {status} attempt {attempt + 1}/{retries}")
            if status == 429:
                # Rate limited — wait longer
                await asyncio.sleep(min(30, 5 * (attempt + 1)))
                continue
            if status < 500:
                # Client error (4xx except 429): do not retry
                raise
        except Exception as e:
            last_err = e
            logger.warning(f"[DeepSeek] Unexpected error attempt {attempt + 1}/{retries}: {e}")

        if attempt < retries - 1:
            wait = 2 ** attempt  # 1s, 2s, 4s
            await asyncio.sleep(wait)

    logger.error(f"[DeepSeek] Failed after {retries} attempts: {last_err}")
    raise last_err


async def extract_financial_data(file_bytes: bytes, file_type: str) -> Dict[str, Any]:
    """Extracts financial data from PDF or Excel using DeepSeek."""
    if file_type == "pdf":
        text = await extract_text_from_pdf(file_bytes)
    elif file_type in ("xlsx", "xls"):
        text = await extract_text_from_excel(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

    if not text.strip():
        raise ValueError("Could not extract text from the document. Check if the PDF is password-protected or a scanned image.")

    prompt = EXTRACTION_PROMPT + text[:14000]  # ~14k chars covers a full Income Statement + Balance Sheet
    result = await call_deepseek(prompt)

    # Parse JSON from response
    try:
        # Try to find JSON in the response
        json_start = result.find("{")
        json_end = result.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(result[json_start:json_end])
    except json.JSONDecodeError as e:
        logger.warning(f"[DeepSeek] JSON extraction failed: {e!r} — returning raw error dict")

    return {"error": "Could not extract structured data.", "raw": result}


# ─── DeepSeek Sector Fallback (when external data is unavailable) ─────

SECTOR_FALLBACK_PROMPT = """You are an economic analyst specialized in global market sectors.

For the sector "{sector}" (industry code {cnae}), provide estimates based on PUBLIC and OFFICIAL data from
government statistics bureaus (e.g., US BLS, Eurostat, IBGE, SEBRAE), central banks, or industry reports.
DO NOT invent data. If you are unsure about a value, use null.

Respond STRICTLY in this JSON format, with no additional text:
{{
  "adjusted_growth_rate": <float: average annual sector growth rate, e.g.: 0.08 for 8%>,
  "sector_risk_premium": <float: sector risk premium, between 0.01 and 0.06>,
  "benchmark_revenue": <float or null: average annual revenue per company in the sector in $>,
  "benchmark_growth": <float or null: sector CAGR over the past 3-5 years>,
  "data_sources": [<list of sources used, e.g.: "US BLS 2024", "Eurostat 2023", "IBGE PIA 2022">]
}}

Mandatory rules:
- adjusted_growth_rate MUST be between -0.10 and 0.30
- sector_risk_premium MUST be between 0.01 and 0.06
- benchmark_revenue in $ (raw value, not in thousands/millions)
- Use real and conservative data. When in doubt, round down.
- If you don't know a value with confidence, use null
"""


async def estimate_sector_data_with_ai(sector: str, cnae_code: str) -> Optional[Dict[str, Any]]:
    """Fallback: uses DeepSeek to estimate sector data when external sources are unavailable.

    Returns dict in DCFSectorAdjustment format or None on failure.
    Applies strict validation to returned values.
    """
    try:
        prompt = SECTOR_FALLBACK_PROMPT.format(sector=sector, cnae=cnae_code)
        result = await call_deepseek(prompt, max_tokens=500)

        # Parse JSON
        json_start = result.find("{")
        json_end = result.rfind("}") + 1
        if json_start < 0 or json_end <= json_start:
            logger.warning("[AI-SECTOR] DeepSeek did not return valid JSON")
            return None

        data = json.loads(result[json_start:json_end])

        # ── Strict validation ──
        growth = data.get("adjusted_growth_rate")
        risk = data.get("sector_risk_premium")

        if growth is None or not isinstance(growth, (int, float)):
            logger.warning("[AI-SECTOR] Invalid or missing growth rate")
            return None
        if risk is None or not isinstance(risk, (int, float)):
            logger.warning("[AI-SECTOR] Invalid or missing risk premium")
            return None

        # Safety caps
        growth = max(-0.10, min(0.30, float(growth)))
        risk = max(0.01, min(0.06, float(risk)))

        benchmark_rev = data.get("benchmark_revenue")
        if benchmark_rev is not None:
            benchmark_rev = float(benchmark_rev)
            if benchmark_rev <= 0 or benchmark_rev > 1e12:  # Sanity check
                benchmark_rev = None

        benchmark_growth = data.get("benchmark_growth")
        if benchmark_growth is not None:
            benchmark_growth = float(benchmark_growth)
            if benchmark_growth < -0.50 or benchmark_growth > 1.0:
                benchmark_growth = None

        sources = data.get("data_sources", [])
        has_official_source = any(
            src_name in str(sources).upper()
            for src_name in ["IBGE", "SEBRAE", "BANCO CENTRAL", "BCB", "CVM", "PIA", "PAS", "PAC", "CEMPRE",
                             "BLS", "EUROSTAT", "OECD", "IMF", "WORLD BANK"]
        )

        # Reduced confidence: 0.3 if official sources cited, 0.15 otherwise
        confidence = 0.30 if has_official_source else 0.15

        logger.info(f"[AI-SECTOR] AI estimate for {sector}: growth={growth:.2%}, risk={risk:.2%}, confidence={confidence}, sources={sources}")

        return {
            "adjusted_growth_rate": round(growth, 4),
            "sector_risk_premium": round(risk, 4),
            "benchmark_revenue": benchmark_rev,
            "benchmark_growth": benchmark_growth,
            "sector_position": None,
            "confidence_level": confidence,
            "data_source": f"DeepSeek AI (sources: {', '.join(sources[:3]) if sources else 'estimate'})",
        }

    except json.JSONDecodeError:
        logger.warning("[AI-SECTOR] Failed to parse JSON from DeepSeek")
        return None
    except Exception as e:
        logger.error(f"[AI-SECTOR] Error: {e}")
        return None


async def generate_strategic_analysis(
    financial_data: Dict[str, Any],
    valuation_result: Optional[Dict[str, Any]] = None,
) -> str:
    """Generates textual strategic analysis with DeepSeek, contextualized by valuation."""
    data_str = json.dumps(financial_data, ensure_ascii=False, indent=2)
    
    # Include valuation result in the prompt
    if valuation_result:
        multiples = valuation_result.get("multiples_valuation", {})
        vr = valuation_result.get("valuation_range", {})
        dlom = valuation_result.get("dlom", {})
        surv = valuation_result.get("survival", {})
        qual = valuation_result.get("qualitative", {})
        prompt = ANALYSIS_PROMPT.format(
            data=data_str,
            equity_gordon=f"{valuation_result.get('equity_value_gordon', 0):,.2f}",
            equity_exit=f"{valuation_result.get('equity_value_exit_multiple', 0):,.2f}",
            equity_dcf=f"{valuation_result.get('equity_value_dcf', 0):,.2f}",
            equity_multiples=f"{multiples.get('equity_avg_multiples', 0):,.2f}",
            equity_final=f"{valuation_result.get('equity_value', 0):,.2f}",
            enterprise_value=f"{valuation_result.get('enterprise_value', 0):,.2f}",
            wacc=f"{(valuation_result.get('wacc', 0) * 100):.1f}",
            risk_score=f"{valuation_result.get('risk_score', 0):.1f}",
            maturity_index=f"{valuation_result.get('maturity_index', 0):.1f}",
            dlom_pct=f"{dlom.get('dlom_pct', 0) * 100:.1f}",
            survival_rate=f"{surv.get('survival_rate', 0) * 100:.1f}",
            qual_score=f"{qual.get('score', 50):.0f}",
            tv_pct=f"{valuation_result.get('tv_percentage', 0):.1f}",
            range_low=f"{vr.get('low', 0):,.2f}",
            range_high=f"{vr.get('high', 0):,.2f}",
            spread_pct=f"{vr.get('spread_pct', 20):.1f}",
        )
    else:
        prompt = ANALYSIS_PROMPT.format(
            data=data_str,
            equity_gordon="N/A", equity_exit="N/A",
            equity_dcf="N/A", equity_multiples="N/A", equity_final="N/A",
            enterprise_value="N/A", wacc="N/A", risk_score="N/A",
            maturity_index="N/A", dlom_pct="N/A", survival_rate="N/A",
            qual_score="N/A", tv_pct="N/A",
            range_low="N/A", range_high="N/A", spread_pct="N/A",
        )
    
    return await call_deepseek(prompt, max_tokens=2500)


# ─── M&A Comparables ─────────────────────────────────────

MA_COMPARABLES_PROMPT = """You are an M&A and valuation expert.

Provide real or estimated data for 4-6 recent M&A transactions (last 5-8 years) in the sector below,
typical for similarly-sized companies.

Sector: {sector}
Reference Revenue: $ {revenue_fmt} per year
Size: {size_label}

Return ONLY a valid JSON with this structure:
{{
  "transactions": [
    {{
      "company": "Company name (can be anonymous, e.g. 'Tech Company X')",
      "year": 2022,
      "ev_revenue_multiple": 2.5,
      "ev_ebitda_multiple": 8.0,
      "deal_size_note": "e.g.: $50-100M",
      "acquirer_type": "PE" | "Strategic" | "IPO" | "Merger",
      "sector_sub": "sub-segment"
    }}
  ],
  "sector_median_ev_revenue": 2.1,
  "sector_median_ev_ebitda": 7.5,
  "commentary": "2-3 sentences about typical multiples in this sector"
}}

Return ONLY valid JSON, no additional text."""


async def get_ma_comparables(
    sector: str,
    revenue: float,
) -> Optional[Dict[str, Any]]:
    """Get M&A comparable transactions for a sector via DeepSeek AI.
    Results are for illustrative/reference purposes."""
    if revenue >= 100_000_000:
        size_label = "large company (revenue > $100M)"
    elif revenue >= 10_000_000:
        size_label = "mid-size company ($10-100M)"
    elif revenue >= 1_000_000:
        size_label = "small company ($1-10M)"
    else:
        size_label = "micro company (< $1M)"

    if revenue >= 1_000_000:
        revenue_fmt = f"{revenue / 1_000_000:.1f}M"
    else:
        revenue_fmt = f"{revenue / 1_000:.0f}K"

    prompt = MA_COMPARABLES_PROMPT.format(
        sector=sector,
        revenue_fmt=revenue_fmt,
        size_label=size_label,
    )

    try:
        result = await call_deepseek(prompt, max_tokens=1500)
        json_start = result.find("{")
        json_end = result.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            data = json.loads(result[json_start:json_end])
            data["source"] = "DeepSeek AI — illustrative M&A estimates"
            return data
    except Exception as e:
        logger.error(f"[MA_COMPARABLES] DeepSeek failed: {e}")
    return None


# ─── Competitive Analysis (Pitch Deck) ───────────────────

COMPETITIVE_ANALYSIS_PROMPT = """You are a market analyst specialized in startups and SMEs.

Based on the data below, generate a detailed competitive analysis for use in a pitch deck.

Company: {company_name}
Sector: {sector}
Value Proposition: {solution}
Approximate Revenue: $ {revenue_fmt}

Return ONLY a valid JSON:
{{
  "competitors": [
    {{
      "name": "Competitor name",
      "type": "direct" | "indirect",
      "description": "1-2 sentences about the competitor",
      "strengths": ["strength 1", "strength 2"],
      "weaknesses": ["weakness 1"],
      "our_advantage": "how our company differentiates from this competitor"
    }}
  ],
  "competitive_summary": "3-4 sentence paragraph summarizing the company's competitive positioning",
  "market_opportunity": "2-3 sentences about the market opportunity in the competitive context",
  "differentiation": ["differentiator 1", "differentiator 2", "differentiator 3"]
}}

Include 3-5 real or typical competitors in the sector.
Return ONLY valid JSON, no additional text."""


async def generate_competitive_analysis(
    company_name: str,
    sector: str,
    solution: str = "",
    revenue: float = 0,
) -> Optional[Dict[str, Any]]:
    """Generate AI-powered competitive analysis for pitch deck."""
    if revenue >= 1_000_000:
        revenue_fmt = f"{revenue / 1_000_000:.1f}M"
    else:
        revenue_fmt = f"{revenue / 1_000:.0f}K" if revenue > 0 else "not provided"

    prompt = COMPETITIVE_ANALYSIS_PROMPT.format(
        company_name=company_name or "Company",
        sector=sector or "Technology",
        solution=solution or "not provided",
        revenue_fmt=revenue_fmt,
    )

    try:
        result = await call_deepseek(prompt, max_tokens=2000)
        json_start = result.find("{")
        json_end = result.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(result[json_start:json_end])
    except Exception as e:
        logger.error(f"[COMPETITIVE] DeepSeek failed: {e}")
    return None
