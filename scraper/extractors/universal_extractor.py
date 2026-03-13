"""Universal property data extractor using CSS selectors.

Extracts property data from HTML using site-specific selector configs
stored in the Site model's `selectors` JSON field.
"""

from typing import Any, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from utils.logger import get_logger

logger = get_logger(__name__)


class UniversalExtractor:
    """Extracts property data from HTML using configurable CSS selectors."""

    def __init__(self, selectors: dict[str, Any]):
        """
        selectors example:
        {
            "title": "h1.property-title",
            "price": ".price-text",
            "description": ".property-description",
            "location": ".property-location",
            "bedrooms": ".bed-count",
            "bathrooms": ".bath-count",
            "area_size": ".area-size",
            "images": "img.property-image::attr(src)",
            "agent_name": ".agent-name",
            "agent_phone": ".agent-phone",
            "features": ".feature-item",
            "listing_link": "a.property-link::attr(href)"
        }
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
        """Extract listing URLs from a search/listing page, filtering honeypots."""
        soup = BeautifulSoup(html, "lxml")
        urls: list[str] = []

        elements = soup.select(listing_selector)
        for el in elements:
            if self._is_honeypot(el):
                logger.debug(f"Skipped honeypot element: {el.get('href', '')[:80]}")
                continue

            href = None
            if el.name == "a":
                href = el.get("href")
            else:
                link = el.select_one("a[href]")
                if link:
                    if self._is_honeypot(link):
                        logger.debug(f"Skipped honeypot link: {link.get('href', '')[:80]}")
                        continue
                    href = link.get("href")

            if href:
                full_url = urljoin(base_url, str(href))
                if full_url not in urls:
                    urls.append(full_url)

        return urls

    def extract_property(self, html: str, url: str) -> Optional[dict[str, Any]]:
        """Extract property data from a detail page."""
        soup = BeautifulSoup(html, "lxml")
        data: dict[str, Any] = {"listingUrl": url}

        for field, selector in self.selectors.items():
            if field == "listing_link":
                continue  # Not relevant for detail pages

            try:
                value = self._extract_field(soup, selector, field)
                if value is not None:
                    data[field] = value
            except Exception as e:
                logger.debug(f"Error extracting {field} with {selector}: {e}")

        # Rename internal field names to match API schema
        data = self._map_field_names(data)

        if not data.get("title"):
            logger.debug(f"No title found for {url}, skipping")
            return None

        return data

    def _extract_field(
        self, soup: BeautifulSoup, selector: str, field: str
    ) -> Any:
        """Extract a single field using a CSS selector."""

        # Handle attribute extraction: selector::attr(name)
        attr_name = None
        if "::attr(" in selector:
            selector, attr_part = selector.split("::attr(", 1)
            attr_name = attr_part.rstrip(")")

        # Handle ::text pseudo-element
        extract_text = True
        if "::text" in selector:
            selector = selector.replace("::text", "")

        # Multi-value fields (images, features)
        if field in ("images", "features", "security", "utilities", "videos"):
            elements = soup.select(selector)
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
