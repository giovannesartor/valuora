"""
Quanto Vale — CNAE API Routes
Endpoints for CNAE classification, hierarchy and validation.
All endpoints use Redis cache (24h) to reduce IBGE API calls.
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


@router.get("/sections", summary="List CNAE sections")
async def list_sections():
    """Returns all CNAE sections (top level of the hierarchy)."""
    key = cnae_key("sections")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    sections = await get_all_sections()
    if not sections:
        raise HTTPException(status_code=502, detail="Could not retrieve IBGE data.")
    result = {"data": sections, "total": len(sections)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/sections/{section_id}/divisions", summary="Divisions by section")
async def list_divisions(section_id: str):
    """Returns divisions of a CNAE section."""
    key = cnae_key(f"div:{section_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    divisions = await get_divisions_by_section(section_id)
    result = {"data": divisions, "total": len(divisions)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/divisions/{division_id}/groups", summary="Groups by division")
async def list_groups(division_id: str):
    """Returns groups of a CNAE division."""
    key = cnae_key(f"grp:{division_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    groups = await get_groups_by_division(division_id)
    result = {"data": groups, "total": len(groups)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/groups/{group_id}/classes", summary="Classes by group")
async def list_classes(group_id: str):
    """Returns classes of a CNAE group."""
    key = cnae_key(f"cls:{group_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    classes = await get_classes_by_group(group_id)
    result = {"data": classes, "total": len(classes)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/classes/{class_id}/subclasses", summary="Subclasses by class")
async def list_subclasses(class_id: str):
    """Returns subclasses of a CNAE class."""
    key = cnae_key(f"subcls:{class_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    subclasses = await get_subclasses_by_class(class_id)
    result = {"data": subclasses, "total": len(subclasses)}
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/classes/{class_id}", summary="CNAE class details")
async def get_class_detail(class_id: str):
    """Returns detailed information for a CNAE class."""
    key = cnae_key(f"class:{class_id}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    result = await get_class_by_id(class_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"CNAE class {class_id} not found.")
    await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/validate/{code}", response_model=CnaeValidationResponse, summary="Validate CNAE code")
async def validate_cnae_code(code: str):
    """Validates a CNAE code and returns hierarchical info."""
    key = cnae_key(f"validate:{code}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    result = await validate_cnae(code)
    if result:
        await cache_set(key, result, ttl=CACHE_TTL_CNAE)
    return result


@router.get("/search", summary="Search CNAE")
async def search_cnae_endpoint(
    q: str = Query(..., min_length=1, description="Code or description"),
):
    """Search CNAE by code or description text."""
    # Cache search with a shorter TTL (1h) since queries vary widely
    key = cnae_key(f"search:{q.lower().strip()}")
    cached = await cache_get(key)
    if cached is not None:
        return cached
    results = await search_cnae(q)
    result = {"data": results, "total": len(results)}
    await cache_set(key, result, ttl=3600)  # 1h for search results
    return result
