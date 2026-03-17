# Scraper Microservice

Python-based web scraper for Nigerian property websites. Uses a 4-layer adaptive fetching pipeline with anti-bot bypass, LLM-assisted extraction, and a multi-stage data processing pipeline. Receives jobs from the Node.js backend via HTTP and reports results back through callbacks.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Fetch Pipeline (4 Layers)](#fetch-pipeline-4-layers)
  - [Layer 1: curl_cffi](#layer-1-curl_cffi)
  - [Layer 2: Scrapling StealthyFetcher](#layer-2-scrapling-stealthyfetcher)
  - [Layer 3: Crawl4AI + Gemini Flash](#layer-3-crawl4ai--gemini-flash)
  - [Layer 4: Playwright + Stealth](#layer-4-playwright--stealth)
- [Extraction Pipeline](#extraction-pipeline)
  - [JSON-LD Structured Data](#json-ld-structured-data)
  - [CSS Selectors](#css-selectors)
  - [LLM Fallback (Gemini Flash)](#llm-fallback-gemini-flash)
  - [Auto-Detection Fallbacks](#auto-detection-fallbacks)
- [Processing Pipeline](#processing-pipeline)
- [Pagination Strategies](#pagination-strategies)
- [Task Queue (Celery + Redis)](#task-queue-celery--redis)
- [Configuration](#configuration)
- [Site Config Format](#site-config-format)
- [Adding a New Site](#adding-a-new-site)
- [API Endpoints](#api-endpoints)
- [Job Lifecycle](#job-lifecycle)
- [Deployment](#deployment)
- [Known Issues and Limitations](#known-issues-and-limitations)
- [Debugging Tips](#debugging-tips)

## Architecture Overview

```
                              Node.js Backend
                              (dispatches job)
                                    |
                              POST /api/jobs
                                    |
                                    v
                        +---------------------+
                        |   FastAPI (app.py)   |
                        |   Job orchestrator   |
                        +----------+----------+
                                   |
                    +--------------+--------------+
                    |                             |
             +------v-------+            +-------v-------+
             | AdaptiveFetcher|          | Report callbacks|
             | (4-layer)      |          | (progress, logs,|
             +------+--------+          |  results, error)|
                    |                    +-------+---------+
         +----------+----------+                |
         |          |          |           POST to backend
    Layer 1    Layer 2    Layer 3/4      /api/internal/*
   curl_cffi  Scrapling  Crawl4AI/
                         Playwright
                    |
         +----------+----------+
         |   Extraction Pipeline  |
         | JSON-LD -> CSS -> LLM  |
         +----------+----------+
                    |
         +----------+----------+
         |  Processing Pipeline   |
         | NLP -> Parse -> Norm   |
         | -> Validate -> Dedup   |
         | -> Enrich -> Callback  |
         +-----------------------+
```

### Design Philosophy: "Try Fast, Fall Back Smart, Learn Forever"

The scraper uses a cognitive loop architecture. Each layer is progressively more capable but slower and more expensive. When an expensive layer (e.g., Crawl4AI + Gemini) succeeds where a fast layer (e.g., curl_cffi) failed, the system discovers CSS selectors from the LLM output and caches them in Redis. Future scrapes then succeed at the fast layer, reducing cost and latency over time.

## Fetch Pipeline (4 Layers)

The `AdaptiveFetcher` class in `engine/adaptive_fetcher.py` implements the core fetching logic. Each URL passes through layers in order until one succeeds.

```
+---------------+     +----------------+     +-------------------+     +------------------+
| Layer 1       | --> | Layer 2        | --> | Layer 3           | --> | Layer 4          |
| curl_cffi     |     | Scrapling      |     | Crawl4AI + Gemini |     | Playwright       |
| (fastest)     |     | (anti-bot)     |     | (LLM extraction)  |     | (full browser)   |
| ~0.5-2s       |     | ~2-5s          |     | ~5-15s            |     | ~5-30s           |
+---------------+     +----------------+     +-------------------+     +------------------+
       |                      |                       |                        |
  Chrome TLS           Cloudflare           Markdown + Gemini          Full JS render
  fingerprint          Turnstile            structured extract         stealth scripts
  via impersonate      bypass                                          cookie/overlay
                                                                       dismiss
```

### Layer 1: curl_cffi

**File:** `engine/adaptive_fetcher.py` (method `_fetch_curl`)

The fastest layer. Uses `curl_cffi` with Chrome TLS fingerprint impersonation to bypass basic bot detection that checks TLS signatures.

| Feature                  | Details                                        |
|--------------------------|------------------------------------------------|
| Library                  | `curl_cffi` with `impersonate="chrome"`        |
| Speed                    | 0.5-2 seconds per request                      |
| Anti-bot bypass          | Chrome TLS fingerprint, randomized headers     |
| Block detection          | Checks for captcha/challenge patterns in HTML  |
| Cookie persistence       | Per-domain session cookies maintained           |
| Proxy support            | Round-robin through configured proxy pool       |
| Fallback                 | Falls back to `httpx` if curl_cffi unavailable |
| When it fails            | Cloudflare challenges, heavy JS-rendered sites |

Headers are randomized per request:
- `User-Agent` from a pool of 50+ realistic Chrome UAs
- `Accept-Language` variants (en-US, en-GB, en-NG combinations)
- `Sec-Ch-Ua` with varying Chrome version numbers
- Domain-specific `Referer` header

### Layer 2: Scrapling StealthyFetcher

**File:** `engine/scrapling_fetcher.py`

Anti-bot bypass layer using the Scrapling library. Handles Cloudflare Turnstile and other challenge systems.

| Feature                  | Details                                        |
|--------------------------|------------------------------------------------|
| Library                  | `scrapling` (StealthyFetcher)                  |
| Speed                    | 2-5 seconds per request                        |
| Anti-bot bypass          | Cloudflare Turnstile, TLS impersonation        |
| Adaptive parsing         | Element fingerprinting with similarity matching |
| Self-healing             | Finds elements even after site redesigns       |
| When it fails            | Sites with advanced bot mitigation             |

The adaptive parser stores lightweight element fingerprints (tag, attributes, neighbor context). When CSS selectors break due to a site redesign, it uses similarity matching to find the equivalent element automatically.

### Layer 3: Crawl4AI + Gemini Flash

**Files:** `engine/crawl4ai_fetcher.py`, `extractors/llm_schema_extractor.py`

This layer is used for the LLM extraction pipeline, not for raw HTML fetching. When CSS selectors fail to extract critical data (price, bedrooms, location), Crawl4AI converts the page to clean Markdown and Gemini Flash extracts structured property data from it.

| Feature                  | Details                                            |
|--------------------------|----------------------------------------------------|
| Library                  | `crawl4ai` (AsyncWebCrawler)                       |
| LLM                      | Google Gemini Flash via `google-genai`             |
| Speed                    | 5-15 seconds (network + LLM inference)             |
| Token efficiency         | Markdown reduces token cost by 80-90% vs raw HTML  |
| Output                   | Structured property dict (Pydantic-validated)      |
| Selector discovery       | LLM analyzes page and returns CSS selectors        |
| Selector caching         | Discovered selectors cached in Redis per domain    |
| Normalization            | LLM normalizes raw text ("3 Baths" -> 3, etc.)   |

The self-healing loop:
1. CSS selectors fail to extract price/bedrooms/location
2. Crawl4AI renders page to Markdown
3. Gemini Flash extracts structured data from Markdown
4. `discover_selectors()` reverse-engineers CSS selectors from the LLM output
5. Selectors are cached in Redis for the domain
6. Next scrape of the same domain uses cached selectors at Layer 1/2 speed

### Layer 4: Playwright + Stealth

**File:** `engine/adaptive_fetcher.py` (method `_fetch_playwright`)

Full headless browser with comprehensive stealth scripts. Last resort for heavily protected or JavaScript-rendered sites.

| Feature                    | Details                                          |
|----------------------------|--------------------------------------------------|
| Library                    | Playwright (Chromium)                            |
| Speed                      | 5-30 seconds per request                         |
| JS rendering               | Full DOM execution                               |
| Stealth script             | WebDriver property deletion, Chrome runtime mock,|
|                            | plugin spoofing, WebGL vendor override, navigator |
|                            | property overrides, permission query interception |
| Cloudflare handling        | Auto-detects "Just a moment..." and waits 15s    |
| Human simulation           | Random scroll, random delays, overlay dismissal  |
| Viewport randomization     | Random width (1280-1920) and height (720-1080)   |
| Cookie/consent dismissal   | Tries 16+ common consent button selectors        |

The stealth script overrides:
- `navigator.webdriver` (undefined)
- `window.chrome` (full runtime mock)
- `navigator.plugins` (3 realistic plugins)
- `navigator.languages` (en-US, en, en-NG)
- `navigator.hardwareConcurrency` (8)
- `navigator.deviceMemory` (8)
- WebGL renderer ("Intel Iris OpenGL Engine")
- `HTMLIFrameElement.contentWindow`
- `Function.prototype.toString` (native code masking)

### Block Detection

All layers share a common block detection system. The fetcher checks HTML responses against 15 patterns:

| Pattern                           | Detects                         |
|-----------------------------------|---------------------------------|
| `captcha`, `recaptcha`, `hCaptcha`| CAPTCHA challenges              |
| `cf-challenge`, `cf-turnstile`    | Cloudflare protection           |
| `challenge-platform`              | Generic challenge pages         |
| `Access Denied`                   | IP/geo blocks                   |
| `unusual traffic`                 | Rate limiting                   |
| `just a moment`, `checking your browser` | Cloudflare interstitial  |
| `are you a robot`, `verify you are human` | Bot detection pages     |

When 3+ consecutive blocks occur, the fetcher applies progressive backoff (5s per block, max 30s).

### Proxy Rotation

Proxies are configured via the `PROXY_LIST` environment variable (comma-separated URLs). The fetcher rotates through proxies round-robin using a thread-safe counter. Compatible with BrightData and Smartproxy residential proxy formats (`http://user:pass@host:port`).

## Extraction Pipeline

After fetching HTML, data is extracted using a three-tier strategy.

### JSON-LD Structured Data

**File:** `extractors/universal_extractor.py` (methods `extract_json_ld`, `harvest_properties_from_json_ld`)

The most reliable extraction method. Parses `<script type="application/ld+json">` tags and walks the JSON-LD tree looking for property-related schema.org types.

| Detected Schema Types                                              |
|---------------------------------------------------------------------|
| `RealEstateListing`, `Product`, `Offer`, `Residence`, `House`,     |
| `Apartment`, `SingleFamily`, `Accommodation`, `Place`, `LocalBusiness` |

Extracted fields: `name`, `price`, `address` (street, locality, region, country), `numberOfBedrooms`, `numberOfBathrooms`, `floorSize`, `image`, `description`, `seller.name`, `url`.

### CSS Selectors

**File:** `extractors/universal_extractor.py` (class `UniversalExtractor`)

Site-specific selectors stored in the `Site.selectors` JSON field. Supports:

- **Pipe-separated fallbacks:** `"h1.title | h1 | .name"` -- tries each selector in order
- **Attribute extraction:** `"img.photo::attr(src)"` -- extracts attribute instead of text
- **Text extraction:** `"span.price::text"` -- explicit text extraction
- **Multi-value fields:** `images`, `features`, `security`, `utilities` return arrays
- **Honeypot detection:** Filters hidden links (display:none, zero-size, trap classes)

When CSS selectors find nothing, auto-detection kicks in:
- **Title:** `<title>` tag (suffix stripped) or `<h1>` or `og:title`
- **Price:** Elements matching `[class*='price']`, then regex scan for `NGN/N` patterns
- **Images:** `og:image` meta tags, then gallery/carousel/slider image selectors
- **Listing URLs:** URL pattern matching (`/property/`, `/for-sale/`, numeric IDs)

### LLM Fallback (Gemini Flash)

**File:** `extractors/llm_schema_extractor.py`

Triggered when critical fields (price, bedrooms, location) are missing after CSS extraction:

1. `fetch_as_markdown(url)` -- Crawl4AI renders page to clean Markdown
2. `extract_property_from_markdown(markdown, url)` -- Gemini Flash extracts structured data
3. Results merged into existing data (gap-fill only, does not overwrite)
4. `discover_selectors(html, llm_data)` -- Reverse-engineers CSS selectors from LLM output
5. `save_selectors(domain, selectors)` -- Cached in Redis for future fast-path

If Crawl4AI is unavailable, falls back to plain text extraction: BeautifulSoup strips HTML to text, then `extract_with_llm(text, raw_data)` sends it to Gemini.

`normalize_with_llm(raw_data)` handles fields that regex parsers could not resolve (e.g., converting "3 Baths" to integer 3, or "5 Million Naira" to 5000000).

## Processing Pipeline

After extraction, each property passes through a multi-stage processing pipeline.

```
Raw HTML
    |
    v
[1] NLP: Listing Type Detection
    Classifies as SALE / RENT / LEASE / SHORTLET
    from title, description, and price text
    |
    v
[2] Price Parser
    Nigerian price parsing: ₦, "million", "per annum"
    Handles: ₦5,000,000 | 5M | 5 million | N5,000,000
    |
    v
[3] Location Parser
    Hierarchical extraction:
    estate > area > LGA > state > country
    |
    v
[4] Feature Extractor
    Amenity extraction from description + features text
    |
    v
[5] LLM Normalization (conditional)
    Only called when key fields still missing after regex parsing
    Normalizes text to structured data via Gemini
    |
    v
[6] Normalizer (normalizer.py)
    - Strip HTML from all text fields
    - Unicode NFC normalization
    - Collapse whitespace
    - Convert numeric strings to int/float
    - Compute pricePerSqm and pricePerBedroom
    - Normalize image URLs (filter non-http)
    - Infer property category (Residential/Commercial/Land/Shortlet/Industrial)
    - Build search keywords (top 50 terms)
    - Set defaults (country=Nigeria, state=Lagos, currency=NGN)
    |
    v
[7] Validator (validator.py)
    - Check required fields: title, listingUrl, source
    - Clean empty strings to None
    - Validate numeric field types
    - Compute quality score (0-100)
    |
    v
[8] Deduplicator (deduplicator.py)
    - SHA256 hash of: lowercase(title) | listingUrl | lowercase(source)
    - Matches backend DedupService algorithm exactly
    - In-memory set for within-job dedup
    |
    v
[9] Enricher (enricher.py)
    - OSM Nominatim geocoding (latitude/longitude)
    - In-memory cache to avoid redundant lookups
    - Rate limited to 1 req/sec (Nominatim policy)
    - Nigeria-scoped results (countrycodes=ng)
    |
    v
[10] Callback (callback.py)
     - POST each property to backend for live feed
     - POST batch results at job end
     - Report progress throughout
```

### Quality Scoring (0-100)

The validator computes a quality score matching the backend algorithm:

| Component        | Max Points | Criteria                                     |
|------------------|------------|----------------------------------------------|
| Title            | 10         | >20 chars = 10, >10 chars = 7, any = 4      |
| Description      | 15         | >200 chars = 15, >100 = 10, >30 = 6         |
| Price            | 10         | Valid price > 0                               |
| Property details | 15         | Bedrooms (4), bathrooms (3), type (4), size (4) |
| Location         | 20         | Area (5), state (3), address (5), coords (7) |
| Images           | 15         | 5+ images = 15, 3+ = 10, 1+ = 5             |
| Agent info       | 10         | Name (5), phone (5)                           |
| Features         | 5          | 3+ features = 5, 1+ = 3                      |

## Pagination Strategies

**File:** `engine/pagination_strategy.py`

The `PaginationStrategy` class implements three pagination approaches, tried in order when `pagination_type="auto"`:

| Strategy         | How it works                                            | Detection                            |
|------------------|---------------------------------------------------------|--------------------------------------|
| Next Button      | Find `<a rel="next">`, `.next`, aria-label, text match  | 15+ CSS selectors + text regex       |
| Numeric Links    | Find page number links (1, 2, 3...) in pagination container | Container selectors + digit regex |
| URL Parameter    | Append `?page=N`, `/page/N`, or `?offset=N*perPage`    | Configured per site or auto fallback |

Site configs can force a specific strategy via `paginationType`: `"auto"`, `"next_button"`, `"numeric_links"`, `"url_param"`, `"path_segment"`, `"offset"`.

### Incremental Scraping

**File:** `pipeline/incremental.py`

Tracks previously seen URLs in Redis. When scraping encounters N consecutive already-known URLs (default: 5), it stops paginating that path, assuming remaining pages contain old listings.

### Page Classification

**File:** `pipeline/page_classifier.py`

Detects and skips category/index/directory pages that are not listing pages, preventing the scraper from crawling navigation trees.

### Relevance Scoring

**File:** `pipeline/relevance_scorer.py`

When CSS selectors find zero listing URLs, the relevance scorer uses multi-signal element scoring to identify property listing links from raw HTML. Signals include parent element classes, URL patterns, and link text content.

## Task Queue (Celery + Redis)

**File:** `tasks.py`

The scraper supports Celery-based task execution for production deployments:

| Configuration       | Value                                           |
|---------------------|-------------------------------------------------|
| Broker              | Redis (via `REDIS_URL`)                         |
| Result backend      | Redis                                           |
| Retry policy        | Exponential backoff: 30s, 60s, 120s, 240s, 480s|
| Max retries         | 3                                               |
| Task priorities     | Active intent = 1, Rescrape = 3, Bulk = 7      |
| Concurrency locks   | Per-domain Redis locks with 30-minute TTL       |
| Job timeout         | 30 minutes (hard kill via asyncio.wait_for)     |

In the current architecture, the primary execution path is in-process via `asyncio.create_task` when the backend dispatches via HTTP POST to `/api/jobs`. Celery is available as an alternative for worker-based deployments.

## Configuration

**File:** `config.py`

All configuration is loaded from environment variables.

| Variable                 | Default                          | Description                                |
|--------------------------|----------------------------------|--------------------------------------------|
| `API_BASE_URL`           | `http://localhost:5000/api`      | Backend API URL for callbacks              |
| `API_CALLBACK_URL`       | (alias for API_BASE_URL)         | Backwards-compatible alias                 |
| `INTERNAL_API_KEY`       | `dev-internal-key`               | Shared auth key with backend               |
| `SCRAPER_HOST`           | `0.0.0.0`                        | FastAPI bind host                          |
| `SCRAPER_PORT`           | `8000`                           | FastAPI bind port                          |
| `REDIS_URL`              | `redis://localhost:6379/0`       | Redis for Celery, locks, selector cache    |
| `PLAYWRIGHT_HEADLESS`    | `true`                           | Run Playwright in headless mode            |
| `BROWSER_TIMEOUT`        | `30000`                          | Playwright page load timeout (ms)          |
| `PROXY_LIST`             | (empty)                          | Comma-separated proxy URLs                 |
| `PROXY_URLS`             | (alias for PROXY_LIST)           | Backwards-compatible alias                 |
| `DELAY_MIN`              | `2.0`                            | Minimum delay between requests (seconds)   |
| `DELAY_MAX`              | `5.0`                            | Maximum delay between requests (seconds)   |
| `MAX_CONCURRENT_PER_SITE`| `2`                              | Max concurrent requests per domain         |
| `NOMINATIM_URL`          | `https://nominatim.openstreetmap.org` | Geocoding API URL                   |
| `NOMINATIM_EMAIL`        | `scraper@realtorspractice.com`   | Required by Nominatim usage policy         |
| `SAVE_RAW_HTML`          | `false`                          | Save HTML snapshots of failed extractions  |
| `RAW_HTML_DIR`           | `/tmp/scraper-raw-html`          | Directory for HTML snapshots               |
| `RAW_HTML_RETENTION_DAYS`| `7`                              | Auto-purge snapshots older than N days     |
| `LOG_LEVEL`              | `INFO`                           | Logging level (DEBUG, INFO, WARN, ERROR)   |
| `GEMINI_API_KEY`         | (none)                           | Google Gemini API key for LLM extraction   |

## Site Config Format

Sites are stored in the backend's `Site` model and sent to the scraper as part of the job payload. The scraper receives them as `SiteConfig` Pydantic models:

```json
{
  "id": "cuid-string",
  "name": "PropertyPro.ng",
  "baseUrl": "https://www.propertypro.ng",
  "listPaths": ["/property-for-sale/lagos", "/property-for-rent/lagos"],
  "listingSelector": "a.property-listing-link | .listings-cards a[href*='/property/']",
  "selectors": {
    "title": "h1.property-title | h1",
    "price": ".price-text | [class*='price']",
    "description": ".property-description | .description",
    "location": ".property-location | .address | [class*='location']",
    "bedrooms": ".bed-count | [class*='bed']",
    "bathrooms": ".bath-count | [class*='bath']",
    "area_size": ".area-size | [class*='sqm']",
    "images": "img.property-image::attr(src) | .gallery img::attr(src)",
    "agent_name": ".agent-name | [class*='agent'] .name",
    "agent_phone": "a[href^='tel:']::attr(href)",
    "features": ".feature-item | .amenity | [class*='feature'] li"
  },
  "paginationType": "auto",
  "paginationConfig": {
    "param": "page",
    "startFrom": 1,
    "nextSelector": "a.pagination-next"
  },
  "requiresJs": false,
  "maxPages": 10,
  "delayMin": 2.0,
  "delayMax": 5.0
}
```

### Selector Syntax

| Syntax                     | Example                          | Behavior                          |
|----------------------------|----------------------------------|-----------------------------------|
| Basic CSS                  | `h1.title`                       | Select first match, extract text  |
| Pipe fallback              | `h1.title \| h1 \| .name`       | Try each selector in order        |
| Attribute extraction       | `img::attr(src)`                 | Extract attribute value           |
| Text extraction            | `span.price::text`               | Explicit text extraction          |
| Multi-value field          | For `images`, `features` fields  | Returns array of all matches      |

### Pagination Types

| Type           | Config Keys                         | Example URL                        |
|----------------|-------------------------------------|------------------------------------|
| `auto`         | (none required)                     | Tries all 3 strategies             |
| `url_param`    | `param`, `startFrom`                | `?page=2`                          |
| `path_segment` | `suffix`                            | `/page/2`                          |
| `offset`       | `param`, `perPage`                  | `?offset=20`                       |
| `next_button`  | `nextSelector` (optional)           | Follows Next link in DOM           |
| `numeric_links`| (none required)                     | Finds page number links            |

## Adding a New Site

1. **Create the site config** in the frontend Sites page (`/scraper/sites`) or via the API:

   ```bash
   curl -X POST http://localhost:5000/api/sites \
     -H "Authorization: Bearer <jwt>" \
     -H "Content-Type: application/json" \
     -d '{
       "key": "newsite",
       "name": "New Property Site",
       "baseUrl": "https://www.example-property.ng",
       "listPaths": ["/for-sale/lagos"],
       "selectors": { ... },
       "paginationType": "auto",
       "maxPages": 10
     }'
   ```

2. **Determine selectors** by inspecting the target site:
   - Open a listing page in browser DevTools
   - Identify the listing container selector (for listing URLs)
   - Identify field selectors (title, price, location, bedrooms, etc.)
   - Use pipe-separated fallbacks for resilience: `".primary | .fallback"`

3. **Test the scrape** by triggering a single-site job with `maxListingsPerSite: 5`:
   - Use the Scraper page in the frontend
   - Or POST to `/api/scrape/start` with the site ID

4. **If selectors are unknown**, set minimal selectors and rely on the LLM fallback:
   - The scraper will use Crawl4AI + Gemini to extract data
   - Discovered selectors will be cached in Redis automatically
   - Check Redis for `selectors:<domain>` keys to retrieve discovered selectors
   - Add the discovered selectors to the site config for future fast-path scraping

5. **Monitor results** via:
   - Live logs in the Scraper page (Socket.io feed)
   - Scrape logs API (`/api/scrape/logs`)
   - Data Explorer page (check newly scraped properties)

## API Endpoints

| Method | Path                    | Description                   | Auth            |
|--------|-------------------------|-------------------------------|-----------------|
| GET    | `/health`               | Health check (+ Redis status) | None            |
| POST   | `/api/jobs`             | Start a scrape job            | X-Internal-Key  |
| GET    | `/api/jobs/{job_id}`    | Get job status                | X-Internal-Key  |
| POST   | `/api/jobs/{job_id}/stop` | Stop a running job          | X-Internal-Key  |

### Start Job Request

```json
{
  "jobId": "cuid-from-backend",
  "sites": [ /* array of SiteConfig objects */ ],
  "maxListingsPerSite": 100,
  "callbackUrl": "https://api.example.com/api",
  "parameters": {}
}
```

### Callback Endpoints (sent to backend)

| Callback                          | Payload                                    |
|-----------------------------------|--------------------------------------------|
| `POST /internal/scrape-results`   | `{ jobId, properties: [...], stats: {...} }`|
| `POST /internal/scrape-progress`  | `{ jobId, processed, total, current_site, ...}` |
| `POST /internal/scrape-error`     | `{ jobId, error: "message" }`              |
| `POST /internal/scrape-log`       | `{ jobId, level, message, details }`       |
| `POST /internal/scrape-property`  | `{ jobId, property: {...} }` (live feed)   |

## Job Lifecycle

```
Backend dispatches POST /api/jobs
    |
    v
FastAPI receives job, launches asyncio task
    |
    v
For each site in job.sites:
    |
    +-- Check robots.txt (skip if disallowed)
    +-- Respect Crawl-Delay if set
    +-- Build starting URLs from listPaths
    |
    For each starting URL:
        |
        For each page (up to maxPages):
            |
            +-- Fetch page HTML (4-layer adaptive fetcher)
            +-- Check for category/index page (skip if so)
            +-- Load cached LLM-discovered selectors from Redis
            +-- Extract listing URLs:
            |   JSON-LD URLs -> CSS selector URLs -> Relevance scorer
            +-- Filter invalid URLs (WhatsApp, mailto, tel, javascript)
            +-- Normalize and deduplicate via VisitedSet
            +-- Check incremental tracker (stop after 5 consecutive known)
            |
            For each listing URL:
                |
                +-- Fetch detail page HTML
                +-- Extract: JSON-LD first, then CSS selectors
                +-- LLM fallback if critical fields missing
                +-- NLP: detect listing type (SALE/RENT/LEASE/SHORTLET)
                +-- Parse price (Nigerian formats)
                +-- Parse location (hierarchy)
                +-- Extract features/amenities
                +-- LLM normalization (if fields still raw)
                +-- Normalize all fields
                +-- Validate + compute quality score
                +-- Dedup check (SHA256)
                +-- Report property to backend (live feed)
                +-- Report progress
            |
            +-- 3-strategy pagination to get next page URL
    |
    v
Enrich all properties (Nominatim geocoding)
    |
    v
Report final results + stats to backend
```

## Deployment

### Docker

The scraper ships with a `Dockerfile` based on the official Playwright Python image:

```bash
# Build
docker build -t realtors-scraper ./scraper

# Run
docker run -p 8000:8000 \
  -e API_BASE_URL=https://api.example.com/api \
  -e INTERNAL_API_KEY=your-key \
  -e REDIS_URL=redis://your-redis:6379 \
  -e GEMINI_API_KEY=your-gemini-key \
  realtors-scraper
```

Base image: `mcr.microsoft.com/playwright/python:v1.52.0-jammy` (includes Chromium, Firefox, WebKit browsers and all OS dependencies).

Additional system dependencies installed: `libxml2-dev`, `libxslt1-dev` (for lxml/Scrapling).

### Koyeb

Deployed as a Docker service on Koyeb (Eco worker tier):

1. Connect GitHub repository to Koyeb
2. Set Docker build context to `./scraper`
3. Configure environment variables in Koyeb dashboard
4. CMD override for Celery worker (if using queue): `celery -A tasks worker --loglevel=info`
5. Default CMD runs the FastAPI server: `uvicorn app:app --host 0.0.0.0 --port 8000`

### Local Development

```bash
cd scraper

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Run the server
python app.py
# or
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## Known Issues and Limitations

| Issue                                | Impact                              | Workaround                         |
|--------------------------------------|-------------------------------------|-------------------------------------|
| Scrapling import may fail on some platforms | Layer 2 unavailable          | Scraper falls through to Layer 3/4  |
| Crawl4AI requires its own managed browser  | Additional disk/memory usage  | Browser installed at build time     |
| Nominatim rate limit (1 req/sec)     | Geocoding is slow for large batches | In-memory cache reduces lookups     |
| Gemini API has token limits          | LLM extraction may fail on very long pages | Markdown conversion reduces tokens |
| Redis unavailable degrades gracefully| No stop-job, no selector cache, no incremental tracking | All features have None-safe fallbacks |
| Cloudflare challenge may not resolve | 15s timeout, then treated as block  | Playwright layer retries with different viewport |
| Some sites require login/auth        | Cannot scrape gated content         | Not supported currently              |
| Memory usage with Playwright         | ~200-500MB per browser context      | Single context reused, closed on job end |
| 30-minute hard timeout per job       | Long jobs get killed                | Split into smaller jobs              |

## Debugging Tips

### HTML Snapshots

When extraction fails (no data extracted), the scraper saves the raw HTML to `RAW_HTML_DIR` (default: `/tmp/scraper-raw-html/`). Files are named `{site}_{timestamp}.html` with a comment containing the source URL. Auto-purged after 7 days.

Enable for all pages (not just failures) with `SAVE_RAW_HTML=true`.

### Log Levels

Set `LOG_LEVEL=DEBUG` for verbose output including:
- Which fetcher layer was used for each URL
- Which selectors matched or failed
- Block detection results
- Pagination strategy decisions
- Dedup hash collisions
- LLM extraction details

### Checking Cached Selectors

Discovered selectors are cached in Redis under `selectors:<domain>`:

```python
import redis
r = redis.Redis.from_url("redis://localhost:6379")
r.get("selectors:www.propertypro.ng")  # JSON dict of field -> CSS selector
```

### Testing a Single URL

```python
import asyncio
from engine.adaptive_fetcher import AdaptiveFetcher

async def test():
    fetcher = AdaptiveFetcher()
    html = await fetcher.fetch("https://www.propertypro.ng/property/123")
    print(f"Layer used: {fetcher.last_successful_layer}")
    print(f"HTML length: {len(html) if html else 0}")
    await fetcher.close()

asyncio.run(test())
```

### Testing Extraction

```python
from extractors.universal_extractor import UniversalExtractor

selectors = {
    "title": "h1",
    "price": "[class*='price']",
    "location": "[class*='location']",
}

extractor = UniversalExtractor(selectors)
data = extractor.extract_property_with_json_ld(html, "https://example.com/property/1")
print(data)
```

### Monitoring Scrape Progress

Live scrape progress is streamed to the frontend via Socket.io. To monitor from the backend:

```bash
# Check scrape logs
curl http://localhost:5000/api/scrape/logs?jobId=<job-id>&level=ERROR \
  -H "Authorization: Bearer <jwt>"
```

### Common Failure Patterns

| Symptom                             | Likely Cause                        | Fix                                |
|-------------------------------------|-------------------------------------|------------------------------------|
| All pages return empty HTML         | IP blocked or Cloudflare challenge  | Add/rotate proxies                 |
| Properties extracted but no price   | Price selector broken               | Check site for redesign, update selectors |
| "Missing required field: title"     | Title selector broken               | Auto-detection should catch it; check HTML snapshot |
| Duplicate count very high           | Listing URLs point to same property | Check listingSelector specificity  |
| Job times out at 30 minutes         | Too many pages or slow site         | Reduce maxPages or maxListingsPerSite |
| LLM fallback errors                 | Gemini API key invalid or rate limited | Check GEMINI_API_KEY env var      |
| Geocoding returns no results        | Location text too vague             | Check normalizer output for area/state |

## File Reference

```
scraper/
├── app.py                          # FastAPI entry point, job orchestrator
├── config.py                       # Environment configuration
├── tasks.py                        # Celery task definitions
├── Dockerfile                      # Docker build (Playwright base image)
├── requirements.txt                # Python dependencies
├── engine/
│   ├── adaptive_fetcher.py         # 4-layer fetch pipeline (main fetcher)
│   ├── scrapling_fetcher.py        # Layer 2: Scrapling StealthyFetcher
│   ├── crawl4ai_fetcher.py         # Layer 3: Crawl4AI Markdown conversion
│   ├── pagination_strategy.py      # 3-strategy pagination handler
│   ├── page_renderer.py            # Legacy Playwright browser management
│   ├── pagination.py               # Legacy pagination (URL generation)
│   └── cookie_handler.py           # Consent banner dismissal
├── extractors/
│   ├── universal_extractor.py      # CSS selector + JSON-LD extraction
│   ├── llm_schema_extractor.py     # Gemini Flash structured extraction
│   ├── llm_extractor.py            # Legacy LLM extractor
│   ├── selector_cache.py           # Redis-backed selector cache
│   ├── universal_nlp.py            # Listing type detection (SALE/RENT/etc.)
│   ├── price_parser.py             # Nigerian price parsing
│   ├── location_parser.py          # Location hierarchy extraction
│   └── feature_extractor.py        # Amenity/feature extraction
├── pipeline/
│   ├── normalizer.py               # Data cleaning and normalization
│   ├── validator.py                # Validation + quality scoring (0-100)
│   ├── deduplicator.py             # SHA256 exact deduplication
│   ├── enricher.py                 # Nominatim geocoding
│   ├── page_classifier.py          # Category/index page detection
│   ├── incremental.py              # Incremental scraping tracker
│   └── relevance_scorer.py         # Multi-signal listing URL scorer
├── utils/
│   ├── callback.py                 # HTTP callbacks to backend
│   ├── rate_limiter.py             # Per-domain rate limiting
│   ├── url_normalizer.py           # URL normalization + VisitedSet
│   ├── user_agents.py              # 50+ Chrome UA strings + header rotation
│   ├── robots_checker.py           # robots.txt compliance
│   └── logger.py                   # Structured logging
└── tests/
    └── test_engine.py              # Engine unit tests
```
