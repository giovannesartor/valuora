"""
Quanto Vale — Cache Service
Redis cache module for IBGE data (CNAE & SIDRA).
Default TTL: 24h. JSON serialization.
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
    """Retrieve value from Redis cache. Returns None if missing or error."""
    try:
        data = await redis_client.get(key)
        if data is not None:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"[CACHE] Error reading {key}: {e}")
    return None


async def cache_set(key: str, value: Any, ttl: int = CACHE_TTL_CNAE) -> bool:
    """Store value in Redis cache with TTL."""
    try:
        await redis_client.set(key, json.dumps(value, default=str), ex=ttl)
        return True
    except Exception as e:
        logger.warning(f"[CACHE] Error writing {key}: {e}")
        return False


async def cache_delete(key: str) -> bool:
    """Remove key from cache."""
    try:
        await redis_client.delete(key)
        return True
    except Exception as e:
        logger.warning(f"[CACHE] Error deleting {key}: {e}")
        return False


async def cache_delete_pattern(pattern: str) -> int:
    """Remove all keys matching the pattern."""
    try:
        keys = []
        async for key in redis_client.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await redis_client.delete(*keys)
        return len(keys)
    except Exception as e:
        logger.warning(f"[CACHE] Error clearing pattern {pattern}: {e}")
        return 0


# ─── Helpers de chave ────────────────────────────────────

def cnae_key(suffix: str) -> str:
    """Generate cache key for CNAE."""
    return f"{PREFIX_CNAE}{suffix}"


def sidra_key(suffix: str) -> str:
    """Generate cache key for SIDRA."""
    return f"{PREFIX_SIDRA}{suffix}"


def benchmark_key(cnae_code: str, year: Optional[int] = None) -> str:
    """Generate cache key for benchmark."""
    if year:
        return f"{PREFIX_BENCHMARK}{cnae_code}:{year}"
    return f"{PREFIX_BENCHMARK}{cnae_code}"


# ─── JWT Blacklist ────────────────────────────────────────
PREFIX_JWT_BLACKLIST = "qv:jwt_blacklist:"


async def blacklist_token(jti: str, ttl: int = 1800) -> bool:
    """Add JWT token to blacklist. TTL = remaining token time."""
    try:
        key = f"{PREFIX_JWT_BLACKLIST}{jti}"
        await redis_client.set(key, "1", ex=ttl)
        return True
    except Exception as e:
        logger.warning(f"[CACHE] Error blacklisting JWT {jti}: {e}")
        return False


async def is_token_blacklisted(jti: str) -> bool:
    """Check if JWT token is blacklisted."""
    try:
        key = f"{PREFIX_JWT_BLACKLIST}{jti}"
        result = await redis_client.get(key)
        return result is not None
    except Exception as e:
        logger.warning(f"[CACHE] Error checking JWT blacklist {jti}: {e}")
        return False
