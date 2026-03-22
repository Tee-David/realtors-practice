"""Scraper microservice — LLM-powered, zero-selector property extraction.

Pipeline: Discover listing pages → Paginate → LLM extract → Enrich detail → Report
Works on ANY real estate website without manual CSS selectors.
"""

import asyncio
import os
import random
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

from config import config
from engine.adaptive_fetcher import AdaptiveFetcher
from engine.page_discovery import discover_listing_pages, is_listing_page
from pipeline.page_classifier import classify_page
from extractors.llm_extractor import (
    extract_listings_from_page,
    extract_detail_from_page,
    merge_listing_detail,
    llm_navigate,
    prioritize_nav_results,
)
from extractors.universal_nlp import detect_listing_type
from extractors.price_parser import parse_price
from extractors.location_parser import parse_location
from extractors.feature_extractor import extract_features
from pipeline.validator import validate_property
from pipeline.deduplicator import Deduplicator
from pipeline.normalizer import normalize_property
from pipeline.enricher import enrich_property
from utils.callback import (
    report_progress, report_results, report_error,
    report_log, report_property, report_learned_data,
    report_learn_results, set_api_base_url,
)
from utils.robots_checker import is_allowed as robots_allowed, get_crawl_delay
from utils.url_normalizer import normalize_url, VisitedSet
from utils.logger import get_logger

import redis

logger = get_logger("scraper")

# Redis is optional — scraper works without it (stop-job checks disabled)
try:
    redis_client = redis.Redis.from_url(config.redis_url, decode_responses=True)
    redis_client.ping()
    logger.info("Redis connected")
except Exception as _redis_err:
    redis_client = None
    logger.warning(f"Redis unavailable ({_redis_err}) — stop-job disabled")


# --- App ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Scraper service starting on {config.host}:{config.port}")
    # Log LLM provider status at startup
    from engine.llm_providers import PROVIDERS
    for p in PROVIDERS:
        status = "CONFIGURED" if p.api_key else "NO KEY"
        logger.info(f"  LLM: {p.name} ({p.model}) — {status}")
    configured = [p.name for p in PROVIDERS if p.api_key]
    if not configured:
        logger.error("WARNING: No LLM API keys configured — extraction will fail!")
    else:
        logger.info(f"  Available LLM providers: {', '.join(configured)}")
    yield
    logger.info("Scraper service shutting down")


app = FastAPI(
    title="Realtors' Practice Scraper",
    version="2.0.0",
    lifespan=lifespan,
)


# --- Models ---

class SiteConfig(BaseModel):
    id: str
    name: str
    baseUrl: str
    listPaths: list[str] = Field(default_factory=list)
    listingSelector: str = ""
    selectors: dict[str, Any] = Field(default_factory=dict)
    paginationType: str = "auto"
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

    @field_validator("callbackUrl")
    @classmethod
    def validate_callback_url(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from urllib.parse import urlparse
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("callbackUrl must use http or https scheme")
        allowed_hosts = [
            "localhost", "127.0.0.1",
            urlparse(config.api_base_url).hostname,
        ]
        if parsed.hostname not in allowed_hosts:
            raise ValueError(f"callbackUrl host '{parsed.hostname}' not in allowlist")
        return v

    def get_api_base_url(self) -> str:
        if self.callbackUrl:
            return self.callbackUrl.rstrip("/")
        return config.api_base_url


class JobStatus(BaseModel):
    jobId: str
    status: str
    processed: int = 0
    total: int = 0
    errors: int = 0


# In-memory job status tracker (for GH Actions polling)
_job_statuses: dict[str, dict] = {}


def _update_job_status(job_id: str, **kwargs):
    if job_id not in _job_statuses:
        _job_statuses[job_id] = {"status": "running", "processed": 0, "total": 0, "errors": 0}
    _job_statuses[job_id].update(kwargs)


# --- Auth ---

def verify_internal_key(x_internal_key: str = Header(...)):
    if x_internal_key != config.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid internal API key")


# --- Routes ---

@app.get("/health")
async def health():
    from engine.llm_providers import get_available_providers, PROVIDERS
    configured = [p.name for p in PROVIDERS if p.api_key]
    available = get_available_providers()
    return {
        "status": "OK" if configured else "DEGRADED",
        "service": "scraper",
        "version": "2.0.0-llm",
        "redis_connected": redis_client.ping() if redis_client else False,
        "llm_providers_configured": configured,
        "llm_providers_available": available,
        "llm_warning": None if configured else "No LLM API keys configured — extraction will fail",
    }


@app.post("/api/jobs", dependencies=[])
async def start_job(
    request: ScrapeJobRequest,
    x_internal_key: str = Header(...),
):
    verify_internal_key(x_internal_key)
    _update_job_status(request.jobId, status="running")
    asyncio.create_task(_run_scrape_job(request))
    return {"jobId": request.jobId, "status": "STARTED"}


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str, x_internal_key: str = Header(...)):
    verify_internal_key(x_internal_key)
    info = _job_statuses.get(job_id, {})
    is_stopped = (redis_client and redis_client.exists(f"job:stop:{job_id}")) if redis_client else False
    status = "STOPPING" if is_stopped else info.get("status", "unknown")
    return JobStatus(
        jobId=job_id, status=status,
        processed=info.get("processed", 0),
        total=info.get("total", 0),
        errors=info.get("errors", 0),
    )


