"""
CNPJ lookup service via ReceitaWS.

Public API  : https://www.receitaws.com.br/v1/cnpj/{cnpj}         — 3 req/min, no token
Commercial API: https://www.receitaws.com.br/v1/cnpj/{cnpj}/days/30 — with RECEITAWS_TOKEN
"""
import re
import logging
from datetime import date
import httpx

from app.core.config import settings
from app.core.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

_BASE_URL = "https://www.receitaws.com.br/v1/cnpj"

# ReceitaWS status → friendly label
_SITUACAO_MAP = {
    "ATIVA": "Ativa",
    "SUSPENSA": "Suspensa",
    "INAPTA": "Inapta",
    "BAIXADA": "Baixada",
    "NULA": "Nula",
}


def _clean_cnpj(cnpj: str) -> str:
    """Strips CNPJ formatting and returns the 14 digits."""
    digits = re.sub(r"\D", "", cnpj)
    if len(digits) != 14:
        raise ValueError(f"Invalid CNPJ: {cnpj!r} — expected 14 digits, got {len(digits)}")
    if not _validate_cnpj_digits(digits):
        raise ValueError(f"CNPJ {cnpj!r} with invalid check digits.")
    return digits


def _validate_cnpj_digits(digits: str) -> bool:
    """Validates the two CNPJ check digits (modulo 11 algorithm)."""
    if len(set(digits)) == 1:
        return False  # Sequences like 00000000000000 are invalid

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
        # Commercial API: accepts data up to 30 days old before fetching in real time
        return f"{_BASE_URL}/{cnpj_digits}/days/30"
    return f"{_BASE_URL}/{cnpj_digits}"


def _build_headers() -> dict:
    headers = {"Accept": "application/json"}
    if settings.RECEITAWS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.RECEITAWS_TOKEN}"
    return headers


# Cache TTL for CNPJ results: 7 days (corporate data rarely changes)
_CNPJ_CACHE_TTL = 60 * 60 * 24 * 7


async def lookup_cnpj(cnpj: str) -> dict:
    """
    Queries a CNPJ on ReceitaWS and returns a standardized dictionary with
    the fields relevant to Valuora.

    Uses Redis cache for 7 days to avoid unnecessary API hits (conserves
    quota and protects against Public API rate limits).

    Raises:
        ValueError  — CNPJ with invalid format or check digits
        httpx.HTTPStatusError — HTTP error from ReceitaWS (4xx/5xx)
        RuntimeError — response indicates error in the JSON 'status' field
    """
    digits = _clean_cnpj(cnpj)

    # Try Redis cache before calling the API
    cache_key = f"cnpj:{digits}"
    cached = await cache_get(cache_key)
    if cached and isinstance(cached, dict):
        return cached

    url = _build_url(digits)
    headers = _build_headers()

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)

    # 429 = Public API rate limit
    if response.status_code == 429:
        raise RuntimeError("ReceitaWS query limit reached. Try again in 1 minute.")

    # 402 = Commercial API quota exhausted
    if response.status_code == 402:
        raise RuntimeError("ReceitaWS query quota exhausted. Check your plan.")

    response.raise_for_status()

    data = response.json()

    # The API returns status="ERROR" in the body when CNPJ is not cached (Public API) or doesn't exist
    if data.get("status") == "ERROR":
        message = data.get("message", "CNPJ not found.")
        raise RuntimeError(message)

    result = _parse(data)

    # Save to Redis cache (cache.py handles json.dumps internally)
    await cache_set(cache_key, result, _CNPJ_CACHE_TTL)

    return result


def _parse(data: dict) -> dict:
    """Extracts and normalizes relevant fields do JSON da ReceitaWS."""

    # CNAE principal
    atividade_principal = data.get("atividade_principal") or []
    cnae_codigo = ""
    cnae_descricao = ""
    if atividade_principal:
        first = atividade_principal[0]
        cnae_codigo = re.sub(r"\D", "", first.get("code", ""))  # "47.11-3-01" → "4711301"
        cnae_descricao = first.get("text", "")

    # Opening date → approximate years of operation
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
