"""Relevance scorer — multi-signal scoring to identify property listing elements.

Ported from scraper v2.0. When the configured CSS listing selector fails or
returns noisy results, the relevance scorer analyzes individual HTML elements
to determine how likely they are to be actual property listing cards.

Signals scored:
- Has price text (Nigerian Naira patterns)
- Has location/address text
- Has an image (property photo)
- Has a detail link (href to a property page)
- Has bedroom/bathroom counts
- Has property-related class names
- Has reasonable text length (not too short, not too long)

Each signal contributes points; elements above a threshold are considered
property listing candidates.
"""

import re
from typing import Any

from bs4 import BeautifulSoup, Tag

from utils.logger import get_logger

logger = get_logger(__name__)

# --- Scoring weights ---

WEIGHT_HAS_PRICE = 25
WEIGHT_HAS_LOCATION = 15
WEIGHT_HAS_IMAGE = 15
WEIGHT_HAS_LINK = 10
WEIGHT_HAS_BEDROOMS = 10
WEIGHT_HAS_PROPERTY_CLASS = 10
WEIGHT_REASONABLE_TEXT = 10
WEIGHT_HAS_AGENT = 5

# Minimum score to consider an element a property listing candidate
DEFAULT_THRESHOLD = 40

# --- Detection patterns ---

_PRICE_PATTERN = re.compile(
    r"(?:₦|NGN|N)\s*[\d,]+(?:\.\d{2})?"
    r"|[\d,]+\s*(?:million|m|billion|b)\b"
    r"|(?:price|amount)\s*[:]\s*[\d,]+"
    r"|[\d]{1,3}(?:,\d{3})+",
    re.IGNORECASE,
)

_LOCATION_PATTERN = re.compile(
    r"(?:lekki|ikoyi|victoria\s*island|vi\b|ajah|surulere|yaba|ikeja"
    r"|magodo|gbagada|maryland|ogba|festac|isolo|apapa|oshodi"
    r"|ikotun|alimosho|agege|mushin|abeokuta|ibadan|abuja"
    r"|port\s*harcourt|calabar|enugu|kaduna|kano|benin|warri"
    r"|asaba|owerri|uyo|maitama|wuse|garki|gwarinpa|jabi"
    r"|lagos|nigeria)",
    re.IGNORECASE,
)

_BEDROOM_PATTERN = re.compile(
    r"\b(\d+)\s*(?:bed(?:room)?s?|br|bdr)\b"
    r"|\bbed(?:room)?s?\s*[:]\s*(\d+)",
    re.IGNORECASE,
)

_BATHROOM_PATTERN = re.compile(
    r"\b(\d+)\s*(?:bath(?:room)?s?|ba)\b"
    r"|\bbath(?:room)?s?\s*[:]\s*(\d+)",
    re.IGNORECASE,
)

_PROPERTY_CLASS_KEYWORDS = frozenset({
    "property", "listing", "card", "result", "item",
    "house", "apartment", "flat", "estate", "real-estate",
    "realestate", "product", "offer",
})

_AGENT_PATTERN = re.compile(
    r"(?:agent|realtor|contact|posted\s+by|listed\s+by|advertiser)",
    re.IGNORECASE,
)

# Reasonable text length range for a listing card
_MIN_TEXT_LENGTH = 20
_MAX_TEXT_LENGTH = 2000


# --- Standalone convenience function ---