@app.get("/api/jobs/{job_id}/status")
async def get_job_status_simple(job_id: str):
    """Unauthenticated status endpoint for GH Actions polling."""
    info = _job_statuses.get(job_id, {})
    return {"jobId": job_id, "status": info.get("status", "unknown")}


@app.post("/api/jobs/{job_id}/stop")
async def stop_job(job_id: str, x_internal_key: str = Header(...)):
    verify_internal_key(x_internal_key)
    if redis_client:
        redis_client.setex(f"job:stop:{job_id}", 86400, "1")
    return {"jobId": job_id, "status": "STOPPING"}


# --- Learn Site Endpoint ---

class LearnSiteRequest(BaseModel):
    jobId: str
    site: SiteConfig
    callbackUrl: str | None = None


@app.post("/api/learn", dependencies=[])
async def learn_site_endpoint(
    request: LearnSiteRequest,
    x_internal_key: str = Header(...),
):
    verify_internal_key(x_internal_key)
    _update_job_status(request.jobId, status="running")
    asyncio.create_task(_run_learn_job(request))
    return {"jobId": request.jobId, "status": "STARTED"}


async def _run_learn_job(request: LearnSiteRequest) -> None:
    """Run a site learning job with a 15-minute timeout."""
    if request.callbackUrl:
        set_api_base_url(request.callbackUrl)

    try:
        from pipeline.site_learner import learn_site
        from engine.llm_providers import PROVIDERS

        configured = [p.name for p in PROVIDERS if p.api_key]
        if not configured:
            error_msg = "No LLM API keys configured — cannot learn site"
            logger.error(error_msg)
            _update_job_status(request.jobId, status="failed")
            await report_error(request.jobId, error_msg)
            return

        fetcher = AdaptiveFetcher()
        try:
            result = await asyncio.wait_for(
                learn_site(request.site, request.jobId, fetcher),
                timeout=900,  # 15 minutes max
            )

            # Report results back to backend
            await report_learn_results(
                job_id=request.jobId,
                site_id=result.site_id,
                site_profile=result.site_profile,
                selectors=result.selectors,
                detail_selectors=result.detail_selectors,
                list_paths=result.list_paths,
            )
            _update_job_status(request.jobId, status="completed")
            logger.info(f"Learn job {request.jobId} completed for site {request.site.name}")

        finally:
            await fetcher.close()

    except asyncio.TimeoutError:
        logger.error(f"Learn job {request.jobId} timed out after 15 minutes")
        _update_job_status(request.jobId, status="failed")
        await report_error(request.jobId, "Learn job timed out after 15 minutes")
    except Exception as e:
        logger.exception(f"Learn job {request.jobId} failed: {e}")
        _update_job_status(request.jobId, status="failed")
        await report_error(request.jobId, str(e))


# --- Helpers ---

def _is_stopped(job_id: str) -> bool:
    return bool(redis_client and redis_client.exists(f"job:stop:{job_id}"))


