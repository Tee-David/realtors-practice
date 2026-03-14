"""Per-site selector cache backed by Redis.

When the LLM discovers new CSS selectors for a site, they're cached here.
On subsequent scrapes, the adaptive fetcher checks the cache first and uses
discovered selectors (Layer 2) before falling back to LLM extraction (Layer 3).

Selectors expire after 7 days to force periodic re-discovery, ensuring
the cache stays fresh as sites evolve.
"""

import json
from typing import Optional

import redis

from config import config
from utils.logger import get_logger

logger = get_logger(__name__)

CACHE_PREFIX = "selector_cache:"
DEFAULT_TTL = 7 * 24 * 3600  # 7 days

_redis: Optional[redis.Redis] = None


def _get_redis() -> redis.Redis:
    """Lazy-init Redis client."""
    global _redis
    if _redis is None:
        _redis = redis.Redis.from_url(config.redis_url, decode_responses=True)
    return _redis


def _site_key(site_domain: str) -> str:
    """Build Redis key for a site's cached selectors."""
    return f"{CACHE_PREFIX}{site_domain}"


def get_cached_selectors(site_domain: str) -> Optional[dict[str, str]]:
    """Retrieve cached CSS selectors for a site.

    Args:
        site_domain: The site's domain (e.g., 'propertypro.ng')

    Returns:
        Dict mapping field names to CSS selectors, or None if no cache exists
    """
    try:
        r = _get_redis()
        raw = r.get(_site_key(site_domain))
        if raw:
            selectors = json.loads(raw)
            logger.debug(f"Cache hit: {len(selectors)} selectors for {site_domain}")
            return selectors
        return None
    except Exception as e:
        logger.debug(f"Selector cache read error: {e}")
        return None


def save_selectors(
    site_domain: str, selectors: dict[str, str], ttl: int = DEFAULT_TTL
) -> None:
    """Cache discovered CSS selectors for a site.

    Args:
        site_domain: The site's domain
        selectors: Dict mapping field names to CSS selectors
        ttl: Time-to-live in seconds (default 7 days)
    """
    try:
        r = _get_redis()
        r.setex(_site_key(site_domain), ttl, json.dumps(selectors))
        logger.info(f"Cached {len(selectors)} selectors for {site_domain} (TTL: {ttl}s)")
    except Exception as e:
        logger.warning(f"Selector cache write error: {e}")


def invalidate(site_domain: str) -> None:
    """Remove cached selectors for a site (force re-discovery)."""
    try:
        r = _get_redis()
        r.delete(_site_key(site_domain))
        logger.info(f"Invalidated selector cache for {site_domain}")
    except Exception as e:
        logger.debug(f"Selector cache invalidation error: {e}")
