"""HTTP callback helpers with batching and retry.

Solves the #1 failure mode: Render 429 rate limiting caused by 50+ HTTP callbacks/sec.
All non-critical callbacks (logs, progress, property feed) are buffered and flushed
every few seconds. Critical callbacks (results, errors) are sent immediately with
exponential backoff retry.
"""

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from config import config
from utils.logger import get_logger

logger = get_logger(__name__)

# Shared HTTP client with generous timeout for result payloads
_client = httpx.AsyncClient(timeout=60.0)

# Thread-safe per-job callback URL storage using contextvars
import contextvars

_api_base_url_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "_api_base_url_var", default=None
)


def set_api_base_url(url: str | None) -> None:
    """Override the API base URL for callbacks."""
    _api_base_url_var.set(url.rstrip("/") if url else None)


def _base_url() -> str:
    return _api_base_url_var.get() or config.api_base_url


def _headers() -> dict[str, str]:
    return {"X-Internal-Key": config.internal_api_key, "Content-Type": "application/json"}


# ── Retry helper for critical calls ──

async def _post_with_retry(
    url: str,
    payload: dict[str, Any],
    max_retries: int = 5,
    label: str = "",
) -> bool:
    """POST with exponential backoff retry. Returns True if successful."""
    for attempt in range(max_retries):
        try:
            resp = await _client.post(url, json=payload, headers=_headers())
            if resp.status_code == 429:
                wait = min(2 ** attempt * 2, 60)
                logger.warning(f"429 on {label}, retry {attempt + 1}/{max_retries} in {wait}s")
                await asyncio.sleep(wait)
                continue
            if resp.status_code >= 500:
                wait = min(2 ** attempt * 2, 30)
                logger.warning(f"HTTP {resp.status_code} on {label}, retry {attempt + 1}/{max_retries} in {wait}s")
                await asyncio.sleep(wait)
                continue
            if resp.status_code >= 400:
                logger.error(f"{label} failed: HTTP {resp.status_code} — {resp.text[:300]}")
                return False
            return True
        except Exception as e:
            wait = min(2 ** attempt * 2, 30)
            logger.warning(f"{label} attempt {attempt + 1} error: {e}, retry in {wait}s")
            await asyncio.sleep(wait)

    logger.error(f"{label} FAILED after {max_retries} retries")
    return False


# ── Callback Batcher ──

