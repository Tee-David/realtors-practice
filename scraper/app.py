"""Scraper microservice — FastAPI entry point.

Receives scrape jobs from the Node.js API server, runs the scraping pipeline,
and reports results/progress back via HTTP callbacks.
"""

import asyncio
import uuid
from contextlib import asynccontextmanager
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
from utils.logger import get_logger

logger = get_logger("scraper")

# In-memory job tracking
active_jobs: dict[str, dict[str, Any]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Scraper service starting on {config.host}:{config.port}")
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
        "activeJobs": len(active_jobs),
    }


@app.post("/api/jobs", dependencies=[])
async def start_job(
    request: ScrapeJobRequest,
    x_internal_key: str = Header(...),
):
    verify_internal_key(x_internal_key)

    if request.jobId in active_jobs:
        raise HTTPException(status_code=409, detail="Job already running")

    active_jobs[request.jobId] = {
        "status": "RUNNING",
        "processed": 0,
        "total": 0,
        "errors": 0,
    }

    # Run scrape in background
    asyncio.create_task(_run_scrape_job(request))

    return {"jobId": request.jobId, "status": "STARTED"}


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str, x_internal_key: str = Header(...)):
    verify_internal_key(x_internal_key)
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = active_jobs[job_id]
    return JobStatus(jobId=job_id, **job)


@app.post("/api/jobs/{job_id}/stop")
async def stop_job(job_id: str, x_internal_key: str = Header(...)):
    verify_internal_key(x_internal_key)
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    active_jobs[job_id]["status"] = "STOPPING"
    return {"jobId": job_id, "status": "STOPPING"}


# --- Scrape Pipeline ---

async def _run_scrape_job(request: ScrapeJobRequest) -> None:
    job_id = request.jobId
    all_properties: list[dict[str, Any]] = []
    deduplicator = Deduplicator()
    fetcher = AdaptiveFetcher()
    total_errors = 0

    try:
        await report_log(job_id, "INFO", f"Starting scrape job with {len(request.sites)} site(s)")

        for site_idx, site in enumerate(request.sites):
            if active_jobs.get(job_id, {}).get("status") == "STOPPING":
                await report_log(job_id, "WARN", "Job stopped by user")
                break

            await report_log(job_id, "INFO", f"Scraping site: {site.name} ({site.baseUrl})")
            site_properties: list[dict[str, Any]] = []

            try:
                # Fetch listing pages
                page_num = 0
                while page_num < site.maxPages:
                    if active_jobs.get(job_id, {}).get("status") == "STOPPING":
                        break

                    page_url = _build_page_url(site, page_num)
                    await report_log(job_id, "DEBUG", f"Fetching page {page_num + 1}: {page_url}")

                    html = await fetcher.fetch(page_url, requires_js=site.requiresJs)
                    if not html:
                        await report_log(job_id, "WARN", f"Empty response from {page_url}")
                        break

                    # Extract listing URLs from the page
                    extractor = UniversalExtractor(site.selectors)
                    listing_urls = extractor.extract_listing_urls(html, site.baseUrl, site.listingSelector)

                    if not listing_urls:
                        await report_log(job_id, "INFO", f"No more listings found on page {page_num + 1}")
                        break

                    await report_log(job_id, "INFO", f"Found {len(listing_urls)} listings on page {page_num + 1}")

                    # Process each listing
                    for listing_url in listing_urls:
                        if len(site_properties) >= request.maxListingsPerSite:
                            break
                        if active_jobs.get(job_id, {}).get("status") == "STOPPING":
                            break

                        try:
                            listing_html = await fetcher.fetch(listing_url, requires_js=site.requiresJs)
                            if not listing_html:
                                total_errors += 1
                                continue

                            # Extract raw data
                            raw_data = extractor.extract_property(listing_html, listing_url)
                            if not raw_data:
                                total_errors += 1
                                continue

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
                            active_jobs[job_id]["processed"] = len(all_properties) + len(site_properties)
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

        active_jobs[job_id]["status"] = "COMPLETED"
        active_jobs[job_id]["processed"] = len(all_properties)
        active_jobs[job_id]["errors"] = total_errors

    except Exception as e:
        logger.exception(f"Fatal error in job {job_id}")
        active_jobs[job_id]["status"] = "FAILED"
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
