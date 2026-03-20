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
from urllib.parse import urlparse

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

from config import config
from bs4 import BeautifulSoup
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
from pipeline.page_classifier import should_skip_page, classify_page
from pipeline.incremental import IncrementalTracker
from pipeline.relevance_scorer import RelevanceScorer
# pagination_strategy no longer used — render_and_collect_pages handles pagination
from utils.callback import report_progress, report_results, report_error, report_log, report_property
from utils.robots_checker import is_allowed as robots_allowed, get_crawl_delay
from utils.url_normalizer import normalize_url, VisitedSet, is_valid_property_url
from utils.logger import get_logger

import redis

logger = get_logger("scraper")

# Redis is optional — scraper works without it (stop-job checks disabled)
try:
    redis_client = redis.Redis.from_url(config.redis_url, decode_responses=True)
    redis_client.ping()
    logger.info("Redis connected")
except Exception as _redis_err:
    logger.warning(f"Redis unavailable ({_redis_err}) — stop-job and selector cache disabled")
    redis_client = None


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
    listPaths: list[str] = Field(default_factory=list)
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

    @field_validator("callbackUrl")
    @classmethod
    def validate_callback_url(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from urllib.parse import urlparse
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("callbackUrl must use http or https scheme")
        # Allow localhost in dev, restrict to known hosts in production
        allowed_hosts = [
            "localhost", "127.0.0.1",
            urlparse(config.api_base_url).hostname,
        ]
        if parsed.hostname not in allowed_hosts:
            raise ValueError(f"callbackUrl host '{parsed.hostname}' not in allowlist")
        return v

    def get_api_base_url(self) -> str:
        """Return the callback URL from payload, or fall back to config."""
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
    return {
        "status": "OK",
        "service": "scraper",
        "redis_connected": redis_client.ping() if redis_client else False
    }


@app.post("/api/jobs", dependencies=[])
async def start_job(
    request: ScrapeJobRequest,
    x_internal_key: str = Header(...),
):
    verify_internal_key(x_internal_key)

    # Track job status and run in-process
    _update_job_status(request.jobId, status="running")
    asyncio.create_task(_run_scrape_job(request))

    return {"jobId": request.jobId, "status": "STARTED"}


@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str, x_internal_key: str = Header(...)):
    verify_internal_key(x_internal_key)
    info = _job_statuses.get(job_id, {})
    is_stopped = (redis_client and redis_client.exists(f"job:stop:{job_id}")) if redis_client else False
    status = "STOPPING" if is_stopped else info.get("status", "unknown")
    return JobStatus(jobId=job_id, status=status, processed=info.get("processed", 0), total=info.get("total", 0), errors=info.get("errors", 0))


@app.get("/api/jobs/{job_id}/status")
async def get_job_status_simple(job_id: str):
    """Unauthenticated status endpoint for GH Actions polling."""
    info = _job_statuses.get(job_id, {})
    return {"jobId": job_id, "status": info.get("status", "unknown")}


@app.post("/api/jobs/{job_id}/stop")
async def stop_job(job_id: str, x_internal_key: str = Header(...)):
    verify_internal_key(x_internal_key)
    if redis_client:
        redis_client.setex(f"job:stop:{job_id}", 86400, "1")  # Expire after 24h
    return {"jobId": job_id, "status": "STOPPING"}


# --- Scrape Pipeline ---

async def _run_scrape_job(request: ScrapeJobRequest) -> None:
    """Run a scrape job with a hard timeout of 30 minutes."""
    try:
        await asyncio.wait_for(
            _run_scrape_job_inner(request),
            timeout=1800,  # 30 minutes max
        )
        _update_job_status(request.jobId, status="completed")
    except asyncio.TimeoutError:
        logger.error(f"Job {request.jobId} exceeded 30-minute timeout")
        _update_job_status(request.jobId, status="failed")
        await report_error(request.jobId, "Job timed out after 30 minutes")
    except Exception as e:
        logger.exception(f"Job {request.jobId} wrapper error: {e}")
        _update_job_status(request.jobId, status="failed")


