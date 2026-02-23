"""
DeepSeek API Integration
Extração de dados financeiros de PDFs/Excel e análise estratégica.
NÃO calcula valuation — apenas extrai e analisa.
"""
import httpx
import json
import PyPDF2
import openpyxl
import io
from typing import Dict, Any, Optional
from app.core.config import settings


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

ANALYSIS_PROMPT = """Você é um consultor estratégico especializado em PMEs brasileiras.

Com base nos seguintes dados financeiros e resultado de valuation, forneça uma análise estratégica concisa:

DADOS FINANCEIROS:
{data}

RESULTADO DO VALUATION:
- Equity Value (DCF): R$ {equity_dcf}
- Equity Value (Múltiplos): R$ {equity_multiples}
- Equity Value Final (triangulado): R$ {equity_final}
- Enterprise Value: R$ {enterprise_value}
- WACC: {wacc}%
- Score de Risco: {risk_score}/100
- Índice de Maturidade: {maturity_index}/100
- % do Terminal Value no EV: {tv_pct}%
- Range: R$ {range_low} a R$ {range_high} (±{spread_pct}%)

Escreva uma análise de 4-6 parágrafos cobrindo:
1. Saúde financeira geral e posicionamento
2. Interpretação do valuation — o que os números dizem sobre a empresa
3. Pontos fortes do negócio
4. Riscos e vulnerabilidades (use o risk_score e tv_percentage como referência)
5. Recomendações estratégicas para aumentar o valor da empresa
6. Potencial de valorização a médio/longo prazo

Se o Terminal Value representa >75% do EV, mencione isso como alerta.
Se o risk_score é >60, enfatize os riscos.

Escreva em português brasileiro, tom profissional e objetivo.
NÃO recalcule valores — use os números fornecidos.
"""


async def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
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
        prompt = ANALYSIS_PROMPT.format(
            data=data_str,
            equity_dcf=f"{valuation_result.get('equity_value_dcf', 0):,.2f}",
            equity_multiples=f"{multiples.get('equity_avg_multiples', 0):,.2f}",
            equity_final=f"{valuation_result.get('equity_value', 0):,.2f}",
            enterprise_value=f"{valuation_result.get('enterprise_value', 0):,.2f}",
            wacc=f"{(valuation_result.get('wacc', 0) * 100):.1f}",
            risk_score=f"{valuation_result.get('risk_score', 0):.1f}",
            maturity_index=f"{valuation_result.get('maturity_index', 0):.1f}",
            tv_pct=f"{valuation_result.get('tv_percentage', 0):.1f}",
            range_low=f"{vr.get('low', 0):,.2f}",
            range_high=f"{vr.get('high', 0):,.2f}",
            spread_pct=f"{vr.get('spread_pct', 20):.1f}",
        )
    else:
        prompt = ANALYSIS_PROMPT.format(
            data=data_str,
            equity_dcf="N/A", equity_multiples="N/A", equity_final="N/A",
            enterprise_value="N/A", wacc="N/A", risk_score="N/A",
            maturity_index="N/A", tv_pct="N/A",
            range_low="N/A", range_high="N/A", spread_pct="N/A",
        )
    
    return await call_deepseek(prompt, max_tokens=2500)
