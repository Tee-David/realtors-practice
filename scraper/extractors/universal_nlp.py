"""Natural language listing type detection.

Determines whether a property listing is FOR SALE, FOR RENT, SHORTLET, or LAND
based on title, description, and price text analysis.
"""

import re

from utils.logger import get_logger

logger = get_logger(__name__)

# Weighted keyword patterns for each listing type
SALE_PATTERNS = [
    (r"\bfor\s+sale\b", 10),
    (r"\bselling\b", 8),
    (r"\bsell\b", 5),
    (r"\bbuy\b", 5),
    (r"\bpurchase\b", 5),
    (r"\bownership\b", 4),
    (r"\boutright\b", 7),
    (r"\bjoint\s+venture\b", 6),
    (r"\bnewly\s+built\b", 3),
    (r"\boff[\s-]?plan\b", 6),
    (r"\bc\s*of\s*o\b", 5),  # Certificate of Occupancy
    (r"\bglobal\s+c\s*of\s*o\b", 5),
    (r"\bgovernor'?s?\s+consent\b", 5),
    (r"\bsurvey\s+plan\b", 3),
    (r"\bexcision\b", 4),
    (r"\bgazetted\b", 4),
]

RENT_PATTERNS = [
    (r"\bfor\s+rent\b", 10),
    (r"\bto\s+let\b", 10),
    (r"\bto\s+rent\b", 10),
    (r"\bletting\b", 8),
    (r"\brental\b", 7),
    (r"\blease\b", 5),
    (r"\bleasing\b", 5),
    (r"\btenant\b", 6),
    (r"\bper\s+annum\b", 8),
    (r"\bp\.?a\.?\b", 4),
    (r"\bper\s+year\b", 8),
    (r"\bannual\s+rent\b", 10),
    (r"\bmonthly\s+rent\b", 10),
    (r"\b/\s*year\b", 6),
    (r"\b/\s*month\b", 6),
    (r"\b/\s*annum\b", 7),
]

SHORTLET_PATTERNS = [
    (r"\bshort\s*let\b", 10),
    (r"\bshort[\s-]?term\b", 8),
    (r"\bshort[\s-]?stay\b", 8),
    (r"\bper\s+night\b", 10),
    (r"\b/\s*night\b", 9),
    (r"\bnightly\b", 8),
    (r"\bper\s+day\b", 7),
    (r"\bdaily\b", 5),
    (r"\bweekend\b", 4),
    (r"\bairbnb\b", 8),
    (r"\bbnb\b", 6),
    (r"\bfully\s+furnished\s+.*\brent\b", 3),
    (r"\bholiday\s+home\b", 6),
    (r"\bserviced\s+apartment\b", 3),
]

LAND_PATTERNS = [
    (r"\bland\s+for\b", 10),
    (r"\bplot\s+of\s+land\b", 10),
    (r"\bplots?\s+for\b", 9),
    (r"\bacre(?:s|age)?\b", 7),
    (r"\bhectare\b", 7),
    (r"\bsqm\s+land\b", 6),
    (r"\bsquare\s+met(?:er|re)\b", 4),
    (r"\bvacant\s+land\b", 9),
    (r"\bbare\s+land\b", 9),
    (r"\bdry\s+land\b", 8),
    (r"\bcorner[\s-]?piece\b", 5),
    (r"\bcommercial\s+land\b", 8),
    (r"\bresidential\s+land\b", 8),
    (r"\bindustrial\s+land\b", 8),
    (r"\bmixed[\s-]?use\s+land\b", 8),
]


def detect_listing_type(
    title: str = "",
    description: str = "",
    price_text: str = "",
) -> str:
    """Detect listing type from text content.

    Returns one of: SALE, RENT, SHORTLET, LAND
    """
    # Combine text, weight title more heavily
    combined = f"{title} {title} {price_text} {description[:500]}"
    text = combined.lower()

    scores = {
        "SALE": _score_patterns(text, SALE_PATTERNS),
        "RENT": _score_patterns(text, RENT_PATTERNS),
        "SHORTLET": _score_patterns(text, SHORTLET_PATTERNS),
        "LAND": _score_patterns(text, LAND_PATTERNS),
    }

    # Land detection from category clues in title
    land_keywords = re.search(
        r"\b(plot|land|acre|hectare)\b", title.lower()
    )
    if land_keywords and scores["LAND"] >= 5:
        # If it's clearly land, check if for sale or rent
        if scores["RENT"] > scores["SALE"]:
            return "RENT"  # Land for lease
        return "SALE"  # Default: land is for sale

    # Get the highest scoring type
    best_type = max(scores, key=scores.get)  # type: ignore

    # If no strong signal, default to SALE
    if scores[best_type] < 3:
        return "SALE"

    return best_type


def _score_patterns(text: str, patterns: list[tuple[str, int]]) -> int:
    """Sum up weighted pattern matches."""
    score = 0
    for pattern, weight in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            score += weight
    return score
