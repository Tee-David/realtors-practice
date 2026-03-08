"""Data normalization and cleaning for scraped property data.

Cleans whitespace, normalizes numeric fields, strips HTML from descriptions,
and ensures data matches the Prisma Property model schema.
"""

import re
from typing import Any

from utils.logger import get_logger

logger = get_logger(__name__)

# HTML tag stripper
HTML_TAG_RE = re.compile(r"<[^>]+>")
# Collapse multiple whitespace
MULTI_SPACE_RE = re.compile(r"\s+")


def normalize_property(raw_data: dict[str, Any], site_name: str) -> dict[str, Any]:
    """Normalize raw scraped data into a clean property dict.

    Args:
        raw_data: Raw extracted data from the universal extractor + NLP + parsers.
        site_name: Name of the source site (used as `source`).

    Returns:
        Cleaned dict ready for validation.
    """
    data = dict(raw_data)  # shallow copy

    # Set source
    data["source"] = site_name

    # Clean text fields
    for field in ("title", "description", "locationText", "fullAddress",
                  "agentName", "agentPhone", "agentEmail", "agencyName",
                  "propertyType", "propertySubtype", "estateName", "streetName",
                  "area", "lga", "state"):
        val = data.get(field)
        if isinstance(val, str):
            # Strip HTML
            val = HTML_TAG_RE.sub("", val)
            # Collapse whitespace
            val = MULTI_SPACE_RE.sub(" ", val).strip()
            data[field] = val if val else None

    # Strip HTML from description (extra thorough)
    if data.get("description"):
        data["description"] = _clean_description(data["description"])

    # Normalize numeric fields to int
    for field in ("bedrooms", "bathrooms", "toilets", "bq", "floors",
                  "parkingSpaces", "yearBuilt", "unitsAvailable"):
        data[field] = _to_int(data.get(field))

    # Normalize float fields
    for field in ("price", "landSizeSqm", "buildingSizeSqm", "pricePerSqm",
                  "serviceCharge", "legalFees", "agentCommission", "initialDeposit"):
        data[field] = _to_float(data.get(field))

    # Compute pricePerSqm if we have both price and area
    if data.get("price") and data.get("landSizeSqm") and data["landSizeSqm"] > 0:
        data["pricePerSqm"] = round(data["price"] / data["landSizeSqm"], 2)
    elif data.get("price") and data.get("buildingSizeSqm") and data["buildingSizeSqm"] > 0:
        data["pricePerSqm"] = round(data["price"] / data["buildingSizeSqm"], 2)

    # Compute pricePerBedroom
    if data.get("price") and data.get("bedrooms") and data["bedrooms"] > 0:
        data["pricePerBedroom"] = round(data["price"] / data["bedrooms"], 2)

    # Normalize images to list of strings
    images = data.get("images")
    if isinstance(images, list):
        data["images"] = [url for url in images if isinstance(url, str) and url.startswith("http")]
    else:
        data["images"] = []

    # Normalize list fields
    for field in ("features", "security", "utilities", "landmarks", "promoTags"):
        val = data.get(field)
        if not isinstance(val, list):
            data[field] = []

    # Default values
    data.setdefault("country", "Nigeria")
    data.setdefault("state", "Lagos")
    data.setdefault("priceCurrency", "NGN")
    data.setdefault("status", "AVAILABLE")
    data.setdefault("verificationStatus", "UNVERIFIED")
    data.setdefault("category", _infer_category(data))

    # Build search keywords
    data["searchKeywords"] = _build_search_keywords(data)

    return data


def _clean_description(text: str) -> str:
    """Strip HTML and clean up description text."""
    text = HTML_TAG_RE.sub(" ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    text = text.replace("&lt;", "<").replace("&gt;", ">")
    text = MULTI_SPACE_RE.sub(" ", text).strip()
    return text


def _to_int(val: Any) -> int | None:
    """Convert value to int, extracting digits if needed."""
    if val is None:
        return None
    if isinstance(val, int):
        return val
    if isinstance(val, float):
        return int(val)
    if isinstance(val, str):
        # Extract first number from string like "3 bedrooms"
        match = re.search(r"(\d+)", val)
        if match:
            return int(match.group(1))
    return None


def _to_float(val: Any) -> float | None:
    """Convert value to float."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if val > 0 else None
    if isinstance(val, str):
        clean = val.replace(",", "").replace(" ", "")
        match = re.search(r"([\d.]+)", clean)
        if match:
            try:
                f = float(match.group(1))
                return f if f > 0 else None
            except ValueError:
                return None
    return None


def _infer_category(data: dict[str, Any]) -> str:
    """Infer property category from type and listing type."""
    listing_type = (data.get("listingType") or "").upper()
    prop_type = (data.get("propertyType") or "").lower()

    if listing_type == "SHORTLET":
        return "SHORTLET"

    land_keywords = ("land", "plot", "acre", "hectare")
    if any(kw in prop_type for kw in land_keywords):
        return "LAND"

    commercial_keywords = ("office", "shop", "warehouse", "commercial", "store", "plaza")
    if any(kw in prop_type for kw in commercial_keywords):
        return "COMMERCIAL"

    industrial_keywords = ("factory", "industrial", "plant")
    if any(kw in prop_type for kw in industrial_keywords):
        return "INDUSTRIAL"

    return "RESIDENTIAL"


def _build_search_keywords(data: dict[str, Any]) -> list[str]:
    """Build search keywords from property data."""
    keywords: set[str] = set()

    for field in ("title", "area", "state", "lga", "estateName",
                  "propertyType", "agentName"):
        val = data.get(field)
        if isinstance(val, str) and val:
            for word in val.lower().split():
                if len(word) > 2:
                    keywords.add(word)

    features = data.get("features") or []
    for feat in features:
        if isinstance(feat, str):
            keywords.add(feat.lower())

    return list(keywords)[:50]  # Cap at 50 keywords
