"""Scraper configuration loaded from environment variables."""

import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    # API callback (supports both API_BASE_URL and API_CALLBACK_URL for backwards compat)
    api_base_url: str = os.getenv("API_BASE_URL", os.getenv("API_CALLBACK_URL", "http://localhost:5000/api"))
    internal_api_key: str = os.getenv("INTERNAL_API_KEY", "")

    # Server
    host: str = os.getenv("SCRAPER_HOST", "0.0.0.0")
    port: int = int(os.getenv("SCRAPER_PORT", "8000"))

    # Celery / Redis
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Playwright
    headless: bool = os.getenv("PLAYWRIGHT_HEADLESS", "true").lower() == "true"
    browser_timeout: int = int(os.getenv("BROWSER_TIMEOUT", "30000"))

    # Proxy (Brightdata/Smartproxy compatible)
    # Supports both PROXY_LIST and PROXY_URLS env vars (comma-separated URLs)
    # Format: http://user:pass@host:port
    proxy_urls_raw: str = os.getenv("PROXY_LIST", os.getenv("PROXY_URLS", ""))
    proxy_urls: list[str] = field(default_factory=list)

    def __post_init__(self):
        env = os.getenv("ENVIRONMENT", "development")
        is_production = env == "production"

        # Validate internal API key
        if not self.internal_api_key or self.internal_api_key == "dev-internal-key":
            if is_production:
                raise RuntimeError(
                    "INTERNAL_API_KEY must be set in production (cannot use default). "
                    "Set the INTERNAL_API_KEY environment variable or GitHub Actions secret."
                )
            if not self.internal_api_key:
                self.internal_api_key = "dev-internal-key"

        # Validate callback URL is not localhost in production
        if is_production:
            from urllib.parse import urlparse
            parsed = urlparse(self.api_base_url)
            if parsed.hostname in ("localhost", "127.0.0.1", "0.0.0.0"):
                raise RuntimeError(
                    f"API_BASE_URL resolves to localhost ({self.api_base_url}) in production. "
                    "This means callbacks will go nowhere. "
                    "Set the PROD_API_URL GitHub Actions secret to your live backend URL "
                    "(e.g. https://your-app.onrender.com/api)."
                )

        # Log callback URL at startup for visibility in GH Actions logs
        print(f"[CONFIG] Callback URL: {self.api_base_url}")
        print(f"[CONFIG] Environment: {env}")
        print(f"[CONFIG] INTERNAL_API_KEY: {'SET (' + str(len(self.internal_api_key)) + ' chars)' if self.internal_api_key else 'NOT SET'}")

        # Parse proxy URLs
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
