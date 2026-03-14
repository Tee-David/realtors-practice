"""LLM-powered property extraction using Gemini Flash.

Takes clean Markdown (from Crawl4AI) or raw page text and extracts structured
property data using Gemini Flash with a Pydantic schema.

Also discovers CSS selectors for self-healing: when LLM extraction succeeds,
we ask Gemini to return the CSS selectors that match each field, caching them
in Redis so future scrapes of the same site use fast CSS extraction (Layer 2)
instead of LLM extraction (Layer 3).
"""

import json
import os
from typing import Any, Optional

from pydantic import BaseModel, Field

from utils.logger import get_logger

logger = get_logger(__name__)

# Gemini API key from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


class PropertySchema(BaseModel):
    """Pydantic schema for Nigerian property data extraction."""
    title: Optional[str] = Field(None, description="Property title/headline")
    price_text: Optional[str] = Field(None, description="Price as displayed (e.g. '₦5,000,000', '₦50k/yr', '₦2.5 Million')")
    location_text: Optional[str] = Field(None, description="Full location/address string")
    description: Optional[str] = Field(None, description="Property description text")
    bedrooms: Optional[int] = Field(None, description="Number of bedrooms")
    bathrooms: Optional[int] = Field(None, description="Number of bathrooms")
    toilets: Optional[int] = Field(None, description="Number of toilets")
    area_size_text: Optional[str] = Field(None, description="Area/floor size as displayed (e.g. '250 sqm', '500m²')")
    property_type: Optional[str] = Field(None, description="Property type (e.g. Flat, Duplex, Bungalow, Land, Detached House)")
    listing_type: Optional[str] = Field(None, description="Listing type: FOR_SALE, FOR_RENT, SHORTLET, or LAND")
    agent_name: Optional[str] = Field(None, description="Agent or seller name")
    agent_phone: Optional[str] = Field(None, description="Agent phone number")
    features: list[str] = Field(default_factory=list, description="Property features/amenities list")
    images: list[str] = Field(default_factory=list, description="Image URLs found on the page")


EXTRACTION_PROMPT = """You are a Nigerian property data extraction specialist.

Extract structured property listing data from the following page content.
This is a Nigerian real estate listing. Pay attention to:
- Prices in Naira (₦, NGN, N) with million/M/k suffixes
- Nigerian locations (Lagos, Abuja, etc.) with areas (Lekki, Ikeja, etc.)
- Nigerian property types (flat, duplex, bungalow, self-contain, BQ, etc.)
- Listing type: FOR_SALE (buy), FOR_RENT (rent/let/lease), SHORTLET, or LAND

Return ONLY valid JSON matching this schema:
{schema}

Page content:
---
{content}
---

Extract all available fields. Use null for fields not found. For features, list all amenities/features mentioned."""

SELECTOR_DISCOVERY_PROMPT = """You are a web scraping expert. Given this HTML snippet and the extracted property data,
identify the CSS selectors that would match each field.

Return ONLY valid JSON mapping field names to CSS selectors. Use pipe-separated fallbacks.
Example: {{"title": "h1.listing-title | h1 | .property-name", "price": ".price | .amount"}}

Extracted data:
{data}

HTML snippet (first 5000 chars):
{html}

Return CSS selectors for: title, price, location, description, bedrooms, bathrooms, images, agent_name, agent_phone, features"""


def _call_gemini(prompt: str) -> Optional[str]:
    """Call Gemini Flash API and return the response text."""
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — LLM extraction unavailable")
        return None

    try:
        from google import genai

        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return response.text
    except Exception as e:
        logger.warning(f"Gemini API error: {e}")
        return None


def extract_property_from_markdown(
    markdown: str, url: str
) -> Optional[dict[str, Any]]:
    """Extract structured property data from Markdown using Gemini Flash.

    Args:
        markdown: Clean Markdown content (from Crawl4AI)
        url: Source URL

    Returns:
        Dict of extracted property data, or None on failure
    """
    # Truncate to ~8000 chars to stay within token limits
    content = markdown[:8000]

    schema_json = json.dumps(PropertySchema.model_json_schema(), indent=2)
    prompt = EXTRACTION_PROMPT.format(schema=schema_json, content=content)

    response = _call_gemini(prompt)
    if not response:
        return None

    try:
        # Clean response — Gemini sometimes wraps in ```json blocks
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)

        # Map to our expected field names
        result: dict[str, Any] = {"listingUrl": url, "_source": "llm-gemini"}
        field_mapping = {
            "title": "title",
            "price_text": "price_text",
            "location_text": "location_text",
            "description": "description",
            "bedrooms": "bedrooms",
            "bathrooms": "bathrooms",
            "toilets": "toilets",
            "area_size_text": "area_size_text",
            "property_type": "propertyType",
            "listing_type": "listingType",
            "agent_name": "agentName",
            "agent_phone": "agentPhone",
            "features": "features",
            "images": "images",
        }

        for src_key, dst_key in field_mapping.items():
            value = data.get(src_key)
            if value is not None:
                result[dst_key] = value

        if result.get("title") or result.get("price_text"):
            return result
        return None

    except (json.JSONDecodeError, KeyError) as e:
        logger.warning(f"Failed to parse Gemini response: {e}")
        return None


