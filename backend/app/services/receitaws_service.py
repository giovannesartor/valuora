"""
Serviço de consulta de CNPJ via ReceitaWS.

API Pública  : https://www.receitaws.com.br/v1/cnpj/{cnpj}         — 3 req/min, sem token
API Comercial: https://www.receitaws.com.br/v1/cnpj/{cnpj}/days/30 — com RECEITAWS_TOKEN
"""
import re
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.receitaws.com.br/v1/cnpj"

# Mapeamento ReceitaWS situação → label amigável
_SITUACAO_MAP = {
    "ATIVA": "Ativa",
    "SUSPENSA": "Suspensa",
    "INAPTA": "Inapta",
    "BAIXADA": "Baixada",
    "NULA": "Nula",
}


def _clean_cnpj(cnpj: str) -> str:
    """Remove formatação do CNPJ e retorna apenas os 14 dígitos."""
    digits = re.sub(r"\D", "", cnpj)
    if len(digits) != 14:
        raise ValueError(f"CNPJ inválido: {cnpj!r} — esperado 14 dígitos, recebido {len(digits)}")
    return digits


def _build_url(cnpj_digits: str) -> str:
    if settings.RECEITAWS_TOKEN:
        # API Comercial: aceita dados com até 30 dias de defasagem antes de buscar em tempo real
        return f"{_BASE_URL}/{cnpj_digits}/days/30"
    return f"{_BASE_URL}/{cnpj_digits}"


def _build_headers() -> dict:
    headers = {"Accept": "application/json"}
    if settings.RECEITAWS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.RECEITAWS_TOKEN}"
    return headers


async def lookup_cnpj(cnpj: str) -> dict:
    """
    Consulta um CNPJ na ReceitaWS e retorna um dicionário padronizado com os
    campos relevantes para o QuantoVale.

    Raises:
        ValueError  — CNPJ com formato inválido
        httpx.HTTPStatusError — erro HTTP da ReceitaWS (4xx/5xx)
        RuntimeError — resposta indica erro no campo 'status' do JSON
    """
    digits = _clean_cnpj(cnpj)
    url = _build_url(digits)
    headers = _build_headers()

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)

    # 429 = rate limit da API Pública
    if response.status_code == 429:
        raise RuntimeError("Limite de consultas da ReceitaWS atingido. Tente novamente em 1 minuto.")

    # 402 = limite da API Comercial esgotado
    if response.status_code == 402:
        raise RuntimeError("Cota de consultas da ReceitaWS esgotada. Verifique seu plano.")

    response.raise_for_status()

    data = response.json()

    # A API retorna status="ERROR" no corpo quando o CNPJ não está no cache (API Pública) ou não existe
    if data.get("status") == "ERROR":
        message = data.get("message", "CNPJ não encontrado.")
        raise RuntimeError(message)

    return _parse(data)


def _parse(data: dict) -> dict:
    """Extrai e normaliza os campos relevantes do JSON da ReceitaWS."""

    # CNAE principal
    atividade_principal = data.get("atividade_principal") or []
    cnae_codigo = ""
    cnae_descricao = ""
    if atividade_principal:
        first = atividade_principal[0]
        cnae_codigo = re.sub(r"\D", "", first.get("code", ""))  # "47.11-3-01" → "4711301"
        cnae_descricao = first.get("text", "")

    # Data de abertura → anos de operação aproximados
    abertura = data.get("abertura", "")  # "DD/MM/YYYY"
    tempo_empresa_anos: int | None = None
    if abertura:
        try:
            from datetime import date
            d, m, y = abertura.split("/")
            abertura_date = date(int(y), int(m), int(d))
            tempo_empresa_anos = (date.today() - abertura_date).days // 365
        except Exception:
            pass

    situacao_raw = (data.get("situacao") or "").upper()
    situacao = _SITUACAO_MAP.get(situacao_raw, situacao_raw)

    return {
        "cnpj": data.get("cnpj", ""),
        "razao_social": data.get("nome", ""),
        "nome_fantasia": data.get("fantasia", ""),
        "situacao": situacao,
        "situacao_ativa": situacao_raw == "ATIVA",
        "porte": data.get("porte", ""),           # "MEI" | "ME" | "EPP" | "DEMAIS"
        "natureza_juridica": data.get("natureza_juridica", ""),
        "abertura": abertura,
        "tempo_empresa_anos": tempo_empresa_anos,
        "capital_social": data.get("capital_social", ""),
        "cnae_codigo": cnae_codigo,
        "cnae_descricao": cnae_descricao,
        "atividades_secundarias": [
            {"codigo": re.sub(r"\D", "", a.get("code", "")), "descricao": a.get("text", "")}
            for a in (data.get("atividades_secundarias") or [])
        ],
        "municipio": data.get("municipio", ""),
        "uf": data.get("uf", ""),
        "ultima_atualizacao": data.get("ultima_atualizacao", ""),
    }
