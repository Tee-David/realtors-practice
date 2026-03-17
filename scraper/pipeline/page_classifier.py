"""Page classifier — detect whether a page is a listing, detail, or category/index page.

Ported from scraper v2.0. Category/index pages (e.g. "All States", "Property Types")
are directories of links to *other listing pages*, not actual property listings.
Scraping them wastes time and pollutes results. This classifier analyzes page
content to determine the page type so the pipeline can skip non-listing pages.
"""

import re
from typing import Literal

from bs4 import BeautifulSoup, Tag

from urllib.parse import urlparse

from utils.logger import get_logger

logger = get_logger(__name__)

PageType = Literal["listing", "detail", "category", "unknown"]

# Nigerian real estate portals that use category-like URL paths (e.g. /property/123)
# for actual property listings. These must be excluded from the URL-pattern category
# check to avoid false positives.
_NIGERIAN_PORTAL_DOMAINS = {
    "propertypro.ng",
    "nigeriapropertycentre.com",
    "privateproperty.com.ng",
    "buyletlive.com",
    "realtor.com.ng",
    "estateintel.com",
    "tolet.com.ng",
    "jumia.com.ng",
    "jiji.ng",
}


# --- Signals for category/index pages ---

# Navigation-style link patterns (breadcrumb-like directories)
_CATEGORY_LINK_PATTERNS = re.compile(
    r"(?:all\s+(?:states|cities|areas|types|categories))"
    r"|(?:browse\s+by)"
    r"|(?:property\s+types?)"
    r"|(?:popular\s+(?:locations|areas|searches))"
    r"|(?:explore\s+(?:properties|listings))"
    r"|(?:states?\s+in\s+nigeria)",
    re.IGNORECASE,
)

# URL path patterns that signal category/index pages
_CATEGORY_URL_PATTERNS = re.compile(
    r"/(?:categories|directory|index|sitemap|browse|explore|all-)"
    r"|/(?:states|cities|areas|locations)/?$"
    r"|/property-types/?$",
    re.IGNORECASE,
)

# Minimum ratio of outbound links that look like sub-categories vs property listings
_CATEGORY_LINK_RATIO_THRESHOLD = 0.6

# Minimum number of links to analyze for category detection
_MIN_LINKS_FOR_ANALYSIS = 5

# --- Signals for property listing pages ---

_PRICE_PATTERN = re.compile(
    r"(?:₦|NGN|N)\s*[\d,]+|[\d,]+\s*(?:million|m)\b",
    re.IGNORECASE,
)

_LISTING_CARD_SELECTORS = [
    "[class*='property']",
    "[class*='listing']",
    "[class*='card']",
    "[class*='result']",
    ".property",
    ".listing",
    ".search-result",
]

# --- Signals for detail pages ---

_DETAIL_SELECTORS = [
    "[class*='detail']",
    "[class*='single-property']",
    "[class*='property-detail']",
    "[class*='listing-detail']",
    ".property-description",
    ".listing-description",
    "#property-details",
]


def classify_page(html: str, url: str) -> PageType:
    """Classify a page as listing, detail, category, or unknown.

    Args:
        html: Raw HTML content of the page.
        url: The page URL (used for URL-pattern heuristics).

    Returns:
        PageType indicating what kind of page this is.
    """
    if not html or len(html) < 200:
        return "unknown"

    # Quick URL check first — but skip for known Nigerian portals whose listing
    # URLs overlap with category URL patterns (e.g. /property/123).
    parsed_url = urlparse(url)
    domain = parsed_url.hostname or ""
    # Strip leading "www." for matching
    domain = domain.removeprefix("www.")
    is_known_portal = domain in _NIGERIAN_PORTAL_DOMAINS

    if not is_known_portal and _CATEGORY_URL_PATTERNS.search(url):
        logger.debug(f"Category page detected by URL pattern: {url}")
        return "category"

    soup = BeautifulSoup(html, "lxml")

    # Check for detail page signals first (single-property view)
    if _is_detail_page(soup):
        return "detail"

    # Check for category/index page signals
    if _is_category_page(soup, url):
        logger.debug(f"Category/index page detected: {url}")
        return "category"

    # Check for listing page signals (search results with property cards)
    if _is_listing_page(soup):
        return "listing"

    return "unknown"


