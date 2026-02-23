"""
Quanto Vale — Cache Service
Módulo de cache Redis para dados IBGE (CNAE & SIDRA).
TTL padrão: 24h. Serialização JSON.
"""

import json
import logging
from typing import Optional, Any
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

# TTLs em segundos
CACHE_TTL_CNAE = 86400         # 24 horas
CACHE_TTL_SIDRA = 86400        # 24 horas
CACHE_TTL_BENCHMARK = 43200    # 12 horas
CACHE_TTL_SHORT = 3600         # 1 hora

# Prefixos
PREFIX_CNAE = "qv:cnae:"
PREFIX_SIDRA = "qv:sidra:"
PREFIX_BENCHMARK = "qv:bench:"


async def cache_get(key: str) -> Optional[Any]:
    """Recupera valor do cache Redis. Retorna None se ausente ou erro."""
    try:
        data = await redis_client.get(key)
        if data is not None:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"[CACHE] Erro ao ler {key}: {e}")
    return None


async def cache_set(key: str, value: Any, ttl: int = CACHE_TTL_CNAE) -> bool:
    """Armazena valor no cache Redis com TTL."""
    try:
        await redis_client.set(key, json.dumps(value, default=str), ex=ttl)
        return True
    except Exception as e:
        logger.warning(f"[CACHE] Erro ao gravar {key}: {e}")
        return False


async def cache_delete(key: str) -> bool:
    """Remove chave do cache."""
    try:
        await redis_client.delete(key)
        return True
    except Exception as e:
        logger.warning(f"[CACHE] Erro ao deletar {key}: {e}")
        return False


async def cache_delete_pattern(pattern: str) -> int:
    """Remove todas as chaves que casam com o padrão."""
    try:
        keys = []
        async for key in redis_client.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await redis_client.delete(*keys)
        return len(keys)
    except Exception as e:
        logger.warning(f"[CACHE] Erro ao limpar padrão {pattern}: {e}")
        return 0


# ─── Helpers de chave ────────────────────────────────────

def cnae_key(suffix: str) -> str:
    """Gera chave de cache para CNAE."""
    return f"{PREFIX_CNAE}{suffix}"


def sidra_key(suffix: str) -> str:
    """Gera chave de cache para SIDRA."""
    return f"{PREFIX_SIDRA}{suffix}"


def benchmark_key(cnae_code: str, year: Optional[int] = None) -> str:
    """Gera chave de cache para benchmark."""
    if year:
        return f"{PREFIX_BENCHMARK}{cnae_code}:{year}"
    return f"{PREFIX_BENCHMARK}{cnae_code}"


# ─── JWT Blacklist ────────────────────────────────────────
PREFIX_JWT_BLACKLIST = "qv:jwt_blacklist:"


async def blacklist_token(jti: str, ttl: int = 1800) -> bool:
    """Adiciona token JWT à blacklist. TTL = tempo restante do token."""
    try:
        key = f"{PREFIX_JWT_BLACKLIST}{jti}"
        await redis_client.set(key, "1", ex=ttl)
        return True
    except Exception as e:
        logger.warning(f"[CACHE] Erro ao blacklistar JWT {jti}: {e}")
        return False


async def is_token_blacklisted(jti: str) -> bool:
    """Verifica se token JWT está na blacklist."""
    try:
        key = f"{PREFIX_JWT_BLACKLIST}{jti}"
        result = await redis_client.get(key)
        return result is not None
    except Exception as e:
        logger.warning(f"[CACHE] Erro ao verificar blacklist JWT {jti}: {e}")
        return False
