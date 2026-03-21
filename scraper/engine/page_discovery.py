"""Auto-discover listing pages from a site's homepage.

When a site has no configured listPaths, this module:
1. Fetches the homepage
2. Scores all internal links for property-listing relevance
3. Returns the best candidate listing page URLs

This means we NEVER need manual listPaths — just a base URL.
"""

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from utils.logger import get_logger

logger = get_logger(__name__)

# Keywords that indicate a URL leads to property listings
LISTING_KEYWORDS = [
    "properties", "property", "listings", "listing", "for-sale", "for-rent",
    "buy", "rent", "sale", "let", "shortlet", "real-estate", "realestate",
    "houses", "apartments", "flats", "homes", "estate", "search",
    "all-properties", "browse", "explore", "catalog", "catalogue",
    # Nigerian-specific
    "lagos", "lekki", "ikoyi", "ajah", "ikeja", "vi", "abuja",
]

# Keywords that indicate we should NOT follow this link
SKIP_KEYWORDS = [
    "login", "register", "signup", "sign-up", "signin", "sign-in",
    "about", "contact", "blog", "news", "career", "faq", "help",
    "privacy", "terms", "policy", "cookie", "sitemap",
    "agent", "agents", "developer", "developers",
    "advertise", "pricing", "plan", "subscribe",
    ".pdf", ".doc", ".xlsx", ".csv", ".zip",
    "facebook.com", "twitter.com", "instagram.com", "linkedin.com",
    "youtube.com", "wa.me", "whatsapp",
]

# Common URL patterns for property listing pages
COMMON_LISTING_PATHS = [
    "/properties",
    "/properties/for-sale",
    "/properties/for-rent",
    "/property-for-sale",
    "/property-for-rent",
    "/for-sale",
    "/for-rent",
    "/buy",
    "/rent",
    "/listings",
    "/search",
    "/all-properties",
    "/real-estate",
    "/homes",
    "/houses-for-sale",
    "/houses-for-rent",
    "/flats-apartments",
    # Nigerian property sites often use these
    "/for-sale/flats-apartments/lagos",
    "/for-sale/houses/lagos",
    "/for-rent/flats-apartments/lagos",
    "/for-rent/houses/lagos",
    "/property-for-sale/lagos",
    "/property-for-rent/lagos",
]


def score_link(href: str, text: str, base_domain: str) -> float:
    """Score a link's likelihood of leading to a property listing page.

    Higher score = more likely to be a listing page.
    Returns 0.0 for links that should be skipped.
    """
    href_lower = href.lower()
    text_lower = text.lower().strip()

    # Skip external links
    parsed = urlparse(href)
    if parsed.netloc and parsed.netloc != base_domain:
        return 0.0

    # Skip non-content links
    if any(kw in href_lower for kw in SKIP_KEYWORDS):
        return 0.0

    # Skip anchor-only links
    if href.startswith("#") or href.startswith("javascript:"):
        return 0.0

    score = 0.0

    # Score based on URL path keywords
    for kw in LISTING_KEYWORDS:
        if kw in href_lower:
            score += 10.0
        if kw in text_lower:
            score += 5.0

    # Bonus for paths that look like listing categories
    path = parsed.path.lower().rstrip("/")
    segments = [s for s in path.split("/") if s]

    # 1-3 segment paths are more likely to be listing pages
    # (not too shallow like /, not too deep like /a/b/c/d/e)
    if 1 <= len(segments) <= 3:
        score += 5.0

    # Bonus for property-type words in URL
    property_types = ["flat", "apartment", "house", "duplex", "land",
                      "commercial", "office", "shop", "warehouse"]
    for pt in property_types:
        if pt in href_lower:
            score += 8.0
            break

    # Bonus for sale/rent indicators
    if any(w in href_lower for w in ["sale", "rent", "let", "buy"]):
        score += 10.0

    # Bonus for text that suggests a listing link
    listing_text_patterns = [
        r"view\s+(all\s+)?propert",
        r"browse\s+propert",
        r"search\s+propert",
        r"for\s+sale",
        r"for\s+rent",
        r"see\s+all",
        r"all\s+listing",
        r"\d+\s+propert",  # "250 properties"
    ]
    for pat in listing_text_patterns:
        if re.search(pat, text_lower):
            score += 15.0
            break

    return score


def discover_listing_pages(
    html: str,
    base_url: str,
    max_results: int = 10,
) -> list[str]:
    """Discover listing page URLs from a homepage or portal page.

    Scans all links, scores them by property-listing relevance,
    and returns the top candidates. Also tries common listing path patterns.

    Returns list of full URLs, ordered by relevance score (best first).
    """
    soup = BeautifulSoup(html, "lxml")
    base_domain = urlparse(base_url).netloc
    base = base_url.rstrip("/")

    scored: dict[str, float] = {}

    # Score all links on the page
    for a_tag in soup.find_all("a", href=True):
        href = a_tag.get("href", "").strip()
        text = a_tag.get_text(strip=True)

        if not href:
            continue

        full_url = urljoin(base_url, href).split("#")[0].split("?")[0].rstrip("/")

        # Skip the homepage itself
        if full_url.rstrip("/") == base.rstrip("/"):
            continue

        link_score = score_link(full_url, text, base_domain)
        if link_score > 0:
            # Keep the highest score for each URL
            scored[full_url] = max(scored.get(full_url, 0), link_score)

    # Also probe common listing paths (they might not be linked on homepage)
    for path in COMMON_LISTING_PATHS:
        candidate = base + path
        if candidate not in scored:
            # Give common paths a base score — they'll be validated by the fetcher
            scored[candidate] = 5.0

    # Sort by score descending
    sorted_urls = sorted(scored.items(), key=lambda x: x[1], reverse=True)

    # Return top results
    results = [url for url, score in sorted_urls[:max_results] if score > 0]

    logger.info(f"[Discovery] Found {len(results)} candidate listing pages from {base_url}")
    for url, score in sorted_urls[:5]:
        logger.debug(f"  {score:.0f}pts -> {url}")

    return results


def is_listing_page(html: str) -> bool:
    """Quick check: does this page look like it contains property listings?

    Heuristic: count property-related signals in the HTML.
    Returns True if the page likely has property cards/listings.
    """
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(separator=" ", strip=True).lower()

    signals = 0

    # Price patterns (₦, NGN, naira)
    price_count = len(re.findall(r"₦|ngn|naira|\d{1,3}(,\d{3})+", text))
    if price_count >= 3:
        signals += 3

    # Bedroom/bathroom mentions
    bed_count = len(re.findall(r"\d+\s*(bed|bath|toilet|room)", text))
    if bed_count >= 2:
        signals += 2

    # Property type words
    prop_types = len(re.findall(
        r"bedroom|apartment|flat|duplex|terrace|bungalow|detached|semi-detached|penthouse",
        text
    ))
    if prop_types >= 3:
        signals += 2

    # Card-like elements
    cards = soup.select(
        "div[class*='listing'], div[class*='property'], div[class*='card'], "
        "li[class*='listing'], li[class*='property'], article"
    )
    if len(cards) >= 2:
        signals += 3

    # Multiple links that look like property pages
    links = soup.find_all("a", href=True)
    property_links = 0
    for a in links:
        href = a.get("href", "").lower()
        if any(kw in href for kw in ["property", "listing", "bedroom", "flat", "house"]):
            property_links += 1
    if property_links >= 3:
        signals += 2

    return signals >= 4
