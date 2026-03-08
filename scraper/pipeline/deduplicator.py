"""In-memory deduplication for a single scrape job.

Uses SHA256 hash of title|listingUrl|source — identical logic to
backend/src/services/dedup.service.ts for consistency.
"""

import hashlib
from typing import Any

from utils.logger import get_logger

logger = get_logger(__name__)


class Deduplicator:
    """Tracks seen property hashes within a scrape run."""

    def __init__(self) -> None:
        self._seen_hashes: set[str] = set()
        self._duplicate_count: int = 0

    @property
    def duplicate_count(self) -> int:
        return self._duplicate_count

    @staticmethod
    def generate_hash(data: dict[str, Any]) -> str:
        """Generate SHA256 hash matching backend DedupService.generateHash()."""
        title = (data.get("title") or "").lower().strip()
        listing_url = (data.get("listingUrl") or "").strip()
        source = (data.get("source") or "").lower().strip()
        normalized = f"{title}|{listing_url}|{source}"
        return hashlib.sha256(normalized.encode()).hexdigest()

    def is_duplicate(self, prop: dict[str, Any]) -> bool:
        """Check if property is a duplicate within this job."""
        h = self.generate_hash(prop)
        if h in self._seen_hashes:
            self._duplicate_count += 1
            return True
        self._seen_hashes.add(h)
        return False

    def reset(self) -> None:
        """Clear all tracked hashes."""
        self._seen_hashes.clear()
        self._duplicate_count = 0
