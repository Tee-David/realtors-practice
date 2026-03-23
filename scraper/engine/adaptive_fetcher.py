"""Adaptive fetcher with 4-layer cognitive loop fallback chain.

The cognitive loop architecture ("try fast, fall back smart, learn forever"):

Layer 1: JSON-LD / Structured Data (handled by UniversalExtractor, not here)
Layer 2: Scrapling StealthyFetcher (anti-bot bypass + adaptive self-healing selectors)
Layer 3: Crawl4AI + Gemini Flash (page → Markdown → LLM structured extraction)
Layer 4: Playwright + stealth (full browser fingerprint spoofing for hardest sites)

Each layer is progressively more capable (and slower). When Layer 3 succeeds but
Layer 2 failed, the self-healing loop discovers new CSS selectors and caches them
so future scrapes use fast Layer 2 instead of expensive Layer 3.
"""

import asyncio
import hashlib
import random
import re
import threading
from http.cookiejar import CookieJar
from typing import Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from config import config
from utils.logger import get_logger
from utils.rate_limiter import rate_limiter
from utils.user_agents import get_random_headers, get_random_ua

logger = get_logger(__name__)

# Patterns that indicate a captcha / block page
BLOCK_PATTERNS = [
    re.compile(r"captcha", re.IGNORECASE),
    re.compile(r"cf-challenge", re.IGNORECASE),
    re.compile(r"challenge-platform", re.IGNORECASE),
    re.compile(r"cf-turnstile", re.IGNORECASE),
    re.compile(r"recaptcha", re.IGNORECASE),
    re.compile(r"hCaptcha", re.IGNORECASE),
    re.compile(r"Access\s+Denied", re.IGNORECASE),
    re.compile(r"blocked\s+your\s+access", re.IGNORECASE),
    re.compile(r"unusual\s+traffic", re.IGNORECASE),
    re.compile(r"are\s+you\s+a\s+robot", re.IGNORECASE),
    re.compile(r"verify\s+you\s+are\s+human", re.IGNORECASE),
    re.compile(r"bot\s+detection", re.IGNORECASE),
    re.compile(r"please\s+complete\s+the\s+security\s+check", re.IGNORECASE),
    re.compile(r"just\s+a\s+moment", re.IGNORECASE),
    re.compile(r"checking\s+your\s+browser", re.IGNORECASE),
]

