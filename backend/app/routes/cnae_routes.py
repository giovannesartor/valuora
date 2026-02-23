"""
Quanto Vale — CNAE API Routes
Endpoints para classificação CNAE, hierarquia e validação.
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

router = APIRouter(prefix="/cnae", tags=["CNAE"])


@router.get("/sections", summary="Listar seções CNAE")
async def list_sections():
    """Retorna todas as seções CNAE (nível mais alto da hierarquia)."""
    sections = await get_all_sections()
    if not sections:
        raise HTTPException(status_code=502, detail="Não foi possível obter dados do IBGE.")
    return {"data": sections, "total": len(sections)}


@router.get("/sections/{section_id}/divisions", summary="Divisões por seção")
async def list_divisions(section_id: str):
    """Retorna divisões de uma seção CNAE."""
    divisions = await get_divisions_by_section(section_id)
    return {"data": divisions, "total": len(divisions)}


@router.get("/divisions/{division_id}/groups", summary="Grupos por divisão")
async def list_groups(division_id: str):
    """Retorna grupos de uma divisão CNAE."""
    groups = await get_groups_by_division(division_id)
    return {"data": groups, "total": len(groups)}


@router.get("/groups/{group_id}/classes", summary="Classes por grupo")
async def list_classes(group_id: str):
    """Retorna classes de um grupo CNAE."""
    classes = await get_classes_by_group(group_id)
    return {"data": classes, "total": len(classes)}


@router.get("/classes/{class_id}/subclasses", summary="Subclasses por classe")
async def list_subclasses(class_id: str):
    """Retorna subclasses de uma classe CNAE."""
    subclasses = await get_subclasses_by_class(class_id)
    return {"data": subclasses, "total": len(subclasses)}


@router.get("/classes/{class_id}", summary="Detalhes de uma classe CNAE")
async def get_class_detail(class_id: str):
    """Retorna informações detalhadas de uma classe CNAE."""
    result = await get_class_by_id(class_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Classe CNAE {class_id} não encontrada.")
    return result


@router.get("/validate/{code}", response_model=CnaeValidationResponse, summary="Validar código CNAE")
async def validate_cnae_code(code: str):
    """Valida um código CNAE e retorna informações hierárquicas."""
    result = await validate_cnae(code)
    return result


@router.get("/search", summary="Buscar CNAE")
async def search_cnae_endpoint(
    q: str = Query(..., min_length=1, description="Código ou descrição"),
):
    """Busca CNAE por código ou texto na descrição."""
    results = await search_cnae(q)
    return {"data": results, "total": len(results)}
