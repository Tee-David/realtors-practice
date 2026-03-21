"""Site Intelligence Learner — explore a site's structure and build a persistent profile.

Runs as a dedicated "learn" job before any scraping. Discovers:
- Listing entry points (sale, rent, shortlet pages)
- Pagination patterns
- Anti-bot/fetching requirements
- CSS selectors (from sample extraction)
- Price format patterns
- Hidden JSON APIs

The profile is stored in the DB and used by the scraper for fast, accurate extraction.
"""

import asyncio
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from engine.adaptive_fetcher import AdaptiveFetcher
from extractors.llm_extractor import (
    extract_listings_from_page,
    llm_navigate,
    prioritize_nav_results,
    html_to_clean_text,
)
from extractors.selector_learner import learn_selectors_from_extraction
from pipeline.page_classifier import classify_page, _is_listing_page
from engine.page_discovery import discover_listing_pages, is_listing_page
from utils.callback import report_log
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class LearnResult:
    """Result of a site learning session."""
    site_id: str
    site_profile: dict
    selectors: dict | None = None
    detail_selectors: dict | None = None
    list_paths: list[str] = field(default_factory=list)
    learn_duration_ms: int = 0
    llm_calls_used: int = 0


async def learn_site(
    site: Any,
    job_id: str,
    fetcher: AdaptiveFetcher,
) -> LearnResult:
    """Main entry point: explore a site and build its intelligence profile.

    Steps:
    1. Fetch homepage, assess anti-bot/fetching needs
    2. LLM navigates to find all listing entry points (sale/rent/shortlet)
    3. For each entry point: fetch, validate with sample extraction
    4. Detect pagination pattern
    5. Learn CSS selectors from samples
    6. Analyze price formats
    7. Compute estimates
    """
    start_time = time.time()
    llm_calls = 0

    await report_log(job_id, "INFO", f"[Learn] Starting site learning for {site.name} ({site.baseUrl})")

    # Step 1: Fetch homepage and assess fetching strategy
    await report_log(job_id, "INFO", f"[Learn] Fetching homepage...")
    fetching_info = await _assess_fetching(site.baseUrl, fetcher)

    homepage_html = fetching_info.get("html")
    if not homepage_html:
        await report_log(job_id, "ERROR", f"[Learn] Could not fetch homepage for {site.name}")
        return LearnResult(
            site_id=site.id,
            site_profile=_build_failed_profile(fetching_info, start_time),
        )

    await report_log(job_id, "INFO",
        f"[Learn] Homepage fetched ({len(homepage_html)} chars, strategy: {fetching_info.get('strategy', '?')})")

    # Step 2: Discover entry points via LLM navigation
    await report_log(job_id, "INFO", f"[Learn] LLM navigating to find listing pages...")
    nav_results = await llm_navigate(
        homepage_html, site.baseUrl,
        site_name=site.name,
        existing_list_paths=site.listPaths if site.listPaths else None,
    )
    llm_calls += 1

    candidate_urls: list[str] = []
    if nav_results:
        candidate_urls = prioritize_nav_results(nav_results, max_urls=10)
        await report_log(job_id, "INFO", f"[Learn] LLM found {len(candidate_urls)} candidate URLs")
    else:
        # Fallback: keyword discovery
        discovered = discover_listing_pages(homepage_html, site.baseUrl, max_results=5)
        if discovered:
            candidate_urls = discovered
            await report_log(job_id, "INFO", f"[Learn] Keyword discovery found {len(discovered)} URLs")
        elif is_listing_page(homepage_html):
            candidate_urls = [site.baseUrl]
            await report_log(job_id, "INFO", f"[Learn] Homepage itself has listings")

    # Build nav_results lookup for category info
    nav_lookup: dict[str, dict] = {}
    for r in (nav_results or []):
        nav_lookup[r.get("url", "")] = r

    # Step 3: Validate entry points with sample extraction
    entry_points: list[dict] = []
    all_samples: list[dict] = []
    best_selectors: dict | None = None
    best_selectors_confidence = 0.0

    for url in candidate_urls[:8]:  # Cap at 8 to stay within LLM budget
        await report_log(job_id, "INFO", f"[Learn] Validating: {url}")

        html = await fetcher.fetch(url, requires_js=True)
        if not html or len(html) < 500:
            await report_log(job_id, "DEBUG", f"[Learn] Could not fetch {url}")
            continue

        # Classify — but override if sample extraction succeeds
        page_type = classify_page(html, url)

        # Extract 2-3 sample properties to validate
        page_text = html_to_clean_text(html, url)
        if len(page_text.strip()) < 200:
            await report_log(job_id, "DEBUG", f"[Learn] Page too short ({len(page_text)} chars), skipping")
            continue

        samples = await extract_listings_from_page(html, url, site_name=site.name)
        llm_calls += 1

        if samples and len(samples) >= 1:
            # This URL has actual listings — it's a valid entry point
            nav_info = nav_lookup.get(url, {})
            path = urlparse(url).path

            # Count listings per page for estimates
            listings_per_page = len(samples)

            entry_points.append({
                "url": url,
                "path": path if path and path != "/" else "/",
                "category": nav_info.get("category", "General"),
                "listingType": nav_info.get("listing_type", "sale"),
                "propertyType": nav_info.get("property_type", "general"),
                "estimatedListings": 0,  # Updated after pagination detection
                "estimatedPages": 0,
                "avgListingsPerPage": listings_per_page,
                "validated": True,
            })

            all_samples.extend(samples[:3])  # Keep max 3 samples per page

            # Try learning CSS selectors from these samples
            if len(samples) >= 2:
                learned = learn_selectors_from_extraction(html, samples, url)
                if learned and learned.confidence > best_selectors_confidence:
                    best_selectors_confidence = learned.confidence
                    best_selectors = {
                        "listing_container": learned.listing_container,
                        **learned.fields,
                        "_confidence": learned.confidence,
                        "_learned_at": learned.learned_at,
                    }

            await report_log(job_id, "INFO",
                f"[Learn] ✓ {url} — {len(samples)} listings found "
                f"({nav_info.get('listing_type', '?')}/{nav_info.get('property_type', '?')})")
        else:
            await report_log(job_id, "DEBUG",
                f"[Learn] ✗ {url} — no listings (classified as '{page_type}')")

    if not entry_points:
        await report_log(job_id, "WARN", f"[Learn] No valid entry points found for {site.name}")
        duration_ms = int((time.time() - start_time) * 1000)
        return LearnResult(
            site_id=site.id,
            site_profile=_build_empty_profile(fetching_info, duration_ms, llm_calls),
            learn_duration_ms=duration_ms,
            llm_calls_used=llm_calls,
        )

    # Step 4: Detect pagination from first valid entry point
    await report_log(job_id, "INFO", f"[Learn] Detecting pagination pattern...")
    pagination = await _detect_pagination(
        entry_points[0]["url"], fetcher,
    )
    await report_log(job_id, "INFO",
        f"[Learn] Pagination: {pagination.get('type', 'none')} "
        f"(max {pagination.get('maxPagesDetected', 0)} pages detected)")

    # Update entry point estimates based on pagination
    max_pages = pagination.get("maxPagesDetected", 1)
    for ep in entry_points:
        ep["estimatedPages"] = max_pages
        ep["estimatedListings"] = ep["avgListingsPerPage"] * max_pages

    # Step 5: Analyze price formats from samples
    price_formats = _analyze_price_formats(all_samples)

    # Step 6: Compute estimates
    has_css = best_selectors is not None and best_selectors_confidence >= 0.5
    estimates = _compute_estimates(entry_points, pagination, has_css, fetching_info)

    # Build validation info from samples
    sample_titles = [s.get("title", "")[:80] for s in all_samples[:5] if s.get("title")]
    validation = {
        "samplesExtracted": len(all_samples),
        "samplesValid": sum(1 for s in all_samples if s.get("title") and s.get("price")),
        "confidence": min(1.0, len(all_samples) / max(len(entry_points) * 2, 1)),
        "sampleTitles": sample_titles,
    }

    # CSS selectors summary
    css_summary = {
        "hasListingSelectors": has_css,
        "confidence": best_selectors_confidence,
        "fieldCount": len(best_selectors) - 2 if best_selectors else 0,  # minus _confidence, _learned_at
    }

    duration_ms = int((time.time() - start_time) * 1000)

    # Build the full site profile
    site_profile = {
        "entryPoints": entry_points,
        "pagination": pagination,
        "fetching": {
            "antiBot": fetching_info.get("antiBot", "none"),
            "requiresJs": fetching_info.get("requiresJs", True),
            "recommendedDelay": fetching_info.get("recommendedDelay", 2),
            "strategy": fetching_info.get("strategy", "playwright"),
        },
        "apis": [],  # TODO: API discovery in future iteration
        "priceFormats": price_formats,
        "validation": validation,
        "cssSelectors": css_summary,
        "estimates": estimates,
        "version": 1,
        "learnDurationMs": duration_ms,
        "llmCallsUsed": llm_calls,
    }

    # Collect validated listPaths
    list_paths = [ep["path"] for ep in entry_points if ep["path"] and ep["path"] != "/"]

    await report_log(job_id, "INFO",
        f"[Learn] Complete: {len(entry_points)} entry points, "
        f"{len(all_samples)} samples, "
        f"CSS: {'yes' if has_css else 'no'} ({best_selectors_confidence:.0%}), "
        f"est. {estimates.get('totalListings', 0)} listings in {estimates.get('scrapeTimeMinutes', 0)} min")

    return LearnResult(
        site_id=site.id,
        site_profile=site_profile,
        selectors=best_selectors,
        detail_selectors=None,
        list_paths=list_paths,
        learn_duration_ms=duration_ms,
        llm_calls_used=llm_calls,
    )


