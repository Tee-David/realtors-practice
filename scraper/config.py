"""Scraper configuration loaded from environment variables."""

import os
from dataclasses import dataclass, field


@dataclass
class Config:
    # API callback
    api_base_url: str = os.getenv("API_BASE_URL", "http://localhost:5000/api")
    internal_api_key: str = os.getenv("INTERNAL_API_KEY", "dev-internal-key")

    # Server
    host: str = os.getenv("SCRAPER_HOST", "0.0.0.0")
    port: int = int(os.getenv("SCRAPER_PORT", "8000"))

    # Celery / Redis
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Playwright
    headless: bool = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() == "true"
    browser_timeout: int = int(os.getenv("BROWSER_TIMEOUT", "30000"))

    # Proxy (Brightdata/Smartproxy compatible)
    proxy_urls_raw: str = os.getenv("PROXY_URLS", "")
    proxy_urls: list[str] = field(default_factory=list)

    def __post_init__(self):
        if self.proxy_urls_raw:
            self.proxy_urls = [p.strip() for p in self.proxy_urls_raw.split(",") if p.strip()]

    @property
    def proxy_url(self) -> str | None:
        """Returns a random proxy from the pool, or None if no proxies configured."""
        import random
        return random.choice(self.proxy_urls) if self.proxy_urls else None

    # Rate limiting
    default_delay_min: float = float(os.getenv("DELAY_MIN", "2.0"))
    default_delay_max: float = float(os.getenv("DELAY_MAX", "5.0"))
    max_concurrent_per_site: int = int(os.getenv("MAX_CONCURRENT_PER_SITE", "2"))

    # Geocoding
    nominatim_url: str = os.getenv("NOMINATIM_URL", "https://nominatim.openstreetmap.org")
    nominatim_email: str = os.getenv("NOMINATIM_EMAIL", "scraper@realtorspractice.com")

    # Storage
    save_raw_html: bool = os.getenv("SAVE_RAW_HTML", "false").lower() == "true"
    raw_html_dir: str = os.getenv("RAW_HTML_DIR", "/tmp/scraper-raw-html")
    raw_html_retention_days: int = int(os.getenv("RAW_HTML_RETENTION_DAYS", "7"))

    # Logging
    log_level: str = os.getenv("LOG_LEVEL", "INFO")


config = Config()
