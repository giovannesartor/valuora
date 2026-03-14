"""
CNPJ lookup routes via ReceitaWS.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from app.services.receitaws_service import lookup_cnpj
from app.services.auth_service import get_current_user, get_current_admin
from app.models.models import User
from app.core.cache import cache_get, cache_set, cache_delete

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cnpj", tags=["CNPJ"])

# Rate limit: 20 queries per user per day
_RATE_LIMIT_MAX = 20
_RATE_LIMIT_TTL = 60 * 60 * 24  # 24h


async def _check_rate_limit(user_id: str) -> None:
    """Raises HTTPException 429 if user exceeded daily limit."""
    from app.core.redis import redis_client
    key = f"cnpj_rl:{user_id}"
    # Atomic pipeline: INCR + EXPIRE in a single round-trip
    async with redis_client.pipeline(transaction=True) as pipe:
        await pipe.incr(key)
        await pipe.expire(key, _RATE_LIMIT_TTL)
        results = await pipe.execute()
    count = results[0]
    if count > _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {_RATE_LIMIT_MAX} CNPJ queries reached. Try again tomorrow.",
        )


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
    summary="Look up CNPJ data",
    description=(
        "Looks up CNPJ registration data from Receita Federal via ReceitaWS. "
        "Returns fields such as legal name, CNAE, company size, age and status. "
        "Requires authentication."
    ),
)
async def get_cnpj(
    cnpj: str,
    current_user: User = Depends(get_current_user),
):
    await _check_rate_limit(str(current_user.id))
    try:
        result = await lookup_cnpj(cnpj)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error querying CNPJ %s: %s", cnpj, exc)
        raise HTTPException(
            status_code=503,
            detail="CNPJ lookup service temporarily unavailable. Please try again.",
        )

    return result


@router.delete(
    "/{cnpj}/invalidate",
    summary="Invalidate CNPJ cache (admin)",
    description="Removes the CNPJ entry from Redis cache, forcing a fresh ReceitaWS query on next request. Requires admin role.",
)
async def invalidate_cnpj_cache(
    cnpj: str,
    current_admin: User = Depends(get_current_admin),
):
    import re
    digits = re.sub(r"\D", "", cnpj)
    if len(digits) != 14:
        raise HTTPException(status_code=422, detail="CNPJ must have 14 digits.")
    cache_key = f"cnpj:{digits}"
    removed = await cache_delete(cache_key)
    return {
        "ok": True,
        "cnpj": digits,
        "cache_removed": removed,
        "message": "Cache invalidated. Next query will hit ReceitaWS in real time.",
    }