def extract_with_llm(
    page_text: str, existing_data: dict[str, Any]
) -> dict[str, Any]:
    """Fill in missing fields using Gemini Flash.

    This is the fallback called from app.py when CSS extraction
    returns incomplete data (missing price, bedrooms, or location).

    Args:
        page_text: Plain text extracted from the page
        existing_data: Partially extracted data from CSS selectors

    Returns:
        Merged data with LLM-filled gaps
    """
    content = page_text[:6000]
    schema_json = json.dumps(PropertySchema.model_json_schema(), indent=2)
    prompt = EXTRACTION_PROMPT.format(schema=schema_json, content=content)

    response = _call_gemini(prompt)
    if not response:
        return existing_data

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        llm_data = json.loads(cleaned)

        # Merge: only fill in missing fields from existing data
        for key, value in llm_data.items():
            mapped_key = {
                "price_text": "price_text",
                "location_text": "location_text",
                "bedrooms": "bedrooms",
                "bathrooms": "bathrooms",
                "agent_name": "agentName",
                "agent_phone": "agentPhone",
            }.get(key, key)

            if value is not None and not existing_data.get(mapped_key):
                existing_data[mapped_key] = value

        return existing_data

    except (json.JSONDecodeError, KeyError):
        return existing_data


NORMALIZATION_PROMPT = """You are a Nigerian property data normalization specialist.

I have partially extracted property data, but some fields are still raw text or missing.
Normalize the following fields into clean structured values.

Rules:
- Prices: Convert to numeric Naira value. Examples:
  "₦5 Million" → 5000000, "₦5,000,000" → 5000000, "5m" → 5000000,
  "₦500k" → 500000, "₦2.5 Billion" → 2500000000, "N50,000/month" → 50000
- Bedrooms/Bathrooms/Toilets: Extract the integer. Examples:
  "3 Bed" → 3, "3 Bedrooms" → 3, "Three bedrooms" → 3, "3 Baths" → 3,
  "Studio" → 0, "Self Contain" → 1
- Area: Convert to square meters (float). Examples:
  "200 sqm" → 200.0, "200 square meters" → 200.0, "0.5 hectares" → 5000.0,
  "1 acre" → 4046.86, "500m²" → 500.0, "2 plots" → 1200.0
- Location: Extract area, lga (local government area), and state separately.
  Example: "Lekki Phase 1, Lagos" → area: "Lekki Phase 1", state: "Lagos"
- Property type: Normalize to one of: Flat, Duplex, Semi-Detached Duplex,
  Detached Duplex, Terraced Duplex, Bungalow, Penthouse, Maisonette, Mini Flat,
  Self Contain, Studio, Mansion, Land, Commercial, Warehouse, Office, Shop

Here is the raw data (fields with value null or already numeric are already clean — skip them):
{raw_data}

Return ONLY valid JSON with these fields (use null for fields you cannot determine):
{{
  "price": <number or null>,
  "bedrooms": <int or null>,
  "bathrooms": <int or null>,
  "toilets": <int or null>,
  "area_sqm": <float or null>,
  "area": <string or null>,
  "lga": <string or null>,
  "state": <string or null>,
  "propertyType": <string or null>
}}"""


def _needs_llm_normalization(data: dict[str, Any]) -> dict[str, Any]:
    """Identify fields that still look like raw text and need LLM normalization.

    Returns a dict of field_name -> raw_value for fields that need LLM help.
    Only includes fields where regex parsers likely failed.
    """
    fields_needing_help: dict[str, Any] = {}

    # Price: missing or still text after parse_price
    if not data.get("price") and data.get("price_text"):
        fields_needing_help["price_text"] = data["price_text"]

    # Bedrooms: missing or still a string
    bedrooms = data.get("bedrooms")
    if bedrooms is None and data.get("title"):
        # Check if title/description might contain bedroom info
        fields_needing_help["title"] = data.get("title", "")
        fields_needing_help["description_snippet"] = (data.get("description") or "")[:500]
    elif isinstance(bedrooms, str):
        fields_needing_help["bedrooms_raw"] = bedrooms

    # Bathrooms: still a string
    bathrooms = data.get("bathrooms")
    if isinstance(bathrooms, str):
        fields_needing_help["bathrooms_raw"] = bathrooms
    elif bathrooms is None and data.get("description"):
        fields_needing_help["description_snippet"] = (data.get("description") or "")[:500]

    # Toilets: still a string
    toilets = data.get("toilets")
    if isinstance(toilets, str):
        fields_needing_help["toilets_raw"] = toilets

    # Area size: present as text but not parsed
    if not data.get("landSizeSqm") and not data.get("buildingSizeSqm"):
        area_text = data.get("area_size_text")
        if area_text:
            fields_needing_help["area_size_text"] = area_text

    # Location: state or area still missing after parse_location
    if not data.get("state") or not data.get("area"):
        loc_text = data.get("locationText") or data.get("location_text")
        if loc_text:
            fields_needing_help["location_text"] = loc_text

    # Property type: missing
    if not data.get("propertyType"):
        if data.get("title"):
            fields_needing_help["title"] = data.get("title", "")

    return fields_needing_help


