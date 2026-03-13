"""Robots.txt parser and checker.

Fetches and caches robots.txt for each domain, and checks whether
a given URL is allowed before scraping.
"""

import urllib.robotparser
from urllib.parse import urlparse
from typing import Optional
import httpx
from utils.logger import get_logger

logger = get_logger("robots_checker")

# Cache of RobotFileParser instances per domain
_robots_cache: dict[str, Optional[urllib.robotparser.RobotFileParser]] = {}

USER_AGENT = "RealtorsPracticeScraper/1.0 (+https://realtorspractice.com)"


def _get_robots_parser(base_url: str) -> Optional[urllib.robotparser.RobotFileParser]:
    """Fetch and cache robots.txt for a domain."""
    try:
        parsed = urlparse(base_url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        return None

    if domain in _robots_cache:
        return _robots_cache[domain]

    robots_url = f"{domain}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()

    try:
        resp = httpx.get(robots_url, timeout=10, follow_redirects=True,
                         headers={"User-Agent": USER_AGENT})
        if resp.status_code == 200:
            rp.parse(resp.text.splitlines())
            _robots_cache[domain] = rp
            logger.info(f"Loaded robots.txt for {domain}")
            return rp
        else:
            # No robots.txt or access denied — allow all
            _robots_cache[domain] = None
            logger.debug(f"No robots.txt for {domain} (status {resp.status_code}) — allowing all")
            return None
    except Exception as e:
        logger.debug(f"Could not fetch robots.txt for {domain}: {e} — allowing all")
        _robots_cache[domain] = None
        return None


def is_allowed(url: str) -> bool:
    """Check if the given URL is allowed by robots.txt.

    Returns True if:
    - robots.txt doesn't exist or couldn't be fetched
    - robots.txt allows the URL for our user agent
    - The URL is explicitly allowed

    Returns False if robots.txt disallows the URL.
    """
    rp = _get_robots_parser(url)
    if rp is None:
        return True  # No robots.txt = allow all

    allowed = rp.can_fetch(USER_AGENT, url)
    if not allowed:
        # Also check with "*" agent
        allowed = rp.can_fetch("*", url)

    if not allowed:
        logger.warning(f"robots.txt DISALLOWS: {url}")

    return allowed


def get_crawl_delay(base_url: str) -> Optional[float]:
    """Get the Crawl-Delay directive from robots.txt, if any."""
    rp = _get_robots_parser(base_url)
    if rp is None:
        return None

    try:
        delay = rp.crawl_delay(USER_AGENT)
        if delay is None:
            delay = rp.crawl_delay("*")
        return delay
    except Exception:
        return None


def clear_cache():
    """Clear the robots.txt cache (useful for long-running processes)."""
    _robots_cache.clear()
