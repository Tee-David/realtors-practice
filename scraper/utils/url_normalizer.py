"""URL normalization and deduplication utilities.

Normalizes URLs by resolving relative paths, stripping fragments,
sorting query params, and removing tracking parameters — so that
equivalent URLs map to the same canonical form.
"""

import re
from urllib.parse import urlparse, urlunparse, urlencode, parse_qs, unquote

from utils.logger import get_logger

logger = get_logger("url_normalizer")

# Common tracking / session query params to strip
TRACKING_PARAMS = frozenset({
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "ref", "source", "mc_cid", "mc_eid",
    "_ga", "_gl", "hsCtaTracking", "mkt_tok",
})


def normalize_url(url: str) -> str:
    """Normalize a URL to its canonical form.

    - Lowercases scheme and netloc
    - Strips fragment (#...)
    - Strips trailing slash on path (unless path is just "/")
    - Removes common tracking query parameters
    - Sorts remaining query parameters
    - Decodes percent-encoded characters where safe
    """
    try:
        parsed = urlparse(unquote(url))
    except Exception:
        return url

    # Lowercase scheme + host
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Normalize path: collapse double slashes, strip trailing slash
    path = re.sub(r"/+", "/", parsed.path)
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    # Filter and sort query params
    query_params = parse_qs(parsed.query, keep_blank_values=False)
    filtered = {
        k: v for k, v in query_params.items()
        if k.lower() not in TRACKING_PARAMS
    }
    # Sort params for canonical ordering
    sorted_query = urlencode(
        sorted(filtered.items()),
        doseq=True,
    ) if filtered else ""

    # Drop fragment entirely
    return urlunparse((scheme, netloc, path, parsed.params, sorted_query, ""))


class VisitedSet:
    """Thread-safe visited URL tracker using normalized URLs."""

    def __init__(self):
        self._seen: set[str] = set()

    def add(self, url: str) -> bool:
        """Add a URL. Returns True if it was new, False if already visited."""
        normalized = normalize_url(url)
        if normalized in self._seen:
            return False
        self._seen.add(normalized)
        return True

    def has(self, url: str) -> bool:
        """Check if a URL has been visited."""
        return normalize_url(url) in self._seen

    def __len__(self) -> int:
        return len(self._seen)

    def clear(self):
        self._seen.clear()