def normalize_with_llm(raw_data: dict[str, Any]) -> dict[str, Any]:
    """Use Gemini Flash to normalize messy property fields that regex parsers missed.

    Only calls the LLM when key fields are still raw text or missing.
    Merges normalized values back into the data dict.

    Args:
        raw_data: Property data after regex-based price/location parsing.

    Returns:
        Enriched data dict with normalized numeric and structured fields.
    """
    fields_to_normalize = _needs_llm_normalization(raw_data)

    if not fields_to_normalize:
        logger.debug("All fields already normalized — skipping LLM normalization")
        return raw_data

    logger.info(f"LLM normalization needed for {len(fields_to_normalize)} field(s): {list(fields_to_normalize.keys())}")

    raw_json = json.dumps(fields_to_normalize, indent=2, default=str)
    prompt = NORMALIZATION_PROMPT.format(raw_data=raw_json)

    response = _call_gemini(prompt)
    if not response:
        return raw_data

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        llm_result = json.loads(cleaned)

        # Merge LLM-normalized values into raw_data (only fill gaps)
        if llm_result.get("price") and not raw_data.get("price"):
            price_val = llm_result["price"]
            if isinstance(price_val, (int, float)) and price_val > 0:
                raw_data["price"] = float(price_val)
                logger.info(f"LLM normalized price: {raw_data.get('price_text')} -> {price_val}")

        if llm_result.get("bedrooms") is not None and not isinstance(raw_data.get("bedrooms"), int):
            raw_data["bedrooms"] = int(llm_result["bedrooms"])

        if llm_result.get("bathrooms") is not None and not isinstance(raw_data.get("bathrooms"), int):
            raw_data["bathrooms"] = int(llm_result["bathrooms"])

        if llm_result.get("toilets") is not None and not isinstance(raw_data.get("toilets"), int):
            raw_data["toilets"] = int(llm_result["toilets"])

        if llm_result.get("area_sqm") and not raw_data.get("landSizeSqm") and not raw_data.get("buildingSizeSqm"):
            area_val = float(llm_result["area_sqm"])
            if area_val > 0:
                # Use landSizeSqm for land, buildingSizeSqm for buildings
                prop_type = (raw_data.get("propertyType") or "").lower()
                if any(kw in prop_type for kw in ("land", "plot", "acre")):
                    raw_data["landSizeSqm"] = area_val
                else:
                    raw_data["buildingSizeSqm"] = area_val
                logger.info(f"LLM normalized area: {raw_data.get('area_size_text')} -> {area_val} sqm")

        if llm_result.get("area") and not raw_data.get("area"):
            raw_data["area"] = llm_result["area"]

        if llm_result.get("lga") and not raw_data.get("lga"):
            raw_data["lga"] = llm_result["lga"]

        if llm_result.get("state") and not raw_data.get("state"):
            raw_data["state"] = llm_result["state"]

        if llm_result.get("propertyType") and not raw_data.get("propertyType"):
            raw_data["propertyType"] = llm_result["propertyType"]

        raw_data["_llm_normalized"] = True
        return raw_data

    except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
        logger.warning(f"Failed to parse LLM normalization response: {e}")
        return raw_data


def discover_selectors(
    html: str, extracted_data: dict[str, Any]
) -> Optional[dict[str, str]]:
    """Ask Gemini to discover CSS selectors that match extracted data.

    This enables the self-healing loop: when LLM extraction succeeds but
    CSS selectors failed, we discover new selectors and cache them so
    future scrapes use fast Layer 2 instead of expensive Layer 3.

    Args:
        html: Raw HTML of the page
        extracted_data: Successfully extracted data (from LLM)

    Returns:
        Dict mapping field names to CSS selectors, or None
    """
    html_snippet = html[:5000]
    data_json = json.dumps(
        {k: v for k, v in extracted_data.items() if k not in ("_source", "listingUrl", "images")},
        indent=2,
        default=str,
    )

    prompt = SELECTOR_DISCOVERY_PROMPT.format(data=data_json, html=html_snippet)
    response = _call_gemini(prompt)
    if not response:
        return None

    try:
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        selectors = json.loads(cleaned)
        if isinstance(selectors, dict) and len(selectors) >= 2:
            logger.info(f"Discovered {len(selectors)} CSS selectors via LLM")
            return selectors
        return None

    except (json.JSONDecodeError, KeyError):
        return None