# ─── Helper functions ────────────────────────────────────


async def _assess_fetching(base_url: str, fetcher: AdaptiveFetcher) -> dict:
    """Assess what fetching strategy works for this site."""
    result: dict[str, Any] = {
        "antiBot": "none",
        "requiresJs": True,
        "recommendedDelay": 2,
        "strategy": "playwright",
        "html": None,
    }

    # Try Playwright first (most sites need JS)
    html = await fetcher.fetch(base_url, requires_js=True)
    if html and len(html) > 500:
        result["html"] = html
        result["strategy"] = fetcher.last_successful_layer or "playwright"

        # Check if it was blocked
        block_reason = fetcher.last_block_reason
        if block_reason:
            if "cloudflare" in str(block_reason).lower():
                result["antiBot"] = "cloudflare"
            else:
                result["antiBot"] = "basic"
        else:
            # If Playwright worked, check if curl would also work (faster)
            result["requiresJs"] = True  # Default to JS for Nigerian sites

        return result

    # All layers failed
    result["antiBot"] = "aggressive"
    result["strategy"] = "blocked"
    return result


async def _detect_pagination(url: str, fetcher: AdaptiveFetcher) -> dict:
    """Detect pagination pattern by trying to paginate 2-3 pages."""
    result = {
        "type": "none",
        "urlPattern": None,
        "maxPagesDetected": 1,
    }

    # Try collecting pages (will use the fingerprint dedup to stop on duplicates)
    pages = await fetcher.render_and_collect_pages(url, max_pages=3)

    if len(pages) > 1:
        # Pagination works — analyze the URLs to detect pattern
        urls = [p[0] for p in pages]
        result["maxPagesDetected"] = len(pages)

        # Detect pattern from URL differences
        if len(urls) >= 2:
            url1, url2 = urls[0], urls[1]
            if "page=" in url2:
                result["type"] = "url-param"
                result["urlPattern"] = "?page={n}"
            elif "/page/" in url2:
                result["type"] = "url-param"
                result["urlPattern"] = "/page/{n}"
            else:
                # Likely Next button navigation
                result["type"] = "next-button"

        # Estimate max pages more aggressively
        # If we got 3 pages with no duplicates, there are likely more
        if len(pages) == 3:
            result["maxPagesDetected"] = 10  # Conservative estimate

    return result


