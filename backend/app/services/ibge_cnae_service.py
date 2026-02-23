"""
Quanto Vale — IBGE CNAE Service
Serviço de integração com a API CNAE v2 do IBGE.
https://servicodados.ibge.gov.br/api/v2/cnae

Funcionalidades:
- Hierarquia completa (Seção → Divisão → Grupo → Classe → Subclasse)
- Validação de código CNAE
- Cache Redis 24h
- Persistência PostgreSQL
- Retry com backoff exponencial
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any

import httpx
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import async_session_maker
from app.core.cache import (
    cache_get, cache_set, cnae_key,
    CACHE_TTL_CNAE,
)
from app.models.cnae import CnaeCode
from app.schemas.cnae_schema import CnaeCodeResponse, CnaeValidationResponse

logger = logging.getLogger(__name__)

BASE_URL = "https://servicodados.ibge.gov.br/api/v2/cnae"
TIMEOUT = 15.0
MAX_RETRIES = 3


# ─── HTTP Client com retry ──────────────────────────────

async def _ibge_request(endpoint: str, retries: int = MAX_RETRIES) -> Optional[Any]:
    """Faz requisição à API CNAE do IBGE com retry e backoff exponencial."""
    url = f"{BASE_URL}/{endpoint}" if endpoint else BASE_URL
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            logger.warning(f"[CNAE] Timeout na tentativa {attempt + 1}/{retries} — {url}")
        except httpx.HTTPStatusError as e:
            logger.error(f"[CNAE] HTTP {e.response.status_code} — {url}")
            if e.response.status_code == 404:
                return None
            if e.response.status_code >= 500:
                pass  # Retry
            else:
                return None
        except Exception as e:
            logger.error(f"[CNAE] Erro inesperado: {e}")

        if attempt < retries - 1:
            wait = 2 ** attempt
            logger.info(f"[CNAE] Aguardando {wait}s antes do retry...")
            await asyncio.sleep(wait)

    logger.error(f"[CNAE] Falha após {retries} tentativas — {url}")
    return None


# ─── Normalização ────────────────────────────────────────

def _normalize_cnae_item(item: Dict[str, Any], level: str) -> Dict[str, Any]:
    """Normaliza um item da resposta CNAE para formato padronizado."""
    code = str(item.get("id", ""))
    description = item.get("descricao", "")

    # Determinar parent_code baseado no nível
    parent_code = None
    section_id = None
    division_id = None
    group_id = None
    clean = code.replace(".", "").replace("-", "").replace("/", "")

    if level == "secao":
        section_id = code
    elif level == "divisao":
        section_id = None  # Seria preciso lookup
        division_id = clean[:2] if len(clean) >= 2 else code
    elif level == "grupo":
        division_id = clean[:2] if len(clean) >= 2 else None
        group_id = clean[:3] if len(clean) >= 3 else code
        parent_code = clean[:2] if len(clean) >= 2 else None
    elif level == "classe":
        division_id = clean[:2] if len(clean) >= 2 else None
        group_id = clean[:3] if len(clean) >= 3 else None
        parent_code = clean[:3] if len(clean) >= 3 else None
    elif level == "subclasse":
        parent_code = clean[:5] if len(clean) >= 5 else None

    return {
        "code": code,
        "description": description,
        "level": level,
        "parent_code": parent_code,
        "section_id": section_id,
        "division_id": division_id,
        "group_id": group_id,
    }


async def _persist_cnae_items(items: List[Dict[str, Any]]) -> None:
    """Persiste itens CNAE no PostgreSQL (upsert)."""
    if not items:
        return
    try:
        async with async_session_maker() as session:
            for item in items:
                stmt = pg_insert(CnaeCode).values(
                    code=item["code"],
                    description=item["description"],
                    level=item["level"],
                    parent_code=item.get("parent_code"),
                    section_id=item.get("section_id"),
                    division_id=item.get("division_id"),
                    group_id=item.get("group_id"),
                ).on_conflict_do_update(
                    constraint="uq_cnae_code_level",
                    set_={
                        "description": item["description"],
                        "parent_code": item.get("parent_code"),
                        "section_id": item.get("section_id"),
                        "division_id": item.get("division_id"),
                        "group_id": item.get("group_id"),
                    }
                )
                await session.execute(stmt)
            await session.commit()
            logger.info(f"[CNAE] Persistidos {len(items)} itens no PostgreSQL")
    except Exception as e:
        logger.error(f"[CNAE] Erro ao persistir: {e}")


# ─── Funções Públicas ────────────────────────────────────

async def get_all_sections() -> List[Dict[str, Any]]:
    """Obtém todas as seções CNAE (nível mais alto da hierarquia)."""
    cache = await cache_get(cnae_key("sections"))
    if cache:
        return cache

    data = await _ibge_request("secoes")
    if not data:
        return []

    results = []
    for item in data:
        normalized = _normalize_cnae_item(item, "secao")
        results.append(normalized)

    await cache_set(cnae_key("sections"), results, CACHE_TTL_CNAE)
    await _persist_cnae_items(results)
    return results


async def get_divisions_by_section(section_id: str) -> List[Dict[str, Any]]:
    """Obtém divisões de uma seção CNAE."""
    key = cnae_key(f"divisions:{section_id}")
    cache = await cache_get(key)
    if cache:
        return cache

    data = await _ibge_request(f"secoes/{section_id}/divisoes")
    if not data:
        return []

    results = []
    for item in data:
        normalized = _normalize_cnae_item(item, "divisao")
        normalized["section_id"] = section_id
        results.append(normalized)

    await cache_set(key, results, CACHE_TTL_CNAE)
    await _persist_cnae_items(results)
    return results


async def get_groups_by_division(division_id: str) -> List[Dict[str, Any]]:
    """Obtém grupos de uma divisão CNAE."""
    key = cnae_key(f"groups:{division_id}")
    cache = await cache_get(key)
    if cache:
        return cache

    data = await _ibge_request(f"divisoes/{division_id}/grupos")
    if not data:
        return []

    results = []
    for item in data:
        normalized = _normalize_cnae_item(item, "grupo")
        results.append(normalized)

    await cache_set(key, results, CACHE_TTL_CNAE)
    await _persist_cnae_items(results)
    return results


async def get_classes_by_group(group_id: str) -> List[Dict[str, Any]]:
    """Obtém classes de um grupo CNAE."""
    key = cnae_key(f"classes:{group_id}")
    cache = await cache_get(key)
    if cache:
        return cache

    data = await _ibge_request(f"grupos/{group_id}/classes")
    if not data:
        return []

    results = []
    for item in data:
        normalized = _normalize_cnae_item(item, "classe")
        results.append(normalized)

    await cache_set(key, results, CACHE_TTL_CNAE)
    await _persist_cnae_items(results)
    return results


async def get_subclasses_by_class(class_id: str) -> List[Dict[str, Any]]:
    """Obtém subclasses de uma classe CNAE."""
    key = cnae_key(f"subclasses:{class_id}")
    cache = await cache_get(key)
    if cache:
        return cache

    data = await _ibge_request(f"classes/{class_id}/subclasses")
    if not data:
        return []

    results = []
    for item in data:
        normalized = _normalize_cnae_item(item, "subclasse")
        results.append(normalized)

    await cache_set(key, results, CACHE_TTL_CNAE)
    await _persist_cnae_items(results)
    return results


async def get_class_by_id(class_id: str) -> Optional[Dict[str, Any]]:
    """Obtém detalhes de uma classe CNAE pelo ID."""
    key = cnae_key(f"class:{class_id}")
    cache = await cache_get(key)
    if cache:
        return cache

    data = await _ibge_request(f"classes/{class_id}")
    if not data:
        return None

    # API retorna lista ou objeto
    item = data[0] if isinstance(data, list) else data
    result = _normalize_cnae_item(item, "classe")

    # Incluir informações hierárquicas
    if "grupo" in item:
        grupo = item["grupo"]
        result["grupo"] = {
            "id": grupo.get("id"),
            "descricao": grupo.get("descricao"),
        }
        if "divisao" in grupo:
            result["divisao"] = {
                "id": grupo["divisao"].get("id"),
                "descricao": grupo["divisao"].get("descricao"),
            }
            if "secao" in grupo["divisao"]:
                result["secao"] = {
                    "id": grupo["divisao"]["secao"].get("id"),
                    "descricao": grupo["divisao"]["secao"].get("descricao"),
                }

    await cache_set(key, result, CACHE_TTL_CNAE)
    await _persist_cnae_items([result])
    return result


async def validate_cnae(code: str) -> CnaeValidationResponse:
    """Valida um código CNAE e retorna informações sobre ele."""
    clean = code.replace(".", "").replace("-", "").replace("/", "").strip()

    if not clean:
        return CnaeValidationResponse(code=code, is_valid=False)

    # Determinar endpoint correto pelo comprimento
    if len(clean) <= 2:
        data = await _ibge_request(f"divisoes/{clean}")
        level = "divisao"
    elif len(clean) <= 3:
        data = await _ibge_request(f"grupos/{clean}")
        level = "grupo"
    elif len(clean) <= 5:
        data = await _ibge_request(f"classes/{clean}")
        level = "classe"
    else:
        data = await _ibge_request(f"subclasses/{clean}")
        level = "subclasse"

    if not data:
        return CnaeValidationResponse(code=code, is_valid=False)

    item = data[0] if isinstance(data, list) else data
    description = item.get("descricao", "")

    # Extrair hierarquia
    section = None
    division = None
    group = None

    if "grupo" in item:
        group = item["grupo"].get("id")
        if "divisao" in item["grupo"]:
            division = item["grupo"]["divisao"].get("id")
            if "secao" in item["grupo"]["divisao"]:
                section = item["grupo"]["divisao"]["secao"].get("id")
    elif "divisao" in item:
        division = item["divisao"].get("id")
        if "secao" in item["divisao"]:
            section = item["divisao"]["secao"].get("id")

    return CnaeValidationResponse(
        code=code,
        is_valid=True,
        description=description,
        level=level,
        section=section,
        division=division,
        group=group,
    )


async def search_cnae(query: str) -> List[Dict[str, Any]]:
    """Busca CNAE por texto na descrição ou código."""
    # Tenta buscar no banco local primeiro
    try:
        async with async_session_maker() as session:
            result = await session.execute(
                select(CnaeCode).where(
                    or_(
                        CnaeCode.code.ilike(f"%{query}%"),
                        CnaeCode.description.ilike(f"%{query}%"),
                    )
                ).limit(20)
            )
            items = result.scalars().all()
            if items:
                return [
                    {
                        "code": item.code,
                        "description": item.description,
                        "level": item.level,
                        "parent_code": item.parent_code,
                    }
                    for item in items
                ]
    except Exception as e:
        logger.warning(f"[CNAE] Erro ao buscar no banco: {e}")

    # Fallback: buscar na API — tenta como classe
    clean = query.replace(".", "").replace("-", "").replace("/", "").strip()
    if clean.isdigit():
        class_data = await get_class_by_id(clean)
        if class_data:
            return [class_data]

    return []
