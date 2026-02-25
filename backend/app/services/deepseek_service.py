"""
DeepSeek API Integration
Extração de dados financeiros de PDFs/Excel e análise estratégica.
NÃO calcula valuation — apenas extrai e analisa.
"""
import httpx
import json
import logging
from pypdf import PdfReader
import openpyxl
import io
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


EXTRACTION_PROMPT = """Você é um analista financeiro especializado em PMEs brasileiras.

Analise o documento a seguir e extraia as seguintes informações em JSON:

{
  "company_name": "nome da empresa se encontrado",
  "revenue": numero (receita líquida anual em R$),
  "cogs": numero (custo dos produtos/serviços vendidos),
  "gross_profit": numero (lucro bruto),
  "operating_expenses": numero (despesas operacionais),
  "ebit": numero (EBIT),
  "net_income": numero (lucro líquido),
  "net_margin": numero (margem líquida em decimal, ex: 0.15),
  "total_assets": numero,
  "total_liabilities": numero (dívidas totais),
  "cash": numero (caixa e equivalentes),
  "equity": numero (patrimônio líquido),
  "growth_rate": numero (taxa de crescimento se disponível, em decimal),
  "years_available": numero (quantos anos de dados estão disponíveis),
  "notes": "observações relevantes"
}

Retorne APENAS o JSON válido, sem texto adicional.
Se algum valor não estiver disponível, use null.
NÃO calcule valuation. Apenas extraia os dados.

DOCUMENTO:
"""

ANALYSIS_PROMPT = """Você é um consultor estratégico especializado em valuation e M&A de PMEs brasileiras.

Com base nos seguintes dados financeiros e resultado de valuation, forneça uma análise estratégica profissional.

DADOS FINANCEIROS:
{data}

RESULTADO DO VALUATION:
- Equity Value DCF (Gordon Growth): R$ {equity_gordon}
- Equity Value DCF (Exit Multiple): R$ {equity_exit}
- Equity Value DCF Ponderado: R$ {equity_dcf}
- Equity Value (Múltiplos): R$ {equity_multiples}
- Equity Value Final (triangulado + ajustes): R$ {equity_final}
- Enterprise Value: R$ {enterprise_value}
- WACC: {wacc}%
- Score de Risco: {risk_score}/100
- Índice de Maturidade: {maturity_index}/100
- DLOM (Desconto de Liquidez): {dlom_pct}%
- Taxa de Sobrevivência: {survival_rate}%
- Score Qualitativo: {qual_score}/100
- % do Terminal Value no EV: {tv_pct}%
- Range: R$ {range_low} a R$ {range_high} (±{spread_pct}%)

Estruture EXATAMENTE neste formato (use os títulos como estão):

## Saúde Financeira e Posicionamento
Avalie margens, endividamento e eficiência operacional.

## Interpretação do Valuation
O que os diferentes métodos (DCF Gordon, Exit Multiple, Múltiplos) dizem. 
Se divergem significativamente, explique o porquê.

## Pontos Fortes
Liste 3-5 forças identificadas do negócio.

## Riscos e Vulnerabilidades
Liste 3-5 riscos. Use o risk_score e DLOM como referência.
Se TV > 75% do EV, mencione como alerta.
Se risk_score > 60, enfatize os riscos.

## Recomendações Estratégicas
5 recomendações concretas para aumentar o valor da empresa.
Inclua métricas alvo quando possível.

## Cenários e Potencial
Descreva cenário conservador, base e otimista de valorização nos próximos 3-5 anos.

## Considerações para Rodada de Investimento
Se a empresa buscar investimento, comente sobre valuation justo (pre-money),
diluição aceitável e como se posicionar para investidores.

Escreva em português brasileiro, tom profissional e objetivo.
NÃO recalcule valores — use os números fornecidos.
Use Markdown para formatação.
"""


async def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


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


async def call_deepseek(prompt: str, max_tokens: int = 4000) -> str:
    """Chama a API DeepSeek."""
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


async def extract_financial_data(file_bytes: bytes, file_type: str) -> Dict[str, Any]:
    """Extrai dados financeiros de PDF ou Excel usando DeepSeek."""
    if file_type == "pdf":
        text = await extract_text_from_pdf(file_bytes)
    elif file_type in ("xlsx", "xls"):
        text = await extract_text_from_excel(file_bytes)
    else:
        raise ValueError(f"Tipo de arquivo não suportado: {file_type}")

    if not text.strip():
        raise ValueError("Não foi possível extrair texto do documento.")

    prompt = EXTRACTION_PROMPT + text[:8000]  # Limit context
    result = await call_deepseek(prompt)

    # Parse JSON from response
    try:
        # Try to find JSON in the response
        json_start = result.find("{")
        json_end = result.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(result[json_start:json_end])
    except json.JSONDecodeError:
        pass

    return {"error": "Não foi possível extrair dados estruturados.", "raw": result}