class CallbackBatcher:
    """Buffers non-critical HTTP callbacks and flushes at intervals.

    Reduces callback rate from 50+/s to ~2/s, eliminating Render 429s.
    Critical calls (results, errors) bypass the buffer and retry with backoff.
    """

    def __init__(self, flush_interval: float = 5.0, max_batch_size: int = 50):
        self._flush_interval = flush_interval
        self._max_batch_size = max_batch_size
        self._log_buffer: list[dict[str, Any]] = []
        self._property_buffer: list[dict[str, Any]] = []
        self._progress_latest: dict[str, Any] | None = None
        self._lock = asyncio.Lock()
        self._flush_task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        """Start the background flush loop."""
        if self._running:
            return
        self._running = True
        self._flush_task = asyncio.create_task(self._flush_loop())

    async def _flush_loop(self) -> None:
        """Background loop that flushes buffers at intervals."""
        while self._running:
            try:
                await asyncio.sleep(self._flush_interval)
                await self._flush()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"Flush loop error: {e}")

    async def _flush(self) -> None:
        """Flush all accumulated buffers in one sweep."""
        async with self._lock:
            logs = self._log_buffer.copy()
            self._log_buffer.clear()
            properties = self._property_buffer.copy()
            self._property_buffer.clear()
            progress = self._progress_latest
            self._progress_latest = None

        # Send batched logs
        if logs:
            job_id = logs[0].get("jobId", "")
            url = f"{_base_url()}/internal/scrape-log-batch"
            try:
                resp = await _client.post(
                    url, json={"jobId": job_id, "logs": logs}, headers=_headers()
                )
                if resp.status_code == 404:
                    # Batch endpoint doesn't exist yet — fall back to individual
                    single_url = f"{_base_url()}/internal/scrape-log"
                    for log_entry in logs[:10]:  # Cap at 10 to avoid flood
                        try:
                            await _client.post(single_url, json=log_entry, headers=_headers())
                        except Exception:
                            pass
                elif resp.status_code >= 400:
                    logger.debug(f"Log batch failed: HTTP {resp.status_code}")
            except Exception as e:
                logger.debug(f"Log batch error: {e}")

        # Send batched properties (live feed)
        if properties:
            job_id = properties[0].get("jobId", "")
            url = f"{_base_url()}/internal/scrape-property-batch"
            try:
                resp = await _client.post(
                    url, json={"jobId": job_id, "properties": properties}, headers=_headers()
                )
                if resp.status_code == 404:
                    # Batch endpoint doesn't exist — fall back to individual (capped)
                    single_url = f"{_base_url()}/internal/scrape-property"
                    for prop in properties[:5]:
                        try:
                            await _client.post(single_url, json=prop, headers=_headers())
                        except Exception:
                            pass
                elif resp.status_code >= 400:
                    logger.debug(f"Property batch failed: HTTP {resp.status_code}")
            except Exception as e:
                logger.debug(f"Property batch error: {e}")

        # Send latest progress (only the most recent snapshot)
        if progress:
            url = f"{_base_url()}/internal/scrape-progress"
            try:
                await _client.post(url, json=progress, headers=_headers())
            except Exception:
                pass

    async def buffer_log(
        self, job_id: str, level: str, message: str, details: dict[str, Any] | None = None,
    ) -> None:
        """Buffer a log entry for batch sending."""
        entry: dict[str, Any] = {
            "jobId": job_id,
            "level": level,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if details:
            entry["details"] = details

        force_flush = False
        async with self._lock:
            self._log_buffer.append(entry)
            if len(self._log_buffer) >= self._max_batch_size:
                force_flush = True

        if force_flush:
            await self._flush()

        # Also log locally for GH Actions visibility
        if level == "ERROR":
            logger.error(f"[SCRAPE] {message}")
        elif level == "WARN":
            logger.warning(f"[SCRAPE] {message}")
        else:
            logger.info(f"[SCRAPE] {message}")

    async def buffer_property(self, job_id: str, property_data: dict[str, Any]) -> None:
        """Buffer a property for batch live-feed sending."""
        async with self._lock:
            self._property_buffer.append({"jobId": job_id, "property": property_data})

    async def update_progress(
        self,
        job_id: str,
        processed: int,
        total: int,
        current_site: str | None = None,
        message: str | None = None,
        current_page: int | None = None,
        max_pages: int | None = None,
        pages_fetched: int | None = None,
        properties_found: int | None = None,
        duplicates: int | None = None,
        errors: int | None = None,
    ) -> None:
        """Update the latest progress snapshot (overwrites previous, sent on flush)."""
        payload: dict[str, Any] = {
            "jobId": job_id,
            "processed": processed,
            "total": total,
        }
        if current_site:
            payload["currentSite"] = current_site
        if message:
            payload["message"] = message
        if current_page is not None:
            payload["currentPage"] = current_page
        if max_pages is not None:
            payload["maxPages"] = max_pages
        if pages_fetched is not None:
            payload["pagesFetched"] = pages_fetched
        if properties_found is not None:
            payload["propertiesFound"] = properties_found
        if duplicates is not None:
            payload["duplicates"] = duplicates
        if errors is not None:
            payload["errors"] = errors

        async with self._lock:
            self._progress_latest = payload

    async def flush_and_close(self) -> None:
        """Flush all remaining buffers and stop the background task."""
        self._running = False
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        # Final flush
        await self._flush()


# ── Global batcher instance ──

_batcher = CallbackBatcher()


async def start_batcher() -> None:
    """Start the global callback batcher. Call once at job start."""
    await _batcher.start()


async def stop_batcher() -> None:
    """Flush and stop the global callback batcher. Call at job end."""
    await _batcher.flush_and_close()


# ── Public API (same signatures as before, but now batched) ──


async def report_progress(
    job_id: str,
    processed: int,
    total: int,
    current_site: str | None = None,
    message: str | None = None,
    current_page: int | None = None,
    max_pages: int | None = None,
    pages_fetched: int | None = None,
    properties_found: int | None = None,
    duplicates: int | None = None,
    errors: int | None = None,
) -> None:
    """Report scrape job progress (batched — only latest snapshot is sent)."""
    await _batcher.update_progress(
        job_id, processed, total,
        current_site=current_site, message=message,
        current_page=current_page, max_pages=max_pages,
        pages_fetched=pages_fetched, properties_found=properties_found,
        duplicates=duplicates, errors=errors,
    )


async def report_results(
    job_id: str,
    properties: list[dict[str, Any]],
    stats: dict[str, Any],
) -> None:
    """Send scraped properties to the API server.

    CRITICAL PATH — sent immediately with exponential backoff retry.
    Large payloads are chunked to avoid timeouts.
    """
    url = f"{_base_url()}/internal/scrape-results"

    # Split large payloads into chunks of 30 properties
    CHUNK_SIZE = 30
    if len(properties) > CHUNK_SIZE:
        chunks = [properties[i:i + CHUNK_SIZE] for i in range(0, len(properties), CHUNK_SIZE)]
        logger.info(f"Splitting {len(properties)} properties into {len(chunks)} chunks for job {job_id}")
        all_success = True
        for i, chunk in enumerate(chunks):
            chunk_stats = {**stats, "incremental": True, "chunkIndex": i, "totalChunks": len(chunks)}
            if i == len(chunks) - 1:
                chunk_stats["totalScraped"] = stats.get("totalScraped", len(properties))
            success = await _post_with_retry(
                url,
                {"jobId": job_id, "properties": chunk, "stats": chunk_stats},
                max_retries=5,
                label=f"report_results chunk {i + 1}/{len(chunks)} (job {job_id})",
            )
            if not success:
                all_success = False

        if not all_success:
            await _save_fallback(job_id, properties, stats)
        return

    # Small payload — send directly
    success = await _post_with_retry(
        url,
        {"jobId": job_id, "properties": properties, "stats": stats},
        max_retries=5,
        label=f"report_results ({len(properties)} props, job {job_id})",
    )

    if not success:
        await _save_fallback(job_id, properties, stats)


async def _save_fallback(
    job_id: str, properties: list[dict[str, Any]], stats: dict[str, Any],
) -> None:
    """Save results to local file as last resort when backend is unreachable."""
    if not properties:
        return
    fallback_path = f"/tmp/scraper-results-{job_id}-{int(time.time())}.json"
    try:
        with open(fallback_path, "w") as f:
            json.dump({"jobId": job_id, "properties": properties, "stats": stats}, f)
        logger.critical(f"RESULTS SAVED TO FALLBACK FILE: {fallback_path} ({len(properties)} properties)")
    except Exception as e:
        logger.critical(f"FAILED TO SAVE FALLBACK FILE: {e} — {len(properties)} properties LOST")


async def report_error(job_id: str, error: str, details: str | None = None) -> None:
    """Report a scrape error (sent immediately with retry)."""
    url = f"{_base_url()}/internal/scrape-error"
    payload: dict[str, Any] = {"jobId": job_id, "error": error}
    if details:
        payload["details"] = details
    await _post_with_retry(url, payload, max_retries=3, label=f"report_error (job {job_id})")


async def report_log(
    job_id: str, level: str, message: str, details: dict[str, Any] | None = None,
) -> None:
    """Send a log entry (batched — flushed every 5 seconds)."""
    await _batcher.buffer_log(job_id, level, message, details)


async def report_learned_data(
    job_id: str,
    site_id: str,
    selectors: dict[str, Any] | None = None,
    detail_selectors: dict[str, Any] | None = None,
    list_paths: list[str] | None = None,
) -> None:
    """Report learned selectors/listPaths back to the backend (sent with retry)."""
    url = f"{_base_url()}/internal/scrape-learned"
    payload: dict[str, Any] = {"jobId": job_id, "siteId": site_id}
    if selectors:
        payload["selectors"] = selectors
    if detail_selectors:
        payload["detailSelectors"] = detail_selectors
    if list_paths:
        payload["listPaths"] = list_paths
    await _post_with_retry(url, payload, max_retries=3, label=f"report_learned (site {site_id})")


async def report_learn_results(
    job_id: str,
    site_id: str,
    site_profile: dict[str, Any],
    selectors: dict[str, Any] | None = None,
    detail_selectors: dict[str, Any] | None = None,
    list_paths: list[str] | None = None,
) -> None:
    """Send site intelligence learn results to the backend (sent with retry)."""
    url = f"{_base_url()}/internal/learn-results"
    payload: dict[str, Any] = {
        "jobId": job_id,
        "siteId": site_id,
        "siteProfile": site_profile,
    }
    if selectors:
        payload["selectors"] = selectors
    if detail_selectors:
        payload["detailSelectors"] = detail_selectors
    if list_paths:
        payload["listPaths"] = list_paths
    await _post_with_retry(url, payload, max_retries=3, label=f"report_learn_results (site {site_id})")


async def report_property(
    job_id: str,
    property_data: dict[str, Any],
) -> None:
    """Report a single scraped property (batched — flushed every 5 seconds)."""
    await _batcher.buffer_property(job_id, property_data)