async def _run_scrape_job_inner(request: ScrapeJobRequest) -> None:
    job_id = request.jobId
    all_properties: list[dict[str, Any]] = []
    deduplicator = Deduplicator()
    fetcher = AdaptiveFetcher()
    visited = VisitedSet()
    total_errors = 0
    block_count = 0
    total_pages_fetched = 0

    # Use callbackUrl from payload if provided (so production callbacks go to the right place)
    if request.callbackUrl:
        from utils.callback import set_api_base_url
        set_api_base_url(request.callbackUrl)

    try:
        await report_log(job_id, "INFO", f"Starting scrape job with {len(request.sites)} site(s)")

        for site_idx, site in enumerate(request.sites):
            if (redis_client and redis_client.exists(f"job:stop:{job_id}")):
                await report_log(job_id, "WARN", "Job stopped by user")
                break

            await report_log(job_id, "INFO", f"Scraping site: {site.name} ({site.baseUrl})")
            # Report initial progress for this site so frontend moves past "Initialising"
            await report_progress(
                job_id,
                processed=len(all_properties),
                total=request.maxListingsPerSite * len(request.sites),
                current_site=site.name,
                current_page=0,
                max_pages=site.maxPages,
                pages_fetched=total_pages_fetched,
                properties_found=len(all_properties),
                duplicates=0,
                errors=total_errors,
            )
            site_properties: list[dict[str, Any]] = []

            # Initialize per-site pipeline improvements
            incremental = IncrementalTracker(
                redis_client=redis_client,
                site_id=site.id,
                consecutive_threshold=5,
            )
            relevance_scorer = RelevanceScorer(threshold=40)

            try:
                # Check robots.txt before scraping
                if not robots_allowed(site.baseUrl):
                    await report_log(job_id, "WARN", f"robots.txt disallows scraping {site.baseUrl} — skipping site")
                    continue

                # Respect Crawl-Delay from robots.txt if set
                crawl_delay = get_crawl_delay(site.baseUrl)
                if crawl_delay:
                    await report_log(job_id, "INFO", f"robots.txt Crawl-Delay: {crawl_delay}s for {site.name}")

                # Build starting URLs from listPaths (fall back to baseUrl if none)
                start_urls = []
                if site.listPaths:
                    for lp in site.listPaths:
                        if lp.startswith("http"):
                            start_urls.append(lp)
                        else:
                            start_urls.append(site.baseUrl.rstrip("/") + "/" + lp.lstrip("/"))
                else:
                    start_urls = [site.baseUrl]

                await report_log(job_id, "INFO", f"Starting URLs for {site.name}: {start_urls}")

                for start_url in start_urls:
                    if len(site_properties) >= request.maxListingsPerSite:
                        break
                    if (redis_client and redis_client.exists(f"job:stop:{job_id}")):
                        break

                    await report_log(job_id, "INFO", f"Crawling path: {start_url}")

                    # Reset incremental tracker consecutive counter for each start path
                    incremental.reset_consecutive()

                    # Collect all listing pages using browser-session pagination.
                    # This keeps Playwright alive across pages (handles SPAs, JS pagination,
                    # cookie state). Falls back to per-page fetch if browser pagination fails.
                    await report_log(job_id, "INFO", f"[{site.name}] Using browser-session pagination for {start_url}")
                    collected_pages = await fetcher.render_and_collect_pages(
                        start_url, max_pages=site.maxPages
                    )

                    if not collected_pages:
                        # Fallback: single-page fetch (the browser session approach failed)
                        await report_log(job_id, "WARN", f"[{site.name}] Browser pagination returned nothing, falling back to single fetch")
                        html = await fetcher.fetch(start_url, requires_js=site.requiresJs)
                        if html and len(html) > 500:
                            collected_pages = [(start_url, html)]

                    if not collected_pages:
                        await report_log(job_id, "ERROR", f"[{site.name}] Could not fetch any pages from {start_url}")
                        total_errors += 1
                        continue

                    await report_log(job_id, "INFO", f"[{site.name}] Collected {len(collected_pages)} listing pages")

                    for page_num, (page_url, html) in enumerate(collected_pages):
                        if len(site_properties) >= request.maxListingsPerSite:
                            break
                        if (redis_client and redis_client.exists(f"job:stop:{job_id}")):
                            break

                        total_pages_fetched += 1

                        # Phase 3.5: Category page detection — skip index/directory pages
                        # But on first pages, don't break — they might be homepages
                        # that need auto-discovery of listing subpages
                        if should_skip_page(html, page_url):
                            if page_num == 0:
                                await report_log(job_id, "INFO", f"[{site.name}] Page looks like category/index, will auto-discover listings")
                            else:
                                await report_log(job_id, "INFO", f"[{site.name}] Skipping category/index page: {page_url}")
                                break

                        # Check for cached LLM-discovered selectors (self-healing)
                        effective_selectors = dict(site.selectors)
                        try:
                            from extractors.selector_cache import get_cached_selectors
                            domain = urlparse(site.baseUrl).netloc
                            cached = get_cached_selectors(domain)
                            if cached:
                                # Merge cached selectors (cached take priority for fields that exist)
                                for field, sel in cached.items():
                                    if field in effective_selectors:
                                        # Prepend cached selector as higher-priority fallback
                                        effective_selectors[field] = f"{sel} | {effective_selectors[field]}"
                                    else:
                                        effective_selectors[field] = sel
                                await report_log(job_id, "DEBUG", f"Using {len(cached)} cached selectors for {domain}")
                        except Exception:
                            pass

                        # Extract listing URLs from the page
                        extractor = UniversalExtractor(effective_selectors)

                        # First try JSON-LD for listing URLs
                        json_ld_list = extractor.extract_json_ld(html)
                        json_ld_properties = extractor.harvest_properties_from_json_ld(json_ld_list, page_url)
                        json_ld_urls = [
                            p["listingUrl"] for p in json_ld_properties
                            if p.get("listingUrl") and p["listingUrl"] != page_url
                        ]

                        # Then try CSS selectors
                        raw_listing_urls = extractor.extract_listing_urls(html, site.baseUrl, site.listingSelector)

                        # Merge: JSON-LD URLs first (higher confidence), then CSS URLs
                        all_raw_urls = json_ld_urls.copy()
                        for u in raw_listing_urls:
                            if u not in all_raw_urls:
                                all_raw_urls.append(u)
                        raw_listing_urls = all_raw_urls if all_raw_urls else raw_listing_urls

                        # Phase 3.5: Relevance scoring fallback — if CSS selectors found nothing,
                        # use multi-signal element scoring to find property listing URLs
                        if not raw_listing_urls:
                            await report_log(job_id, "DEBUG", f"[{site.name}] CSS selectors found nothing, trying relevance scorer")
                            relevance_urls = relevance_scorer.extract_listing_urls_by_relevance(
                                html, site.baseUrl
                            )
                            if relevance_urls:
                                raw_listing_urls = relevance_urls
                                await report_log(job_id, "INFO", f"[{site.name}] Relevance scorer found {len(relevance_urls)} candidate URLs")

                        # Auto-discover listing pages when no property URLs found
                        # This triggers on homepages, category pages, or any page
                        # that doesn't have direct property listing links
                        if not raw_listing_urls and page_num == 0:
                            await report_log(job_id, "INFO", f"[{site.name}] Homepage has no listings, auto-discovering listing pages...")
                            from bs4 import BeautifulSoup
                            from urllib.parse import urljoin
                            soup = BeautifulSoup(html, "html.parser")
                            listing_keywords = [
                                "propert", "listing", "for-sale", "for-rent", "buy",
                                "rent", "sell", "estate", "apartment", "house",
                                "duplex", "flat", "land", "search", "catalog",
                                "status/", "property-type/", "/city/", "/area/",
                            ]
                            discovered_paths = []
                            for a_tag in soup.find_all("a", href=True):
                                href = a_tag["href"]
                                if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                                    continue
                                full_url = urljoin(page_url, href)
                                # Only follow internal links
                                if urlparse(full_url).netloc != urlparse(site.baseUrl).netloc:
                                    continue
                                href_lower = full_url.lower()
                                link_text = (a_tag.get_text() or "").lower().strip()
                                # Check if URL or link text contains listing keywords
                                if any(kw in href_lower or kw in link_text for kw in listing_keywords):
                                    norm = normalize_url(full_url)
                                    if norm not in [normalize_url(su) for su in start_urls] and norm not in [normalize_url(su) for su in discovered_paths]:
                                        discovered_paths.append(full_url)
                            if discovered_paths:
                                # Add top matches to start_urls for crawling
                                for dp in discovered_paths[:10]:
                                    start_urls.append(dp)
                                await report_log(job_id, "INFO",
                                    f"[{site.name}] Discovered {len(discovered_paths)} listing pages from homepage, queued {min(len(discovered_paths), 10)} for crawling")
                            else:
                                # Last resort: try common property listing URL patterns
                                base = site.baseUrl.rstrip("/")
                                common_paths = [
                                    "/properties", "/listings", "/for-sale", "/for-rent",
                                    "/buy", "/rent", "/search", "/all-properties",
                                    "/real-estate", "/homes", "/property",
                                ]
                                await report_log(job_id, "INFO", f"[{site.name}] Trying common listing URL patterns...")
                                for cp in common_paths:
                                    candidate = base + cp
                                    if normalize_url(candidate) not in [normalize_url(su) for su in start_urls]:
                                        start_urls.append(candidate)
                                await report_log(job_id, "INFO", f"[{site.name}] Queued {len(common_paths)} common paths to try")

                        # Filter invalid URLs, normalize, and deduplicate via visited set
                        listing_urls = []
                        incremental_stop = False
                        for u in raw_listing_urls:
                            if not is_valid_property_url(u):
                                continue
                            normalized = normalize_url(u)
                            if not visited.add(normalized):
                                continue

                            # Phase 3.5: Incremental scraping — track seen URLs,
                            # stop after N consecutive already-known URLs
                            is_new = incremental.check_and_track(normalized)
                            if incremental.should_stop:
                                await report_log(
                                    job_id, "INFO",
                                    f"[{site.name}] Incremental stop: {incremental.consecutive_known} "
                                    f"consecutive known URLs — assuming remaining pages are old"
                                )
                                incremental_stop = True
                                break

                            if is_new:
                                listing_urls.append(normalized)

                        if incremental_stop:
                            # Don't stop on page 1 — there may be new listings on later pages
                            if page_num == 0:
                                await report_log(job_id, "INFO", f"[{site.name}] Incremental stop on page 1, continuing to check next pages")
                                incremental.reset_consecutive()
                            else:
                                break

                        if not listing_urls:
                            # Allow advancing past up to 2 empty pages before giving up
                            if page_num < 2:
                                await report_log(job_id, "DEBUG", f"[{site.name}] No new listings on page {page_num + 1}, trying next page")
                                continue
                            else:
                                await report_log(job_id, "INFO", f"[{site.name}] No more listings found on page {page_num + 1}")
                                break

                        skipped = len(raw_listing_urls) - len(listing_urls)
                        if skipped:
                            await report_log(job_id, "DEBUG", f"Skipped {skipped} already-visited/known URLs on page {page_num + 1}")
                        await report_log(job_id, "INFO", f"[{site.name}] Found {len(listing_urls)} new listings on page {page_num + 1}")

                        # Process each listing
                        for listing_url in listing_urls:
                            if len(site_properties) >= request.maxListingsPerSite:
                                break
                            if (redis_client and redis_client.exists(f"job:stop:{job_id}")):
                                break

                            try:
                                listing_html = await fetcher.fetch(listing_url, requires_js=site.requiresJs)
                                if not listing_html:
                                    total_errors += 1
                                    if fetcher.last_block_reason:
                                        block_count += 1
                                        await report_log(job_id, "WARN", f"Blocked ({fetcher.last_block_reason}): {listing_url}")
                                        if block_count >= 3:
                                            await report_log(job_id, "WARN", f"Multiple blocks detected for {site.name} — slowing down")
                                            await asyncio.sleep(random.uniform(10, 20))
                                    continue

                                # Extract raw data — JSON-LD first, CSS selectors as fallback
                                raw_data = extractor.extract_property_with_json_ld(listing_html, listing_url)
                                if not raw_data:
                                    total_errors += 1
                                    _save_snapshot(site.name, listing_url, listing_html)
                                    await report_log(job_id, "WARN", f"No data extracted from {listing_url}, snapshot saved")
                                    continue

                                # LLM Fallback if crucial data is missing (Layer 3: Crawl4AI + Gemini)
                                if not raw_data.get("price_text") or not raw_data.get("bedrooms") or not raw_data.get("location_text"):
                                    await report_log(job_id, "DEBUG", f"Missing data for {listing_url}, attempting LLM fallback...")
                                    try:
                                        # Try Crawl4AI → Markdown → Gemini extraction first
                                        markdown = await fetcher.fetch_as_markdown(listing_url)
                                        if markdown:
                                            from extractors.llm_schema_extractor import extract_property_from_markdown, discover_selectors
                                            llm_data = extract_property_from_markdown(markdown, listing_url)
                                            if llm_data:
                                                # Merge LLM data into existing (fill gaps only)
                                                for key, value in llm_data.items():
                                                    if value is not None and not raw_data.get(key):
                                                        raw_data[key] = value
                                                await report_log(job_id, "INFO", f"LLM extraction filled gaps for {listing_url}")

                                                # Self-healing: discover CSS selectors for next time
                                                discovered = discover_selectors(listing_html, llm_data)
                                                if discovered:
                                                    from extractors.selector_cache import save_selectors
                                                    domain = urlparse(site.baseUrl).netloc
                                                    save_selectors(domain, discovered)
                                                    await report_log(job_id, "INFO", f"Self-healed: cached {len(discovered)} selectors for {domain}")
                                            else:
                                                # Fall back to plain text extraction
                                                from extractors.llm_schema_extractor import extract_with_llm
                                                page_text = BeautifulSoup(listing_html, "lxml").get_text(separator=" ", strip=True)
                                                raw_data = extract_with_llm(page_text, raw_data)
                                        else:
                                            # Crawl4AI unavailable, fall back to plain text
                                            from extractors.llm_schema_extractor import extract_with_llm
                                            page_text = BeautifulSoup(listing_html, "lxml").get_text(separator=" ", strip=True)
                                            raw_data = extract_with_llm(page_text, raw_data)
                                    except Exception as llm_err:
                                        await report_log(job_id, "DEBUG", f"LLM fallback error: {str(llm_err)[:200]}")

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

                                # LLM normalization for fields that regex parsers couldn't handle
                                # Only calls LLM when key fields are still missing or raw text
                                if (
                                    not raw_data.get("price")
                                    or not isinstance(raw_data.get("bedrooms"), int)
                                    or not raw_data.get("state")
                                    or not raw_data.get("area")
                                    or (not raw_data.get("landSizeSqm") and not raw_data.get("buildingSizeSqm") and raw_data.get("area_size_text"))
                                ):
                                    try:
                                        from extractors.llm_schema_extractor import normalize_with_llm
                                        raw_data = normalize_with_llm(raw_data)
                                    except Exception as norm_err:
                                        await report_log(job_id, "DEBUG", f"LLM normalization error: {str(norm_err)[:200]}")

                                # Normalize
                                normalized = normalize_property(raw_data, site.name)

                                # Validate + quality score
                                validated = validate_property(normalized)

                                # Dedup check
                                if deduplicator.is_duplicate(validated):
                                    await report_log(job_id, "DEBUG", f"Duplicate skipped: {validated.get('title', '')[:50]}")
                                    continue

                                site_properties.append(validated)

                                # Phase 3.5: Mark URL as scraped for incremental tracking
                                incremental.mark_scraped(listing_url)

                                # Report property to frontend for live feed
                                await report_property(job_id, {
                                    "title": validated.get("title"),
                                    "price": validated.get("price"),
                                    "location": validated.get("area") or validated.get("state"),
                                    "bedrooms": validated.get("bedrooms"),
                                    "bathrooms": validated.get("bathrooms"),
                                    "image": (validated.get("images") or [None])[0],
                                    "source": site.name,
                                })

                                # Update progress
                                await report_progress(
                                    job_id,
                                    processed=len(all_properties) + len(site_properties),
                                    total=request.maxListingsPerSite * len(request.sites),
                                    current_site=site.name,
                                    current_page=page_num + 1,
                                    max_pages=site.maxPages,
                                    pages_fetched=total_pages_fetched,
                                    properties_found=len(all_properties) + len(site_properties),
                                    duplicates=deduplicator.duplicate_count,
                                    errors=total_errors,
                                )

                            except Exception as e:
                                total_errors += 1
                                await report_log(job_id, "ERROR", f"[{site.name}] Error processing {listing_url}: {str(e)}")

                        # Pagination is handled by render_and_collect_pages() above —
                        # no per-page URL building needed here

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host=config.host, port=config.port, reload=True)
