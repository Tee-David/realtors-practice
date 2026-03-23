"""Universal property data extractor using CSS selectors + JSON-LD.

Extracts property data from HTML using site-specific selector configs
stored in the Site model's `selectors` JSON field.

Supports:
- JSON-LD structured data extraction (most reliable method)
- Multiple fallback selectors per field (pipe-separated: "h1.title | h1 | .name")
- Attribute extraction: selector::attr(href)
- Text extraction: selector::text
- Multi-value fields (images, features): returns arrays
- Auto-detection of listing URLs when selector fails
"""

import json
import re
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Tag

from utils.logger import get_logger

logger = get_logger(__name__)

# Site-specific URL patterns that identify DETAIL pages (not category/index pages).
# These are the most reliable way to find property listings — CSS selectors break
# when sites redesign, but URL structures are stable.
SITE_DETAIL_URL_PATTERNS: dict[str, list[re.Pattern]] = {
    "propertypro.ng": [
        # /property/3-bedroom-flat-for-sale-lekki-5PBCA (slug ending with alphanumeric ID)
        re.compile(r"/property/[\w-]+-\d*[A-Z][A-Z0-9]{2,}$", re.IGNORECASE),
        re.compile(r"/property/[\w-]{20,}$"),  # Long slugs are detail pages
    ],
    "nigeriapropertycentre.com": [
        re.compile(r"/\d{6,}-[\w-]+$"),  # /2207080-luxury-two-bedroom-maisonette
        re.compile(r"/property/\d{4,}"),  # /property/125342
    ],
    "jiji.ng": [
        re.compile(r"/[\w-]+-[\w]{5,}\.html$"),  # /slug-id123.html
        re.compile(r"/item/[\w-]+"),  # /item/slug
    ],
    "property24.com.ng": [
        re.compile(r"/\d{6,}$"),  # /property-for-sale/123456
        re.compile(r"/property-for-(?:sale|rent)/[\w-]+/\d+"),  # /property-for-sale/lagos/123456
    ],
    "buyletlive.com": [
        re.compile(r"/properties/[a-f0-9-]{20,}"),  # UUID-based
        re.compile(r"/properties/[\w-]{20,}$"),  # Long slug detail pages
    ],
    "privateproperty.com.ng": [
        re.compile(r"/[\w-]+-\d{4,}$"),  # /slug-12345
        re.compile(r"/property/[\w-]+-\d+"),  # /property/slug-12345
    ],
}


