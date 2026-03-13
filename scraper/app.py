"""Scraper microservice — FastAPI entry point.

Receives scrape jobs from the Node.js API server, runs the scraping pipeline,
and reports results/progress back via HTTP callbacks.
"""

import asyncio
import os
import glob
import random
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from config import config
from engine.adaptive_fetcher import AdaptiveFetcher
from extractors.universal_extractor import UniversalExtractor
from extractors.universal_nlp import detect_listing_type
from extractors.price_parser import parse_price
from extractors.location_parser import parse_location
from extractors.feature_extractor import extract_features
from pipeline.validator import validate_property
from pipeline.deduplicator import Deduplicator
from pipeline.normalizer import normalize_property
from pipeline.enricher import enrich_property
from utils.callback import report_progress, report_results, report_error, report_log
from utils.robots_checker import is_allowed as robots_allowed, get_crawl_delay
from utils.url_normalizer import normalize_url, VisitedSet
from utils.logger import get_logger

import redis

logger = get_logger("scraper")

redis_client = redis.Redis.from_url(config.redis_url, decode_responses=True)


def _purge_old_snapshots():
    """Delete HTML snapshots older than retention period."""
    snapshot_dir = config.raw_html_dir
    if not os.path.exists(snapshot_dir):
        return
    cutoff = datetime.now() - timedelta(days=config.raw_html_retention_days)
    for filepath in glob.glob(os.path.join(snapshot_dir, "*.html")):
        try:
            file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
            if file_mtime < cutoff:
                os.remove(filepath)
                logger.info(f"Purged old snapshot: {filepath}")
        except OSError:
            pass


def _save_snapshot(site_name: str, url: str, html: str):
    """Save raw HTML for debugging failed extractions."""
    snapshot_dir = config.raw_html_dir
    os.makedirs(snapshot_dir, exist_ok=True)
    safe_name = site_name.replace(" ", "_").replace("/", "_")[:30]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{safe_name}_{timestamp}.html"
    filepath = os.path.join(snapshot_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"<!-- Source URL: {url} -->\n")
        f.write(html)
    logger.info(f"Saved HTML snapshot: {filepath}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Scraper service starting on {config.host}:{config.port}")
    _purge_old_snapshots()
    yield
    logger.info("Scraper service shutting down")


app = FastAPI(
    title="Realtors' Practice Scraper",
    version="1.0.0",
    lifespan=lifespan,
)


# --- Models ---

class SiteConfig(BaseModel):
    id: str
    name: str
    baseUrl: str
    listingSelector: str
    selectors: dict[str, Any]
    paginationType: str = "url_param"
    paginationConfig: dict[str, Any] = Field(default_factory=dict)
    requiresJs: bool = False
    maxPages: int = 10
    delayMin: float | None = None
    delayMax: float | None = None


class ScrapeJobRequest(BaseModel):
    jobId: str
    sites: list[SiteConfig]
    maxListingsPerSite: int = 100
    callbackUrl: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class JobStatus(BaseModel):
    jobId: str
    status: str
    processed: int = 0
    total: int = 0
    errors: int = 0


# --- Auth ---

def verify_internal_key(x_internal_key: str = Header(...)):
    if x_internal_key != config.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid internal API key")


# --- Routes ---

@app.get("/health")
async def health():
    return {
        "status": "OK",
        "service": "scraper",
        "redis_connected": redis_client.ping()
    }


@app.post("/api/jobs", dependencies=[])
async def start_job(
    request: ScrapeJobRequest,
    x_internal_key: str = Header(...),
):
    verify_internal_key(x_internal_key)
    
    # We no longer start jobs via API (Backend pushes directly to Celery/Redis)
    # But we keep this for backwards compatibility
    from tasks import process_job
    process_job.delay(request.dict())

    return {"jobId": request.jobId, "status": "STARTED"}


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str, x_internal_key: str = Header(...)):
    verify_internal_key(x_internal_key)
    
    # Check if job was stopped
    is_stopped = redis_client.exists(f"job:stop:{job_id}")
    return JobStatus(jobId=job_id, status="STOPPING" if is_stopped else "UNKNOWN")


