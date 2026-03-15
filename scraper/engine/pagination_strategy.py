"""3-strategy pagination — next button click, numeric page links, URL param fallback.

Ported from scraper v2.0. The original pagination.py supported basic URL
generation but didn't handle dynamic next-button detection or numeric
page-link extraction from HTML. This module provides a unified
PaginationStrategy that tries three approaches in order:

1. **Next button** — find a "Next" link/button in the DOM and follow it
2. **Numeric page links** — find page number links (1, 2, 3, ...) and
   build URLs for each page
3. **URL parameter fallback** — append ?page=N (or offset, path segment)
   to the base URL

The strategy is stateful: it receives HTML from the current page and
returns the URL for the next page (or None when pagination is exhausted).
"""

import re
from typing import Optional
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

from bs4 import BeautifulSoup, Tag

from utils.logger import get_logger

logger = get_logger(__name__)


# --- Strategy 1: Next button selectors ---

_NEXT_BUTTON_SELECTORS = [
    # Explicit rel="next"
    "a[rel='next']",
    "link[rel='next']",
    # Class-based
    "a.next",
    "a.next-page",
    "li.next > a",
    "li.next a",
    ".pagination-next a",
    ".pagination .next a",
    "[class*='pagination'] .next a",
    "[class*='pager'] .next a",
    # Aria-based
    "a[aria-label='Next']",
    "a[aria-label='Next page']",
    "a[aria-label='Go to next page']",
    # Icon-based (chevron right)
    ".pagination a[class*='right']",
    ".pagination a[class*='forward']",
]

# Text patterns that indicate a "Next" button
_NEXT_TEXT_PATTERNS = re.compile(
    r"^\s*(?:next|next\s*page|next\s*»|»|›|→|>)\s*$",
    re.IGNORECASE,
)

# --- Strategy 2: Numeric page link patterns ---

_PAGE_NUMBER_PATTERN = re.compile(r"^\s*(\d+)\s*$")

_PAGINATION_CONTAINER_SELECTORS = [
    ".pagination",
    "[class*='pagination']",
    "nav[aria-label*='page']",
    "nav[aria-label*='Page']",
    ".pager",
    "[class*='pager']",
    "[class*='page-numbers']",
    "ul.pages",
    ".page-nav",
]


# --- Standalone convenience function ---


def get_next_page_url(
    html: str,
    current_url: str,
    strategy: str = "auto",
) -> Optional[str]:
    """Get the next page URL from the current page HTML.

    Implements three pagination strategies with automatic fallback:
        1. **Next button** — Find and follow a "Next" link/button in the DOM.
        2. **Numeric page links** — Find page number links (1, 2, 3, ...) and
           pick the next one.
        3. **URL parameter manipulation** — Append ?page=N or /page/N to the URL.

    Args:
        html: HTML content of the current page.
        current_url: URL of the current page.
        strategy: One of "auto", "next_button", "numeric_links", "url_param",
            "path_segment", "offset". Default "auto" tries all three in order.

    Returns:
        URL of the next page, or None if pagination is exhausted.
    """
    paginator = PaginationStrategy(
        pagination_type=strategy,
        pagination_config={},
        max_pages=100,  # No artificial limit for standalone usage
    )
    return paginator.get_next_page_url(html, current_url, page_num=0)


