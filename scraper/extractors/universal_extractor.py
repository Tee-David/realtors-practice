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

    def extract_listing_urls(
        self, html: str, base_url: str, listing_selector: str
    ) -> list[str]:
        """Extract listing URLs from a search/listing page, filtering honeypots.

        Tries the provided selector first, then falls back to auto-detection
        of property listing links based on URL patterns.
        """
        soup = BeautifulSoup(html, "lxml")
        urls: list[str] = []

        # Try each pipe-separated selector
        selectors = [s.strip() for s in listing_selector.split("|")]

        for selector in selectors:
            if not selector:
                continue
            elements = soup.select(selector)
            if elements:
                for el in elements:
                    if self._is_honeypot(el):
                        continue
                    href = self._get_href(el)
                    if href:
                        full_url = urljoin(base_url, str(href))
                        if full_url not in urls and self._is_property_url(full_url, base_url):
                            urls.append(full_url)
                if urls:
                    return urls

        # Fallback: auto-detect property links by URL patterns
        if not urls:
            urls = self._auto_detect_listing_urls(soup, base_url)

        return urls

    def _get_href(self, el: Tag) -> Optional[str]:
        """Extract href from an element or its first child link."""
        if el.name == "a":
            return el.get("href")
        link = el.select_one("a[href]")
        if link and not self._is_honeypot(link):
            return link.get("href")
        return None

    @staticmethod
    def _is_property_url(url: str, base_url: str) -> bool:
        """Check if a URL looks like a property detail page."""
        parsed = urlparse(url)
        base_domain = urlparse(base_url).netloc

        # Must be same domain
        if parsed.netloc and parsed.netloc != base_domain:
            return False

        path = parsed.path.lower()

        # Skip non-property pages
        skip_patterns = [
            "/login", "/register", "/signup", "/about", "/contact",
            "/terms", "/privacy", "/faq", "/help", "/blog",
            "/agents", "/companies", "/account", "/cart", "/checkout",
            ".css", ".js", ".png", ".jpg", ".svg", ".ico",
            "/search", "/filter",
        ]
        if any(pat in path for pat in skip_patterns):
            return False

        # Common property URL patterns for Nigerian sites
        property_patterns = [
            r"/property/", r"/properties/", r"/listing/", r"/listings/",
            r"/for-sale/", r"/for-rent/", r"/to-let/",
            r"/house", r"/flat", r"/apartment", r"/land",
            r"/detail", r"/view/",
            r"/\d+",  # Numeric IDs in URL
        ]
        return any(re.search(pat, path) for pat in property_patterns)

    def _auto_detect_listing_urls(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        """Auto-detect property listing URLs when CSS selectors fail."""
        urls: list[str] = []

        for link in soup.find_all("a", href=True):
            if self._is_honeypot(link):
                continue
            href = str(link["href"])
            full_url = urljoin(base_url, href)
            if full_url not in urls and self._is_property_url(full_url, base_url):
                # Additional heuristic: links inside elements that look like listing cards
                parent_classes = " ".join(link.parent.get("class", [])).lower() if link.parent else ""
                card_hints = ("card", "listing", "property", "item", "result", "product")
                if any(hint in parent_classes for hint in card_hints) or self._is_property_url(full_url, base_url):
                    urls.append(full_url)

        return urls[:200]  # Cap at 200 to prevent runaway

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

        return items

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
