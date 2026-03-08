"""Per-domain rate limiter with randomized delays."""

import asyncio
import random
import time
from collections import defaultdict
from urllib.parse import urlparse

from config import config
from utils.logger import get_logger

logger = get_logger(__name__)


class RateLimiter:
    """Enforces per-domain rate limits with human-like random delays."""

    def __init__(
        self,
        delay_min: float = config.default_delay_min,
        delay_max: float = config.default_delay_max,
    ):
        self.delay_min = delay_min
        self.delay_max = delay_max
        self._last_request: dict[str, float] = defaultdict(float)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def _get_domain(self, url: str) -> str:
        return urlparse(url).netloc

    async def wait(self, url: str) -> None:
        domain = self._get_domain(url)
        async with self._locks[domain]:
            elapsed = time.monotonic() - self._last_request[domain]
            delay = random.uniform(self.delay_min, self.delay_max)
            if elapsed < delay:
                wait_time = delay - elapsed
                logger.debug(f"Rate limit: waiting {wait_time:.1f}s for {domain}")
                await asyncio.sleep(wait_time)
            self._last_request[domain] = time.monotonic()


rate_limiter = RateLimiter()