def score_element(element_data: dict) -> float:
    """Score a property listing element on multiple signals, returning 0.0-1.0.

    This is a standalone function that scores a dict of pre-extracted element
    data (not a BeautifulSoup Tag). Useful for scoring data that has already
    been partially extracted by other pipeline stages.

    Signals scored (each contributes to the total):
        - has_price: Price text present (e.g. NGN, Naira amounts)
        - has_location: Nigerian location/area name detected
        - has_bedrooms: Bedroom or bathroom count present
        - has_bathrooms: Bathroom count present
        - has_images: At least one property image URL
        - has_title: Non-empty title string
        - word_count_ok: Description word count in reasonable range (10-500)

    Args:
        element_data: Dict with optional keys: "price", "price_text",
            "location", "location_text", "bedrooms", "bathrooms",
            "images", "title", "description", "text".

    Returns:
        Float between 0.0 and 1.0 representing listing confidence.
    """
    score = 0.0
    max_score = 7.0  # 7 signals, each worth 1 point

    # Signal 1: Has price
    price = element_data.get("price") or element_data.get("price_text", "")
    if price and (isinstance(price, (int, float)) or _PRICE_PATTERN.search(str(price))):
        score += 1.0

    # Signal 2: Has location
    location = element_data.get("location") or element_data.get("location_text", "")
    if location and _LOCATION_PATTERN.search(str(location)):
        score += 1.0

    # Signal 3: Has bedrooms
    bedrooms = element_data.get("bedrooms")
    if bedrooms and (isinstance(bedrooms, int) or _BEDROOM_PATTERN.search(str(bedrooms))):
        score += 1.0

    # Signal 4: Has bathrooms
    bathrooms = element_data.get("bathrooms")
    if bathrooms and (isinstance(bathrooms, int) or _BATHROOM_PATTERN.search(str(bathrooms))):
        score += 1.0

    # Signal 5: Has images
    images = element_data.get("images", [])
    if images and len(images) > 0:
        score += 1.0

    # Signal 6: Has title
    title = element_data.get("title", "")
    if title and len(str(title).strip()) > 3:
        score += 1.0

    # Signal 7: Word count in reasonable range
    text = element_data.get("description") or element_data.get("text", "")
    if text:
        word_count = len(str(text).split())
        if 10 <= word_count <= 500:
            score += 1.0

    return round(score / max_score, 2)


