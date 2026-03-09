import asyncio
import random
from urllib.parse import urlparse
from typing import Optional, Dict, Any

from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Error as PlaywrightError
from config import config
from utils.logger import get_logger

logger = get_logger(__name__)

class PageRenderer:
    """Wrapper around Playwright to handle JS rendering, stealth, and resource blocking."""
    
    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        
    async def initialize(self):
        """Initialize Playwright and launch the browser."""
        if not self.playwright:
            self.playwright = await async_playwright().start()
            
        if not self.browser:
            launch_args = {
                "headless": config.headless,
                "args": [
                    "--disable-blink-features=AutomationControlled",
                    "--disable-features=IsolateOrigins,site-per-process",
                    "--disable-site-isolation-trials",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--no-first-run",
                    "--no-zygote",
                    "--use-gl=egl",
                ]
            }
            
            if config.proxy_url:
                launch_args["proxy"] = {"server": config.proxy_url}
                logger.info(f"Playwright configured with proxy: {config.proxy_url}")
                
            self.browser = await self.playwright.chromium.launch(**launch_args)
            logger.info("Playwright browser initialized")

    async def _create_context(self, user_agent: str, headers: Dict[str, str] = None) -> BrowserContext:
        """Create a new browser context with stealth properties."""
        context_args = {
            "user_agent": user_agent,
            "viewport": {"width": random.randint(1366, 1920), "height": random.randint(768, 1080)},
            "device_scale_factor": 1,
            "has_touch": False,
            "is_mobile": False,
            "java_script_enabled": True,
            "timezone_id": "Africa/Lagos", # Contextual to Nigeria real estate
            "geolocation": {"longitude": 3.3792, "latitude": 6.5244}, # Lagos roughly
            "permissions": ["geolocation"],
            "extra_http_headers": headers or {}
        }
        
        context = await self.browser.new_context(**context_args)
        
        # Stealth: Overwrite navigator.webdriver and other detection vectors
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            window.chrome = { runtime: {} };
        """)
        
        return context

    async def _block_resources(self, route):
        """Route handler to block non-essential resources for speed."""
        excluded_types = ["image", "media", "font", "stylesheet", "other"]
        if route.request.resource_type in excluded_types:
            await route.abort()
        else:
            await route.continue_()

    async def render_page(
        self, 
        url: str, 
        user_agent: str, 
        wait_for_selector: Optional[str] = None,
        block_media: bool = True,
        headers: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Render a page using Playwright and return its HTML and status.
        """
        if not self.browser:
            await self.initialize()
            
        context = None
        page = None
        
        try:
            context = await self._create_context(user_agent, headers)
            page = await context.new_page()
            
            if block_media:
                await page.route("**/*", self._block_resources)
                
            logger.info(f"Playwright navigating to: {url}")
            
            # Navigate with a generous timeout, waiting for DOMContentLoaded at minimum
            response = await page.goto(
                url, 
                timeout=config.browser_timeout, 
                wait_until="domcontentloaded"
            )
            
            if not response:
                return {"success": False, "error": "No response returned from goto"}
                
            status = response.status
            
            # Random human-like delay before acting
            await page.wait_for_timeout(random.randint(1500, 3500))
            
            # Wait for specific selector if requested (e.g. property prices finishing rendering)
            if wait_for_selector:
                try:
                    await page.wait_for_selector(
                        wait_for_selector, 
                        timeout=5000, 
                        state="attached"
                    )
                except PlaywrightError as e:
                    logger.warning(f"Timeout waiting for selector '{wait_for_selector}' on {url}: {e}")
                    # We still continue, as the page might have partial content
            
            # Simulate a quick human scroll
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight/3)")
            await page.wait_for_timeout(random.randint(500, 1000))
            
            html = await page.content()
            
            return {
                "success": status < 400,
                "html": html,
                "status": status,
                "url": page.url # Capture actual URL in case of redirects
            }

        except PlaywrightError as e:
            logger.error(f"Playwright error rendering {url}: {e}")
            return {"success": False, "error": str(e), "status": 0}
        except Exception as e:
            logger.error(f"Unexpected error rendering {url}: {e}")
            return {"success": False, "error": str(e), "status": 0}
        finally:
            if page:
                await page.close()
            if context:
                await context.close()
                
    async def cleanup(self):
        """Close browser and playwright instances."""
        if self.browser:
            await self.browser.close()
            self.browser = None
            logger.info("Playwright browser closed")
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None

# Singleton instance
renderer = PageRenderer()
