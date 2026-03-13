"""Adaptive fetcher with fallback chain: requests -> Playwright -> proxy.

Tries the simplest method first, escalates when blocked or JS-rendered content needed.
Detects 403/captcha blocks and reports them.
"""

import asyncio
import random
import re
from typing import Optional

import httpx
from playwright.async_api import async_playwright, Browser, BrowserContext

from config import config
from utils.logger import get_logger
from utils.rate_limiter import rate_limiter
from utils.user_agents import get_random_headers, get_random_ua

logger = get_logger(__name__)

# Patterns that indicate a captcha / block page
BLOCK_PATTERNS = [
    re.compile(r"captcha", re.IGNORECASE),
    re.compile(r"cf-challenge", re.IGNORECASE),          # Cloudflare
    re.compile(r"challenge-platform", re.IGNORECASE),     # Cloudflare
    re.compile(r"recaptcha", re.IGNORECASE),
    re.compile(r"hCaptcha", re.IGNORECASE),
    re.compile(r"Access\s+Denied", re.IGNORECASE),
    re.compile(r"blocked\s+your\s+access", re.IGNORECASE),
    re.compile(r"unusual\s+traffic", re.IGNORECASE),
    re.compile(r"are\s+you\s+a\s+robot", re.IGNORECASE),
    re.compile(r"verify\s+you\s+are\s+human", re.IGNORECASE),
    re.compile(r"bot\s+detection", re.IGNORECASE),
    re.compile(r"please\s+complete\s+the\s+security\s+check", re.IGNORECASE),
]


class AdaptiveFetcher:
    """Fetches web pages with automatic fallback on failure."""

    def __init__(self):
        self._http_client = httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            limits=httpx.Limits(max_connections=10),
        )
        self._browser: Optional[Browser] = None
        self._browser_context: Optional[BrowserContext] = None
        self._playwright = None
        self.last_block_reason: Optional[str] = None

    async def _get_browser(self) -> BrowserContext:
        """Lazy-init Playwright browser with stealth settings."""
        if self._browser_context:
            return self._browser_context

        self._playwright = await async_playwright().start()

        launch_args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-infobars",
            "--disable-extensions",
            "--disable-gpu",
        ]

        proxy_settings = None
        if config.proxy_url:
            proxy_settings = {"server": config.proxy_url}

        self._browser = await self._playwright.chromium.launch(
            headless=config.headless,
            args=launch_args,
        )

        self._browser_context = await self._browser.new_context(
            user_agent=get_random_ua(),
            viewport={"width": 1920, "height": 1080},
            locale="en-NG",
            timezone_id="Africa/Lagos",
            proxy=proxy_settings,
            java_script_enabled=True,
        )

        # Stealth: override navigator.webdriver
        await self._browser_context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'en-NG'] });
            window.chrome = { runtime: {} };
        """)

        return self._browser_context

    async def fetch(self, url: str, requires_js: bool = False) -> Optional[str]:
        """Fetch a URL with adaptive fallback.

        1. If not JS-required, try plain HTTP first
        2. Fall back to Playwright if HTTP fails or JS is required
        """
        await rate_limiter.wait(url)

        if not requires_js:
            html = await self._fetch_http(url)
            if html and len(html) > 500:
                return html
            logger.debug(f"HTTP fetch insufficient for {url}, falling back to Playwright")

        return await self._fetch_playwright(url)

    @staticmethod
    def _is_blocked(html: str) -> bool:
        """Detect if the response is a captcha/block page rather than real content."""
        if not html or len(html) < 100:
            return False
        # Only check the first 5KB for efficiency
        snippet = html[:5000]
        for pattern in BLOCK_PATTERNS:
            if pattern.search(snippet):
                return True
        return False

    async def _fetch_http(self, url: str) -> Optional[str]:
        """Simple HTTP GET with rotating headers."""
        try:
            headers = get_random_headers()
            resp = await self._http_client.get(url, headers=headers)

            if resp.status_code == 403:
                logger.warning(f"HTTP 403 Forbidden for {url} — likely blocked")
                self.last_block_reason = "403 Forbidden"
                return None
            if resp.status_code == 429:
                logger.warning(f"HTTP 429 Too Many Requests for {url}")
                self.last_block_reason = "429 Rate Limited"
                return None
            if resp.status_code == 200:
                if self._is_blocked(resp.text):
                    logger.warning(f"Captcha/block page detected for {url}")
                    self.last_block_reason = "Captcha/Block page"
                    return None
                self.last_block_reason = None
                return resp.text

            logger.debug(f"HTTP {resp.status_code} for {url}")
            return None
        except Exception as e:
            logger.debug(f"HTTP fetch error for {url}: {e}")
            return None

    async def _fetch_playwright(self, url: str) -> Optional[str]:
        """Fetch with Playwright (headless Chrome) for JS-rendered content."""
        try:
            context = await self._get_browser()
            page = await context.new_page()

            try:
                # Random delay before navigation (human-like)
                await asyncio.sleep(random.uniform(0.5, 1.5))

                await page.goto(url, wait_until="domcontentloaded", timeout=config.browser_timeout)

                # Dismiss cookie/consent banners
                await self._dismiss_overlays(page)

                # Wait for content to load
                await page.wait_for_timeout(random.randint(1500, 3000))

                # Scroll down slightly (human-like)
                await page.evaluate("window.scrollBy(0, window.innerHeight * 0.3)")
                await page.wait_for_timeout(random.randint(500, 1000))

                html = await page.content()

                if self._is_blocked(html):
                    logger.warning(f"Captcha/block page detected (Playwright) for {url}")
                    self.last_block_reason = "Captcha/Block page (Playwright)"
                    return None

                self.last_block_reason = None
                return html

            finally:
                await page.close()

        except Exception as e:
            logger.warning(f"Playwright fetch error for {url}: {e}")
            return None

    async def _dismiss_overlays(self, page) -> None:
        """Try to dismiss common cookie/consent/popup overlays."""
        dismiss_selectors = [
            # Cookie consent buttons
            "button:has-text('Accept')",
            "button:has-text('Accept All')",
            "button:has-text('I Agree')",
            "button:has-text('Got it')",
            "button:has-text('OK')",
            "[id*='cookie'] button",
            "[class*='cookie'] button",
            "[id*='consent'] button",
            "[class*='consent'] button",
            # Close buttons on modals
            ".modal .close",
            "[class*='modal'] [class*='close']",
            "[aria-label='Close']",
            "button[class*='dismiss']",
        ]

        for selector in dismiss_selectors:
            try:
                el = page.locator(selector).first
                if await el.is_visible(timeout=500):
                    await el.click(timeout=1000)
                    await page.wait_for_timeout(300)
                    return
            except Exception:
                continue

    async def close(self) -> None:
        """Clean up browser and HTTP client."""
        try:
            if self._browser_context:
                await self._browser_context.close()
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
            await self._http_client.aclose()
        except Exception as e:
            logger.debug(f"Cleanup error: {e}")
