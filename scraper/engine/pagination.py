from typing import List, Optional, Tuple
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse
from bs4 import BeautifulSoup
import re
from utils.logger import get_logger

logger = get_logger(__name__)

class PaginationHandler:
    """Universal handler for navigating through multi-page listing results."""
    
    # Common CSS selectors for 'Next' buttons
    NEXT_BUTTON_SELECTORS = [
        "a.next",
        "a[rel='next']",
        "li.next > a",
        ".pagination-next a",
        "a:contains('Next')",
        "a:contains('Next Page')",
        "a[aria-label='Next']",
        ".pages a:last-child", # Fallback, often the last pagination link is next
    ]

    @staticmethod
    def extract_next_page_url(html: str, base_url: str, custom_selector: Optional[str] = None) -> Optional[str]:
        """
        Attempt to find the 'next page' URL from the HTML DOM using common selectors.
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        selectors_to_try = [custom_selector] if custom_selector else PaginationHandler.NEXT_BUTTON_SELECTORS
        
        for selector in selectors_to_try:
            if not selector:
                continue
                
            # Handle jQuery pseudo-selector :contains manually since bs4 doesn't support it
            if ":contains" in selector:
                parts = selector.split(":contains")
                tag = parts[0] if parts[0] else "a"
                text_to_match = parts[1].strip("(')")
                
                elements = soup.find_all(tag)
                for el in elements:
                    if text_to_match.lower() in el.get_text().lower() and el.has_attr('href'):
                        return urljoin(base_url, el['href'])
            else:
                element = soup.select_one(selector)
                if element and element.has_attr('href'):
                    href = element['href']
                    # Skip javascript anchors
                    if not href.startswith('javascript:'):
                        return urljoin(base_url, href)
                        
        return None

    @staticmethod
    def generate_urls_by_param(base_url: str, param: str = "page", start: int = 1, end: int = 10) -> List[str]:
        """
        Generate a list of URLs by iterating a query parameter.
        Useful for known URL structures (e.g., site.com/search?page=1, ?page=2)
        """
        urls = []
        parsed = urlparse(base_url)
        query_dict = parse_qs(parsed.query)
        
        for p in range(start, end + 1):
            query_dict[param] = [str(p)]
            new_query = urlencode(query_dict, doseq=True)
            new_url = urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                new_query,
                parsed.fragment
            ))
            urls.append(new_url)
            
        return urls

    @staticmethod
    def generate_urls_by_path(base_url: str, path_pattern: str = "/page/{}", start: int = 1, end: int = 10) -> List[str]:
        """
        Generate a list of URLs by appending path segments.
        Useful for sites like site.com/properties/page/2
        """
        # Ensure base URL doesn't end in slash to cleanly join
        clean_base = base_url.rstrip('/')
        
        urls = []
        for p in range(start, end + 1):
            if p == 1:
                urls.append(base_url) # Page 1 is usually just the base route
            else:
                urls.append(f"{clean_base}{path_pattern.format(p)}")
                
        return urls
