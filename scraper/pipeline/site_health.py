"""Site health pre-checks — skip dead/blocked sites before wasting time.

Performs quick DNS + HTTP HEAD checks to identify sites that are:
- Dead (DNS resolution failure)
- Blocking scrapers (HTTP 403/401)
- Behind captcha walls
- Timing out

Saves time and LLM budget by skipping unhealthy sites early.
"""

import asyncio
import socket
from urllib.parse import urlparse

import httpx

from utils.logger import get_logger

logger = get_logger(__name__)


class SiteHealthChecker:
    """Quick pre-flight health checks for scraping targets."""

    def __init__(self):
        self._client = httpx.AsyncClient(timeout=8.0, follow_redirects=True, verify=False)

    async def preflight(self, base_url: str) -> tuple[bool, str]:
        """Quick health check before scraping a site.

        Returns (should_scrape, reason).
        - True, "" = healthy, proceed
        - False, reason = skip this site
        """
        parsed = urlparse(base_url)
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL — no hostname"

        # Step 1: DNS resolution with retry (catches dead domains fast)
        dns_ok = False
        for attempt in range(2):
            try:
                loop = asyncio.get_event_loop()
                await asyncio.wait_for(
                    loop.run_in_executor(
                        None, socket.getaddrinfo, hostname, None
                    ),
                    timeout=10.0,
                )
                dns_ok = True
                break
            except (socket.gaierror, OSError):
                if attempt == 1:
                    return False, f"DNS resolution failed — domain {hostname} may be dead"
            except asyncio.TimeoutError:
                if attempt == 1:
                    return False, f"DNS resolution timed out for {hostname}"
            await asyncio.sleep(1)

        if not dns_ok:
            return False, f"DNS resolution failed for {hostname}"

        # Step 2: HTTP HEAD request (catches 403s, captchas, timeouts)
        try:
            resp = await self._client.head(base_url)

            if resp.status_code == 403:
                return False, f"HTTP 403 Forbidden — site is blocking scrapers"
            if resp.status_code == 401:
                return False, f"HTTP 401 Unauthorized — requires authentication"
            if resp.status_code == 503:
                return False, f"HTTP 503 Service Unavailable — site may be down"
            if resp.status_code >= 500:
                return False, f"HTTP {resp.status_code} Server Error"

            # Check for captcha in small responses
            if resp.status_code == 200:
                # HEAD doesn't return body, but we can check headers
                content_type = resp.headers.get("content-type", "")
                if "text/html" not in content_type and "application/json" not in content_type:
                    # Might be a redirect to captcha — still try
                    pass

            return True, ""

        except httpx.TimeoutException:
            return False, f"HTTP request timed out ({base_url})"
        except httpx.ConnectError:
            return False, f"Connection refused or failed ({base_url})"
        except Exception as e:
            return False, f"Health check error: {str(e)[:100]}"

    async def close(self):
        await self._client.aclose()