class PaginationStrategy:
    """3-strategy pagination handler.

    Usage:
        paginator = PaginationStrategy(
            pagination_type="auto",
            pagination_config={},
            max_pages=10,
        )

        # Page 0 — use start_url directly
        html = await fetcher.fetch(start_url)

        # Get next page URL from the HTML
        next_url = paginator.get_next_page_url(html, start_url, page_num=0)
        if next_url:
            html = await fetcher.fetch(next_url)
            ...
    """

    def __init__(
        self,
        pagination_type: str = "auto",
        pagination_config: Optional[dict] = None,
        max_pages: int = 10,
    ) -> None:
        """
        Args:
            pagination_type: One of "auto", "next_button", "numeric_links",
                "url_param", "path_segment", "offset". "auto" tries all
                three strategies in order.
            pagination_config: Site-specific config dict with keys like
                "param", "startFrom", "suffix", "perPage", "nextSelector".
            max_pages: Maximum number of pages to paginate through.
        """
        self.pagination_type = pagination_type
        self.config = pagination_config or {}
        self.max_pages = max_pages
        self._discovered_page_urls: list[str] = []
        self._current_strategy: Optional[str] = None

    @property
    def current_strategy(self) -> Optional[str]:
        """The strategy that last successfully produced a URL."""
        return self._current_strategy

    def get_next_page_url(
        self,
        html: str,
        current_url: str,
        page_num: int,
    ) -> Optional[str]:
        """Determine the next page URL using the 3-strategy approach.

        Args:
            html: HTML content of the current page.
            current_url: URL of the current page.
            page_num: Zero-based page number of the current page.

        Returns:
            URL for the next page, or None if pagination is exhausted.
        """
        if page_num + 1 >= self.max_pages:
            logger.debug(f"Reached max pages ({self.max_pages})")
            return None

        # If a specific strategy is configured, use only that one
        if self.pagination_type == "next_button":
            return self._strategy_next_button(html, current_url)
        elif self.pagination_type == "numeric_links":
            return self._strategy_numeric_links(html, current_url, page_num)
        elif self.pagination_type in ("url_param", "path_segment", "offset"):
            return self._strategy_url_param(current_url, page_num)
        elif self.pagination_type == "auto":
            # Try all three strategies in order
            return self._auto_strategy(html, current_url, page_num)
        else:
            # Unknown type — fall back to URL param
            logger.debug(f"Unknown pagination type '{self.pagination_type}', using url_param")
            return self._strategy_url_param(current_url, page_num)

    def _auto_strategy(
        self,
        html: str,
        current_url: str,
        page_num: int,
    ) -> Optional[str]:
        """Try all three strategies in order: next button -> numeric links -> URL param.

        Args:
            html: HTML content of the current page.
            current_url: URL of the current page.
            page_num: Zero-based page number of the current page.

        Returns:
            URL for the next page, or None if all strategies fail.
        """
        # Strategy 1: Next button click
        next_url = self._strategy_next_button(html, current_url)
        if next_url:
            self._current_strategy = "next_button"
            logger.debug(f"Strategy 1 (next button) found: {next_url}")
            return next_url

        # Strategy 2: Numeric page links
        next_url = self._strategy_numeric_links(html, current_url, page_num)
        if next_url:
            self._current_strategy = "numeric_links"
            logger.debug(f"Strategy 2 (numeric links) found: {next_url}")
            return next_url

        # Strategy 3: URL parameter fallback
        next_url = self._strategy_url_param(current_url, page_num)
        if next_url:
            self._current_strategy = "url_param"
            logger.debug(f"Strategy 3 (URL param) fallback: {next_url}")
            return next_url

        logger.debug(f"All pagination strategies exhausted at page {page_num + 1}")
        return None

    # --- Strategy 1: Next button ---

    def _strategy_next_button(
        self,
        html: str,
        current_url: str,
    ) -> Optional[str]:
        """Find a 'Next' button/link in the DOM and return its href.

        Args:
            html: HTML content of the current page.
            current_url: URL of the current page (for resolving relative hrefs).

        Returns:
            Absolute URL of the next page, or None.
        """
        soup = BeautifulSoup(html, "lxml")

        # Check custom selector first
        custom_selector = self.config.get("nextSelector")
        if custom_selector:
            el = soup.select_one(custom_selector)
            href = self._extract_href(el)
            if href:
                return urljoin(current_url, href)

        # Try each standard selector
        for selector in _NEXT_BUTTON_SELECTORS:
            el = soup.select_one(selector)
            href = self._extract_href(el)
            if href:
                full_url = urljoin(current_url, href)
                # Sanity check: next URL should be on the same domain
                if self._is_same_domain(full_url, current_url):
                    return full_url

        # Text-matching fallback: find links whose text says "Next"
        pagination_container = self._find_pagination_container(soup)
        search_root = pagination_container if pagination_container else soup

        for link in search_root.find_all("a", href=True):
            link_text = link.get_text(strip=True)
            if _NEXT_TEXT_PATTERNS.match(link_text):
                href = link.get("href", "")
                if href and not href.startswith(("javascript:", "#")):
                    full_url = urljoin(current_url, href)
                    if self._is_same_domain(full_url, current_url):
                        return full_url

        return None

    # --- Strategy 2: Numeric page links ---

    def _strategy_numeric_links(
        self,
        html: str,
        current_url: str,
        page_num: int,
    ) -> Optional[str]:
        """Find numeric page links (1, 2, 3, ...) and return the next page URL.

        Args:
            html: HTML content of the current page.
            current_url: URL of the current page.
            page_num: Zero-based current page number.

        Returns:
            URL of the next page, or None.
        """
        soup = BeautifulSoup(html, "lxml")
        pagination = self._find_pagination_container(soup)
        if not pagination:
            return None

        # Collect all numeric page links
        page_links: dict[int, str] = {}
        for link in pagination.find_all("a", href=True):
            text = link.get_text(strip=True)
            match = _PAGE_NUMBER_PATTERN.match(text)
            if match:
                num = int(match.group(1))
                href = link.get("href", "")
                if href and not href.startswith(("javascript:", "#")):
                    page_links[num] = urljoin(current_url, href)

        if not page_links:
            return None

        # Cache discovered URLs for future use
        self._discovered_page_urls = [
            url for _, url in sorted(page_links.items())
        ]

        # The "current page" is typically page_num + 1 (1-indexed)
        # We want the page after that
        target_page = page_num + 2  # next page (1-indexed)

        if target_page in page_links:
            return page_links[target_page]

        # If exact page not found, try the highest page that's above current
        current_1indexed = page_num + 1
        higher_pages = {n: url for n, url in page_links.items() if n > current_1indexed}
        if higher_pages:
            next_page = min(higher_pages.keys())
            return higher_pages[next_page]

        return None

    # --- Strategy 3: URL parameter fallback ---

    def _strategy_url_param(
        self,
        current_url: str,
        page_num: int,
    ) -> Optional[str]:
        """Generate the next page URL by manipulating URL parameters.

        Supports three sub-modes based on pagination_type:
        - url_param: append ?page=N
        - path_segment: append /page/N to path
        - offset: append ?offset=N*perPage

        Args:
            current_url: URL of the current page.
            page_num: Zero-based current page number.

        Returns:
            URL for the next page.
        """
        ptype = self.pagination_type if self.pagination_type != "auto" else "url_param"
        next_page_num = page_num + 1

        if ptype == "url_param":
            param = self.config.get("param", "page")
            start_from = self.config.get("startFrom", 1)
            page_value = next_page_num + start_from

            parsed = urlparse(current_url)
            query_dict = parse_qs(parsed.query)
            query_dict[param] = [str(page_value)]
            new_query = urlencode(query_dict, doseq=True)
            return urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                "",
            ))

        elif ptype == "path_segment":
            suffix = self.config.get("suffix", "/page/{page}")
            # Strip any existing page segment from the URL
            base = self._strip_page_segment(current_url)
            page_value = next_page_num + self.config.get("startFrom", 0)
            return base.rstrip("/") + suffix.replace("{page}", str(page_value))

        elif ptype == "offset":
            param = self.config.get("param", "offset")
            per_page = self.config.get("perPage", 20)
            offset_value = next_page_num * per_page

            parsed = urlparse(current_url)
            query_dict = parse_qs(parsed.query)
            query_dict[param] = [str(offset_value)]
            new_query = urlencode(query_dict, doseq=True)
            return urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                "",
            ))

        return None

    # --- Helpers ---

    @staticmethod
    def _extract_href(el: Optional[Tag]) -> Optional[str]:
        """Extract href from an element, returning None for invalid values."""
        if el is None:
            return None
        href = el.get("href")
        if not href:
            return None
        href = str(href).strip()
        if href.startswith(("javascript:", "#", "mailto:", "tel:")):
            return None
        return href

    @staticmethod
    def _is_same_domain(url1: str, url2: str) -> bool:
        """Check if two URLs are on the same domain."""
        return urlparse(url1).netloc == urlparse(url2).netloc

    @staticmethod
    def _find_pagination_container(soup: BeautifulSoup) -> Optional[Tag]:
        """Find the pagination container element in the DOM."""
        for selector in _PAGINATION_CONTAINER_SELECTORS:
            container = soup.select_one(selector)
            if container:
                return container
        return None

    @staticmethod
    def _strip_page_segment(url: str) -> str:
        """Remove existing page/N segment from a URL path."""
        parsed = urlparse(url)
        # Remove /page/N or /p/N from path
        path = re.sub(r"/(?:page|p)/\d+/?$", "", parsed.path)
        return urlunparse((
            parsed.scheme,
            parsed.netloc,
            path,
            parsed.params,
            parsed.query,
            "",
        ))
