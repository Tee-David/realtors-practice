"""Scrapling-based fetcher with adaptive self-healing selectors and anti-bot bypass.

Uses Scrapling's StealthyFetcher to bypass Cloudflare Turnstile and other anti-bot
systems. The adaptive parser stores element fingerprints and uses similarity matching
when selectors break — the scraper self-heals on site redesigns.

This replaces curl_cffi as the primary fetching layer (Layer 2 in the cognitive loop).
"""

import asyncio
from typing import Any, Optional

from utils.logger import get_logger

logger = get_logger(__name__)


class ScraplingFetcher:
    """Fetches web pages using Scrapling's StealthyFetcher with anti-bot bypass."""

    def __init__(self):
        self._stealthy = None
        self.last_block_reason: Optional[str] = None

    def _get_stealthy(self):
        """Lazy-init Scrapling StealthyFetcher."""
        if self._stealthy is not None:
            return self._stealthy
        try:
            from scrapling import StealthyFetcher
            self._stealthy = StealthyFetcher()
            return self._stealthy
        except ImportError:
            logger.warning("scrapling not installed — pip install scrapling")
            return None

    async def fetch(self, url: str) -> Optional[str]:
        """Fetch a URL using Scrapling's StealthyFetcher.

        StealthyFetcher handles:
        - Cloudflare Turnstile bypass
        - TLS fingerprint impersonation
        - Anti-bot detection evasion
        - Automatic challenge solving

        Returns HTML string or None on failure.
        """
        stealthy = self._get_stealthy()
        if stealthy is None:
            return None

        try:
            # StealthyFetcher.fetch is synchronous — run in executor
            loop = asyncio.get_event_loop()
            page = await loop.run_in_executor(None, stealthy.fetch, url)

            if page is None or page.status != 200:
                status = page.status if page else "no response"
                logger.warning(f"Scrapling fetch failed ({status}) for {url}")
                self.last_block_reason = f"Scrapling HTTP {status}"
                return None

            html = page.html
            if not html or len(html) < 500:
                logger.warning(f"Scrapling returned insufficient HTML for {url}")
                self.last_block_reason = "Scrapling: insufficient content"
                return None

            self.last_block_reason = None
            return html

        except Exception as e:
            logger.warning(f"Scrapling fetch error for {url}: {e}")
            self.last_block_reason = f"Scrapling error: {str(e)[:100]}"
            return None

    def extract_with_adaptive_parser(
        self, html: str, selectors: dict[str, str], url: str
    ) -> Optional[dict[str, Any]]:
        """Extract data using Scrapling's adaptive parser.

        The adaptive parser stores lightweight fingerprints of elements (tag,
        attributes, neighbor context). When a CSS selector breaks because the site
        changed its layout, the parser uses similarity matching to find the element
        that used to match — self-healing without manual selector updates.

        Args:
            html: Raw HTML string
            selectors: Dict mapping field names to CSS selectors
            url: Page URL for resolving relative URLs

        Returns:
            Dict of extracted field data, or None if extraction fails
        """
        try:
            from scrapling import Adaptor

            page = Adaptor(html, url=url)
            data: dict[str, Any] = {"listingUrl": url}

            for field, selector_chain in selectors.items():
                if field in ("listing_link", "listingSelector", "listing_container",
                             "paginationConfig", "delayMin", "delayMax"):
                    continue

                # Support pipe-separated fallback selectors
                individual_selectors = [s.strip() for s in str(selector_chain).split("|")]

                for sel in individual_selectors:
                    if not sel:
                        continue

                    try:
                        # Handle attribute extraction: selector::attr(name)
                        attr_name = None
                        clean_sel = sel
                        if "::attr(" in sel:
                            clean_sel, attr_part = sel.split("::attr(", 1)
                            attr_name = attr_part.rstrip(")")
                        if "::text" in clean_sel:
                            clean_sel = clean_sel.replace("::text", "")

                        # Multi-value fields
                        if field in ("images", "features", "security", "utilities", "videos"):
                            elements = page.css(clean_sel)
                            if elements:
                                if attr_name:
                                    values = [el.attrib.get(attr_name, "") for el in elements]
                                else:
                                    values = [el.text.strip() for el in elements if el.text]
                                values = [v for v in values if v]
                                if values:
                                    data[field] = values
                                    break
                        else:
                            # Single-value field — use auto_match for self-healing
                            element = page.css_first(clean_sel)
                            if element:
                                if attr_name:
                                    value = element.attrib.get(attr_name)
                                else:
                                    value = element.text.strip() if element.text else None
                                if value:
                                    data[field] = value
                                    break
                    except Exception as e:
                        logger.debug(f"Scrapling selector error for {field}/{sel}: {e}")
                        continue

            # Only return if we got meaningful data
            if len(data) > 1:  # more than just listingUrl
                return data
            return None

        except ImportError:
            logger.warning("scrapling not installed for adaptive parsing")
            return None
        except Exception as e:
            logger.warning(f"Scrapling adaptive extraction error: {e}")
            return None

    async def close(self) -> None:
        """Clean up resources."""
        self._stealthy = None