def _analyze_price_formats(samples: list[dict]) -> list[str]:
    """Extract price format patterns from sample properties."""
    patterns: set[str] = set()

    for sample in samples:
        price = sample.get("price", "")
        if not price:
            continue

        # Detect format patterns
        if "₦" in price:
            if re.search(r"₦[\d,.]+[Mm]", price):
                patterns.add("₦{n}M")
            elif "/yr" in price or "/year" in price:
                patterns.add("₦{n}/year")
            elif "/month" in price:
                patterns.add("₦{n}/month")
            else:
                patterns.add("₦{n}")
        elif "NGN" in price.upper():
            patterns.add("NGN {n}")
        elif "$" in price:
            patterns.add("${n}")

    return list(patterns) or ["₦{n}"]


def _compute_estimates(
    entry_points: list[dict],
    pagination: dict,
    has_css: bool,
    fetching: dict,
) -> dict:
    """Estimate total scrape time, listings, LLM calls needed."""
    total_pages = sum(ep.get("estimatedPages", 1) for ep in entry_points)
    total_listings = sum(ep.get("estimatedListings", 0) for ep in entry_points)

    # Time per page depends on strategy
    if has_css:
        time_per_page = 5  # seconds — no LLM call needed
        llm_calls = 1  # just navigation
    else:
        time_per_page = 15  # seconds — includes LLM extraction
        llm_calls = total_pages + 1  # 1 per page + navigation

    # Add detail enrichment estimate (1 fetch + 1 LLM call per listing)
    detail_time = total_listings * 3  # ~3s per detail page

    # Add delay between requests
    delay = fetching.get("recommendedDelay", 2)
    total_delay = (total_pages + total_listings) * delay

    total_seconds = (total_pages * time_per_page) + detail_time + total_delay
    total_minutes = max(1, round(total_seconds / 60))

    return {
        "totalListings": total_listings,
        "totalPages": total_pages,
        "scrapeTimeMinutes": total_minutes,
        "llmCallsNeeded": llm_calls,
    }


