"""LLM-powered property extractor — zero CSS selectors needed.

Converts HTML → Markdown → sends to LLM with a Pydantic schema → returns
structured property data. Works on ANY real estate website dynamically.
"""

import re
from typing import Any
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

from engine.llm_providers import llm_extract_json
from utils.logger import get_logger

logger = get_logger(__name__)


# ──────────────────────────────────────────────────────
# Pydantic schema — this is what the LLM extracts
# ──────────────────────────────────────────────────────

class PropertyListing(BaseModel):
    """Schema for a single property listing extracted by the LLM."""
    title: str = ""
    price: str = ""
    bedrooms: int | None = None
    bathrooms: int | None = None
    toilets: int | None = None
    property_type: str = ""
    listing_type: str = ""  # "sale", "rent", "shortlet"
    location: str = ""
    area: str = ""
    state: str = ""
    description: str = ""
    land_size: str = ""
    building_size: str = ""
    furnishing: str = ""
    features: list[str] = Field(default_factory=list)
    images: list[str] = Field(default_factory=list)
    listing_url: str = ""
    agent_name: str = ""
    agent_phone: str = ""
    agency_name: str = ""
    service_charge: str = ""


LISTING_SYSTEM_PROMPT = """You are a real estate data extraction expert. You extract structured property listing data from website content.

RULES:
- Extract ALL property listings visible on the page
- Return a JSON array of objects, one per property
- For each property, extract all available fields — leave empty string "" for missing text fields, null for missing numbers
- Price should include currency symbol as-is (e.g., "₦45,000,000" or "NGN 2,500,000/year")
- Location should be the full address/area as shown (e.g., "Lekki Phase 1, Lagos")
- listing_type: "sale" for buy/sale, "rent" for rent/lease, "shortlet" for short-term
- listing_url: the URL/link for the specific property detail page (relative or absolute)
- images: array of image URLs for the property (from img src attributes)
- features: amenities like "swimming pool", "gym", "24hr power", "security" etc.
- Return ONLY valid JSON array. No explanation, no markdown."""

DETAIL_SYSTEM_PROMPT = """You are a real estate data extraction expert. You extract detailed property information from a single property's detail page.

RULES:
- Extract all available information about this ONE property
- Return a single JSON object (not an array)
- Price should include currency symbol as-is
- Extract description fully (first 500 chars if very long)
- Extract ALL images you can find
- Extract agent/agency contact info if visible
- features: list amenities, facilities, specifications
- Return ONLY valid JSON object. No explanation, no markdown."""


def html_to_clean_text(html: str, base_url: str = "") -> str:
    """Convert HTML to clean text for LLM consumption.

    Strips nav, footer, scripts, ads. Preserves structure with newlines.
    Much cheaper than sending raw HTML (fewer tokens).
    """
    soup = BeautifulSoup(html, "lxml")

    # Remove non-content elements
    for tag in soup.find_all(["script", "style", "noscript", "iframe", "svg",
                              "nav", "footer", "header"]):
        tag.decompose()

    # Remove hidden elements
    for tag in soup.find_all(attrs={"style": re.compile(r"display\s*:\s*none", re.I)}):
        tag.decompose()
    for tag in soup.find_all(class_=re.compile(r"(cookie|popup|modal|overlay|banner|advert)", re.I)):
        tag.decompose()

    # Extract meaningful content
    lines = []

    # Get page title
    title_tag = soup.find("title")
    if title_tag:
        lines.append(f"PAGE TITLE: {title_tag.get_text(strip=True)}")
        lines.append("")

    # Find main content area (prefer <main>, article, or content divs)
    main = (soup.find("main")
            or soup.find("article")
            or soup.find(id=re.compile(r"(content|main|listing|propert)", re.I))
            or soup.find(class_=re.compile(r"(content|main|listing|propert)", re.I))
            or soup.body or soup)

    # Extract links with their text and href (critical for finding listing URLs)
    for a_tag in main.find_all("a", href=True):
        href = a_tag.get("href", "")
        if href and not href.startswith(("#", "javascript:", "mailto:", "tel:", "whatsapp:")):
            full_url = urljoin(base_url, href) if base_url else href
            text = a_tag.get_text(strip=True)
            if text and len(text) > 3:
                # Include images in the link context
                img = a_tag.find("img")
                img_src = ""
                if img and img.get("src"):
                    img_src = f" [IMG: {urljoin(base_url, img['src'])}]"
                lines.append(f"LINK: {text} -> {full_url}{img_src}")

    lines.append("")
    lines.append("--- PAGE CONTENT ---")
    lines.append("")

    # Get visible text with structure
    for element in main.find_all(["h1", "h2", "h3", "h4", "p", "span", "div", "li", "td", "th"]):
        text = element.get_text(separator=" ", strip=True)
        if text and len(text) > 2:
            # Tag headings
            if element.name in ("h1", "h2", "h3", "h4"):
                lines.append(f"\n## {text}")
            else:
                lines.append(text)

    # Extract images
    lines.append("")
    lines.append("--- IMAGES ---")
    for img in main.find_all("img", src=True):
        src = img.get("src", "")
        alt = img.get("alt", "")
        if src and not src.startswith("data:"):
            full_src = urljoin(base_url, src) if base_url else src
            lines.append(f"IMAGE: {alt} -> {full_src}")

    text = "\n".join(lines)

    # Collapse excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Truncate if too long (keep under ~6000 tokens ≈ 24000 chars)
    if len(text) > 24000:
        text = text[:24000] + "\n\n[TRUNCATED — page too long]"

    return text


