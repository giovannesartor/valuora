"""
Rotas de consulta de CNPJ via ReceitaWS.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from app.services.receitaws_service import lookup_cnpj
from app.services.auth_service import get_current_user
from app.models.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cnpj", tags=["CNPJ"])


class AtividadeSecundaria(BaseModel):
    codigo: str
    descricao: str


class CNPJResponse(BaseModel):
    cnpj: str
    razao_social: str
    nome_fantasia: str
    situacao: str
    situacao_ativa: bool
    porte: str
    natureza_juridica: str
    abertura: str
    tempo_empresa_anos: Optional[int]
    capital_social: str
    cnae_codigo: str
    cnae_descricao: str
    atividades_secundarias: List[AtividadeSecundaria]
    municipio: str
    uf: str
    ultima_atualizacao: str


@router.get(
    "/{cnpj}",
    response_model=CNPJResponse,
    summary="Consultar dados de um CNPJ",
    description=(
        "Busca os dados cadastrais de um CNPJ na Receita Federal via ReceitaWS. "
        "Retorna campos como razão social, CNAE, porte, tempo de empresa e situação. "
        "Requer autenticação."
    ),
)
async def get_cnpj(
    cnpj: str,
    current_user: User = Depends(get_current_user),
):
    try:
        result = await lookup_cnpj(cnpj)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Erro ao consultar CNPJ %s: %s", cnpj, exc)
        raise HTTPException(
            status_code=503,
            detail="Serviço de consulta de CNPJ temporariamente indisponível. Tente novamente.",
        )

    return result