class RelevanceScorer:
    """Scores HTML elements to determine if they represent property listings.

    Usage:
        scorer = RelevanceScorer(threshold=40)
        candidates = scorer.find_listing_elements(html, base_url)
        for element, score in candidates:
            # element is a BeautifulSoup Tag with score >= threshold
            ...
    """

    def __init__(self, threshold: int = DEFAULT_THRESHOLD) -> None:
        """
        Args:
            threshold: Minimum relevance score (0-100) for an element to be
                considered a property listing candidate.
        """
        self.threshold = threshold

    def score_element(self, element: Tag) -> dict[str, Any]:
        """Score a single HTML element on multiple property-listing signals.

        Args:
            element: A BeautifulSoup Tag to analyze.

        Returns:
            Dict with individual signal scores and the total score.
        """
        text = element.get_text(separator=" ", strip=True)
        classes = " ".join(element.get("class", [])).lower()

        signals: dict[str, int] = {}

        # Signal 1: Has price
        if _PRICE_PATTERN.search(text):
            signals["has_price"] = WEIGHT_HAS_PRICE
        else:
            signals["has_price"] = 0

        # Signal 2: Has location
        if _LOCATION_PATTERN.search(text):
            signals["has_location"] = WEIGHT_HAS_LOCATION
        else:
            signals["has_location"] = 0

        # Signal 3: Has image
        images = element.find_all("img")
        real_images = [
            img for img in images
            if img.get("src") and not img["src"].endswith((".svg", ".gif", ".ico"))
        ]
        if real_images:
            signals["has_image"] = WEIGHT_HAS_IMAGE
        else:
            # Check for background-image in style
            style = element.get("style", "")
            if "background-image" in style.lower():
                signals["has_image"] = WEIGHT_HAS_IMAGE
            else:
                signals["has_image"] = 0

        # Signal 4: Has detail link
        links = element.find_all("a", href=True)
        has_property_link = any(
            link.get("href") and not link["href"].startswith(("#", "javascript:", "mailto:", "tel:"))
            for link in links
        )
        signals["has_link"] = WEIGHT_HAS_LINK if has_property_link else 0

        # Signal 5: Has bedroom/bathroom info
        has_beds = bool(_BEDROOM_PATTERN.search(text))
        has_baths = bool(_BATHROOM_PATTERN.search(text))
        if has_beds or has_baths:
            signals["has_bedrooms"] = WEIGHT_HAS_BEDROOMS
        else:
            signals["has_bedrooms"] = 0

        # Signal 6: Property-related class names
        has_property_class = any(kw in classes for kw in _PROPERTY_CLASS_KEYWORDS)
        signals["has_property_class"] = WEIGHT_HAS_PROPERTY_CLASS if has_property_class else 0

        # Signal 7: Reasonable text length
        text_len = len(text)
        if _MIN_TEXT_LENGTH <= text_len <= _MAX_TEXT_LENGTH:
            signals["reasonable_text"] = WEIGHT_REASONABLE_TEXT
        else:
            signals["reasonable_text"] = 0

        # Signal 8: Has agent/contact info
        if _AGENT_PATTERN.search(text):
            signals["has_agent"] = WEIGHT_HAS_AGENT
        else:
            signals["has_agent"] = 0

        total = sum(signals.values())

        return {
            "signals": signals,
            "total_score": total,
            "text_length": text_len,
        }

    def find_listing_elements(
        self,
        html: str,
        base_url: str,
        container_selector: str | None = None,
    ) -> list[tuple[Tag, int]]:
        """Find HTML elements that are likely property listing cards.

        Scans the page for repeating container elements (divs, articles, li)
        and scores each one. Returns elements above the threshold, sorted
        by score descending.

        Args:
            html: Raw HTML of a listing/search page.
            base_url: The page URL (for context).
            container_selector: Optional CSS selector to narrow the search
                area (e.g. ".search-results" to only scan within results).

        Returns:
            List of (element, score) tuples sorted by score descending.
        """
        soup = BeautifulSoup(html, "lxml")

        # Narrow to container if provided
        search_root = soup
        if container_selector:
            container = soup.select_one(container_selector)
            if container:
                search_root = container

        # Candidate elements: divs, articles, sections, list items
        # that are likely card/item containers
        candidate_tags = search_root.find_all(
            ["div", "article", "section", "li", "a"],
            recursive=True,
        )

        # Filter: skip very small elements and the root itself
        candidates: list[tuple[Tag, int]] = []
        seen_texts: set[str] = set()  # Avoid scoring nested duplicates

        for el in candidate_tags:
            # Skip elements that are too deeply nested or too shallow
            text = el.get_text(separator=" ", strip=True)
            if len(text) < _MIN_TEXT_LENGTH:
                continue
            if len(text) > _MAX_TEXT_LENGTH:
                continue

            # Avoid scoring parent and child that contain the same text
            text_hash = hash(text[:200])
            if text_hash in seen_texts:
                continue
            seen_texts.add(text_hash)

            result = self.score_element(el)
            if result["total_score"] >= self.threshold:
                candidates.append((el, result["total_score"]))

        # Sort by score descending
        candidates.sort(key=lambda x: x[1], reverse=True)

        logger.debug(
            f"Relevance scorer found {len(candidates)} candidates "
            f"(threshold={self.threshold}) on {base_url}"
        )

        return candidates

    def extract_listing_urls_by_relevance(
        self,
        html: str,
        base_url: str,
        container_selector: str | None = None,
    ) -> list[str]:
        """Extract property listing URLs using relevance scoring.

        This is the main entry point for the pipeline. When CSS selectors
        fail to find listings, this method finds high-relevance elements
        and extracts their detail-page links.

        Args:
            html: Raw HTML of a listing/search page.
            base_url: The page URL.
            container_selector: Optional CSS selector to narrow search.

        Returns:
            List of unique property detail URLs found in high-relevance elements.
        """
        from urllib.parse import urljoin

        candidates = self.find_listing_elements(html, base_url, container_selector)
        urls: list[str] = []

        for element, score in candidates:
            # Extract the primary link from this element
            link = element.find("a", href=True)
            if not link:
                # The element itself might be a link
                if element.name == "a" and element.get("href"):
                    link = element
                else:
                    continue

            href = link.get("href", "")
            if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue

            full_url = urljoin(base_url, href)
            if full_url not in urls:
                urls.append(full_url)

        logger.debug(
            f"Relevance scorer extracted {len(urls)} listing URLs from {base_url}"
        )

        return urls
