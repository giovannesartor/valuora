"""
Quanto Vale — CNAE API Routes
Endpoints para classificação CNAE, hierarquia e validação.
Todos os endpoints usam cache Redis (24h) para reduzir chamadas ao IBGE.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.services.ibge_cnae_service import (
    get_all_sections,
    get_divisions_by_section,
    get_groups_by_division,
    get_classes_by_group,
    get_subclasses_by_class,
    get_class_by_id,
    validate_cnae,
    search_cnae,
)
from app.schemas.cnae_schema import CnaeCodeResponse, CnaeValidationResponse
from app.core.cache import cache_get, cache_set, cnae_key, CACHE_TTL_CNAE

router = APIRouter(prefix="/cnae", tags=["CNAE"])


@router.get("/sections", summary="Listar seções CNAE")
async def list_sections():
    """Retorna todas as seções CNAE (nível mais alto da hierarquia)."""
    key = cnae_key("sections")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    sections = await get_all_sections()
    if not sections:
        raise HTTPException(status_code=502, detail="Não foi possível obter dados do IBGE.")
    result = {"data": sections, "total": len(sections)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/sections/{section_id}/divisions", summary="Divisões por seção")
async def list_divisions(section_id: str):
    """Retorna divisões de uma seção CNAE."""
    key = cnae_key(f"div:{section_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    divisions = await get_divisions_by_section(section_id)
    result = {"data": divisions, "total": len(divisions)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/divisions/{division_id}/groups", summary="Grupos por divisão")
async def list_groups(division_id: str):
    """Retorna grupos de uma divisão CNAE."""
    key = cnae_key(f"grp:{division_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    groups = await get_groups_by_division(division_id)
    result = {"data": groups, "total": len(groups)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/groups/{group_id}/classes", summary="Classes por grupo")
async def list_classes(group_id: str):
    """Retorna classes de um grupo CNAE."""
    key = cnae_key(f"cls:{group_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    classes = await get_classes_by_group(group_id)
    result = {"data": classes, "total": len(classes)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/classes/{class_id}/subclasses", summary="Subclasses por classe")
async def list_subclasses(class_id: str):
    """Retorna subclasses de uma classe CNAE."""
    key = cnae_key(f"subcls:{class_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    subclasses = await get_subclasses_by_class(class_id)
    result = {"data": subclasses, "total": len(subclasses)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/classes/{class_id}", summary="Detalhes de uma classe CNAE")
async def get_class_detail(class_id: str):
    """Retorna informações detalhadas de uma classe CNAE."""
    key = cnae_key(f"class:{class_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    result = await get_class_by_id(class_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Classe CNAE {class_id} não encontrada.")
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/validate/{code}", response_model=CnaeValidationResponse, summary="Validar código CNAE")
async def validate_cnae_code(code: str):
    """Valida um código CNAE e retorna informações hierárquicas."""
    key = cnae_key(f"validate:{code}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    result = await validate_cnae(code)
    if result:
        await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/search", summary="Buscar CNAE")
async def search_cnae_endpoint(
    q: str = Query(..., min_length=1, description="Código ou descrição"),
):
    """Busca CNAE por código ou texto na descrição."""
    # Cache search with a shorter TTL (1h) since queries vary widely
    key = cnae_key(f"search:{q.lower().strip()}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    results = await search_cnae(q)
    result = {"data": results, "total": len(results)}
    await cache_set(key, result, ttl=3600)  # 1h for search results
    return result
