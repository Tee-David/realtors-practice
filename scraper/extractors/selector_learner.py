"""Reverse-engineer CSS selectors from LLM-extracted data + original HTML.

After the LLM successfully extracts property listings from a page, this module
analyzes the HTML to find CSS selectors that match the extracted data. These
selectors are stored per-site and used as a fast fallback when LLM is unavailable.

This is pure Python DOM traversal — no LLM calls, fast, and free.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from bs4 import BeautifulSoup, Tag

from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class LearnedSelectors:
    """Selectors discovered for a site, with confidence tracking."""
    listing_container: str  # CSS selector for the listing card container
    fields: dict[str, str]  # field_name -> CSS selector relative to container
    confidence: float  # 0.0 - 1.0
    sample_count: int  # how many listings were used to learn
    learned_at: str  # ISO timestamp
    page_url: str  # URL where selectors were learned


def _build_css_selector(tag: Tag) -> str:
    """Build a CSS selector for a specific tag.

    Prefers class-based selectors (most stable), falls back to tag + nth-child.
    """
    classes = tag.get("class", [])
    tag_name = tag.name

    if classes:
        # Use the most specific class (longest, most likely unique)
        # Filter out generic utility classes
        meaningful = [c for c in classes if len(c) > 2 and not re.match(r"^(p|m|d|w|h|col|row)-", c)]
        if meaningful:
            return f"{tag_name}.{'.'.join(meaningful[:2])}"
        return f"{tag_name}.{'.'.join(classes[:2])}"

    # Use id if available
    tag_id = tag.get("id", "")
    if tag_id:
        return f"#{tag_id}"

    # Use data attributes
    for attr in tag.attrs:
        if attr.startswith("data-") and tag[attr]:
            return f'{tag_name}[{attr}="{tag[attr]}"]'

    return tag_name


def _find_text_in_soup(soup: BeautifulSoup, text: str) -> list[Tag]:
    """Find all tags containing the exact text (case-insensitive, stripped)."""
    if not text or len(text) < 3:
        return []

    text_lower = text.lower().strip()
    results = []

    for tag in soup.find_all(string=re.compile(re.escape(text_lower[:50]), re.IGNORECASE)):
        parent = tag.parent
        if parent and parent.name not in ("script", "style", "noscript"):
            results.append(parent)

    return results


def _find_common_ancestor(tags: list[Tag], target_count: int) -> tuple[str, list[Tag]] | None:
    """Walk up from matched text elements to find the repeating container.

    The container is an ancestor element that appears approximately `target_count`
    times in the page — suggesting it's the listing card wrapper.
    """
    if not tags:
        return None

    # For each matched tag, walk up and collect ancestor candidates
    ancestor_counts: dict[str, int] = {}  # selector -> count
    ancestor_examples: dict[str, Tag] = {}  # selector -> example tag

    for tag in tags:
        current = tag
        depth = 0
        while current.parent and depth < 8:
            current = current.parent
            if not isinstance(current, Tag) or current.name in ("body", "html", "[document]"):
                break

            selector = _build_css_selector(current)
            # Count how many siblings/cousins match this selector
            try:
                matches = current.parent.select(selector) if current.parent else []
                count = len(matches)
                if count >= 2:
                    # Score by how close count is to target
                    key = selector
                    if key not in ancestor_counts or abs(count - target_count) < abs(ancestor_counts[key] - target_count):
                        ancestor_counts[key] = count
                        ancestor_examples[key] = current
            except Exception:
                pass
            depth += 1

    if not ancestor_counts:
        return None

    # Pick the selector whose count is closest to target_count
    best_selector = min(
        ancestor_counts.keys(),
        key=lambda s: abs(ancestor_counts[s] - target_count),
    )

    best_tag = ancestor_examples[best_selector]
    # Re-select all matching containers from the page root
    try:
        root = best_tag.find_parent("body") or best_tag.find_parent()
        if root:
            containers = root.select(best_selector)
            return best_selector, containers
    except Exception:
        pass

    return None


def _learn_field_selector(
    containers: list[Tag],
    field_name: str,
    field_values: list[str | int | None],
) -> str | None:
    """Find the CSS selector path within containers that matches field values.

    For each container + expected value pair, find the element containing the value
    and determine its CSS path relative to the container.
    """
    if not field_values:
        return None

    # Collect candidate selectors from each container
    selector_votes: dict[str, int] = {}

    for container, value in zip(containers, field_values):
        if not value or (isinstance(value, str) and len(value) < 2):
            continue

        search_text = str(value).strip()[:80]

        # Find elements within this container that contain the value
        for element in container.find_all(string=re.compile(re.escape(search_text[:30]), re.IGNORECASE)):
            parent = element.parent
            if not isinstance(parent, Tag):
                continue

            # Build a selector relative to the container
            selector = _build_css_selector(parent)
            selector_votes[selector] = selector_votes.get(selector, 0) + 1

    if not selector_votes:
        return None

    # Pick the selector with the most votes (most consistently matches across containers)
    best = max(selector_votes.keys(), key=lambda s: selector_votes[s])
    if selector_votes[best] >= max(2, len(containers) // 3):
        return best

    return None


def _validate_selectors(
    soup: BeautifulSoup,
    container_selector: str,
    field_selectors: dict[str, str],
    expected_listings: list[dict[str, Any]],
) -> float:
    """Validate learned selectors by applying them and comparing results.

    Returns confidence score 0.0-1.0.
    """
    try:
        containers = soup.select(container_selector)
    except Exception:
        return 0.0

    if not containers:
        return 0.0

    # Check: did we find a similar number of containers as expected listings?
    count_ratio = min(len(containers), len(expected_listings)) / max(len(containers), len(expected_listings))
    if count_ratio < 0.5:
        return 0.0

    # Check: do field selectors actually find content in the containers?
    fields_matched = 0
    fields_total = len(field_selectors)

    for field_name, selector in field_selectors.items():
        matches_found = 0
        for container in containers[:5]:  # Sample first 5
            try:
                el = container.select_one(selector)
                if el and el.get_text(strip=True):
                    matches_found += 1
            except Exception:
                continue
        if matches_found >= 2:
            fields_matched += 1

    if fields_total == 0:
        return 0.0

    return (count_ratio * 0.4) + (fields_matched / fields_total * 0.6)


def learn_selectors_from_extraction(
    html: str,
    extracted_listings: list[dict[str, Any]],
    base_url: str,
) -> LearnedSelectors | None:
    """Reverse-engineer CSS selectors from LLM extraction results.

    Strategy:
    1. Parse HTML into BeautifulSoup
    2. For each extracted listing, find the title text in the HTML
    3. Walk up the DOM to find the repeating container (listing card)
    4. Within each container, map fields to relative CSS selectors
    5. Validate by applying selectors back, compute confidence score
    """
    if not extracted_listings or len(extracted_listings) < 2:
        return None

    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        return None

    # Remove noise
    for tag in soup.find_all(["script", "style", "noscript"]):
        tag.decompose()

    # Step 1: Find listing containers by matching title text
    title_tags: list[Tag] = []
    for listing in extracted_listings:
        title = listing.get("title", "")
        if not title or len(title) < 3:
            continue
        matches = _find_text_in_soup(soup, title)
        if matches:
            title_tags.append(matches[0])  # Best match

    if len(title_tags) < 2:
        logger.debug("Selector learner: could not find enough title matches in HTML")
        return None

    # Step 2: Find common ancestor container
    result = _find_common_ancestor(title_tags, target_count=len(extracted_listings))
    if not result:
        logger.debug("Selector learner: could not find common container")
        return None

    container_selector, containers = result
    logger.info(f"Selector learner: found container '{container_selector}' ({len(containers)} matches)")

    # Step 3: Learn field selectors within containers
    # Map field names to their values across all listings
    learnable_fields = ["title", "price", "location", "property_type", "listing_type"]
    field_selectors: dict[str, str] = {}

    for field_name in learnable_fields:
        values = [listing.get(field_name) for listing in extracted_listings[:len(containers)]]
        selector = _learn_field_selector(containers, field_name, values)
        if selector:
            field_selectors[field_name] = selector

    if not field_selectors:
        logger.debug("Selector learner: no field selectors could be learned")
        return None

    # Step 4: Validate
    confidence = _validate_selectors(soup, container_selector, field_selectors, extracted_listings)
    logger.info(
        f"Selector learner: learned {len(field_selectors)} field selectors, "
        f"confidence={confidence:.0%}"
    )

    if confidence < 0.3:
        logger.debug("Selector learner: confidence too low, discarding")
        return None

    return LearnedSelectors(
        listing_container=container_selector,
        fields=field_selectors,
        confidence=confidence,
        sample_count=len(extracted_listings),
        learned_at=datetime.now(timezone.utc).isoformat(),
        page_url=base_url,
    )


def extract_with_selectors(
    html: str,
    container_selector: str,
    field_selectors: dict[str, str],
) -> list[dict[str, Any]]:
    """Extract listings using previously learned CSS selectors (fast, no LLM).

    Returns list of property dicts, or empty list if extraction fails.
    """
    try:
        soup = BeautifulSoup(html, "lxml")
        containers = soup.select(container_selector)
    except Exception:
        return []

    if not containers:
        return []

    listings = []
    for container in containers:
        listing: dict[str, Any] = {}
        has_data = False

        for field_name, selector in field_selectors.items():
            try:
                el = container.select_one(selector)
                if el:
                    text = el.get_text(strip=True)
                    if text:
                        listing[field_name] = text
                        has_data = True
            except Exception:
                continue

        # Extract listing URL from anchor tags in container
        if not listing.get("listing_url"):
            a_tag = container.find("a", href=True)
            if a_tag:
                listing["listing_url"] = a_tag["href"]
                has_data = True

        if has_data:
            listings.append(listing)

    return listings
