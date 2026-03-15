"""Incremental scraping tracker — skip already-scraped URLs.

Ported from scraper v2.0. Tracks URLs that have been successfully scraped
across runs. When the crawler encounters N consecutive already-seen URLs
on a listing page, it stops paginating (the assumption is that older
listings have already been captured in a previous run).

Supports two backends:
- In-memory set (default, resets each process restart)
- Redis set (optional, persists across restarts for true incremental scraping)
"""

from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)

# Default threshold: stop after this many consecutive known URLs
DEFAULT_CONSECUTIVE_THRESHOLD = 5

# Redis key prefix for the seen-URLs set
_REDIS_KEY_PREFIX = "scraper:seen_urls:"


# --- Standalone convenience functions ---

# Module-level in-memory fallback for standalone functions (no Redis)
_default_memory_sets: dict[str, set[str]] = {}


def mark_url_seen(url: str, site_id: str = "default") -> None:
    """Mark a URL as seen for a given site (in-memory only).

    For Redis-backed tracking, use the IncrementalTracker class directly.

    Args:
        url: The normalized URL to mark as seen.
        site_id: Identifier for the site being scraped.
    """
    _default_memory_sets.setdefault(site_id, set()).add(url)


def is_url_seen(url: str, site_id: str = "default") -> bool:
    """Check whether a URL has been seen before (in-memory only).

    For Redis-backed tracking, use the IncrementalTracker class directly.

    Args:
        url: The normalized URL to check.
        site_id: Identifier for the site being scraped.

    Returns:
        True if the URL has been marked as seen.
    """
    return url in _default_memory_sets.get(site_id, set())


def should_stop_incremental(consecutive_known: int, threshold: int = 5) -> bool:
    """Determine whether the crawler should stop paginating.

    When N consecutive listing URLs are already known, the remaining pages
    are assumed to contain only old listings from a previous run.

    Args:
        consecutive_known: Number of consecutive already-known URLs encountered.
        threshold: Stop threshold (default 5).

    Returns:
        True if consecutive_known >= threshold.
    """
    return consecutive_known >= threshold


class IncrementalTracker:
    """Tracks scraped URLs to enable incremental (delta) scraping.

    When scraping a listing page, each extracted URL is checked against
    the seen set. If ``consecutive_threshold`` URLs in a row are already
    known, the tracker signals the crawler to stop paginating for this
    site — all remaining pages are assumed to contain only old listings.

    Args:
        redis_client: Optional Redis client for persistent tracking.
            If None, uses an in-memory set (resets on restart).
        site_id: Identifier for the site being scraped (used as Redis key
            namespace so different sites don't collide).
        consecutive_threshold: Number of consecutive known URLs before
            signalling the crawler to stop.
        ttl_days: How long to keep URLs in Redis (default 30 days).
    """

    def __init__(
        self,
        redis_client=None,
        site_id: str = "default",
        consecutive_threshold: int = DEFAULT_CONSECUTIVE_THRESHOLD,
        ttl_days: int = 30,
    ) -> None:
        self._redis = redis_client
        self._site_id = site_id
        self._consecutive_threshold = consecutive_threshold
        self._ttl_seconds = ttl_days * 86400
        self._memory_set: set[str] = set()
        self._consecutive_known: int = 0
        self._total_known: int = 0
        self._total_new: int = 0

    @property
    def consecutive_known(self) -> int:
        """Current count of consecutive already-known URLs."""
        return self._consecutive_known

    @property
    def total_known(self) -> int:
        """Total number of URLs that were already in the seen set."""
        return self._total_known

    @property
    def total_new(self) -> int:
        """Total number of newly discovered URLs."""
        return self._total_new

    @property
    def should_stop(self) -> bool:
        """True if the consecutive-known threshold has been reached."""
        return self._consecutive_known >= self._consecutive_threshold

    def _redis_key(self) -> str:
        """Build the Redis key for this site's seen-URL set."""
        return f"{_REDIS_KEY_PREFIX}{self._site_id}"

    def is_known(self, url: str) -> bool:
        """Check whether a URL has been seen before (without marking it).

        Args:
            url: The normalized URL to check.

        Returns:
            True if the URL is already in the seen set.
        """
        if self._redis:
            try:
                return bool(self._redis.sismember(self._redis_key(), url))
            except Exception as e:
                logger.debug(f"Redis sismember error: {e}")
        return url in self._memory_set

    def check_and_track(self, url: str) -> bool:
        """Check a URL and update the consecutive-known counter.

        Call this for each listing URL extracted from a page, in order.
        The method returns whether the URL is new (not seen before).

        If the URL is already known, the consecutive counter increments.
        If the URL is new, the consecutive counter resets to zero and the
        URL is added to the seen set.

        Args:
            url: The normalized listing URL.

        Returns:
            True if the URL is **new** (not previously seen).
            False if the URL was already known.
        """
        if self.is_known(url):
            self._consecutive_known += 1
            self._total_known += 1
            logger.debug(
                f"Known URL ({self._consecutive_known}/{self._consecutive_threshold}): {url}"
            )
            return False

        # New URL — reset consecutive counter and mark as seen
        self._consecutive_known = 0
        self._total_new += 1
        self._mark_seen(url)
        return True

    def mark_scraped(self, url: str) -> None:
        """Explicitly mark a URL as successfully scraped.

        Call this after a listing has been fully processed and validated,
        so that future runs know to skip it.

        Args:
            url: The normalized listing URL.
        """
        self._mark_seen(url)

    def _mark_seen(self, url: str) -> None:
        """Add a URL to the seen set (both memory and Redis)."""
        self._memory_set.add(url)
        if self._redis:
            try:
                key = self._redis_key()
                self._redis.sadd(key, url)
                # Refresh TTL so the set doesn't expire while still in use
                self._redis.expire(key, self._ttl_seconds)
            except Exception as e:
                logger.debug(f"Redis sadd error: {e}")

    def reset_consecutive(self) -> None:
        """Reset the consecutive-known counter (e.g. when moving to a new page)."""
        self._consecutive_known = 0

    def get_stats(self) -> dict[str, int]:
        """Return tracker statistics.

        Returns:
            Dict with total_new, total_known, consecutive_known, and
            memory_set_size.
        """
        return {
            "total_new": self._total_new,
            "total_known": self._total_known,
            "consecutive_known": self._consecutive_known,
            "memory_set_size": len(self._memory_set),
        }
