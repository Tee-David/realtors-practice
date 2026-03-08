"""Nigerian property price parser.

Handles: ₦, NGN, N, Naira, "million", "m", "billion", "b", "k",
"per annum", "p.a.", "/year", "/month", "/night", commas, spaces.
"""

import re
from typing import Any

from utils.logger import get_logger

logger = get_logger(__name__)

# Currency symbols/prefixes
NAIRA_PATTERN = r"(?:₦|NGN|N(?:aira)?)\s*"

# Number with optional commas and decimals
NUMBER_PATTERN = r"([\d,]+(?:\.\d+)?)"

# Multiplier suffixes
MULTIPLIER_PATTERN = r"\s*(million|m|billion|b|bn|thousand|k|th)?"

# Combined price extraction pattern
PRICE_REGEX = re.compile(
    rf"(?:{NAIRA_PATTERN})?{NUMBER_PATTERN}{MULTIPLIER_PATTERN}",
    re.IGNORECASE,
)

# Rent frequency detection
FREQUENCY_PATTERNS = [
    (r"per\s+annum|p\.?a\.?|/\s*(?:year|yr|annum)", "ANNUALLY"),
    (r"per\s+month|/\s*(?:month|mo)", "MONTHLY"),
    (r"per\s+night|/\s*night|nightly", "NIGHTLY"),
    (r"per\s+week|/\s*(?:week|wk)|weekly", "WEEKLY"),
    (r"per\s+day|/\s*day|daily", "DAILY"),
]

# Currency detection
CURRENCY_PATTERNS = [
    (r"(?:\$|USD|US\s*Dollar)", "USD"),
    (r"(?:£|GBP|Pound)", "GBP"),
    (r"(?:€|EUR|Euro)", "EUR"),
]

MULTIPLIERS = {
    "k": 1_000,
    "th": 1_000,
    "thousand": 1_000,
    "m": 1_000_000,
    "million": 1_000_000,
    "b": 1_000_000_000,
    "bn": 1_000_000_000,
    "billion": 1_000_000_000,
}


def parse_price(text: str) -> dict[str, Any]:
    """Parse a Nigerian property price string.

    Returns dict with: price, priceCurrency, rentFrequency
    """
    if not text:
        return {"price": None, "priceCurrency": "NGN", "rentFrequency": None}

    result: dict[str, Any] = {
        "price": None,
        "priceCurrency": "NGN",
        "rentFrequency": None,
    }

    text_clean = text.strip()

    # Detect currency
    for pattern, currency in CURRENCY_PATTERNS:
        if re.search(pattern, text_clean, re.IGNORECASE):
            result["priceCurrency"] = currency
            break

    # Detect rent frequency
    for pattern, frequency in FREQUENCY_PATTERNS:
        if re.search(pattern, text_clean, re.IGNORECASE):
            result["rentFrequency"] = frequency
            break

    # Extract the numeric price
    # First, try to find a price with Naira prefix
    naira_match = re.search(
        rf"{NAIRA_PATTERN}{NUMBER_PATTERN}{MULTIPLIER_PATTERN}",
        text_clean,
        re.IGNORECASE,
    )

    if naira_match:
        result["price"] = _parse_number(
            naira_match.group(1), naira_match.group(2)
        )
    else:
        # Fall back to any number with multiplier
        matches = PRICE_REGEX.findall(text_clean)
        if matches:
            # Take the largest number (likely the price)
            best_price = 0
            for num_str, mult_str in matches:
                price = _parse_number(num_str, mult_str)
                if price and price > best_price:
                    best_price = price
            if best_price > 0:
                result["price"] = best_price

    return result


def _parse_number(num_str: str, multiplier_str: str | None) -> float | None:
    """Convert a number string + multiplier to a float."""
    if not num_str:
        return None

    try:
        # Remove commas and spaces
        clean = num_str.replace(",", "").replace(" ", "")
        value = float(clean)

        # Apply multiplier
        if multiplier_str:
            mult_key = multiplier_str.lower().strip()
            if mult_key in MULTIPLIERS:
                value *= MULTIPLIERS[mult_key]

        return value
    except (ValueError, TypeError):
        return None