def _build_failed_profile(fetching_info: dict, start_time: float) -> dict:
    """Build a minimal profile for a site that couldn't be fetched."""
    return {
        "entryPoints": [],
        "pagination": {"type": "none", "maxPagesDetected": 0},
        "fetching": {
            "antiBot": fetching_info.get("antiBot", "aggressive"),
            "requiresJs": True,
            "recommendedDelay": 5,
            "strategy": "blocked",
        },
        "apis": [],
        "priceFormats": [],
        "validation": {"samplesExtracted": 0, "samplesValid": 0, "confidence": 0, "sampleTitles": []},
        "cssSelectors": {"hasListingSelectors": False, "confidence": 0, "fieldCount": 0},
        "estimates": {"totalListings": 0, "totalPages": 0, "scrapeTimeMinutes": 0, "llmCallsNeeded": 0},
        "version": 1,
        "learnDurationMs": int((time.time() - start_time) * 1000),
        "llmCallsUsed": 0,
    }


def _build_empty_profile(fetching_info: dict, duration_ms: int, llm_calls: int) -> dict:
    """Build a profile for a site with no discoverable entry points."""
    return {
        "entryPoints": [],
        "pagination": {"type": "none", "maxPagesDetected": 0},
        "fetching": {
            "antiBot": fetching_info.get("antiBot", "none"),
            "requiresJs": fetching_info.get("requiresJs", True),
            "recommendedDelay": fetching_info.get("recommendedDelay", 2),
            "strategy": fetching_info.get("strategy", "playwright"),
        },
        "apis": [],
        "priceFormats": [],
        "validation": {"samplesExtracted": 0, "samplesValid": 0, "confidence": 0, "sampleTitles": []},
        "cssSelectors": {"hasListingSelectors": False, "confidence": 0, "fieldCount": 0},
        "estimates": {"totalListings": 0, "totalPages": 0, "scrapeTimeMinutes": 0, "llmCallsNeeded": 0},
        "version": 1,
        "learnDurationMs": duration_ms,
        "llmCallsUsed": llm_calls,
    }
