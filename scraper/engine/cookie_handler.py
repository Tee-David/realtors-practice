import asyncio
from typing import List, Optional
from playwright.async_api import Page, Error as PlaywrightError
from utils.logger import get_logger
import random

logger = get_logger(__name__)

class CookieHandler:
    """Utility to auto-dismiss common GDPR, cookie, and consent banners."""
    
    # Common selectors for "Accept All" or "Dismiss" buttons on cookie banners
    COMMON_ACCEPT_SELECTORS = [
        # IDs and Classes
        "#accept-cookies",
        "#uc-btn-accept-banner",
        ".cmp-accept-all",
        "#onetrust-accept-btn-handler",
        ".cc-allow",
        ".cookie-consent-accept",
        ".cookie-btn-accept",
        "#cookieAccept",
        
        # Data attributes and Roles
        "[data-testid='cookie-accept-button']",
        "[data-qa='accept-cookies']",
        "button[role='button'][aria-label='Accept Cookies']",
        
        # Text content (Playwright specific selectors)
        "button:has-text('Accept All')",
        "button:has-text('Accept cookies')",
        "button:has-text('I Accept')",
        "button:has-text('Got it')",
        "button:has-text('Allow all')",
        "button:has-text('Agree')",
        "a:has-text('Accept')",
    ]

    @staticmethod
    async def dismiss_banners(page: Page, selectors: Optional[List[str]] = None, timeout: int = 5000) -> bool:
        """
        Attempts to find and click a cookie acceptance button.
        Returns True if a banner was dismissed, False otherwise.
        """
        test_selectors = selectors if selectors else CookieHandler.COMMON_ACCEPT_SELECTORS
        
        for selector in test_selectors:
            try:
                # Use query_selector directly for an immediate check without throwing on timeout entirely
                element = await page.query_selector(selector)
                
                if element:
                    # Ensure element is visible before clicking
                    is_visible = await element.is_visible()
                    if is_visible:
                        logger.info(f"Found cookie banner with selector: {selector}. Attempting to dismiss.")
                        
                        # Add a tiny human-like delay before clicking
                        await page.wait_for_timeout(random.randint(400, 1200))
                        
                        await element.click(force=True) # Force click in case of absolute overlay positioning issues
                        await page.wait_for_timeout(random.randint(500, 1000)) # Wait for DOM to react
                        logger.info(f"Successfully dismissed banner using selector: {selector}")
                        return True
                        
            except PlaywrightError as e:
                # Just catch silently, many selectors won't exist on standard pages
                continue
            except Exception as e:
                logger.debug(f"Unexpected error while checking cookie selector {selector}: {e}")
                
        return False