class UniversalExtractor:
    """Extracts property data from HTML using configurable CSS selectors."""

    def __init__(self, selectors: dict[str, Any]):
        """
        selectors example:
        {
            "title": "h1.property-title | h1 | .listing-title",
            "price": ".price-text | .amount | [class*='price']",
            "description": ".property-description | .description | [class*='desc']",
            "location": ".property-location | .address | [class*='location']",
            "bedrooms": ".bed-count | [class*='bed'] | [data-type='bedrooms']",
            "bathrooms": ".bath-count | [class*='bath'] | [data-type='bathrooms']",
            "area_size": ".area-size | [class*='sqm'] | [class*='area']",
            "images": "img.property-image::attr(src) | .gallery img::attr(src)",
            "agent_name": ".agent-name | [class*='agent'] .name",
            "agent_phone": ".agent-phone | [class*='agent'] .phone | a[href^='tel:']",
            "features": ".feature-item | .amenity | [class*='feature'] li",
            "listing_link": "a.property-link::attr(href)"
        }

        Selectors support pipe-separated fallbacks: "primary | fallback1 | fallback2"
        """
        self.selectors = selectors

    @staticmethod
    def _is_honeypot(el: Tag) -> bool:
        """Detect hidden honeypot links (display:none, visibility:hidden, zero-size)."""
        style = (el.get("style") or "").lower().replace(" ", "")
        classes = " ".join(el.get("class", [])).lower()

        if "display:none" in style or "visibility:hidden" in style:
            return True
        if "opacity:0" in style:
            return True
        if "width:0" in style or "height:0" in style:
            return True

        honeypot_names = ("hidden", "trap", "honeypot", "nofollow", "invisible", "d-none")
        if any(name in classes for name in honeypot_names):
            return True

        # Check parent one level up
        parent = el.parent
        if parent and isinstance(parent, Tag):
            ps = (parent.get("style") or "").lower().replace(" ", "")
            if "display:none" in ps or "visibility:hidden" in ps:
                return True

        return False

    # Generic fallback selectors (from proven old scraper)
    GENERIC_CARD_SELECTORS = [
        "div[class*='listing']", "div[class*='property']", "div[class*='card']",
        "li[class*='listing']", "li[class*='property']", "li[class*='item']",
        "article", "div.item", "div.result", "div.product",
    ]

    def extract_listing_urls(
        self, html: str, base_url: str, listing_selector: str
    ) -> list[str]:
        """Extract listing URLs from a search/listing page.

        Strategy (in priority order):
        1. Site-specific URL pattern matching (most reliable — survives redesigns)
        2. CSS selectors from site config (fast but brittle)
        3. Generic card selectors (broad fallback — works on most sites)
        4. Auto-detection of all property-like links on the page (last resort)
        """
        soup = BeautifulSoup(html, "lxml")

        # Strategy 1: Site-specific URL pattern matching
        domain = urlparse(base_url).netloc.replace("www.", "")
        pattern_urls = self._extract_by_url_patterns(soup, base_url, domain)
        if pattern_urls:
            logger.info(f"URL patterns found {len(pattern_urls)} detail URLs for {domain}")
            return pattern_urls

        # Strategy 2: CSS selectors from site config
        urls: list[str] = []
        selectors = [s.strip() for s in listing_selector.split("|")]
        for selector in selectors:
            if not selector:
                continue
            try:
                elements = soup.select(selector)
            except Exception:
                continue
            if elements:
                for el in elements:
                    if self._is_honeypot(el):
                        continue
                    href = self._get_href(el)
                    if href:
                        full_url = urljoin(base_url, str(href))
                        if full_url not in urls and self._is_detail_url(full_url, base_url):
                            urls.append(full_url)
                if urls:
                    logger.info(f"CSS selector '{selector}' found {len(urls)} detail URLs")
                    return urls

        # Strategy 3: Generic card selectors (works on most property sites)
        for card_sel in self.GENERIC_CARD_SELECTORS:
            try:
                cards = soup.select(card_sel)
            except Exception:
                continue
            if not cards or len(cards) < 2:
                continue  # Need at least 2 cards to be a listing page
            card_urls = []
            for card in cards:
                if self._is_honeypot(card):
                    continue
                href = self._get_href(card)
                if href:
                    full_url = urljoin(base_url, str(href))
                    if full_url not in card_urls and self._is_detail_url(full_url, base_url):
                        card_urls.append(full_url)
            if card_urls:
                logger.info(f"Generic selector '{card_sel}' found {len(card_urls)} detail URLs")
                return card_urls

        # Strategy 4: Auto-detect property links by heuristics (scans ALL links)
        urls = self._auto_detect_listing_urls(soup, base_url)
        return urls

    def _extract_by_url_patterns(
        self, soup: BeautifulSoup, base_url: str, domain: str
    ) -> list[str]:
        """Extract listing URLs by matching against known site URL patterns."""
        patterns = SITE_DETAIL_URL_PATTERNS.get(domain, [])
        if not patterns:
            return []

        urls: list[str] = []
        seen = set()
        base_domain = urlparse(base_url).netloc

        for link in soup.find_all("a", href=True):
            if self._is_honeypot(link):
                continue
            href = str(link["href"])

            # Skip non-http protocols
            if href.startswith(("mailto:", "tel:", "javascript:", "whatsapp:", "data:")):
                continue

            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)

            # Must be same domain
            if parsed.netloc and parsed.netloc.replace("www.", "") != base_domain.replace("www.", ""):
                continue

            path = parsed.path.rstrip("/")
            if path in seen or not path:
                continue

            # Check against site-specific patterns
            for pattern in patterns:
                if pattern.search(path):
                    seen.add(path)
                    urls.append(full_url)
                    break

        return urls[:200]

    def _get_href(self, el: Tag) -> Optional[str]:
        """Extract href from an element or its first child link."""
        if el.name == "a":
            return el.get("href")
        link = el.select_one("a[href]")
        if link and not self._is_honeypot(link):
            return link.get("href")
        return None

    @staticmethod
    def _is_detail_url(url: str, base_url: str) -> bool:
        """Check if a URL looks like a property DETAIL page (not category/index).

        Uses a permissive approach: reject known non-property patterns, then
        accept URLs with property indicators, numeric IDs, or deep paths.
        This works dynamically for any property website.
        """
        parsed = urlparse(url)
        base_domain = urlparse(base_url).netloc

        # Must be same domain
        if parsed.netloc and parsed.netloc.replace("www.", "") != base_domain.replace("www.", ""):
            return False

        path = parsed.path.rstrip("/").lower()
        segments = [s for s in path.split("/") if s]

        # Need at least 1 path segment
        if not segments:
            return False

        # Skip non-property pages
        skip_patterns = [
            "/login", "/register", "/signup", "/about", "/contact",
            "/terms", "/privacy", "/faq", "/help", "/blog",
            "/agents", "/companies", "/account", "/cart", "/checkout",
            ".css", ".js", ".png", ".jpg", ".svg", ".ico",
            "/search", "/filter", "/requests/", "/market-trends",
            "/create", "/edit", "/delete", "/settings", "/profile",
            "/advertise", "/pricing", "/subscribe", "/newsletter",
        ]
        if any(pat in path for pat in skip_patterns):
            return False

        last_segment = segments[-1]

        # Reject pure category/location pages
        category_patterns = [
            r"^(for-sale|for-rent|to-let|buy|rent|shortlet)$",
            r"^(lagos|lekki|ikoyi|vi|victoria-island|ikeja|ajah|yaba|surulere|abuja|port-harcourt)$",
            r"^(flat-apartment|flats-apartments|houses?|lands?|commercial|offices?)$",
            r"^(duplex|bungalow|warehouse|shop|showtype|residential|all)$",
            r"^\d+-bedroom$",
        ]
        if len(segments) <= 2 and any(
            re.match(pat, last_segment) for pat in category_patterns
        ):
            return False

        # ── Positive signals (any match = accept) ──

        # 1. Property keywords in URL path
        property_keywords = [
            "bedroom", "bathroom", "property", "flat", "house",
            "duplex", "apartment", "bungalow", "terrace", "detached",
            "semi-detached", "plot", "land", "office", "shop",
            "warehouse", "hotel", "estate", "maisonette", "penthouse",
            "listing", "villa", "condo", "studio",
        ]
        for kw in property_keywords:
            if kw in path:
                return True

        # 2. Numeric IDs (4+ digits) anywhere in URL — common for property pages
        if re.search(r"/\d{4,}", path) or re.search(r"[-_]\d{4,}", path):
            return True

        # 3. Alphanumeric ID at end (e.g. 5PBCA, abc123)
        if re.search(r"[A-Z0-9]{4,}$", segments[-1], re.IGNORECASE):
            return True

        # 4. Ends with .html
        if last_segment.endswith(".html"):
            return True

        # 5. Long unique slug (20+ chars with hyphens, likely a property title)
        if len(last_segment) > 20 and "-" in last_segment:
            return True

        # 6. 3+ path segments = deep URL, likely a detail page
        if len(segments) >= 3:
            return True

        # 7. URL path indicators for detail pages
        detail_indicators = ["/property/", "/listing/", "/detail/", "/view/", "/item/", "/properties/"]
        if any(ind in path for ind in detail_indicators) and len(last_segment) > 5:
            return True

        return False

    # Keep backward compatibility
    _is_property_url = _is_detail_url

    def _auto_detect_listing_urls(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """Auto-detect property listing URLs when CSS selectors and patterns fail."""
        urls: list[str] = []
        seen = set()

        for link in soup.find_all("a", href=True):
            if self._is_honeypot(link):
                continue
            href = str(link["href"])
            if href.startswith(("mailto:", "tel:", "javascript:", "whatsapp:", "data:")):
                continue
            full_url = urljoin(base_url, href)
            path = urlparse(full_url).path.rstrip("/")
            if path in seen:
                continue
            seen.add(path)

            if self._is_detail_url(full_url, base_url):
                urls.append(full_url)

        logger.info(f"Auto-detect found {len(urls)} candidate detail URLs")
        return urls[:200]

    def extract_property(self, html: str, url: str) -> Optional[dict[str, Any]]:
        """Extract property data from a detail page."""
        soup = BeautifulSoup(html, "lxml")
        data: dict[str, Any] = {"listingUrl": url}

        for field, selector in self.selectors.items():
            if field in ("listing_link", "listingSelector", "listing_container",
                         "paginationConfig", "delayMin", "delayMax"):
                continue  # Not relevant for detail pages

            try:
                value = self._extract_field(soup, selector, field)
                if value is not None:
                    data[field] = value
            except Exception as e:
                logger.debug(f"Error extracting {field} with {selector}: {e}")

        # Rename internal field names to match API schema
        data = self._map_field_names(data)

        # Auto-extract title from <title> tag or h1 if not found
        if not data.get("title"):
            data["title"] = self._auto_extract_title(soup)

        if not data.get("title"):
            logger.debug(f"No title found for {url}, skipping")
            return None

        # Auto-extract images if none found
        if not data.get("images"):
            data["images"] = self._auto_extract_images(soup, url)

        # Auto-extract price if not found
        if not data.get("price_text"):
            data["price_text"] = self._auto_extract_price(soup)

        return data

    def _extract_field(
        self, soup: BeautifulSoup, selector: str, field: str
    ) -> Any:
        """Extract a single field using CSS selectors with pipe-separated fallbacks."""

        # Support pipe-separated fallback selectors
        selectors = [s.strip() for s in str(selector).split("|")]

        for sel in selectors:
            if not sel:
                continue
            result = self._extract_single(soup, sel, field)
            if result is not None:
                # For lists, only return if non-empty
                if isinstance(result, list) and len(result) == 0:
                    continue
                return result

        return None

    def _extract_single(
        self, soup: BeautifulSoup, selector: str, field: str
    ) -> Any:
        """Extract using a single CSS selector."""

        # Handle attribute extraction: selector::attr(name)
        attr_name = None
        if "::attr(" in selector:
            selector, attr_part = selector.split("::attr(", 1)
            attr_name = attr_part.rstrip(")")

        # Handle ::text pseudo-element
        if "::text" in selector:
            selector = selector.replace("::text", "")

        # Multi-value fields (images, features)
        if field in ("images", "features", "security", "utilities", "videos"):
            elements = soup.select(selector)
            if not elements:
                return None
            if attr_name:
                return [el.get(attr_name) for el in elements if el.get(attr_name)]
            return [el.get_text(strip=True) for el in elements if el.get_text(strip=True)]

        # Single-value field
        el = soup.select_one(selector)
        if el is None:
            return None

        if attr_name:
            return el.get(attr_name)

        return el.get_text(strip=True)

    @staticmethod
    def _auto_extract_title(soup: BeautifulSoup) -> Optional[str]:
        """Try to auto-extract property title from common elements."""
        # Try h1 first
        h1 = soup.select_one("h1")
        if h1:
            text = h1.get_text(strip=True)
            if len(text) > 5:
                return text

        # Try title tag (strip site name suffix)
        title_tag = soup.select_one("title")
        if title_tag:
            text = title_tag.get_text(strip=True)
            # Remove common suffixes like " - PropertyPro.ng" or " | Nigeria Property Centre"
            for sep in [" - ", " | ", " – ", " — "]:
                if sep in text:
                    text = text.split(sep)[0].strip()
            if len(text) > 5:
                return text

        # Try og:title meta tag
        og_title = soup.select_one("meta[property='og:title']")
        if og_title:
            return og_title.get("content")

        return None

    @staticmethod
    def _auto_extract_images(soup: BeautifulSoup, url: str) -> list[str]:
        """Auto-extract property images from common patterns."""
        images: list[str] = []

        # Try og:image first
        og_images = soup.select("meta[property='og:image']")
        for img in og_images:
            src = img.get("content")
            if src:
                images.append(urljoin(url, src))

        # Try gallery/carousel images
        gallery_selectors = [
            ".gallery img", ".carousel img", ".slider img",
            "[class*='gallery'] img", "[class*='carousel'] img",
            "[class*='slider'] img", "[class*='photo'] img",
            ".property-image img", ".listing-image img",
            "[class*='image'] img",
        ]
        for selector in gallery_selectors:
            for img in soup.select(selector):
                src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
                if src and not src.endswith((".svg", ".gif")):
                    full_url = urljoin(url, src)
                    if full_url not in images:
                        images.append(full_url)

        return images[:20]  # Cap at 20 images

    @staticmethod
    def _auto_extract_price(soup: BeautifulSoup) -> Optional[str]:
        """Auto-extract price from common patterns in Nigerian property sites."""
        # Look for Nigerian Naira patterns in text
        price_pattern = re.compile(
            r"(?:₦|NGN|N)\s*[\d,]+(?:\.\d{2})?(?:\s*(?:million|m|k|billion|b))?",
            re.IGNORECASE,
        )

        # Check common price containers first
        price_selectors = [
            "[class*='price']", "[class*='amount']", "[class*='cost']",
            "[data-price]", ".price", ".amount",
        ]
        for selector in price_selectors:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(strip=True)
                if text:
                    return text

        # Fallback: scan page text for price patterns
        page_text = soup.get_text()
        match = price_pattern.search(page_text)
        if match:
            return match.group(0)

        return None

    # --- JSON-LD Extraction (from v2.0 — most reliable method) ---

    @staticmethod
    def extract_json_ld(html: str) -> list[dict[str, Any]]:
        """Extract all JSON-LD structured data from HTML."""
        soup = BeautifulSoup(html, "lxml")
        results: list[dict[str, Any]] = []
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                text = script.string
                if text:
                    data = json.loads(text)
                    results.append(data)
            except (json.JSONDecodeError, TypeError):
                continue
        return results

    @staticmethod
    def harvest_properties_from_json_ld(
        json_ld_list: list[dict[str, Any]], page_url: str
    ) -> list[dict[str, Any]]:
        """Extract property listings from JSON-LD objects.

        Many Nigerian property sites embed structured data in JSON-LD format
        (schema.org types like RealEstateListing, Product, Offer, etc.)
        This is often MORE reliable than CSS selectors.
        """
        items: list[dict[str, Any]] = []

        def process_obj(obj: dict):
            """Process a single JSON-LD object that looks like a property."""
            # Extract address
            addr = obj.get("address")
            location = None
            if isinstance(addr, dict):
                location = (
                    addr.get("addressLocality")
                    or addr.get("streetAddress")
                    or addr.get("addressRegion")
                )
                # Try to build full address
                parts = [
                    addr.get("streetAddress"),
                    addr.get("addressLocality"),
                    addr.get("addressRegion"),
                    addr.get("addressCountry"),
                ]
                full_addr = ", ".join(p for p in parts if p)
                if full_addr:
                    location = full_addr
            elif isinstance(addr, str):
                location = addr

            # Extract images
            imgs = obj.get("image") or obj.get("photo") or obj.get("photos")
            images = imgs if isinstance(imgs, list) else ([imgs] if imgs else [])
            # Resolve relative URLs
            images = [urljoin(page_url, img) if isinstance(img, str) else img for img in images]
            # Handle image objects
            images = [
                img.get("url", img.get("contentUrl", "")) if isinstance(img, dict) else img
                for img in images
            ]
            images = [img for img in images if img]

            # Extract price
            price = obj.get("price") or obj.get("priceValue")
            offers = obj.get("offers")
            if not price and isinstance(offers, dict):
                price = offers.get("price") or offers.get("priceValue")
            if not price and isinstance(offers, list) and offers:
                price = offers[0].get("price") or offers[0].get("priceValue")

            # Extract listing URL
            listing_url = obj.get("url") or page_url

            # Extract bedrooms/bathrooms from numberOfRooms or floorSize
            bedrooms = obj.get("numberOfBedrooms") or obj.get("numberOfRooms")
            bathrooms = obj.get("numberOfBathroomsTotal") or obj.get("numberOfBathrooms")

            # Extract area
            floor_size = obj.get("floorSize")
            area_size = None
            if isinstance(floor_size, dict):
                area_size = floor_size.get("value")
            elif floor_size:
                area_size = str(floor_size)

            items.append({
                "title": obj.get("name") or obj.get("title"),
                "price_text": str(price) if price else None,
                "location_text": location,
                "description": obj.get("description"),
                "bedrooms": int(bedrooms) if bedrooms else None,
                "bathrooms": int(bathrooms) if bathrooms else None,
                "area_size_text": area_size,
                "images": images,
                "listingUrl": urljoin(page_url, listing_url) if listing_url else page_url,
                "agentName": (
                    obj.get("seller", {}).get("name")
                    if isinstance(obj.get("seller"), dict) else None
                ),
                "_source": "json-ld",
            })

        def walk(obj):
            """Recursively walk JSON-LD to find property-like objects."""
            if isinstance(obj, dict):
                obj_type = obj.get("@type", "")
                type_list = obj_type if isinstance(obj_type, list) else [obj_type]
                type_str = " ".join(str(t).lower() for t in type_list)

                # Match property-related schema.org types
                property_types = (
                    "realestate", "product", "offer", "residence",
                    "house", "apartment", "singlefamily", "accommodation",
                    "place", "localBusiness",
                )
                has_property_indicators = any(
                    k in obj for k in ("price", "address", "numberOfBedrooms", "offers")
                )
                is_property_type = any(t in type_str for t in property_types)

                if (is_property_type or has_property_indicators) and obj.get("name"):
                    process_obj(obj)

                # Also check @graph arrays
                for v in obj.values():
                    walk(v)

            elif isinstance(obj, list):
                for v in obj:
                    walk(v)

        for blob in json_ld_list:
            walk(blob)

        if not items:
            return items

        # Merge multiple JSON-LD objects from the same page into one property.
        # Many sites (like PropertyPro) split data across RealEstateListing,
        # SingleFamilyResidence, and Offer objects as siblings.
        merged: dict[str, Any] = {"_source": "json-ld", "listingUrl": page_url}
        for item in items:
            for key, value in item.items():
                if key == "_source":
                    continue
                # Keep the first non-None value for each field
                if value is not None and (key not in merged or merged[key] is None):
                    merged[key] = value
                # For images, merge all lists
                elif key == "images" and isinstance(value, list) and value:
                    existing = merged.get("images", [])
                    for img in value:
                        if img and img not in existing:
                            existing.append(img)
                    merged["images"] = existing

        return [merged]

    def extract_property_with_json_ld(
        self, html: str, url: str
    ) -> Optional[dict[str, Any]]:
        """Extract property data using JSON-LD first, then CSS selectors as fallback.

        This is the preferred extraction method — JSON-LD is more reliable
        than CSS selectors since it's structured data meant for machines.
        """
        # Try JSON-LD first
        json_ld_list = self.extract_json_ld(html)
        if json_ld_list:
            properties = self.harvest_properties_from_json_ld(json_ld_list, url)
            if properties:
                # Use the first (best) match
                data = properties[0]
                # Fill in any missing fields from CSS selectors
                css_data = self.extract_property(html, url)
                if css_data:
                    for key, value in css_data.items():
                        if key not in data or data[key] is None:
                            data[key] = value
                # Remove internal fields
                data.pop("_source", None)
                return data

        # Fall back to pure CSS extraction
        return self.extract_property(html, url)

    # --- __NEXT_DATA__ extraction (Next.js SSR data) ---

    @staticmethod
    def extract_next_data(html: str, page_url: str) -> list[dict[str, Any]]:
        """Extract property listings from Next.js __NEXT_DATA__ JSON.

        Next.js embeds server-side rendered data in a script tag with id="__NEXT_DATA__".
        This data often contains the full property listing data in props.pageProps.
        """
        soup = BeautifulSoup(html, "lxml")
        script = soup.find("script", id="__NEXT_DATA__")
        if not script or not script.string:
            return []

        try:
            data = json.loads(script.string)
        except (json.JSONDecodeError, TypeError):
            return []

        page_props = data.get("props", {}).get("pageProps", {})
        if not page_props:
            return []

        # Search for arrays of property-like objects
        properties: list[dict[str, Any]] = []

        def _looks_like_property(obj: dict) -> bool:
            """Check if a dict looks like a property listing."""
            property_keys = {"price", "title", "name", "bedrooms", "beds", "address",
                             "location", "amount", "listing_url", "url", "slug",
                             "propertyType", "property_type", "type"}
            matching = property_keys & set(obj.keys())
            return len(matching) >= 2

        def _convert_property(obj: dict) -> dict[str, Any]:
            """Convert a Next.js property object to our schema."""
            # Map common Next.js field names to our schema
            title = obj.get("title") or obj.get("name") or obj.get("heading") or ""
            price = obj.get("price") or obj.get("amount") or obj.get("formattedPrice") or ""

            # Location
            location = (obj.get("location") or obj.get("address") or
                        obj.get("area") or obj.get("neighbourhood") or "")
            if isinstance(location, dict):
                location = location.get("name") or location.get("address") or str(location)

            # URL
            url = obj.get("url") or obj.get("listing_url") or obj.get("detailUrl") or ""
            slug = obj.get("slug") or obj.get("id") or ""
            if not url and slug:
                url = f"{page_url.rstrip('/')}/{slug}"
            if url and not url.startswith("http"):
                url = urljoin(page_url, url)

            # Images
            images = obj.get("images") or obj.get("photos") or obj.get("gallery") or []
            if isinstance(images, str):
                images = [images]
            elif isinstance(images, list):
                images = [
                    (img.get("url") or img.get("src") or img) if isinstance(img, dict) else img
                    for img in images
                ]
            images = [urljoin(page_url, img) if isinstance(img, str) and not img.startswith("http") else img
                      for img in images if isinstance(img, str)]

            return {
                "title": str(title),
                "price": str(price) if price else "",
                "location": str(location),
                "bedrooms": obj.get("bedrooms") or obj.get("beds") or obj.get("numberOfBedrooms"),
                "bathrooms": obj.get("bathrooms") or obj.get("baths") or obj.get("numberOfBathrooms"),
                "toilets": obj.get("toilets"),
                "property_type": obj.get("propertyType") or obj.get("property_type") or obj.get("type") or "",
                "listing_type": obj.get("listingType") or obj.get("listing_type") or obj.get("purpose") or "",
                "description": obj.get("description") or "",
                "land_size": str(obj.get("landSize") or obj.get("land_size") or obj.get("plotSize") or ""),
                "building_size": str(obj.get("buildingSize") or obj.get("building_size") or obj.get("floorArea") or ""),
                "features": obj.get("features") or obj.get("amenities") or [],
                "images": images,
                "listing_url": url or page_url,
                "agent_name": obj.get("agentName") or obj.get("agent_name") or "",
                "agent_phone": obj.get("agentPhone") or obj.get("agent_phone") or "",
                "agency_name": obj.get("agencyName") or obj.get("agency_name") or "",
                "_source": "__NEXT_DATA__",
            }

        def _search_for_properties(obj: Any, depth: int = 0) -> None:
            """Recursively search for property arrays in nested data."""
            if depth > 5:
                return
            if isinstance(obj, list) and len(obj) >= 2:
                # Check if this array contains property-like objects
                prop_count = sum(1 for item in obj[:5] if isinstance(item, dict) and _looks_like_property(item))
                if prop_count >= 2:
                    for item in obj:
                        if isinstance(item, dict) and _looks_like_property(item):
                            properties.append(_convert_property(item))
                    return
            if isinstance(obj, dict):
                for v in obj.values():
                    _search_for_properties(v, depth + 1)
            elif isinstance(obj, list):
                for v in obj:
                    _search_for_properties(v, depth + 1)

        _search_for_properties(page_props)

        if properties:
            logger.info(f"__NEXT_DATA__ extracted {len(properties)} properties from {page_url}")

        return properties

    # --- __NUXT_DATA__ extraction (Nuxt.js) ---

    @staticmethod
    def extract_nuxt_data(html: str, page_url: str) -> list[dict[str, Any]]:
        """Extract property listings from Nuxt.js data payloads.

        Nuxt.js embeds data in various ways:
        - window.__NUXT__ = {...}
        - <script id="__NUXT_DATA__">
        - <script>window.__NUXT_DATA__=...</script>
        """
        soup = BeautifulSoup(html, "lxml")
        properties: list[dict[str, Any]] = []

        # Try script#__NUXT_DATA__
        nuxt_script = soup.find("script", id="__NUXT_DATA__")
        if nuxt_script and nuxt_script.string:
            try:
                data = json.loads(nuxt_script.string)
                # Similar search as __NEXT_DATA__
                if isinstance(data, (dict, list)):
                    # Nuxt data can be deeply nested
                    pass  # TODO: implement if needed for specific sites
            except (json.JSONDecodeError, TypeError):
                pass

        # Try window.__NUXT__ pattern
        for script in soup.find_all("script"):
            if script.string and "window.__NUXT__" in script.string:
                try:
                    # Extract JSON from window.__NUXT__ = {...}
                    match = re.search(r'window\.__NUXT__\s*=\s*({.+?})\s*;?\s*$',
                                      script.string, re.DOTALL)
                    if match:
                        data = json.loads(match.group(1))
                        # Search for property data in the Nuxt state
                        # This is site-specific but we can look for common patterns
                        if isinstance(data, dict):
                            for key in ("data", "state", "fetch"):
                                if key in data and isinstance(data[key], (dict, list)):
                                    pass  # Would need site-specific handling
                except (json.JSONDecodeError, TypeError):
                    pass

        return properties

    # --- OpenGraph extraction ---

    @staticmethod
    def extract_opengraph(html: str, page_url: str) -> dict[str, Any] | None:
        """Extract property data from OpenGraph meta tags.

        Useful for detail pages where OG tags contain structured property info.
        """
        soup = BeautifulSoup(html, "lxml")
        og: dict[str, str] = {}

        for meta in soup.find_all("meta"):
            prop = meta.get("property", "") or meta.get("name", "")
            content = meta.get("content", "")
            if prop.startswith("og:") and content:
                og[prop] = content
            elif prop.startswith("product:") and content:
                og[prop] = content

        if not og.get("og:title"):
            return None

        images = [og["og:image"]] if og.get("og:image") else []
        # Resolve relative image URLs
        images = [urljoin(page_url, img) if not img.startswith("http") else img for img in images]

        return {
            "title": og.get("og:title", ""),
            "description": og.get("og:description", ""),
            "price": og.get("product:price:amount", "") or og.get("og:price:amount", ""),
            "location": og.get("og:locality", "") or og.get("og:region", ""),
            "images": images,
            "listing_url": og.get("og:url", page_url),
            "_source": "opengraph",
        }

    # --- Orchestrator: try all structured data sources ---

    @classmethod
    def extract_all_structured_data(
        cls, html: str, page_url: str,
    ) -> list[dict[str, Any]]:
        """Try all structured data extraction methods in priority order.

        Returns the first non-empty result:
        1. JSON-LD (most reliable — schema.org structured data)
        2. __NEXT_DATA__ (Next.js SSR data)
        3. __NUXT_DATA__ (Nuxt.js data)

        OpenGraph is NOT included here — it's for single-property detail pages,
        not listing pages. Use extract_opengraph() separately for detail enrichment.
        """
        # 1. JSON-LD
        json_ld = cls.extract_json_ld(html)
        if json_ld:
            properties = cls.harvest_properties_from_json_ld(json_ld, page_url)
            if properties and len(properties) >= 1:
                # Filter out items without useful data
                valid = [p for p in properties if p.get("title") or p.get("price_text")]
                if valid:
                    logger.info(f"JSON-LD extracted {len(valid)} properties from {page_url}")
                    return valid

        # 2. __NEXT_DATA__
        next_data = cls.extract_next_data(html, page_url)
        if next_data and len(next_data) >= 2:
            logger.info(f"__NEXT_DATA__ extracted {len(next_data)} properties from {page_url}")
            return next_data

        # 3. __NUXT_DATA__
        nuxt_data = cls.extract_nuxt_data(html, page_url)
        if nuxt_data and len(nuxt_data) >= 2:
            logger.info(f"__NUXT_DATA__ extracted {len(nuxt_data)} properties from {page_url}")
            return nuxt_data

        return []

    def _map_field_names(self, data: dict[str, Any]) -> dict[str, Any]:
        """Map extractor field names to API-expected names."""
        mapping = {
            "price": "price_text",
            "location": "location_text",
            "area_size": "area_size_text",
            "agent_name": "agentName",
            "agent_phone": "agentPhone",
            "agent_email": "agentEmail",
            "agency_name": "agencyName",
        }
        result = {}
        for key, value in data.items():
            mapped_key = mapping.get(key, key)
            result[mapped_key] = value
        return result