async def extract_listings_from_page(
    html: str,
    base_url: str,
    site_name: str = "",
) -> list[dict[str, Any]]:
    """Extract property listings from a listing/search page using LLM.

    This is the core innovation — no CSS selectors needed. The LLM reads
    the page content and extracts structured data for every property card.

    Returns list of property dicts matching PropertyListing schema.
    """
    page_text = html_to_clean_text(html, base_url)

    if len(page_text.strip()) < 100:
        logger.warning(f"[LLM Extractor] Page too short ({len(page_text)} chars), skipping")
        return []

    prompt = f"""Extract all property listings from this {site_name} real estate page.

{page_text}

Return a JSON array of property objects. Each object should have these fields:
title, price, bedrooms, bathrooms, toilets, property_type, listing_type, location, area, state, description, land_size, building_size, furnishing, features, images, listing_url, agent_name, agent_phone, agency_name, service_charge

IMPORTANT:
- listing_url must be the FULL URL to each property's detail page (resolve relative URLs using base: {base_url})
- Extract EVERY property listing visible on the page
- If a field is not available, use "" for strings, null for numbers, [] for arrays"""

    result = await llm_extract_json(
        prompt=prompt,
        system_prompt=LISTING_SYSTEM_PROMPT,
        temperature=0.1,
        max_tokens=4096,
    )

    if not result:
        logger.warning(f"[LLM Extractor] No response from LLM for {site_name}")
        return []

    # Normalize result to list
    if isinstance(result, dict):
        # LLM returned a single object or wrapped result
        if "properties" in result:
            result = result["properties"]
        elif "listings" in result:
            result = result["listings"]
        else:
            result = [result]

    if not isinstance(result, list):
        logger.warning(f"[LLM Extractor] Unexpected result type: {type(result)}")
        return []

    # Resolve relative URLs and validate
    listings = []
    for item in result:
        if not isinstance(item, dict):
            continue

        # Resolve listing URL
        url = item.get("listing_url", "")
        if url and not url.startswith("http"):
            url = urljoin(base_url, url)
        item["listing_url"] = url

        # Resolve image URLs
        images = item.get("images", [])
        if isinstance(images, list):
            item["images"] = [
                urljoin(base_url, img) if not img.startswith("http") else img
                for img in images if isinstance(img, str) and img
            ]

        # Skip items with no useful data
        if not any([
            item.get("title"),
            item.get("price"),
            item.get("listing_url"),
            item.get("location"),
        ]):
            continue

        listings.append(item)

    logger.info(f"[LLM Extractor] Extracted {len(listings)} listings from {site_name}")
    return listings


async def extract_detail_from_page(
    html: str,
    page_url: str,
    site_name: str = "",
) -> dict[str, Any] | None:
    """Extract detailed property data from a single detail page using LLM.

    Used for enrichment — fetches bedrooms, description, images, agent info
    that may not be visible on the listing card.
    """
    page_text = html_to_clean_text(html, page_url)

    if len(page_text.strip()) < 50:
        return None

    prompt = f"""Extract all property details from this {site_name} property detail page.

{page_text}

Return a single JSON object with these fields:
title, price, bedrooms, bathrooms, toilets, property_type, listing_type, location, area, state, description, land_size, building_size, furnishing, features, images, listing_url, agent_name, agent_phone, agency_name, service_charge

IMPORTANT:
- This is a SINGLE property detail page at: {page_url}
- Extract the most complete data possible
- Resolve image URLs using base: {page_url}
- If a field is not available, use "" for strings, null for numbers, [] for arrays"""

    result = await llm_extract_json(
        prompt=prompt,
        system_prompt=DETAIL_SYSTEM_PROMPT,
        temperature=0.1,
        max_tokens=4096,
    )

    if not result:
        return None

    if isinstance(result, list) and len(result) > 0:
        result = result[0]

    if not isinstance(result, dict):
        return None

    # Resolve URLs
    result["listing_url"] = page_url

    images = result.get("images", [])
    if isinstance(images, list):
        result["images"] = [
            urljoin(page_url, img) if not img.startswith("http") else img
            for img in images if isinstance(img, str) and img
        ]

    return result


def merge_listing_detail(listing: dict, detail: dict | None) -> dict:
    """Merge detail page data into listing data. Detail takes precedence for richer fields."""
    if not detail:
        return listing

    merged = {**listing}
    for key, value in detail.items():
        if not value:
            continue
        existing = merged.get(key)
        # Detail overrides listing if it has more data
        if not existing:
            merged[key] = value
        elif isinstance(value, str) and isinstance(existing, str) and len(value) > len(existing):
            merged[key] = value
        elif isinstance(value, list) and isinstance(existing, list) and len(value) > len(existing):
            merged[key] = value
        elif isinstance(value, int) and existing is None:
            merged[key] = value

    return merged