def _to_property_dict(listing: dict, site_name: str, site_id: str = "") -> dict:
    """Convert LLM-extracted listing to the property format expected by the backend."""
    raw = {
        "title": listing.get("title", ""),
        "listingUrl": listing.get("listing_url", ""),
        "source": site_name,
        "siteId": site_id,
        "price_text": listing.get("price", ""),
        "location_text": listing.get("location", ""),
        "description": listing.get("description", ""),
        "bedrooms": listing.get("bedrooms"),
        "bathrooms": listing.get("bathrooms"),
        "toilets": listing.get("toilets"),
        "propertyType": listing.get("property_type", ""),
        "area": listing.get("area", ""),
        "state": listing.get("state", ""),
        "images": listing.get("images", []),
        "agentName": listing.get("agent_name", ""),
        "agentPhone": listing.get("agent_phone", ""),
        "agencyName": listing.get("agency_name", ""),
        "features_text": ", ".join(listing.get("features", []) if isinstance(listing.get("features"), list) else [str(listing.get("features", ""))]),
        "landSize": listing.get("land_size", ""),
        "buildingSize": listing.get("building_size", ""),
        "furnishing": listing.get("furnishing", ""),
        "serviceCharge": listing.get("service_charge", ""),
    }

    # Detect listing type
    raw_type = listing.get("listing_type", "") or detect_listing_type(
        raw.get("title", ""), raw.get("description", ""), raw.get("price_text", ""),
    )
    # Map to valid backend enum (SALE, RENT, LEASE, SHORTLET)
    type_map = {"sale": "SALE", "rent": "RENT", "lease": "LEASE", "shortlet": "SHORTLET", "land": "SALE"}
    raw["listingType"] = type_map.get(raw_type.lower(), "SALE") if raw_type else "SALE"

    # Parse price
    price_info = parse_price(raw.get("price_text", ""))
    raw.update(price_info)

    # Parse location
    location_info = parse_location(raw.get("location_text", ""))
    raw.update(location_info)

    # Extract features
    features = extract_features(
        raw.get("description", ""), raw.get("features_text", ""),
    )
    raw["features"] = features

    return raw


# --- Scrape Pipeline ---

async def _run_scrape_job(request: ScrapeJobRequest) -> None:
    """Run a scrape job with a hard timeout scaled to site count."""
    # Scale timeout: 10 min per site, minimum 15 min, max 90 min
    per_site_budget = 600  # 10 minutes
    job_timeout = max(900, min(len(request.sites) * per_site_budget, 5400))
    try:
        await asyncio.wait_for(
            _run_scrape_job_inner(request),
            timeout=job_timeout,
        )
        _update_job_status(request.jobId, status="completed")
    except asyncio.TimeoutError:
        mins = job_timeout // 60
        logger.error(f"Job {request.jobId} exceeded {mins}-minute timeout")
        _update_job_status(request.jobId, status="failed")
        await report_error(request.jobId, f"Job timed out after {mins} minutes")
    except Exception as e:
        logger.exception(f"Job {request.jobId} wrapper error: {e}")
        _update_job_status(request.jobId, status="failed")
        await report_error(request.jobId, str(e))