@app.post("/api/jobs/{job_id}/stop")
async def stop_job(job_id: str, x_internal_key: str = Header(...)):
    verify_internal_key(x_internal_key)
    redis_client.setex(f"job:stop:{job_id}", 86400, "1") # Expire after 24h
    return {"jobId": job_id, "status": "STOPPING"}


# --- Scrape Pipeline ---

async def _run_scrape_job(request: ScrapeJobRequest) -> None:
    job_id = request.jobId
    all_properties: list[dict[str, Any]] = []
    deduplicator = Deduplicator()
    fetcher = AdaptiveFetcher()
    visited = VisitedSet()
    total_errors = 0
    block_count = 0

    try:
        await report_log(job_id, "INFO", f"Starting scrape job with {len(request.sites)} site(s)")

        for site_idx, site in enumerate(request.sites):
            if redis_client.exists(f"job:stop:{job_id}"):
                await report_log(job_id, "WARN", "Job stopped by user")
                break

            await report_log(job_id, "INFO", f"Scraping site: {site.name} ({site.baseUrl})")
            site_properties: list[dict[str, Any]] = []

            try:
                # Check robots.txt before scraping
                if not robots_allowed(site.baseUrl):
                    await report_log(job_id, "WARN", f"robots.txt disallows scraping {site.baseUrl} — skipping site")
                    continue

                # Respect Crawl-Delay from robots.txt if set
                crawl_delay = get_crawl_delay(site.baseUrl)
                if crawl_delay:
                    await report_log(job_id, "INFO", f"robots.txt Crawl-Delay: {crawl_delay}s for {site.name}")

                # Fetch listing pages
                page_num = 0
                while page_num < site.maxPages:
                    if redis_client.exists(f"job:stop:{job_id}"):
                        break

                    page_url = _build_page_url(site, page_num)
                    await report_log(job_id, "DEBUG", f"Fetching page {page_num + 1}: {page_url}")

                    html = await fetcher.fetch(page_url, requires_js=site.requiresJs)
                    if not html:
                        await report_log(job_id, "WARN", f"Empty response from {page_url}")
                        break

                    # Extract listing URLs from the page
                    extractor = UniversalExtractor(site.selectors)
                    raw_listing_urls = extractor.extract_listing_urls(html, site.baseUrl, site.listingSelector)

                    # Normalize and deduplicate URLs via visited set
                    listing_urls = []
                    for u in raw_listing_urls:
                        normalized = normalize_url(u)
                        if visited.add(normalized):
                            listing_urls.append(normalized)

                    if not listing_urls:
                        await report_log(job_id, "INFO", f"No more listings found on page {page_num + 1}")
                        break

                    skipped = len(raw_listing_urls) - len(listing_urls)
                    if skipped:
                        await report_log(job_id, "DEBUG", f"Skipped {skipped} already-visited URLs on page {page_num + 1}")
                    await report_log(job_id, "INFO", f"Found {len(listing_urls)} new listings on page {page_num + 1}")

                    # Process each listing
                    for listing_url in listing_urls:
                        if len(site_properties) >= request.maxListingsPerSite:
                            break
                        if redis_client.exists(f"job:stop:{job_id}"):
                            break

                        try:
                            listing_html = await fetcher.fetch(listing_url, requires_js=site.requiresJs)
                            if not listing_html:
                                total_errors += 1
                                # Track block detection
                                if fetcher.last_block_reason:
                                    block_count += 1
                                    await report_log(job_id, "WARN", f"Blocked ({fetcher.last_block_reason}): {listing_url}")
                                    if block_count >= 3:
                                        await report_log(job_id, "WARN", f"Multiple blocks detected for {site.name} — slowing down")
                                        await asyncio.sleep(random.uniform(10, 20))
                                continue

                            # Extract raw data
                            raw_data = extractor.extract_property(listing_html, listing_url)
                            if not raw_data:
                                total_errors += 1
                                _save_snapshot(site.name, listing_url, listing_html)
                                await report_log(job_id, "WARN", f"No data extracted from {listing_url}, snapshot saved")
                                continue
                                
                            # LLM Fallback if crucial data is missing (like price, bedrooms, or location)
                            if not raw_data.get("price_text") or not raw_data.get("bedrooms") or not raw_data.get("location_text"):
                                await report_log(job_id, "DEBUG", f"Missing data for {listing_url}, attempting LLM fallback...")
                                from extractors.llm_extractor import extract_with_llm
                                
                                # Use description or raw HTML text for LLM (bs4 get_text to strip tags)
                                from bs4 import BeautifulSoup
                                soup = BeautifulSoup(listing_html, "lxml")
                                page_text = soup.get_text(separator=" ", strip=True)
                                
                                raw_data = extract_with_llm(page_text, raw_data)

                            # NLP: detect listing type
                            raw_data["listingType"] = detect_listing_type(
                                raw_data.get("title", ""),
                                raw_data.get("description", ""),
                                raw_data.get("price_text", ""),
                            )

                            # Parse price
                            price_info = parse_price(raw_data.get("price_text", ""))
                            raw_data.update(price_info)

                            # Parse location
                            location_info = parse_location(raw_data.get("location_text", ""))
                            raw_data.update(location_info)

                            # Extract features
                            features = extract_features(
                                raw_data.get("description", ""),
                                raw_data.get("features_text", ""),
                            )
                            raw_data["features"] = features

                            # Normalize
                            normalized = normalize_property(raw_data, site.name)

                            # Validate + quality score
                            validated = validate_property(normalized)

                            # Dedup check
                            if deduplicator.is_duplicate(validated):
                                await report_log(job_id, "DEBUG", f"Duplicate skipped: {validated.get('title', '')[:50]}")
                                continue

                            site_properties.append(validated)

                            # Update progress
                            await report_progress(
                                job_id,
                                processed=len(all_properties) + len(site_properties),
                                total=request.maxListingsPerSite * len(request.sites),
                                current_site=site.name,
                            )

                        except Exception as e:
                            total_errors += 1
                            await report_log(job_id, "ERROR", f"Error processing {listing_url}: {str(e)}")

                    page_num += 1

            except Exception as e:
                total_errors += 1
                await report_log(job_id, "ERROR", f"Error scraping site {site.name}: {str(e)}")

            await report_log(job_id, "INFO", f"Site {site.name}: scraped {len(site_properties)} properties")
            all_properties.extend(site_properties)

        # Enrich all properties (geocoding)
        if all_properties:
            await report_log(job_id, "INFO", f"Enriching {len(all_properties)} properties (geocoding)...")
            all_properties = await enrich_property(all_properties)

        # Report final results
        stats = {
            "totalScraped": len(all_properties),
            "totalErrors": total_errors,
            "sitesProcessed": len(request.sites),
            "duplicatesSkipped": deduplicator.duplicate_count,
        }

        await report_results(job_id, all_properties, stats)
        await report_log(job_id, "INFO", f"Job complete: {len(all_properties)} properties, {total_errors} errors")

    except Exception as e:
        logger.exception(f"Fatal error in job {job_id}")
        await report_error(job_id, str(e))

    finally:
        await fetcher.close()


def _build_page_url(site: SiteConfig, page_num: int) -> str:
    """Build paginated URL based on site's pagination type."""
    base = site.baseUrl
    pc = site.paginationConfig

    if page_num == 0:
        return base

    if site.paginationType == "url_param":
        param = pc.get("param", "page")
        separator = "&" if "?" in base else "?"
        offset = pc.get("startFrom", 1)
        return f"{base}{separator}{param}={page_num + offset}"

    elif site.paginationType == "path_segment":
        suffix = pc.get("suffix", "/page/{page}")
        return base.rstrip("/") + suffix.replace("{page}", str(page_num + 1))

    elif site.paginationType == "offset":
        param = pc.get("param", "offset")
        per_page = pc.get("perPage", 20)
        separator = "&" if "?" in base else "?"
        return f"{base}{separator}{param}={page_num * per_page}"

    return base


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host=config.host, port=config.port, reload=True)
