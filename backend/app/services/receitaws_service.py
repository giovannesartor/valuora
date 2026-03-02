"""
Serviço de consulta de CNPJ via ReceitaWS.

API Pública  : https://www.receitaws.com.br/v1/cnpj/{cnpj}         — 3 req/min, sem token
API Comercial: https://www.receitaws.com.br/v1/cnpj/{cnpj}/days/30 — com RECEITAWS_TOKEN
"""
import re
import logging
from datetime import date
import httpx

from app.core.config import settings
from app.core.cache import cache_get, cache_set

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
    if not _validate_cnpj_digits(digits):
        raise ValueError(f"CNPJ {cnpj!r} com dígitos verificadores inválidos.")
    return digits


def _validate_cnpj_digits(digits: str) -> bool:
    """Valida os dois dígitos verificadores do CNPJ (algoritmo módulo 11)."""
    if len(set(digits)) == 1:
        return False  # sequências como 00000000000000 são inválidas

    def _calc(d: str, weights: list[int]) -> int:
        total = sum(int(n) * w for n, w in zip(d, weights))
        remainder = total % 11
        return 0 if remainder < 2 else 11 - remainder

    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    d1 = _calc(digits[:12], w1)
    d2 = _calc(digits[:13], w2)
    return int(digits[12]) == d1 and int(digits[13]) == d2


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


# Cache TTL para resultados de CNPJ: 7 dias (dados cadastrais mudam raramente)
_CNPJ_CACHE_TTL = 60 * 60 * 24 * 7


async def lookup_cnpj(cnpj: str) -> dict:
    """
    Consulta um CNPJ na ReceitaWS e retorna um dicionário padronizado com os
    campos relevantes para o QuantoVale.

    Usa cache Redis por 7 dias para evitar hit desnecessário na API (economiza
    cota e protege contra rate limit da API Pública).

    Raises:
        ValueError  — CNPJ com formato inválido ou dígitos verificadores errados
        httpx.HTTPStatusError — erro HTTP da ReceitaWS (4xx/5xx)
        RuntimeError — resposta indica erro no campo 'status' do JSON
    """
    digits = _clean_cnpj(cnpj)

    # Tenta cache Redis antes de chamar a API
    cache_key = f"cnpj:{digits}"
    cached = await cache_get(cache_key)
    if cached and isinstance(cached, dict):
        return cached

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

    result = _parse(data)

    # Salva no cache Redis (cache.py já faz json.dumps internamente)
    await cache_set(cache_key, result, _CNPJ_CACHE_TTL)

    return result


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
            d, m, y = abertura.split("/")
            abertura_date = date(int(y), int(m), int(d))
            tempo_empresa_anos = (date.today() - abertura_date).days // 365
        except Exception as e:
            logger.warning(f"[ReceitaWS] Could not parse abertura date {abertura!r}: {e!r}")

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
