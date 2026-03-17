"""Property data validator and quality scorer.

Validates required fields, cleans invalid values, and computes a quality score
(0-100) matching the backend QualityService algorithm.
"""

from typing import Any

from utils.logger import get_logger

logger = get_logger(__name__)

REQUIRED_FIELDS = ("title", "listingUrl", "source")


def validate_property(data: dict[str, Any]) -> dict[str, Any]:
    """Validate and score a scraped property dict.

    - Ensures required fields exist
    - Cleans invalid/empty values
    - Adds qualityScore (0-100)
    - Returns the cleaned dict (or raises ValueError if invalid)
    """
    # Check required fields
    for field in REQUIRED_FIELDS:
        if not data.get(field):
            raise ValueError(f"Missing required field: {field}")

    # Clean empty strings → None
    cleaned: dict[str, Any] = {}
    for key, value in data.items():
        if isinstance(value, str) and value.strip() == "":
            cleaned[key] = None
        else:
            cleaned[key] = value

    # Ensure listingType defaults to SALE
    if not cleaned.get("listingType"):
        cleaned["listingType"] = "SALE"

    # Validate numeric fields
    for field in ("bedrooms", "bathrooms", "toilets", "bq", "floors", "parkingSpaces"):
        val = cleaned.get(field)
        if val is not None:
            try:
                cleaned[field] = int(val)
            except (ValueError, TypeError):
                cleaned[field] = None

    for field in ("price", "landSizeSqm", "buildingSizeSqm", "serviceCharge"):
        val = cleaned.get(field)
        if val is not None:
            try:
                cleaned[field] = float(val)
                if cleaned[field] <= 0:
                    cleaned[field] = None
            except (ValueError, TypeError):
                cleaned[field] = None

    # Compute quality score (mirrors backend QualityService)
    cleaned["qualityScore"] = _compute_quality_score(cleaned)

    return cleaned


def _compute_quality_score(data: dict[str, Any]) -> int:
    """Compute quality score 0-100, matching backend QualityService."""
    score = 0

    # Title (0-10)
    title = data.get("title") or ""
    if len(title) > 20:
        score += 10
    elif len(title) > 10:
        score += 7
    elif len(title) > 0:
        score += 4

    # Description (0-15)
    desc = data.get("description") or ""
    if len(desc) > 200:
        score += 15
    elif len(desc) > 100:
        score += 10
    elif len(desc) > 30:
        score += 6
    elif len(desc) > 0:
        score += 3

    # Price (0-10)
    price = data.get("price")
    if price and price > 0:
        score += 10

    # Property details (0-15)
    detail_score = 0
    if data.get("bedrooms") is not None:
        detail_score += 4
    if data.get("bathrooms") is not None:
        detail_score += 3
    if data.get("propertyType"):
        detail_score += 4
    if data.get("landSizeSqm") or data.get("buildingSizeSqm"):
        detail_score += 4
    score += min(detail_score, 15)

    # Location (0-20)
    loc_score = 0
    if data.get("area"):
        loc_score += 5
    if data.get("state"):
        loc_score += 3
    if data.get("fullAddress") or data.get("locationText"):
        loc_score += 5
    if data.get("latitude") and data.get("longitude"):
        loc_score += 7
    score += min(loc_score, 20)

    # Images (0-15)
    images = data.get("images") or []
    if isinstance(images, list):
        if len(images) >= 5:
            score += 15
        elif len(images) >= 3:
            score += 10
        elif len(images) >= 1:
            score += 5

    # Agent info (0-10)
    agent_score = 0
    if data.get("agentName"):
        agent_score += 5
    if data.get("agentPhone"):
        agent_score += 5
    score += min(agent_score, 10)

    # Features (0-5)
    features = data.get("features") or []
    if isinstance(features, list):
        if len(features) >= 3:
            score += 5
        elif len(features) >= 1:
            score += 3

    return min(score, 100)
