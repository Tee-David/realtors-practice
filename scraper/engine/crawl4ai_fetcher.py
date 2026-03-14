"""Crawl4AI fetcher — converts web pages to clean Markdown for LLM extraction.

Layer 3 in the cognitive loop. When CSS selectors fail and JSON-LD isn't available,
Crawl4AI renders the page and strips ads/scripts/noise, producing clean Markdown
that reduces LLM token cost by 80-90% vs raw HTML.

The Markdown is then passed to Gemini Flash for structured property extraction.
"""

import asyncio
from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)


class Crawl4AIFetcher:
    """Fetches web pages and converts them to clean Markdown using Crawl4AI."""

    def __init__(self):
        self._crawler = None
        self.last_error: Optional[str] = None

    async def _get_crawler(self):
        """Lazy-init Crawl4AI AsyncWebCrawler."""
        if self._crawler is not None:
            return self._crawler
        try:
            from crawl4ai import AsyncWebCrawler
            self._crawler = AsyncWebCrawler(verbose=False)
            await self._crawler.awarmup()
            return self._crawler
        except ImportError:
            logger.warning("crawl4ai not installed — pip install crawl4ai")
            return None

    async def fetch_as_markdown(self, url: str) -> Optional[str]:
        """Fetch a URL and return clean Markdown content.

        Crawl4AI handles:
        - JavaScript rendering
        - Ad/script/noise removal
        - Clean Markdown conversion preserving content structure
        - Image URL extraction

        Returns Markdown string or None on failure.
        """
        crawler = await self._get_crawler()
        if crawler is None:
            return None

        try:
            result = await crawler.arun(url=url)

            if not result.success:
                logger.warning(f"Crawl4AI failed for {url}: {result.error_message}")
                self.last_error = result.error_message
                return None

            markdown = result.markdown
            if not markdown or len(markdown.strip()) < 100:
                logger.warning(f"Crawl4AI returned insufficient content for {url}")
                self.last_error = "Insufficient content"
                return None

            self.last_error = None
            return markdown

        except Exception as e:
            logger.warning(f"Crawl4AI error for {url}: {e}")
            self.last_error = str(e)[:200]
            return None

    async def fetch_html(self, url: str) -> Optional[str]:
        """Fetch a URL and return the raw rendered HTML.

        Useful when we want to pass rendered HTML to Scrapling's adaptive parser
        (e.g., for JavaScript-heavy sites that curl_cffi can't handle).
        """
        crawler = await self._get_crawler()
        if crawler is None:
            return None

        try:
            result = await crawler.arun(url=url)

            if not result.success:
                logger.warning(f"Crawl4AI HTML fetch failed for {url}")
                self.last_error = result.error_message
                return None

            html = result.html
            if not html or len(html) < 500:
                self.last_error = "Insufficient HTML"
                return None

            self.last_error = None
            return html

        except Exception as e:
            logger.warning(f"Crawl4AI HTML error for {url}: {e}")
            self.last_error = str(e)[:200]
            return None

    async def close(self) -> None:
        """Clean up Crawl4AI resources."""
        if self._crawler:
            try:
                await self._crawler.close()
            except Exception:
                pass
            self._crawler = None