def _is_detail_page(soup: BeautifulSoup) -> bool:
    """Detect single-property detail pages."""
    # Strong signals: detail-specific containers
    for selector in _DETAIL_SELECTORS:
        if soup.select_one(selector):
            return True

    # Heuristic: page has exactly one h1 + price + description (not a grid of cards)
    h1_tags = soup.find_all("h1")
    has_single_h1 = len(h1_tags) == 1

    # Look for a prominent description block (long text paragraphs)
    description_blocks = soup.find_all("p")
    long_paragraphs = [p for p in description_blocks if len(p.get_text(strip=True)) > 100]

    # Look for image galleries
    gallery_selectors = [
        "[class*='gallery']",
        "[class*='carousel']",
        "[class*='slider']",
        "[class*='photos']",
    ]
    has_gallery = any(soup.select_one(sel) for sel in gallery_selectors)

    if has_single_h1 and (len(long_paragraphs) >= 2 or has_gallery):
        return True

    return False


def _is_category_page(soup: BeautifulSoup, url: str) -> bool:
    """Detect category/directory/index pages that aren't actual listings."""
    links = soup.find_all("a", href=True)
    if len(links) < _MIN_LINKS_FOR_ANALYSIS:
        return False

    # Signal 1: Page title or headings match category patterns
    title_text = ""
    title_el = soup.find("title")
    if title_el:
        title_text = title_el.get_text(strip=True).lower()
    h1_el = soup.find("h1")
    if h1_el:
        title_text += " " + h1_el.get_text(strip=True).lower()

    category_title_patterns = [
        "browse by", "all states", "all cities", "all areas",
        "property types", "explore properties", "popular locations",
        "categories", "directory",
    ]
    if any(pat in title_text for pat in category_title_patterns):
        return True

    # Signal 2: Many link texts match category patterns
    category_link_count = 0
    for link in links:
        text = link.get_text(strip=True)
        if _CATEGORY_LINK_PATTERNS.search(text):
            category_link_count += 1

    if category_link_count >= 3:
        return True

    # Signal 3: High ratio of links pointing to sub-category paths
    # (links to /properties-in-lagos, /houses-for-sale-in-abuja, etc.)
    # vs links pointing to individual property detail pages (with numeric IDs)
    category_path_count = 0
    detail_path_count = 0

    for link in links:
        href = link.get("href", "")
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue

        path = href.lower()
        # Looks like a detail page (has numeric ID or /property/ slug)
        if re.search(r"/\d{3,}", path) or re.search(r"/property/\w+", path):
            detail_path_count += 1
        # Looks like a category page (location-based or type-based listing)
        elif re.search(r"(?:properties|houses|flats|land)-(?:in|for)-", path):
            category_path_count += 1

    total_classified = category_path_count + detail_path_count
    if total_classified >= _MIN_LINKS_FOR_ANALYSIS:
        ratio = category_path_count / total_classified
        if ratio >= _CATEGORY_LINK_RATIO_THRESHOLD:
            return True

    # Signal 4: No price-like text on the page (category pages rarely show prices)
    page_text = soup.get_text()
    price_matches = _PRICE_PATTERN.findall(page_text)
    if len(price_matches) == 0:
        # Also check: does the page have many links but no card-like structures?
        card_count = 0
        for selector in _LISTING_CARD_SELECTORS:
            card_count += len(soup.select(selector))
        if card_count == 0 and len(links) > 20:
            return True

    return False


def _is_listing_page(soup: BeautifulSoup) -> bool:
    """Detect search results / listing pages with multiple property cards."""
    # Look for multiple listing card elements
    for selector in _LISTING_CARD_SELECTORS:
        elements = soup.select(selector)
        if len(elements) >= 3:
            return True

    # Heuristic: page has multiple price-like text fragments
    page_text = soup.get_text()
    price_matches = _PRICE_PATTERN.findall(page_text)
    if len(price_matches) >= 3:
        return True

    # Heuristic: page has pagination controls
    pagination_selectors = [
        ".pagination",
        "[class*='pagination']",
        "nav[aria-label*='page']",
        ".pager",
        "[class*='pager']",
    ]
    for selector in pagination_selectors:
        if soup.select_one(selector):
            return True

    return False


def is_category_page(html: str, url: str) -> bool:
    """Detect and skip index/directory/category pages that list links to
    properties but aren't actual property listings.

    Looks for signals like: many outbound links, lack of price/bedroom/location
    data, presence of category navigation, and URL patterns matching directory
    pages.

    Args:
        html: Raw HTML content of the page.
        url: The page URL.

    Returns:
        True if the page is a category/index/directory page.
    """
    return classify_page(html, url) == "category"


def should_skip_page(html: str, url: str) -> bool:
    """Convenience function: returns True if the page should be skipped.

    A page should be skipped if it's a category/index page (not an actual
    property listing page or detail page).

    Args:
        html: Raw HTML content.
        url: The page URL.

    Returns:
        True if the page is a category/index page and should be skipped.
    """
    page_type = classify_page(html, url)
    if page_type == "category":
        logger.info(f"Skipping category/index page: {url}")
        return True
    return False