async def _scrape_single_site(
    site: "SiteDef",
    request: ScrapeJobRequest,
    job_id: str,
    fetcher: AdaptiveFetcher,
    deduplicator: Deduplicator,
    visited: VisitedSet,
) -> tuple[list[dict[str, Any]], int, int]:
    """Scrape one site. Returns (properties, errors, pages_fetched)."""
    site_properties: list[dict[str, Any]] = []
    urls_with_successful_extraction: set[str] = set()
    errors = 0
    pages_fetched = 0

    # Check robots.txt
    if not robots_allowed(site.baseUrl):
        await report_log(job_id, "WARN", f"robots.txt disallows {site.baseUrl} — skipping")
        return site_properties, errors, pages_fetched

    crawl_delay = get_crawl_delay(site.baseUrl)

    # ─── PHASE 1: Determine listing page URLs ───
    listing_page_urls: list[str] = []

    if site.listPaths and any(lp.strip() for lp in site.listPaths):
        for lp in site.listPaths:
            lp = lp.strip()
            if not lp:
                continue
            if lp.startswith("http"):
                listing_page_urls.append(lp)
            else:
                listing_page_urls.append(site.baseUrl.rstrip("/") + "/" + lp.lstrip("/"))
        await report_log(job_id, "INFO", f"[{site.name}] Using {len(listing_page_urls)} configured list paths")
    else:
        await report_log(job_id, "INFO", f"[{site.name}] No listPaths — LLM navigating to find listing pages...")
        homepage_html = await fetcher.fetch(site.baseUrl, requires_js=True)

        if homepage_html:
            pages_fetched += 1
            nav_results = await llm_navigate(
                homepage_html, site.baseUrl,
                site_name=site.name,
                existing_list_paths=site.listPaths if site.listPaths else None,
            )
            if nav_results:
                llm_urls = prioritize_nav_results(nav_results, max_urls=8)
                listing_page_urls.extend(llm_urls)
                categories = set(r.get("listing_type", "?") for r in nav_results)
                await report_log(job_id, "INFO",
                    f"[{site.name}] LLM identified {len(llm_urls)} listing pages "
                    f"(categories: {', '.join(categories)})")
            else:
                discovered = discover_listing_pages(homepage_html, site.baseUrl, max_results=5)
                if discovered:
                    listing_page_urls.extend(discovered)
                    await report_log(job_id, "INFO",
                        f"[{site.name}] Keyword discovery found {len(discovered)} listing pages")
                elif is_listing_page(homepage_html):
                    listing_page_urls.append(site.baseUrl)
                    await report_log(job_id, "INFO", f"[{site.name}] Homepage itself has listings")
                else:
                    await report_log(job_id, "WARN", f"[{site.name}] Could not find listing pages — skipping")
                    return site_properties, errors + 1, pages_fetched
        else:
            await report_log(job_id, "ERROR", f"[{site.name}] Could not fetch homepage")
            return site_properties, errors + 1, pages_fetched

    await report_log(job_id, "INFO", f"[{site.name}] Listing pages to crawl: {listing_page_urls[:5]}")

    # ─── PHASE 2: Crawl listing pages with pagination ───
    for lp_url in listing_page_urls:
        if len(site_properties) >= request.maxListingsPerSite:
            break
        if _is_stopped(job_id):
            break

        await report_log(job_id, "INFO", f"[{site.name}] Crawling: {lp_url}")

        probe_html = await fetcher.fetch(lp_url, requires_js=True)
        if probe_html:
            page_type = classify_page(probe_html, lp_url)
            if page_type == "category":
                await report_log(job_id, "DEBUG",
                    f"[{site.name}] Page classified as category (will still attempt extraction): {lp_url}")

        collected_pages = await fetcher.render_and_collect_pages(
            lp_url, max_pages=site.maxPages,
        )

        if not collected_pages:
            html = probe_html if (probe_html and len(probe_html) > 500) else await fetcher.fetch(lp_url, requires_js=True)
            if html and len(html) > 500:
                collected_pages = [(lp_url, html)]
            else:
                await report_log(job_id, "WARN", f"[{site.name}] Could not fetch {lp_url}")
                errors += 1
                continue

        await report_log(job_id, "INFO",
            f"[{site.name}] Collected {len(collected_pages)} pages from {lp_url}")
        pages_fetched += len(collected_pages)

        # ─── PHASE 3: LLM extraction from each page ───
        consecutive_empty = 0

        for page_num, (page_url, html) in enumerate(collected_pages):

            if len(site_properties) >= request.maxListingsPerSite:
                break
            if _is_stopped(job_id):
                break

            page_type = classify_page(html, page_url)
            if page_type == "category":
                await report_log(job_id, "DEBUG",
                    f"[{site.name}] Page {page_num + 1} classified as category (attempting extraction anyway)")

            listings = None

            # Try CSS selectors first (free, fast)
            stored_selectors = site.selectors or {}
            container_sel = stored_selectors.get("listing_container", "")
            field_sels = {
                k: v for k, v in stored_selectors.items()
                if k not in ("listing_container", "_confidence", "_learned_at", "_stale",
                             "listingSelector", "listing_link", "paginationConfig",
                             "delayMin", "delayMax")
                and isinstance(v, str) and v
            }

            if container_sel and field_sels and not stored_selectors.get("_stale"):
                from extractors.selector_learner import extract_with_selectors
                css_listings = extract_with_selectors(html, container_sel, field_sels)
                if css_listings and len(css_listings) >= 2:
                    listings = css_listings
                    await report_log(job_id, "INFO",
                        f"[{site.name}] CSS selectors extracted {len(listings)} listings "
                        f"from page {page_num + 1} (no LLM needed)")

            # Fall back to LLM extraction
            if listings is None:
                from engine.llm_providers import get_available_providers
                avail = get_available_providers()
                if not avail:
                    await report_log(job_id, "ERROR",
                        f"[{site.name}] No LLM providers available!")
                    errors += 1
                    break

                await report_log(job_id, "INFO",
                    f"[{site.name}] LLM extracting listings from page {page_num + 1} (providers: {', '.join(avail)})...")

                listings = await extract_listings_from_page(
                    html, page_url, site_name=site.name,
                )

                # Learn selectors from successful LLM extraction
                if listings and len(listings) >= 2:
                    try:
                        from extractors.selector_learner import learn_selectors_from_extraction
                        learned = learn_selectors_from_extraction(html, listings, page_url)
                        if learned and learned.confidence >= 0.5:
                            await report_learned_data(
                                job_id=job_id, site_id=site.id,
                                selectors={
                                    "listing_container": learned.listing_container,
                                    **learned.fields,
                                    "_confidence": learned.confidence,
                                    "_learned_at": learned.learned_at,
                                },
                            )
                            await report_log(job_id, "INFO",
                                f"[{site.name}] Learned {len(learned.fields)} CSS selectors "
                                f"(confidence: {learned.confidence:.0%})")
                    except Exception as e:
                        logger.debug(f"Selector learning failed for {site.name}: {e}")


            if not listings:

                await report_log(job_id, "WARN",
                    f"[{site.name}] No listings extracted from page {page_num + 1}")
                consecutive_empty += 1
                if consecutive_empty >= 3:
                    await report_log(job_id, "INFO",
                        f"[{site.name}] 3 consecutive empty pages, moving to next path")
                    break
                continue

            consecutive_empty = 0
            urls_with_successful_extraction.add(page_url)

            logger.info(f"[{site.name}] Found {len(listings)} listings on page {page_num + 1}")
            await report_log(job_id, "INFO",
                f"[{site.name}] Found {len(listings)} listings on page {page_num + 1}")

            # ─── PHASE 4: Process listings ───
            for listing in listings:
                if len(site_properties) >= request.maxListingsPerSite:
                    break
                if _is_stopped(job_id):
                    break

                try:
                    raw_data = _to_property_dict(listing, site.name, site.id)
                    normalized = normalize_property(raw_data, site.name)
                    validated = validate_property(normalized)

                    if deduplicator.is_duplicate(validated):
                        logger.debug(f"Duplicate detected: {validated.get('title', 'unknown')[:60]}")
                        continue

                    site_properties.append(validated)

                    await report_property(job_id, {
                        "title": validated.get("title"),
                        "price": validated.get("price"),
                        "location": validated.get("area") or validated.get("state"),
                        "bedrooms": validated.get("bedrooms"),
                        "bathrooms": validated.get("bathrooms"),
                        "image": (validated.get("images") or [None])[0],
                        "source": site.name,
                    })

                except Exception as e:
                    errors += 1

                    logger.exception(f"[{site.name}] Error processing listing: {str(e)[:200]}")
                    await report_log(job_id, "ERROR",
                        f"[{site.name}] Error processing listing: {str(e)[:200]}")

    # ─── Persist learned listPaths ───
    if (site_properties
        and urls_with_successful_extraction
        and not (site.listPaths and any(lp.strip() for lp in site.listPaths))):
        validated_paths = []
        for url in urls_with_successful_extraction:
            path = urlparse(url).path
            if path and path != "/":
                validated_paths.append(path)
        if validated_paths:
            try:
                await report_learned_data(job_id=job_id, site_id=site.id, list_paths=validated_paths)
                await report_log(job_id, "INFO",
                    f"[{site.name}] Saved {len(validated_paths)} validated listPaths for future scrapes")
            except Exception as e:
                logger.warning(f"Failed to persist listPaths for {site.name}: {e}")

    # Send properties incrementally per-site
    if site_properties:
        site_stats = {
            "totalScraped": len(site_properties),
            "totalErrors": errors,
            "sitesProcessed": 1,
            "duplicatesSkipped": deduplicator.duplicate_count,
            "incremental": True,
        }
        await report_results(job_id, site_properties, site_stats)
        await report_log(job_id, "INFO",
            f"[{site.name}] Sent {len(site_properties)} properties to backend")

    logger.info(f"Site {site.name}: scraped {len(site_properties)} properties, {errors} errors")
    await report_log(job_id, "INFO",
        f"Site {site.name}: scraped {len(site_properties)} properties")

    return site_properties, errors, pages_fetched


