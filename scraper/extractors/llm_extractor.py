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

NAVIGATOR_SYSTEM_PROMPT = """You are a web navigation expert for real estate websites. Your job is to look at a website's links and identify which URLs lead to property LISTING pages (pages showing multiple properties for sale or rent).

RULES:
- Return a JSON array of objects: [{"url": "...", "reason": "..."}, ...]
- Pick the BEST 3-5 URLs that are most likely to show property listings
- Prefer URLs with words like: properties, for-sale, for-rent, listings, houses, apartments, flats, buy, rent
- Prefer URLs that seem to be browse/search/catalog pages (NOT individual property pages, NOT blog posts, NOT about pages)
- If the site is Nigerian real estate, look for Lagos-specific listing pages
- Return ONLY valid JSON array. No explanation."""


def _clean_soup(html: str) -> BeautifulSoup:
    """Parse HTML and remove non-content elements."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.find_all(["script", "style", "noscript", "iframe", "svg"]):
        tag.decompose()
    for tag in soup.find_all(attrs={"style": re.compile(r"display\s*:\s*none", re.I)}):
        tag.decompose()
    for tag in soup.find_all(class_=re.compile(r"(cookie|popup|modal|overlay|banner|advert)", re.I)):
        tag.decompose()
    return soup


def html_to_links_text(html: str, base_url: str = "") -> str:
    """Extract ALL links from a page for the LLM navigator.

    Lighter than full text extraction — just links with context.
    Used when the LLM needs to decide WHERE to go.
    """
    soup = _clean_soup(html)
    lines = []

    title_tag = soup.find("title")
    if title_tag:
        lines.append(f"SITE: {title_tag.get_text(strip=True)}")
        lines.append(f"URL: {base_url}")
        lines.append("")

    # Extract ALL links from the entire page (not just main content)
    body = soup.body or soup
    seen_urls = set()
    for a_tag in body.find_all("a", href=True):
        href = a_tag.get("href", "").strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        full_url = urljoin(base_url, href)
        # Skip external links
        if urlparse(full_url).netloc != urlparse(base_url).netloc:
            continue
        # Skip duplicates
        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        text = a_tag.get_text(strip=True)
        if text and len(text) > 2:
            lines.append(f"LINK: {text} -> {full_url}")
        elif href != "/":
            lines.append(f"LINK: [no text] -> {full_url}")

    # Truncate
    text = "\n".join(lines)
    if len(text) > 12000:
        text = text[:12000] + "\n[TRUNCATED]"
    return text


def html_to_clean_text(html: str, base_url: str = "") -> str:
    """Convert HTML to clean text for LLM property extraction.

    Strips nav, footer, scripts, ads. Preserves structure with newlines.
    Much cheaper than sending raw HTML (fewer tokens).
    """
    soup = _clean_soup(html)

    # Also remove nav/footer/header for extraction (but NOT for navigation)
    for tag in soup.find_all(["nav", "footer", "header"]):
        tag.decompose()

    lines = []

    title_tag = soup.find("title")
    if title_tag:
        lines.append(f"PAGE TITLE: {title_tag.get_text(strip=True)}")
        lines.append("")

    # Use body as the content root — don't try to guess "main" content
    # as many sites don't use semantic HTML properly
    body = soup.body or soup

    # Extract links with their text and href (critical for finding listing URLs)
    for a_tag in body.find_all("a", href=True):
        href = a_tag.get("href", "")
        if href and not href.startswith(("#", "javascript:", "mailto:", "tel:", "whatsapp:")):
            full_url = urljoin(base_url, href) if base_url else href
            text = a_tag.get_text(strip=True)
            if text and len(text) > 3:
                img = a_tag.find("img")
                img_src = ""
                if img and img.get("src"):
                    img_src = f" [IMG: {urljoin(base_url, img['src'])}]"
                lines.append(f"LINK: {text} -> {full_url}{img_src}")

    lines.append("")
    lines.append("--- PAGE CONTENT ---")
    lines.append("")

    # Get visible text — use body, not a guessed "main" section
    seen_texts = set()
    for element in body.find_all(["h1", "h2", "h3", "h4", "p", "span", "div", "li", "td", "th"]):
        # Only get direct text, not nested child text (avoids massive duplication)
        text = element.get_text(separator=" ", strip=True)
        if not text or len(text) < 3:
            continue
        # Deduplicate (common with nested divs)
        text_key = text[:100]
        if text_key in seen_texts:
            continue
        seen_texts.add(text_key)

        if element.name in ("h1", "h2", "h3", "h4"):
            lines.append(f"\n## {text}")
        else:
            lines.append(text)

    # Extract images
    lines.append("")
    lines.append("--- IMAGES ---")
    for img in body.find_all("img", src=True):
        src = img.get("src", "")
        alt = img.get("alt", "")
        if src and not src.startswith("data:"):
            full_src = urljoin(base_url, src) if base_url else src
            lines.append(f"IMAGE: {alt} -> {full_src}")

    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Truncate if too long (keep under ~6000 tokens ≈ 24000 chars)
    if len(text) > 24000:
        text = text[:24000] + "\n\n[TRUNCATED — page too long]"

    return text


async def llm_navigate(html: str, base_url: str, site_name: str = "") -> list[str]:
    """Ask the LLM to identify the best listing page URLs from a homepage.

    The LLM reads all links on the page and picks the ones most likely
    to lead to property listing pages. This is smarter than keyword matching.
    """
    links_text = html_to_links_text(html, base_url)

    if len(links_text.strip()) < 50:
        logger.warning(f"[LLM Navigator] Too few links on {site_name} homepage")
        return []

    prompt = f"""Look at this {site_name} real estate website and identify the URLs that lead to property LISTING pages (pages showing multiple properties for sale or rent).

{links_text}

Return the 3-5 best URLs as a JSON array of objects: [{{"url": "full_url", "reason": "why this is a listing page"}}]
Only include URLs that likely show MULTIPLE property listings. Do NOT include individual property pages, blog posts, about pages, or contact pages."""

    result = await llm_extract_json(
        prompt=prompt,
        system_prompt=NAVIGATOR_SYSTEM_PROMPT,
        temperature=0.1,
        max_tokens=1024,
    )

    if not result:
        return []

    if isinstance(result, dict):
        result = [result]

    urls = []
    for item in result:
        if isinstance(item, dict) and item.get("url"):
            url = item["url"]
            if not url.startswith("http"):
                url = urljoin(base_url, url)
            urls.append(url)
            reason = item.get("reason", "")
            logger.info(f"[LLM Navigator] {site_name}: {url} — {reason}")

    return urls


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

    logger.info(f"[LLM Extractor] Sending {len(page_text)} chars to LLM for {site_name}")

    result = await llm_extract_json(
        prompt=prompt,
        system_prompt=LISTING_SYSTEM_PROMPT,
        temperature=0.1,
        max_tokens=4096,
    )

    if result is None:
        logger.warning(f"[LLM Extractor] No response from LLM for {site_name}")
        return []

    if isinstance(result, list) and len(result) == 0:
        logger.info(f"[LLM Extractor] LLM found no listings on this page for {site_name}")
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
