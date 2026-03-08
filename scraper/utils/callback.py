"""HTTP callback helpers for reporting progress/results to the Node.js API."""

from typing import Any

import httpx

from config import config
from utils.logger import get_logger

logger = get_logger(__name__)

_client = httpx.AsyncClient(timeout=30.0)


def _headers() -> dict[str, str]:
    return {"X-Internal-Key": config.internal_api_key, "Content-Type": "application/json"}


async def report_progress(
    job_id: str,
    processed: int,
    total: int,
    current_site: str | None = None,
    message: str | None = None,
) -> None:
    """Report scrape job progress to the API server."""
    url = f"{config.api_base_url}/internal/scrape-progress"
    payload: dict[str, Any] = {
        "jobId": job_id,
        "processed": processed,
        "total": total,
    }
    if current_site:
        payload["currentSite"] = current_site
    if message:
        payload["message"] = message
    try:
        resp = await _client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Failed to report progress for job {job_id}: {e}")


async def report_results(
    job_id: str,
    properties: list[dict[str, Any]],
    stats: dict[str, Any],
) -> None:
    """Send scraped properties to the API server."""
    url = f"{config.api_base_url}/internal/scrape-results"
    payload = {
        "jobId": job_id,
        "properties": properties,
        "stats": stats,
    }
    try:
        resp = await _client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
        logger.info(f"Reported {len(properties)} properties for job {job_id}")
    except Exception as e:
        logger.error(f"Failed to report results for job {job_id}: {e}")


async def report_error(job_id: str, error: str, details: str | None = None) -> None:
    """Report a scrape error to the API server."""
    url = f"{config.api_base_url}/internal/scrape-error"
    payload: dict[str, Any] = {"jobId": job_id, "error": error}
    if details:
        payload["details"] = details
    try:
        resp = await _client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"Failed to report error for job {job_id}: {e}")


async def report_log(
    job_id: str, level: str, message: str, details: dict[str, Any] | None = None
) -> None:
    """Send a log entry to the API (for live log streaming via Socket.io)."""
    url = f"{config.api_base_url}/internal/scrape-log"
    payload: dict[str, Any] = {"jobId": job_id, "level": level, "message": message}
    if details:
        payload["details"] = details
    try:
        resp = await _client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
    except Exception:
        pass  # Don't log failures for log reports to avoid recursion