async def _run_scrape_job_inner(request: ScrapeJobRequest) -> None:
    """Core scrape pipeline with concurrent site processing.

    Runs up to 3 sites in parallel, each with a 10-minute timeout.
    Properties are sent incrementally per-site for crash resilience.
    """
    job_id = request.jobId
    all_properties: list[dict[str, Any]] = []
    deduplicator = Deduplicator()
    visited = VisitedSet()
    total_errors = 0
    total_pages_fetched = 0

    if request.callbackUrl:
        set_api_base_url(request.callbackUrl)

    try:
        # Check LLM providers upfront
        from engine.llm_providers import get_available_providers, PROVIDERS
        avail = get_available_providers()
        configured = [p.name for p in PROVIDERS if p.api_key]
        if not configured:
            error_msg = "FATAL: No LLM API keys configured. Set at least one: GROQ_API_KEY, CEREBRAS_API_KEY, SAMBANOVA_API_KEY, GEMINI_API_KEY"
            await report_log(job_id, "ERROR", error_msg)
            await report_error(job_id, error_msg)
            return

        batch_index = request.parameters.get("batchIndex")
        total_batches = request.parameters.get("totalBatches", 1)
        if total_batches > 1:
            await report_log(job_id, "INFO",
                f"Batch {batch_index + 1}/{total_batches}: scraping {len(request.sites)} site(s)")
        else:
            await report_log(job_id, "INFO", f"Starting scrape job with {len(request.sites)} site(s)")
        await report_log(job_id, "INFO", f"LLM providers configured: {', '.join(configured)} (available now: {', '.join(avail)})")

        # Concurrency: run up to 3 sites in parallel (limited by LLM rate limits)
        concurrency = min(3, len(request.sites))
        semaphore = asyncio.Semaphore(concurrency)
        per_site_timeout = 600  # 10 minutes per site

        async def _scrape_with_limit(site):
            """Run a single site with its own fetcher, semaphore + timeout."""
            async with semaphore:
                if _is_stopped(job_id):
                    return [], 0, 0
                # Each site gets its own fetcher (own browser context) for isolation
                site_fetcher = AdaptiveFetcher()
                try:
                    logger.info(f"Scraping site: {site.name} ({site.baseUrl})")
                    await report_log(job_id, "INFO", f"Scraping site: {site.name} ({site.baseUrl})")
                    return await asyncio.wait_for(
                        _scrape_single_site(site, request, job_id, site_fetcher, deduplicator, visited),
                        timeout=per_site_timeout,
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"[{site.name}] Timed out after {per_site_timeout // 60} minutes")
                    await report_log(job_id, "WARN",
                        f"[{site.name}] Timed out after {per_site_timeout // 60} minutes — moving on")
                    return [], 1, 0
                except Exception as e:
                    logger.error(f"Error scraping site {site.name}: {str(e)[:200]}")
                    await report_log(job_id, "ERROR", f"Error scraping site {site.name}: {str(e)}")
                    return [], 1, 0
                finally:
                    await site_fetcher.close()

        # Launch all sites concurrently (semaphore limits parallelism)
        results = await asyncio.gather(
            *[_scrape_with_limit(site) for site in request.sites],
            return_exceptions=True,
        )

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                total_errors += 1
                await report_log(job_id, "ERROR",
                    f"Site {request.sites[i].name} crashed: {str(result)[:200]}")
            else:
                props, errs, pages = result
                all_properties.extend(props)
                total_errors += errs
                total_pages_fetched += pages

        # Report final completion
        stats = {
            "totalScraped": len(all_properties),
            "totalErrors": total_errors,
            "sitesProcessed": len(request.sites),
            "duplicatesSkipped": deduplicator.duplicate_count,
        }
        await report_results(job_id, [], stats)

        # End-of-job summary
        batch_label = ""
        if total_batches > 1:
            batch_label = f"[Batch {batch_index + 1}/{total_batches}] "
        summary = (
            f"{batch_label}SCRAPE COMPLETE: {len(request.sites)} sites, "
            f"{len(all_properties)} properties found, "
            f"{deduplicator.duplicate_count} duplicates skipped, "
            f"{total_errors} errors, "
            f"{total_pages_fetched} pages fetched"
        )
        await report_log(job_id, "INFO", summary)
        logger.info(summary)

    except Exception as e:
        logger.exception(f"Fatal error in job {job_id}")
        await report_error(job_id, str(e))

    finally:
        pass  # Each site_fetcher is closed in _scrape_with_limit


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host=config.host, port=config.port, reload=True)
