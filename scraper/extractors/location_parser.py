"""Nigerian property location parser.

Extracts structured location hierarchy from free-text:
estate > area > LGA > state > country
"""

import re
from typing import Any

from utils.logger import get_logger

logger = get_logger(__name__)

# Nigerian states
NIGERIAN_STATES = {
    "abia", "adamawa", "akwa ibom", "anambra", "bauchi", "bayelsa", "benue",
    "borno", "cross river", "delta", "ebonyi", "edo", "ekiti", "enugu",
    "fct", "gombe", "imo", "jigawa", "kaduna", "kano", "katsina", "kebbi",
    "kogi", "kwara", "lagos", "nasarawa", "niger", "ogun", "ondo", "osun",
    "oyo", "plateau", "rivers", "sokoto", "taraba", "yobe", "zamfara",
    "abuja",
}

# Major Lagos areas/LGAs
LAGOS_AREAS = {
    # Island
    "lekki": "Eti-Osa", "victoria island": "Eti-Osa", "vi": "Eti-Osa",
    "ikoyi": "Eti-Osa", "banana island": "Eti-Osa", "oniru": "Eti-Osa",
    "ajah": "Eti-Osa", "sangotedo": "Eti-Osa", "chevron": "Eti-Osa",
    "osapa london": "Eti-Osa", "agungi": "Eti-Osa", "ikate": "Eti-Osa",
    "jakande": "Eti-Osa", "ilasan": "Eti-Osa", "igbo efon": "Eti-Osa",
    "ologolo": "Eti-Osa", "idado": "Eti-Osa", "lafiaji": "Eti-Osa",
    "marwa": "Eti-Osa",
    # Mainland
    "ikeja": "Ikeja", "ogba": "Ikeja", "maryland": "Ikeja",
    "alausa": "Ikeja", "adeniyi jones": "Ikeja", "opebi": "Ikeja",
    "allen avenue": "Ikeja", "toyin street": "Ikeja",
    "yaba": "Yaba", "surulere": "Surulere", "gbagada": "Kosofe",
    "magodo": "Kosofe", "ojodu": "Ojodu", "berger": "Ojodu",
    "ikorodu": "Ikorodu", "agege": "Agege", "ifako": "Ifako-Ijaiye",
    "alimosho": "Alimosho", "isolo": "Isolo", "ejigbo": "Isolo",
    "festac": "Amuwo-Odofin", "satellite town": "Amuwo-Odofin",
    "apapa": "Apapa", "amuwo odofin": "Amuwo-Odofin",
    "ojo": "Ojo", "badagry": "Badagry",
    "epe": "Epe", "ibeju lekki": "Ibeju-Lekki", "ibeju-lekki": "Ibeju-Lekki",
    "eleko": "Ibeju-Lekki", "abijo": "Ibeju-Lekki", "lakowe": "Ibeju-Lekki",
    "awoyaya": "Ibeju-Lekki", "bogije": "Ibeju-Lekki",
    "abraham adesanya": "Eti-Osa", "thomas estate": "Eti-Osa",
    "oregun": "Ikeja", "isheri": "Kosofe",
    "mushin": "Mushin", "oshodi": "Oshodi-Isolo", "anthony": "Kosofe",
    # Lekki sub-areas
    "lekki phase 1": "Eti-Osa", "lekki phase 2": "Eti-Osa",
    "lekki county": "Ibeju-Lekki", "lekki gardens": "Eti-Osa",
    "lekki pearl": "Eti-Osa",
}

# Abuja areas
ABUJA_AREAS = {
    "maitama": "Municipal", "asokoro": "Municipal", "wuse": "Municipal",
    "wuse 2": "Municipal", "garki": "Municipal", "central area": "Municipal",
    "gwarinpa": "Gwarinpa", "jahi": "Jahi", "life camp": "Gwarinpa",
    "lugbe": "Lugbe", "kubwa": "Bwari", "kuje": "Kuje",
    "utako": "Municipal", "jabi": "Municipal", "katampe": "Municipal",
    "durumi": "Municipal", "gudu": "Municipal", "lokogoma": "Lokogoma",
    "galadimawa": "Municipal", "kaura": "Municipal",
    "guzape": "Municipal", "idu": "Municipal", "dawaki": "Dawaki",
    "karshi": "Karshi", "nyanya": "Karu", "karu": "Karu",
}

# Other major cities
OTHER_CITIES = {
    "ibadan": "Oyo", "port harcourt": "Rivers", "ph": "Rivers",
    "benin": "Edo", "benin city": "Edo", "warri": "Delta",
    "calabar": "Cross River", "enugu": "Enugu", "owerri": "Imo",
    "abeokuta": "Ogun", "akure": "Ondo", "kaduna": "Kaduna",
    "kano": "Kano", "ilorin": "Kwara", "jos": "Plateau",
    "aba": "Abia", "uyo": "Akwa Ibom", "asaba": "Delta",
}


def parse_location(text: str) -> dict[str, Any]:
    """Parse location text into structured components.

    Returns dict with: locationText, area, lga, state, country, estateName, streetName
    """
    if not text:
        return {"locationText": None}

    result: dict[str, Any] = {
        "locationText": text.strip(),
        "area": None,
        "lga": None,
        "state": None,
        "country": "Nigeria",
        "estateName": None,
        "streetName": None,
    }

    text_lower = text.lower().strip()

    # Extract estate name (common patterns)
    estate_match = re.search(
        r"([\w\s]+(?:estate|gardens|court|terrace|residences|villa|park|close|crescent))",
        text_lower,
    )
    if estate_match:
        result["estateName"] = _title_case(estate_match.group(1).strip())

    # Extract street name
    street_match = re.search(
        r"(\d+[a-z]?\s+[\w\s]+(?:street|road|avenue|close|crescent|drive|way|lane|boulevard))",
        text_lower,
    )
    if street_match:
        result["streetName"] = _title_case(street_match.group(1).strip())

    # Try to match known areas
    # Check Lagos areas first (most common)
    for area, lga in LAGOS_AREAS.items():
        if area in text_lower:
            result["area"] = _title_case(area)
            result["lga"] = lga
            result["state"] = "Lagos"
            return result

    # Check Abuja areas
    for area, district in ABUJA_AREAS.items():
        if area in text_lower:
            result["area"] = _title_case(area)
            result["lga"] = district
            result["state"] = "FCT"
            return result

    # Check other cities
    for city, state in OTHER_CITIES.items():
        if city in text_lower:
            result["area"] = _title_case(city)
            result["state"] = state
            return result

    # Check for state name directly
    for state in NIGERIAN_STATES:
        if state in text_lower:
            if state == "abuja" or state == "fct":
                result["state"] = "FCT"
            else:
                result["state"] = _title_case(state)
            return result

    # If nothing matched, try to extract from comma-separated parts
    parts = [p.strip() for p in text.split(",")]
    if len(parts) >= 2:
        result["area"] = parts[0].strip()
        # Last part is often the state
        last = parts[-1].strip().lower()
        for state in NIGERIAN_STATES:
            if state in last:
                result["state"] = _title_case(state)
                break

    return result


def _title_case(text: str) -> str:
    """Title case with Nigerian naming conventions."""
    words = text.split()
    result = []
    for word in words:
        if word.lower() in ("of", "the", "and", "in", "at", "on"):
            result.append(word.lower())
        else:
            result.append(word.capitalize())
    return " ".join(result)
