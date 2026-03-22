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

NAVIGATOR_SYSTEM_PROMPT = """You are a navigation expert for Nigerian real estate websites. Your job is to find ALL property listing category URLs on a website — covering different transaction types and property types.

Nigerian real estate sites typically organize listings by:
1. Transaction type: For Sale, For Rent, Shortlet (short-term rental)
2. Property type: Houses, Apartments/Flats, Land, Commercial, Duplex
3. Location: Lagos (Lekki, Ikeja, Ikoyi, Ajah, VI), Abuja, Port Harcourt

RULES:
- Return a JSON array: [{"url": "...", "category": "...", "listing_type": "sale|rent|shortlet", "property_type": "general|houses|apartments|land|commercial", "reason": "..."}]
- Find 5-10 URLs covering DIFFERENT categories (don't pick 5 "for sale" URLs)
- Prioritize diversity: include sale listings, rent listings, and shortlet if available
- Prefer URLs with location filters (especially Lagos — the most active market)
- Look for browse/search/catalog pages showing MULTIPLE properties
- Do NOT include: individual property pages, blog posts, about pages, agent profiles, login/register, contact pages
- Do NOT include the homepage itself
- If the site has search/filter pages, prefer those with pre-set filters (e.g. /properties-for-sale-in-lagos)
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

    # If we got very little visible text but the HTML was large,
    # try extracting from JSON-LD or __NEXT_DATA__ embedded data
    visible_text = "\n".join(lines)
    if len(visible_text.strip()) < 500 and len(html) > 10000:
        # Check for JSON-LD structured data
        ld_soup = BeautifulSoup(html, "lxml")
        for script in ld_soup.find_all("script", type="application/ld+json"):
            try:
                import json
                ld = json.loads(script.string or "")
                if isinstance(ld, (dict, list)):
                    ld_text = json.dumps(ld, indent=2)[:8000]
                    lines.append("\n--- STRUCTURED DATA (JSON-LD) ---")
                    lines.append(ld_text)
            except Exception:
                pass

        # Check for __NEXT_DATA__ (Next.js SSR data)
        for script in ld_soup.find_all("script", id="__NEXT_DATA__"):
            try:
                import json
                nd = json.loads(script.string or "")
                props = nd.get("props", {}).get("pageProps", {})
                if props:
                    nd_text = json.dumps(props, indent=2)[:12000]
                    lines.append("\n--- NEXT.JS PAGE DATA ---")
                    lines.append(nd_text)
            except Exception:
                pass

    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Truncate if too long (keep under ~6000 tokens ≈ 24000 chars)
    if len(text) > 24000:
        text = text[:24000] + "\n\n[TRUNCATED — page too long]"

    return text


async def llm_navigate(
    html: str,
    base_url: str,
    site_name: str = "",
    existing_list_paths: list[str] | None = None,
) -> list[dict[str, str]]:
    """Ask the LLM to identify listing category URLs from a homepage.

    Returns list of dicts with: url, category, listing_type, property_type, reason.
    The LLM is category-aware — it tries to find URLs for sale, rent, AND shortlet
    listings rather than picking 5 URLs all pointing to the same listing type.
    """
    links_text = html_to_links_text(html, base_url)

    if len(links_text.strip()) < 50:
        logger.warning(f"[LLM Navigator] Too few links on {site_name} homepage")
        return []

    existing_note = ""
    if existing_list_paths:
        paths_str = ", ".join(existing_list_paths[:10])
        existing_note = f"\n\nNOTE: These paths are already known: {paths_str}\nFind ADDITIONAL listing pages the site offers beyond these."

    prompt = f"""Look at this {site_name} Nigerian real estate website and identify URLs that lead to property LISTING pages (pages showing multiple properties).

{links_text}{existing_note}

Return 5-10 URLs as a JSON array covering DIFFERENT listing categories (sale, rent, shortlet, different property types).
Each object: {{"url": "full_url", "category": "descriptive name", "listing_type": "sale|rent|shortlet", "property_type": "general|houses|apartments|land|commercial", "reason": "why"}}"""

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

    nav_results = []
    seen_urls = set()
    base_domain = urlparse(base_url).netloc

    for item in result:
        if not isinstance(item, dict) or not item.get("url"):
            continue

        url = item["url"]
        if not url.startswith("http"):
            url = urljoin(base_url, url)

        # Skip external URLs
        if urlparse(url).netloc != base_domain:
            continue

        # Deduplicate
        normalized = url.rstrip("/").lower()
        if normalized in seen_urls:
            continue
        seen_urls.add(normalized)

        nav_results.append({
            "url": url,
            "category": item.get("category", ""),
            "listing_type": item.get("listing_type", "sale"),
            "property_type": item.get("property_type", "general"),
            "reason": item.get("reason", ""),
        })

        logger.info(
            f"[LLM Navigator] {site_name}: {url} — "
            f"{item.get('listing_type', '?')}/{item.get('property_type', '?')} — "
            f"{item.get('reason', '')}"
        )

    return nav_results


def prioritize_nav_results(results: list[dict[str, str]], max_urls: int = 8) -> list[str]:
    """Prioritize navigation results to cover diverse listing categories.

    Ensures at least one URL per listing_type (sale, rent, shortlet)
    rather than all URLs pointing to the same type.
    """
    if not results:
        return []

    # Group by listing_type
    by_type: dict[str, list[str]] = {}
    for r in results:
        lt = r.get("listing_type", "sale")
        by_type.setdefault(lt, []).append(r["url"])

    urls: list[str] = []
    seen: set[str] = set()

    # Round-robin: take 1-2 from each type to ensure diversity
    type_order = ["sale", "rent", "shortlet"]
    for lt in type_order:
        for url in by_type.get(lt, [])[:2]:
            if url not in seen and len(urls) < max_urls:
                urls.append(url)
                seen.add(url)

    # Fill remaining slots with any remaining URLs
    for r in results:
        if r["url"] not in seen and len(urls) < max_urls:
            urls.append(r["url"])
            seen.add(r["url"])

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
        max_tokens=8192,
    )

    if result is None:
        logger.error(f"[LLM Extractor] LLM FAILED for {site_name} — all providers down or rate-limited. Check API keys.")
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

        # Resolve listing URL — fallback to base_url if empty/invalid
        url = item.get("listing_url", "")
        if url and not url.startswith("http"):
            url = urljoin(base_url, url)
        # Reject non-http URLs (javascript:, mailto:, etc.)
        if url and not url.startswith("http"):
            url = ""
        # If no listing URL at all, use the page URL as fallback
        if not url:
            url = base_url
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
            logger.debug(f"[LLM Extractor] Dropping item with no useful data: {item}")
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
        max_tokens=8192,
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
