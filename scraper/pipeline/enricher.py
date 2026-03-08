"""Property enrichment via OSM Nominatim geocoding.

Adds latitude/longitude to properties that have location text but no coords.
Uses rate limiting and in-memory caching to respect Nominatim's usage policy.
"""

import asyncio
from typing import Any

import httpx

from config import config
from utils.logger import get_logger

logger = get_logger(__name__)

# In-memory geocode cache (area -> (lat, lng))
_geocode_cache: dict[str, tuple[float, float] | None] = {}

# Nominatim requires max 1 req/sec
_NOMINATIM_DELAY = 1.1


async def enrich_property(properties: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Enrich properties with geocoding data.

    Adds latitude/longitude for properties that have area/locationText
    but no existing coordinates.
    """
    to_geocode = [
        p for p in properties
        if not (p.get("latitude") and p.get("longitude"))
        and (p.get("area") or p.get("locationText"))
    ]

    if not to_geocode:
        logger.info("No properties need geocoding")
        return properties

    logger.info(f"Geocoding {len(to_geocode)} properties via Nominatim...")

    async with httpx.AsyncClient(timeout=15.0) as client:
        for prop in to_geocode:
            query = _build_geocode_query(prop)
            if not query:
                continue

            coords = await _geocode(client, query)
            if coords:
                prop["latitude"] = coords[0]
                prop["longitude"] = coords[1]
                logger.debug(f"Geocoded '{query}' -> {coords}")

    geocoded_count = sum(
        1 for p in to_geocode
        if p.get("latitude") and p.get("longitude")
    )
    logger.info(f"Geocoded {geocoded_count}/{len(to_geocode)} properties")

    return properties


def _build_geocode_query(prop: dict[str, Any]) -> str | None:
    """Build a geocoding query string from property location data."""
    parts: list[str] = []

    if prop.get("estateName"):
        parts.append(prop["estateName"])
    if prop.get("area"):
        parts.append(prop["area"])
    elif prop.get("locationText"):
        parts.append(prop["locationText"])

    if prop.get("lga"):
        parts.append(prop["lga"])
    if prop.get("state"):
        parts.append(prop["state"])

    parts.append(prop.get("country", "Nigeria"))

    query = ", ".join(parts)
    return query if len(query) > 5 else None


async def _geocode(client: httpx.AsyncClient, query: str) -> tuple[float, float] | None:
    """Geocode a query via Nominatim, with caching."""
    cache_key = query.lower().strip()

    if cache_key in _geocode_cache:
        return _geocode_cache[cache_key]

    try:
        await asyncio.sleep(_NOMINATIM_DELAY)  # Rate limit

        resp = await client.get(
            f"{config.nominatim_url}/search",
            params={
                "q": query,
                "format": "json",
                "limit": 1,
                "countrycodes": "ng",
            },
            headers={
                "User-Agent": f"RealtorsPractice/1.0 ({config.nominatim_email})",
            },
        )
        resp.raise_for_status()
        results = resp.json()

        if results:
            lat = float(results[0]["lat"])
            lon = float(results[0]["lon"])
            coords = (lat, lon)
            _geocode_cache[cache_key] = coords
            return coords

        _geocode_cache[cache_key] = None
        return None

    except Exception as e:
        logger.debug(f"Geocoding failed for '{query}': {e}")
        _geocode_cache[cache_key] = None
        return None