# ─── DeepSeek Sector Fallback (when IBGE is down) ─────────

SECTOR_FALLBACK_PROMPT = """Você é um analista econômico especializado no mercado brasileiro.

Para o setor "{sector}" (CNAE divisão {cnae}) no Brasil, forneça estimativas baseadas em dados PÚBLICOS e OFICIAIS do IBGE, SEBRAE, Banco Central, CVM ou anuários setoriais. NÃO invente dados. Se não tiver certeza sobre um valor, use null.

Responda ESTRITAMENTE neste formato JSON, sem nenhum texto adicional:
{{
  "adjusted_growth_rate": <float: taxa de crescimento anual média do setor, ex: 0.08 para 8%>,
  "sector_risk_premium": <float: prêmio de risco setorial, entre 0.01 e 0.06>,
  "benchmark_revenue": <float ou null: receita média anual por empresa do setor em R$>,
  "benchmark_growth": <float ou null: CAGR do setor nos últimos 3-5 anos>,
  "data_sources": [<lista de fontes usadas, ex: "IBGE PIA 2022", "SEBRAE 2023">]
}}

Regras obrigatórias:
- adjusted_growth_rate DEVE estar entre -0.10 e 0.30
- sector_risk_premium DEVE estar entre 0.01 e 0.06
- benchmark_revenue em R$ (valor bruto, não em milhares/milhões)
- Use dados reais e conservadores. Na dúvida, arredonde para baixo.
- Se não souber um valor com confiança, coloque null
"""


async def estimate_sector_data_with_ai(sector: str, cnae_code: str) -> Optional[Dict[str, Any]]:
    """Fallback: usa DeepSeek para estimar dados setoriais quando IBGE está indisponível.

    Retorna dict no formato DCFSectorAdjustment ou None se falhar.
    Aplica validação rigorosa nos valores retornados.
    """
    try:
        prompt = SECTOR_FALLBACK_PROMPT.format(sector=sector, cnae=cnae_code)
        result = await call_deepseek(prompt, max_tokens=500)

        # Parse JSON
        json_start = result.find("{")
        json_end = result.rfind("}") + 1
        if json_start < 0 or json_end <= json_start:
            logger.warning("[AI-SECTOR] DeepSeek não retornou JSON válido")
            return None

        data = json.loads(result[json_start:json_end])

        # ── Validação rigorosa ──
        growth = data.get("adjusted_growth_rate")
        risk = data.get("sector_risk_premium")

        if growth is None or not isinstance(growth, (int, float)):
            logger.warning("[AI-SECTOR] Growth rate inválido ou ausente")
            return None
        if risk is None or not isinstance(risk, (int, float)):
            logger.warning("[AI-SECTOR] Risk premium inválido ou ausente")
            return None

        # Caps de segurança
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
            for src_name in ["IBGE", "SEBRAE", "BANCO CENTRAL", "BCB", "CVM", "PIA", "PAS", "PAC", "CEMPRE"]
        )

        # Confiança reduzida: 0.3 se citou fontes oficiais, 0.15 se não
        confidence = 0.30 if has_official_source else 0.15

        logger.info(f"[AI-SECTOR] Estimativa IA para {sector}: growth={growth:.2%}, risk={risk:.2%}, confidence={confidence}, sources={sources}")

        return {
            "adjusted_growth_rate": round(growth, 4),
            "sector_risk_premium": round(risk, 4),
            "benchmark_revenue": benchmark_rev,
            "benchmark_growth": benchmark_growth,
            "sector_position": None,
            "confidence_level": confidence,
            "data_source": f"DeepSeek AI (fontes: {', '.join(sources[:3]) if sources else 'estimativa'})",
        }

    except json.JSONDecodeError:
        logger.warning("[AI-SECTOR] Falha ao parsear JSON do DeepSeek")
        return None
    except Exception as e:
        logger.error(f"[AI-SECTOR] Erro: {e}")
        return None


async def generate_strategic_analysis(
    financial_data: Dict[str, Any],
    valuation_result: Optional[Dict[str, Any]] = None,
) -> str:
    """Gera análise estratégica textual com DeepSeek, contextualizada pelo valuation."""
    data_str = json.dumps(financial_data, ensure_ascii=False, indent=2)
    
    # Fix #12: Incluir resultado do valuation no prompt
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
