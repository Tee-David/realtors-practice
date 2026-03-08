"""Property feature/amenity extraction from description text.

Extracts features, security items, and utilities from free-text descriptions.
"""

import re
from typing import Any

# Features (amenities)
FEATURE_PATTERNS: list[tuple[str, str]] = [
    (r"\bswimming\s+pool\b", "Swimming Pool"),
    (r"\bpool\b", "Swimming Pool"),
    (r"\bgym\b|\bgymnasium\b", "Gym"),
    (r"\bfitness\s+cent(?:er|re)\b", "Fitness Center"),
    (r"\bboys?\s*quart(?:er|ers)\b|\bbq\b", "Boys Quarter (BQ)"),
    (r"\bself[\s-]?con(?:tain|tained)?\b", "Self-Contained"),
    (r"\bbalcon(?:y|ies)\b", "Balcony"),
    (r"\bterrace\b", "Terrace"),
    (r"\bgarden\b", "Garden"),
    (r"\bcompound\b", "Compound"),
    (r"\bgarage\b", "Garage"),
    (r"\bcar\s*park(?:ing)?\b|\bparking\s+space\b", "Parking Space"),
    (r"\bstore\s*room\b", "Store Room"),
    (r"\blaundry\b", "Laundry Room"),
    (r"\bwalk[\s-]?in\s+closet\b", "Walk-in Closet"),
    (r"\bwardrobe\b", "Wardrobe"),
    (r"\bair[\s-]?condition(?:ing|er)?\b|\bac\b", "Air Conditioning"),
    (r"\bfurnished\b", "Furnished"),
    (r"\bfully\s+furnished\b", "Fully Furnished"),
    (r"\bsemi[\s-]?furnished\b", "Semi-Furnished"),
    (r"\bserviced\b", "Serviced"),
    (r"\bpent[\s-]?house\b", "Penthouse"),
    (r"\bsmart\s+home\b", "Smart Home"),
    (r"\bjacuzzi\b|\bhot\s+tub\b", "Jacuzzi"),
    (r"\bsauna\b", "Sauna"),
    (r"\belevator\b|\blift\b", "Elevator"),
    (r"\bintercom\b", "Intercom"),
    (r"\binterlocked\b", "Interlocked Compound"),
    (r"\bpop\s+ceiling\b|\bfalse\s+ceiling\b", "POP Ceiling"),
    (r"\bceiling\s+fan\b", "Ceiling Fan"),
    (r"\bchandelier\b", "Chandelier"),
    (r"\bgranite\s+(?:counter)?top\b", "Granite Countertop"),
    (r"\bmarble\b", "Marble Finishing"),
    (r"\btiled\b|\btiles?\b", "Tiled Floors"),
    (r"\bwater\s+heater\b|\bwater\s+boiler\b", "Water Heater"),
    (r"\bkitchen\s+cabinet\b", "Kitchen Cabinet"),
    (r"\bfitted\s+kitchen\b", "Fitted Kitchen"),
    (r"\bopen\s+plan\b", "Open Plan"),
    (r"\ben[\s-]?suite\b", "En-suite"),
    (r"\bguest\s+toilet\b", "Guest Toilet"),
    (r"\bchildren\s+play\b|\bplay\s*ground\b|\bplay\s+area\b", "Children Playground"),
    (r"\bclub\s*house\b", "Clubhouse"),
    (r"\brooftop\b", "Rooftop"),
]

# Security features
SECURITY_PATTERNS: list[tuple[str, str]] = [
    (r"\bgated\s+(?:community|estate|compound)\b", "Gated Estate"),
    (r"\b24\s*(?:hr|hour|/7)\s*(?:security|guard)\b", "24hr Security"),
    (r"\bsecurity\s+guard\b", "Security Guard"),
    (r"\bcctv\b|\bsurveillance\b", "CCTV"),
    (r"\bfence[d]?\b", "Fenced"),
    (r"\belectric\s+fence\b", "Electric Fence"),
    (r"\bsecurity\s+door\b|\barmou?red\s+door\b", "Security Door"),
    (r"\bsecurity\s+post\b|\bguard\s+house\b", "Guard House"),
    (r"\baccess\s+control\b|\bgate\s+(?:pass|access)\b", "Access Control"),
    (r"\balarm\b", "Alarm System"),
    (r"\bbiometric\b", "Biometric Access"),
]

# Utility features
UTILITY_PATTERNS: list[tuple[str, str]] = [
    (r"\b(?:24|twenty[\s-]?four)\s*(?:hr|hour|/7)\s*(?:power|electricity|light)\b", "24hr Power"),
    (r"\bprepaid\s+met(?:er|re)\b", "Prepaid Meter"),
    (r"\binverter\b", "Inverter"),
    (r"\bsolar\b", "Solar Power"),
    (r"\bgenerator\b|\bgen\b", "Generator"),
    (r"\bborehole\b", "Borehole"),
    (r"\bwater\s+(?:supply|treatment)\b", "Water Supply"),
    (r"\boverhead\s+tank\b", "Overhead Tank"),
    (r"\bunderground\s+tank\b", "Underground Tank"),
    (r"\btar(?:red)?\s+road\b", "Tarred Road"),
    (r"\bgood\s+road\b|\baccessible\s+road\b", "Good Road Network"),
    (r"\bdrainage\b", "Drainage"),
    (r"\bsewage\b", "Sewage System"),
    (r"\bwifi\b|\binternet\b|\bfibre\b|\bfiber\b", "Internet/WiFi"),
    (r"\bdstv\b|\bsat(?:ellite)?\s+(?:dish|tv)\b", "Satellite TV"),
]


def extract_features(
    description: str = "",
    features_text: str = "",
) -> dict[str, list[str]]:
    """Extract features, security, and utilities from text.

    Returns dict with: features, security, utilities
    """
    combined = f"{description} {features_text}".lower()

    result: dict[str, list[str]] = {
        "features": [],
        "security": [],
        "utilities": [],
    }

    seen: set[str] = set()

    for pattern, label in FEATURE_PATTERNS:
        if label not in seen and re.search(pattern, combined, re.IGNORECASE):
            result["features"].append(label)
            seen.add(label)

    for pattern, label in SECURITY_PATTERNS:
        if label not in seen and re.search(pattern, combined, re.IGNORECASE):
            result["security"].append(label)
            seen.add(label)

    for pattern, label in UTILITY_PATTERNS:
        if label not in seen and re.search(pattern, combined, re.IGNORECASE):
            result["utilities"].append(label)
            seen.add(label)

    return result