# Comprehensive stealth script for Playwright
STEALTH_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
delete navigator.__proto__.webdriver;
window.chrome = {
    runtime: {
        onMessage: { addListener: function() {}, removeListener: function() {} },
        sendMessage: function() {},
        connect: function() { return { onMessage: { addListener: function() {} }, postMessage: function() {} }; }
    },
    loadTimes: function() { return {}; },
    csi: function() { return {}; },
    app: { isInstalled: false, getDetails: function() {}, getIsInstalled: function() { return false; }, installState: function() { return 'disabled'; } }
};
Object.defineProperty(navigator, 'plugins', {
    get: () => {
        const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        plugins.length = 3;
        return plugins;
    }
});
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'en-NG'] });
Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
if (navigator.connection) {
    Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 });
}
if (navigator.permissions) {
    const originalPermQuery = navigator.permissions.query;
    navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications'
            ? Promise.resolve({ state: 'default', onchange: null })
            : originalPermQuery(parameters)
    );
}
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) return 'Intel Inc.';
    if (parameter === 37446) return 'Intel Iris OpenGL Engine';
    return getParameter.call(this, parameter);
};
try {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function() { return window; }
    });
} catch(e) {}
const nativeToString = Function.prototype.toString;
const customFunctions = new Set();
Function.prototype.toString = function() {
    if (customFunctions.has(this)) {
        return 'function ' + this.name + '() { [native code] }';
    }
    return nativeToString.call(this);
};
"""


# Accept-Language header variants for fingerprint randomization
_ACCEPT_LANG_VARIANTS = [
    "en-US,en;q=0.9",
    "en-US,en;q=0.9,en-NG;q=0.8",
    "en-GB,en;q=0.9",
    "en-GB,en-US;q=0.9,en;q=0.8",
    "en-NG,en;q=0.9,en-US;q=0.8",
    "en-US,en-GB;q=0.9,en;q=0.8",
    "en-NG,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
]

# Sec-Ch-Ua header variants (different Chrome version numbers)
_SEC_CH_UA_VARIANTS = [
    '"Not_A Brand";v="8", "Chromium";v="131", "Google Chrome";v="131"',
    '"Not_A Brand";v="8", "Chromium";v="130", "Google Chrome";v="130"',
    '"Not_A Brand";v="8", "Chromium";v="129", "Google Chrome";v="129"',
    '"Not_A Brand";v="8", "Chromium";v="128", "Google Chrome";v="128"',
    '"Not_A Brand";v="24", "Chromium";v="131", "Google Chrome";v="131"',
    '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
    '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="24"',
]


def _random_viewport() -> dict:
    """Generate a random but realistic viewport size."""
    width = random.randint(1280, 1920)
    # Round to common increments (multiples of 20)
    width = (width // 20) * 20
    height = random.randint(720, 1080)
    height = (height // 20) * 20
    return {"width": width, "height": height}


def _page_fingerprint(html: str) -> str:
    """Compute a content fingerprint for duplicate page detection.

    Extracts visible text from the body, normalizes whitespace, and hashes
    the first 5000 chars. Two pages with the same fingerprint have
    identical visible content (even if raw HTML differs slightly).
    """
    try:
        soup = BeautifulSoup(html, "lxml")
        # Remove scripts/styles that don't contribute to visible content
        for tag in soup.find_all(["script", "style", "noscript"]):
            tag.decompose()
        text = (soup.body or soup).get_text(separator=" ", strip=True)
    except Exception:
        # Fallback: strip tags naively
        text = re.sub(r"<[^>]+>", " ", html)
    # Normalize whitespace and take first 5000 chars
    text = re.sub(r"\s+", " ", text).strip()[:5000]
    return hashlib.md5(text.encode("utf-8", errors="ignore")).hexdigest()


class AdaptiveFetcher:
    """Fetches web pages with automatic multi-layer fallback.

    Cognitive loop fallback chain:
    1. curl_cffi (Chrome TLS fingerprint — fastest, handles basic Cloudflare)
    2. Scrapling StealthyFetcher (anti-bot bypass, adaptive selectors)
    3. Crawl4AI (page → clean Markdown for LLM extraction)
    4. Playwright + stealth (full browser for JS-rendered content)
    """

    def __init__(self):
        self._curl_session = None
        self._scrapling_fetcher = None
        self._crawl4ai_fetcher = None
        self._browser = None
        self._browser_context = None
        self._playwright = None
        self.last_block_reason: Optional[str] = None
        self._consecutive_blocks = 0
        self._last_successful_layer: Optional[str] = None
        # Per-site layer memory: domain → layer name that worked last
        self._site_preferred_layer: dict[str, str] = {}
        # Proxy round-robin state
        self._proxy_index = 0
        self._proxy_lock = threading.Lock()
        # Session cookie persistence keyed by domain
        self._session_cookies: dict[str, dict[str, str]] = {}

    @property
    def last_successful_layer(self) -> Optional[str]:
        """Which layer last succeeded (for per-site tracking)."""
        return self._last_successful_layer

    # ── Proxy rotation ──

    def _next_proxy(self) -> str | None:
        """Round-robin through configured proxy URLs."""
        if not config.proxy_urls:
            return None
        with self._proxy_lock:
            proxy = config.proxy_urls[self._proxy_index % len(config.proxy_urls)]
            self._proxy_index += 1
            return proxy

    def _get_domain_cookies(self, url: str) -> dict[str, str]:
        """Return persisted session cookies for a domain."""
        domain = urlparse(url).netloc
        return self._session_cookies.get(domain, {})

    def _save_domain_cookies(self, url: str, cookies: dict[str, str]) -> None:
        """Merge new cookies into per-domain session storage."""
        domain = urlparse(url).netloc
        existing = self._session_cookies.setdefault(domain, {})
        existing.update(cookies)

    def _randomized_headers(self) -> dict[str, str]:
        """Build headers with randomized fingerprint values."""
        headers = get_random_headers()
        headers["Accept-Language"] = random.choice(_ACCEPT_LANG_VARIANTS)
        headers["Sec-Ch-Ua"] = random.choice(_SEC_CH_UA_VARIANTS)
        headers["Sec-Ch-Ua-Mobile"] = "?0"
        headers["Sec-Ch-Ua-Platform"] = '"Windows"'
        return headers

    # ── Layer helpers ──

    def _get_curl_session(self):
        """Lazy-init curl_cffi session."""
        if self._curl_session is not None:
            return self._curl_session
        try:
            from curl_cffi.requests import AsyncSession
            proxy = self._next_proxy()
            self._curl_session = AsyncSession(
                impersonate="chrome",
                timeout=25,
                allow_redirects=True,
                max_redirects=5,
                verify=False,
                proxies={"http": proxy, "https": proxy} if proxy else None,
            )
            return self._curl_session
        except ImportError:
            logger.debug("curl_cffi not installed")
            return None

    def _get_scrapling(self):
        """Lazy-init Scrapling fetcher."""
        if self._scrapling_fetcher is not None:
            return self._scrapling_fetcher
        try:
            from engine.scrapling_fetcher import ScraplingFetcher
            self._scrapling_fetcher = ScraplingFetcher()
            return self._scrapling_fetcher
        except ImportError:
            logger.debug("scrapling not available")
            return None

    def _get_crawl4ai(self):
        """Lazy-init Crawl4AI fetcher."""
        if self._crawl4ai_fetcher is not None:
            return self._crawl4ai_fetcher
        try:
            from engine.crawl4ai_fetcher import Crawl4AIFetcher
            self._crawl4ai_fetcher = Crawl4AIFetcher()
            return self._crawl4ai_fetcher
        except ImportError:
            logger.debug("crawl4ai not available")
            return None

    async def _get_browser(self):
        """Lazy-init Playwright browser with stealth."""
        if self._browser_context:
            return self._browser_context

        from playwright.async_api import async_playwright

        self._playwright = await async_playwright().start()

        launch_args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-infobars",
            "--disable-extensions",
            "--disable-gpu",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            "--disable-features=IsolateOrigins,site-per-process",
            "--start-maximized",
            "--window-size=1920,1080",
        ]

        proxy = self._next_proxy()
        proxy_settings = {"server": proxy} if proxy else None

        self._browser = await self._playwright.chromium.launch(
            headless=config.headless,
            args=launch_args,
        )

        ua = get_random_ua()
        viewport = {"width": 1500, "height": 900}
        accept_lang = random.choice(_ACCEPT_LANG_VARIANTS)
        sec_ch_ua = random.choice(_SEC_CH_UA_VARIANTS)
        self._browser_context = await self._browser.new_context(
            user_agent=ua,
            viewport=viewport,
            screen=viewport,
            locale="en-NG",
            timezone_id="Africa/Lagos",
            proxy=proxy_settings,
            java_script_enabled=True,
            has_touch=False,
            is_mobile=False,
            color_scheme="light",
            ignore_https_errors=True,
            extra_http_headers={
                "Accept-Language": accept_lang,
                "Accept-Encoding": "gzip, deflate, br",
                "Sec-Ch-Ua": sec_ch_ua,
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
            },
        )

        await self._browser_context.add_init_script(STEALTH_SCRIPT)

        # Block images, media, and fonts for faster page loads
        await self._browser_context.route(
            "**/*",
            lambda route, request: (
                route.abort()
                if request.resource_type in ("image", "media", "font")
                else route.continue_()
            ),
        )

        return self._browser_context

    # ── Main fetch method ──

    async def fetch(self, url: str, requires_js: bool = False) -> Optional[str]:
        """Fetch a URL with adaptive multi-layer fallback.

        Layer order (fast-first — most sites serve usable HTML without JS):
        1. curl_cffi — fast HTTP with Chrome TLS fingerprint (3-5s)
        2. Scrapling — anti-bot bypass (5-10s)
        3. Playwright + stealth — full browser for JS-rendered SPAs (30-60s)

        Per-site layer memory: if a layer worked for this domain before,
        try it first to skip slower fallbacks on subsequent pages.
        """
        MAX_HTML_SIZE = 10_000_000  # 10MB — reject absurdly large pages
        await rate_limiter.wait(url)

        domain = urlparse(url).netloc

        # Back off if getting blocked repeatedly
        if self._consecutive_blocks >= 3:
            backoff = min(self._consecutive_blocks * 5, 30)
            logger.info(f"Backing off {backoff}s due to {self._consecutive_blocks} consecutive blocks")
            await asyncio.sleep(backoff)

        # Track per-layer failures for diagnostic logging
        layer_errors: list[str] = []

        # Define layer execution order: curl_cffi (fast) → playwright (JS) → scrapling (fallback)
        layers = [
            ("curl_cffi", self._fetch_curl),
            ("playwright", self._fetch_playwright),
            ("scrapling", self._try_scrapling),
        ]

        # If we know which layer works for this domain, try it first
        preferred = self._site_preferred_layer.get(domain)
        if preferred:
            # Move preferred layer to front
            layers.sort(key=lambda x: 0 if x[0] == preferred else 1)

        # If requires_js is explicitly set, try Playwright first
        if requires_js and not preferred:
            layers.sort(key=lambda x: 0 if x[0] == "playwright" else 1)

        for layer_name, layer_fn in layers:
            html = await layer_fn(url)

            if html and len(html) > MAX_HTML_SIZE:
                logger.warning(f"Page too large ({len(html)} bytes), skipping: {url}")
                return None

            if html and len(html) > 500:
                block_reason = self._is_blocked(html)
                if not block_reason:
                    self._consecutive_blocks = 0
                    self._last_successful_layer = layer_name
                    self._site_preferred_layer[domain] = layer_name
                    return html
                layer_errors.append(f"{layer_name}: blocked ({block_reason})")
            else:
                reason = "empty response" if not html else f"too short ({len(html)} chars)"
                layer_errors.append(f"{layer_name}: {reason}")

        logger.warning(f"All fetch layers failed for {url} — {'; '.join(layer_errors)}")
        return None

    async def _try_scrapling(self, url: str) -> Optional[str]:
        """Wrapper for scrapling fetch that handles unavailability."""
        scrapling = self._get_scrapling()
        if scrapling is None:
            return None
        return await scrapling.fetch(url)

    async def fetch_as_markdown(self, url: str) -> Optional[str]:
        """Fetch a URL and return clean Markdown via Crawl4AI.

        Used for the LLM extraction pipeline (Layer 3 of the cognitive loop).
        When CSS selectors fail, this converts the page to Markdown and passes
        it to Gemini Flash for structured extraction.
        """
        crawl4ai = self._get_crawl4ai()
        if crawl4ai is None:
            return None
        return await crawl4ai.fetch_as_markdown(url)

    # ── Layer implementations ──

    @staticmethod
    def _is_blocked(html: str) -> Optional[str]:
        """Detect if the response is a captcha/block page."""
        if not html or len(html) < 100:
            return None
        snippet = html[:10000]
        for pattern in BLOCK_PATTERNS:
            match = pattern.search(snippet)
            if match:
                return match.group(0)
        if len(html) < 5000 and "<title>Just a moment...</title>" in html:
            return "Cloudflare challenge page"
        return None

    async def _fetch_curl(self, url: str) -> Optional[str]:
        """HTTP GET using curl_cffi with Chrome TLS fingerprint."""
        session = self._get_curl_session()
        if session is None:
            return await self._fetch_httpx(url)

        try:
            headers = self._randomized_headers()
            domain = urlparse(url).netloc
            headers["Referer"] = f"https://{domain}/"

            # Attach persisted session cookies for this domain
            domain_cookies = self._get_domain_cookies(url)
            if domain_cookies:
                headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in domain_cookies.items())

            resp = await session.get(url, headers=headers)

            if resp.status_code in (403, 401):
                logger.warning(f"curl_cffi {resp.status_code} for {url}")
                self.last_block_reason = f"{resp.status_code} Forbidden"
                self._consecutive_blocks += 1
                return None
            if resp.status_code == 429:
                logger.warning(f"curl_cffi 429 Rate Limited for {url}")
                self.last_block_reason = "429 Rate Limited"
                self._consecutive_blocks += 1
                return None
            if resp.status_code == 200:
                text = resp.text
                block_reason = self._is_blocked(text)
                if block_reason:
                    logger.warning(f"Block detected ({block_reason}) for {url}")
                    self.last_block_reason = block_reason
                    self._consecutive_blocks += 1
                    return None
                self.last_block_reason = None
                # Persist cookies from response
                if hasattr(resp, 'cookies') and resp.cookies:
                    self._save_domain_cookies(url, dict(resp.cookies))
                return text

            logger.debug(f"curl_cffi {resp.status_code} for {url}")
            return None
        except Exception as e:
            logger.debug(f"curl_cffi fetch error for {url}: {e}")
            return None

    async def _fetch_httpx(self, url: str) -> Optional[str]:
        """Fallback HTTP GET with httpx."""
        import httpx
        try:
            proxy = self._next_proxy()
            async with httpx.AsyncClient(
                timeout=20.0,
                follow_redirects=True,
                proxy=proxy,
                verify=False,
            ) as client:
                headers = self._randomized_headers()
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    block_reason = self._is_blocked(resp.text)
                    if block_reason:
                        self.last_block_reason = block_reason
                        self._consecutive_blocks += 1
                        return None
                    self.last_block_reason = None
                    return resp.text
                return None
        except Exception as e:
            logger.debug(f"httpx fetch error for {url}: {e}")
            return None

    async def _fetch_playwright(self, url: str) -> Optional[str]:
        """Fetch with Playwright + stealth for JS-rendered content.

        1. Navigate to URL with networkidle wait
        2. Accept cookies/dismiss overlays
        3. Wait for JS framework hydration (React/Next/Angular)
        4. Wait for list-ready selectors
        5. Scroll to trigger lazy-loaded content
        6. Return fully-rendered HTML
        """
        try:
            context = await self._get_browser()
            page = await context.new_page()

            try:
                await asyncio.sleep(random.uniform(0.3, 0.8))

                # Use networkidle to wait for AJAX/fetch requests to complete
                # Fall back to domcontentloaded if networkidle times out
                try:
                    response = await page.goto(
                        url,
                        wait_until="networkidle",
                        timeout=config.browser_timeout,
                    )
                except Exception:
                    response = await page.goto(
                        url,
                        wait_until="domcontentloaded",
                        timeout=config.browser_timeout,
                    )

                if response and response.status in (403, 401, 429):
                    logger.warning(f"Playwright HTTP {response.status} for {url}")
                    self.last_block_reason = f"Playwright HTTP {response.status}"
                    self._consecutive_blocks += 1
                    return None

                await self._wait_for_cloudflare(page)
                await self._dismiss_overlays(page)

                # Wait for SPA hydration — key for React/Next.js/Angular sites
                await self._wait_for_hydration(page)

                await self._wait_for_list_ready(page)
                await self._human_scroll(page)

                # Second hydration check after scroll (lazy-load triggers)
                await page.wait_for_timeout(1500)

                html = await page.content()

                block_reason = self._is_blocked(html)
                if block_reason:
                    logger.warning(f"Block after Playwright ({block_reason}) for {url}")
                    self.last_block_reason = f"Playwright: {block_reason}"
                    self._consecutive_blocks += 1
                    return None

                self.last_block_reason = None
                return html

            finally:
                await page.close()

        except Exception as e:
            logger.warning(f"Playwright fetch error for {url}: {e}")
            return None

    async def _wait_for_hydration(self, page) -> None:
        """Wait for SPA frameworks to hydrate (React, Next.js, Angular, Vue).

        Checks for actual rendered content rather than just DOM structure.
        Many Nigerian property sites use Next.js or React and need time
        for client-side JS to populate the page content.
        """
        try:
            # Wait for common SPA hydration signals
            hydration_checks = [
                # React: __NEXT_DATA__ or __NUXT__ populated
                "() => document.querySelector('#__next')?.children?.length > 1",
                # General: body has substantial text content
                "() => document.body?.innerText?.length > 500",
                # Cards/articles rendered
                "() => document.querySelectorAll('article, [class*=\"card\"], [class*=\"listing\"], [class*=\"property\"]').length > 2",
            ]
            for check in hydration_checks:
                try:
                    await page.wait_for_function(check, timeout=8000)
                    return
                except Exception:
                    continue

            # Final fallback: wait a bit for any remaining JS execution
            await page.wait_for_timeout(3000)
        except Exception:
            pass

    async def _wait_for_cloudflare(self, page) -> None:
        """Wait for Cloudflare challenge to resolve (up to 15s)."""
        try:
            title = await page.title()
            if "just a moment" in title.lower() or "checking" in title.lower():
                logger.info("Cloudflare challenge detected, waiting...")
                for _ in range(15):
                    await page.wait_for_timeout(1000)
                    title = await page.title()
                    if "just a moment" not in title.lower() and "checking" not in title.lower():
                        logger.info("Cloudflare challenge resolved")
                        await page.wait_for_timeout(1000)
                        return
                logger.warning("Cloudflare challenge did not resolve in 15s")
        except Exception:
            pass

    async def _wait_for_list_ready(self, page) -> None:
        """Wait for property listing content to appear on the page.

        Uses a combined CSS selector to race all listing selectors at once
        (instead of trying each sequentially which can take minutes).
        """
        # Race all listing selectors at once with a single wait
        combined_selector = ", ".join([
            "[data-testid*='listing']",
            ".property-list", ".property-listing", ".listing", ".listings",
            ".property-grid",
            ".results", ".search-results", ".searchResult", ".cards",
            "[class*='property']", "[class*='listing']",
            "[class*='PropertyCard']", "[class*='propertyCard']",
            "[class*='ListingCard']", "[class*='listingCard']",
            "article", ".card", "main",
        ])
        try:
            await page.wait_for_selector(combined_selector, timeout=10000, state="visible")
            return
        except Exception:
            pass

        # Final fallback: wait for meaningful text content
        try:
            await page.wait_for_function(
                "() => document.body?.innerText?.length > 1000",
                timeout=5000,
            )
        except Exception:
            await page.wait_for_timeout(2000)

    async def _human_scroll(self, page, steps: int = 12) -> None:
        """Deep scroll to trigger lazy-loaded content.

        Ported from old scraper: 12 steps of mouse.wheel(0, 1200) covers
        the full page depth, triggering infinite-scroll and lazy-load
        content that lighter scrolling misses.
        """
        try:
            for i in range(steps):
                await page.mouse.wheel(0, 1200)
                await page.wait_for_timeout(random.randint(300, 500))
            # Small pause after scrolling to let final lazy-loads complete
            await page.wait_for_timeout(1000)
        except Exception:
            pass

    async def _dismiss_overlays(self, page) -> None:
        """Try to dismiss common cookie/consent/popup overlays."""
        dismiss_selectors = [
            "button:has-text('Accept')",
            "button:has-text('Accept All')",
            "button:has-text('I Agree')",
            "button:has-text('Got it')",
            "button:has-text('OK')",
            "button:has-text('Allow')",
            "button:has-text('Close')",
            "[id*='cookie'] button",
            "[class*='cookie'] button",
            "[id*='consent'] button",
            "[class*='consent'] button",
            "[class*='gdpr'] button",
            ".modal .close",
            "[class*='modal'] [class*='close']",
            "[aria-label='Close']",
            "button[class*='dismiss']",
            "[class*='popup'] button",
            "[class*='banner'] button",
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

    # ── Browser-session pagination (ported from old scraper) ──

    # "Next" button selectors for in-browser pagination
    _NEXT_SELECTORS = [
        "a[rel='next']",
        "button[aria-label*='Next' i], a[aria-label*='Next' i]",
        "a.page-next, a.next, .pagination-next a, .pager-next a",
        "li.next a, li.pagination-next a, .paginate_button.next",
        "a:has-text('Next')", "button:has-text('Next')",
        "a:has-text('»')", "a:has-text('›')",
    ]

    async def render_and_collect_pages(
        self,
        start_url: str,
        max_pages: int = 30,
    ) -> list[tuple[str, str]]:
        """Drive Playwright through paginated listing pages in a single session.

        Keeps the browser alive across all pages so session state, cookies,
        and JS context persist.

        Strategy order:
        1. Click "Next" buttons within the page
        2. Discover and follow numeric page links
        3. Fall back to ?page=N / /page/N URL patterns

        Returns:
            List of (url, html) tuples for each page visited.
        """
        results: list[tuple[str, str]] = []
        seen_fingerprints: set[str] = set()
        try:
            context = await self._get_browser()
            page = await context.new_page()

            try:
                # PAGE 1
                logger.info(f"render_pages: navigating to {start_url}")
                try:
                    response = await page.goto(
                        start_url,
                        wait_until="networkidle",
                        timeout=45000,
                    )
                except Exception:
                    response = await page.goto(
                        start_url,
                        wait_until="domcontentloaded",
                        timeout=45000,
                    )
                if response:
                    logger.info(f"render_pages: HTTP {response.status} for {start_url}")
                    if response.status in (403, 401, 429):
                        return results

                await self._wait_for_cloudflare(page)
                await self._dismiss_overlays(page)
                await self._wait_for_hydration(page)
                await self._wait_for_list_ready(page)
                await self._human_scroll(page)
                await page.wait_for_timeout(1000)

                html = await page.content()
                logger.info(f"render_pages: page 1 HTML length = {len(html)}")
                block_reason = self._is_blocked(html)
                if block_reason:
                    logger.warning(f"render_pages: page 1 blocked ({block_reason})")
                else:
                    fp = _page_fingerprint(html)
                    seen_fingerprints.add(fp)
                    results.append((page.url, html))

                # Pagination — wrap in a timeout so page 1 always gets returned
                # even if pagination strategies are slow
                PAGINATION_TIMEOUT = 180  # 3 minutes max for pagination
                pages_visited = 1

                async def _paginate():
                    nonlocal pages_visited

                    # Strategy A: Click "Next" button repeatedly
                    while pages_visited < max_pages:
                        clicked = await self._click_next_button(page)
                        if not clicked:
                            logger.debug(f"render_pages: no Next button found after page {pages_visited}")
                            break
                        await self._wait_for_list_ready(page)
                        await self._human_scroll(page)
                        html = await page.content()
                        if not self._is_blocked(html):
                            fp = _page_fingerprint(html)
                            if fp in seen_fingerprints:
                                logger.info(f"render_pages: duplicate page detected at page {pages_visited + 1}, stopping pagination")
                                break
                            seen_fingerprints.add(fp)
                            results.append((page.url, html))
                        pages_visited += 1
                        logger.info(f"render_pages: collected page {pages_visited} via Next button")

                    # Strategy B: Numeric page links (if "Next" button only got page 1)
                    if pages_visited == 1:
                        logger.info("render_pages: trying numeric page links")
                        numeric_urls = await self._discover_numeric_pages(page)
                        logger.info(f"render_pages: found {len(numeric_urls)} numeric page links")
                        for num_url in numeric_urls[: max_pages - pages_visited]:
                            try:
                                await page.goto(num_url, wait_until="domcontentloaded", timeout=40000)
                                await self._wait_for_list_ready(page)
                                await self._human_scroll(page)
                                html = await page.content()
                                if not self._is_blocked(html):
                                    fp = _page_fingerprint(html)
                                    if fp in seen_fingerprints:
                                        logger.info(f"render_pages: duplicate page detected (numeric), stopping")
                                        break
                                    seen_fingerprints.add(fp)
                                    results.append((page.url, html))
                                pages_visited += 1
                            except Exception as e:
                                logger.debug(f"render_pages: numeric page error: {e}")
                                continue

                    # Strategy C: URL param fallback (?page=N, /page/N)
                    if pages_visited == 1:
                        logger.info("render_pages: trying URL param pagination")
                        base = start_url.rstrip("/")
                        joiner = "&" if "?" in start_url else "?"
                        for n in range(2, min(max_pages + 1, 6)):
                            candidates = [
                                f"{start_url}{joiner}page={n}",
                                f"{base}/page/{n}",
                            ]
                            found = False
                            for candidate_url in candidates:
                                try:
                                    await page.goto(candidate_url, wait_until="domcontentloaded", timeout=35000)
                                    await self._wait_for_list_ready(page)
                                    await self._human_scroll(page)
                                    html = await page.content()
                                    if html and len(html) > 2000 and not self._is_blocked(html):
                                        fp = _page_fingerprint(html)
                                        if fp in seen_fingerprints:
                                            logger.info(f"render_pages: duplicate page detected (URL param), stopping")
                                            found = False
                                            break
                                        seen_fingerprints.add(fp)
                                        results.append((page.url, html))
                                        pages_visited += 1
                                        found = True
                                        break
                                except Exception:
                                    continue
                            if not found:
                                break

                try:
                    await asyncio.wait_for(_paginate(), timeout=PAGINATION_TIMEOUT)
                except asyncio.TimeoutError:
                    logger.warning(f"render_pages: pagination timed out after {PAGINATION_TIMEOUT}s — returning {len(results)} page(s)")

                logger.info(f"render_and_collect_pages: collected {len(results)} unique pages from {start_url}")

            finally:
                await page.close()

        except Exception as e:
            logger.error(f"render_and_collect_pages error for {start_url}: {e}", exc_info=True)

        return results

    async def collect_pages_fast(
        self,
        start_url: str,
        max_pages: int = 10,
    ) -> list[tuple[str, str]]:
        """Fast pagination using curl_cffi with URL-pattern discovery.

        Tries URL-pattern pagination (?page=N, /page/N) using fast HTTP
        instead of driving a full browser. Falls back to render_and_collect_pages()
        if curl_cffi pages look empty or blocked.

        Returns list of (url, html) tuples.
        """
        results: list[tuple[str, str]] = []
        seen_fingerprints: set[str] = set()

        # Fetch page 1
        html = await self._fetch_curl(start_url)
        if not html or len(html) < 500 or self._is_blocked(html):
            # curl_cffi didn't work — fall back to browser
            return await self.render_and_collect_pages(start_url, max_pages)

        fp = _page_fingerprint(html)
        seen_fingerprints.add(fp)
        results.append((start_url, html))

        # Discover pagination pattern from page 1 HTML
        # Try common URL patterns for page 2
        base = start_url.rstrip("/")
        joiner = "&" if "?" in start_url else "?"
        page2_candidates = [
            f"{start_url}{joiner}page=2",
            f"{base}/page/2",
        ]

        # Also look for <a rel="next"> or page links in HTML
        try:
            soup = BeautifulSoup(html, "lxml")
            next_link = soup.find("a", rel="next")
            if next_link and next_link.get("href"):
                from urllib.parse import urljoin
                next_url = urljoin(start_url, next_link["href"])
                page2_candidates.insert(0, next_url)

                # Infer pattern from next link
                next_href = next_link["href"]
                import re as _re
                # e.g. ?page=2 → ?page={n}
                m = _re.search(r'[?&]page=(\d+)', next_href)
                if m:
                    page_param_pattern = next_href.replace(f"page={m.group(1)}", "page={n}")
                    for n in range(3, max_pages + 1):
                        url = urljoin(start_url, page_param_pattern.replace("{n}", str(n)))
                        page2_candidates.append(url)
        except Exception:
            pass

        # Try fetching subsequent pages
        working_pattern: str | None = None

        for candidate_url in page2_candidates:
            if len(results) >= max_pages:
                break

            p2_html = await self._fetch_curl(candidate_url)
            if p2_html and len(p2_html) > 2000 and not self._is_blocked(p2_html):
                p2_fp = _page_fingerprint(p2_html)
                if p2_fp not in seen_fingerprints:
                    seen_fingerprints.add(p2_fp)
                    results.append((candidate_url, p2_html))

                    # Found working pattern — continue with it
                    if "page=" in candidate_url:
                        # URL param pattern works
                        import re as _re
                        m = _re.search(r'[?&]page=(\d+)', candidate_url)
                        if m:
                            working_pattern = candidate_url.replace(f"page={m.group(1)}", "page={n}")
                            break
                    elif "/page/" in candidate_url:
                        working_pattern = candidate_url.replace("/page/2", "/page/{n}")
                        break
                else:
                    # Duplicate page — this pattern loops
                    continue

        # If we found a working pattern, fetch remaining pages
        if working_pattern and len(results) < max_pages:
            start_n = 3  # Already have pages 1 and 2
            for n in range(start_n, max_pages + 1):
                if len(results) >= max_pages:
                    break
                page_url = working_pattern.replace("{n}", str(n))
                page_html = await self._fetch_curl(page_url)
                if not page_html or len(page_html) < 2000 or self._is_blocked(page_html):
                    break  # No more pages
                page_fp = _page_fingerprint(page_html)
                if page_fp in seen_fingerprints:
                    break  # Duplicate = end of pagination
                seen_fingerprints.add(page_fp)
                results.append((page_url, page_html))

        # If we only got page 1 with curl_cffi, fall back to browser pagination
        if len(results) <= 1 and max_pages > 1:
            logger.info(f"collect_pages_fast: curl_cffi got only {len(results)} page(s), falling back to browser")
            browser_results = await self.render_and_collect_pages(start_url, max_pages)
            if len(browser_results) > len(results):
                return browser_results

        logger.info(f"collect_pages_fast: collected {len(results)} pages from {start_url}")
        return results

    async def _click_next_button(self, page) -> bool:
        """Try clicking a 'Next' pagination control. Returns True if navigation happened."""
        for selector in self._NEXT_SELECTORS:
            try:
                loc = page.locator(selector).first
                if await loc.is_visible(timeout=1000) and await loc.is_enabled(timeout=500):
                    # Wait for navigation after clicking
                    async with page.expect_navigation(wait_until="domcontentloaded", timeout=15000):
                        await loc.click()
                    return True
            except Exception:
                continue
        return False

    async def _discover_numeric_pages(self, page) -> list[str]:
        """Find numbered pagination links on the current page."""
        try:
            from urllib.parse import urljoin
            urls = []
            anchors = page.locator("a[href]")
            count = min(await anchors.count(), 2000)
            base = page.url
            for i in range(count):
                a = anchors.nth(i)
                href = await a.get_attribute("href") or ""
                if not href:
                    continue
                txt = (await a.inner_text() or "").strip()
                if any(c.isdigit() for c in txt) and any(
                    kw in href for kw in ("page", "/p/", "/pg/", "/page/")
                ):
                    urls.append(urljoin(base, href))
            # Deduplicate preserving order
            seen = set()
            out = []
            for u in urls:
                if u not in seen:
                    out.append(u)
                    seen.add(u)
            return out[:30]
        except Exception:
            return []

    async def close(self) -> None:
        """Clean up all resources."""
        try:
            if self._browser_context:
                await self._browser_context.close()
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
            if self._curl_session:
                await self._curl_session.close()
            if self._scrapling_fetcher:
                await self._scrapling_fetcher.close()
            if self._crawl4ai_fetcher:
                await self._crawl4ai_fetcher.close()
        except Exception as e:
            logger.debug(f"Cleanup error: {e}")
