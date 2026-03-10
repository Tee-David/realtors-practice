# Phase 3 Completion: Scraper Production Pipeline

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the scraper pipeline fully operational in production — Celery hardened with retries/priority/concurrency, deployed on Koyeb with Upstash Redis, tested end-to-end.

**Architecture:** Backend (Render) dispatches scrape jobs to Upstash Redis. Celery worker (Koyeb) picks up tasks, scrapes sites, and POSTs results back to backend via HTTP callbacks. Socket.io broadcasts live progress to frontend.

**Tech Stack:** Python 3.11, Celery 5.4, FastAPI, Playwright, Redis (Upstash), Koyeb (Docker worker), ioredis (backend)

**Spec:** `docs/superpowers/specs/2026-03-10-phase3-scraper-completion-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `scraper/tasks.py` | Modify | Add retry config, priority, domain locks |
| `scraper/app.py` | Modify | Add HTML snapshot on failed extraction, purge on startup |
| `scraper/config.py` | Already done | Snapshot config already exists (lines 48-50) |
| `scraper/Dockerfile` | Keep as-is | Uvicorn CMD for local/API mode; Koyeb overrides for Celery |
| `scraper/koyeb.yaml` | Create | Koyeb worker deployment config |
| `backend/src/services/scrape.service.ts` | Modify | Add priority field to Celery dispatch (lines 84-105) |
| `backend/package.json` | Verify | ioredis should already be installed |
| `.env` | Modify | Add INTERNAL_API_KEY |

---

## Chunk 1: Celery Hardening

### Task 1: Add Retry Config + Priority + Domain Locks to tasks.py

**Files:**
- Modify: `scraper/tasks.py` (full rewrite — 27 lines → ~80 lines)

- [ ] **Step 1: Rewrite tasks.py with retry config, priority handling, and domain locks**

```python
import asyncio
import time
from celery import Celery
from celery.exceptions import MaxRetriesExceededError
from config import config
from utils.logger import get_logger

logger = get_logger("tasks")

app = Celery(
    "scraper",
    broker=config.redis_url,
    backend=config.redis_url,
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Priority: lower number = higher priority (0-9)
    broker_transport_options={
        "priority_steps": list(range(10)),
        "sep": ":",
        "queue_order_strategy": "priority",
    },
)


def _acquire_domain_lock(domain: str) -> bool:
    """Acquire a per-domain Redis lock. Returns True if acquired."""
    import redis as redis_lib
    r = redis_lib.Redis.from_url(config.redis_url, decode_responses=True)
    # Lock expires after 30 minutes (safety valve)
    acquired = r.set(f"domain:lock:{domain}", "1", nx=True, ex=1800)
    return bool(acquired)


def _release_domain_lock(domain: str):
    """Release the per-domain Redis lock."""
    import redis as redis_lib
    r = redis_lib.Redis.from_url(config.redis_url, decode_responses=True)
    r.delete(f"domain:lock:{domain}")


@app.task(
    name="tasks.process_job",
    bind=True,
    autoretry_for=(ConnectionError, TimeoutError, OSError),
    retry_backoff=30,       # Base: 30 seconds
    retry_backoff_max=480,  # Max: 8 minutes
    retry_jitter=True,
    max_retries=3,
)
def process_job(self, payload: dict):
    """Process a scrape job. Retries on transient network errors with exponential backoff."""
    from app import _run_scrape_job, ScrapeJobRequest

    request = ScrapeJobRequest(**payload)

    # Acquire domain locks for all sites in this job
    locked_domains = []
    for site in request.sites:
        domain = site.baseUrl.split("//")[-1].split("/")[0]
        if not _acquire_domain_lock(domain):
            logger.warning(f"Domain {domain} is locked by another task. Retrying in 60s...")
            raise self.retry(countdown=60, max_retries=5)
        locked_domains.append(domain)

    try:
        logger.info(f"Starting job {request.jobId} ({len(request.sites)} sites)")
        asyncio.run(_run_scrape_job(request))
        logger.info(f"Job {request.jobId} completed successfully")
    except (ConnectionError, TimeoutError, OSError) as exc:
        logger.error(f"Transient error in job {request.jobId}: {exc}")
        raise  # autoretry_for handles this
    except Exception as exc:
        logger.error(f"Permanent error in job {request.jobId}: {exc}")
        # Report error back to API — don't retry permanent failures
        from utils.callback import report_error
        asyncio.run(report_error(request.jobId, str(exc)))
    finally:
        # Always release domain locks
        for domain in locked_domains:
            _release_domain_lock(domain)
```

- [ ] **Step 2: Verify tasks.py imports work**

Run locally (from `scraper/` directory):
```bash
python -c "from tasks import app; print('Celery app loaded:', app.main)"
```
Expected: `Celery app loaded: scraper`

- [ ] **Step 3: Commit**

```bash
git add scraper/tasks.py
git commit -m "feat(scraper): add Celery retry config, task priority, and per-domain locks"
```

---

### Task 2: Add HTML Snapshot Storage on Failed Extraction

**Files:**
- Modify: `scraper/app.py` (add snapshot logic at lines ~165-175, add purge at startup)

- [ ] **Step 1: Add snapshot helper function and startup purge to app.py**

Add these imports at the top of `scraper/app.py` (after existing imports):

```python
import os
import glob
from datetime import datetime, timedelta
```

Add this function before `_run_scrape_job`:

```python
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
```

- [ ] **Step 2: Add purge call to the lifespan startup**

Update the `lifespan` function in `app.py`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Scraper service starting on {config.host}:{config.port}")
    _purge_old_snapshots()
    yield
    logger.info("Scraper service shutting down")
```

- [ ] **Step 3: Add snapshot save on failed extraction in `_run_scrape_job`**

In the `_run_scrape_job` function, after the line `if not listing_urls:` (around line 173), the existing code breaks. Before that break, and also when `raw_data` extraction returns None (around line 194), add snapshot saving.

Find this block (around line 192-196):
```python
raw_data = extractor.extract_property(listing_html, listing_url)
if not raw_data:
    total_errors += 1
    continue
```

Replace with:
```python
raw_data = extractor.extract_property(listing_html, listing_url)
if not raw_data:
    total_errors += 1
    _save_snapshot(site.name, listing_url, listing_html)
    await report_log(job_id, "WARN", f"No data extracted from {listing_url}, snapshot saved")
    continue
```

- [ ] **Step 4: Commit**

```bash
git add scraper/app.py
git commit -m "feat(scraper): add HTML snapshot storage for failed extractions with auto-purge"
```

---

### Task 3: Add Priority to Backend Job Dispatch

**Files:**
- Modify: `backend/src/services/scrape.service.ts` (lines 84-105)

- [ ] **Step 1: Add priority mapping to scrape.service.ts**

Find the `scraperPayload` construction (around line 56) and the Celery task dispatch (around line 84). Update the priority in the `properties` object based on job type.

In `startJob`, after `const scraperPayload = {...}` and before the Redis dispatch `try` block, add:

```typescript
    // Map job type to Celery priority (lower = higher priority)
    const priorityMap: Record<string, number> = {
      ACTIVE_INTENT: 1,
      RESCRAPE: 3,
      PASSIVE_BULK: 7,
      SCHEDULED: 7,
    };
    const taskPriority = priorityMap[type] ?? 5;
```

Then update line 101 (`priority: 0`) to:
```typescript
          priority: taskPriority,
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/scrape.service.ts
git commit -m "feat(backend): add task priority to Celery job dispatch based on scrape type"
```

---

## Chunk 2: Deployment Infrastructure

### Task 4: Add INTERNAL_API_KEY to .env

**Files:**
- Modify: `.env`

- [ ] **Step 1: Generate and add INTERNAL_API_KEY**

Add this line to `.env` (in the RENDER section, after SCRAPER_URL):

```
INTERNAL_API_KEY="rp-internal-$(openssl rand -hex 16)"
```

Run the command to generate the actual key:
```bash
echo "rp-internal-$(openssl rand -hex 16)"
```

Copy the output and set it as the value.

- [ ] **Step 2: Verify backend picks it up**

```bash
cd backend && node -e "require('./src/config/env'); console.log('Internal key configured:', !!require('./src/config/env').config.scraper.internalKey)"
```

Expected: `Internal key configured: true`

- [ ] **Step 3: Commit (DO NOT commit .env — it's gitignored)**

No commit needed — .env is gitignored.

---

### Task 5: Create Koyeb Deployment Config

**Files:**
- Create: `scraper/koyeb.yaml`

- [ ] **Step 1: Create koyeb.yaml**

```yaml
# Koyeb deployment config for the scraper Celery worker
# Deploy as a Worker service (no HTTP port)
# Environment variables must be set in the Koyeb dashboard

name: realtors-scraper-worker
type: worker

# Docker build settings
docker:
  dockerfile: Dockerfile
  # Override CMD to run Celery worker instead of uvicorn
  command: >
    celery -A tasks worker
    --loglevel=info
    --concurrency=2
    -Q celery
    --without-heartbeat
    --without-mingle

# Instance config
instance_type: eco  # 512MB RAM, $2.70/mo
regions:
  - fra  # Frankfurt (closest to Render EU)
min_scale: 1
max_scale: 1

# Health check (Celery worker doesn't have HTTP, use process check)
# Koyeb monitors the process — if it exits, it restarts

# Environment variables (set these in Koyeb dashboard, not here):
# REDIS_URL          — Upstash Redis URL (rediss://...)
# API_CALLBACK_URL   — https://realtors-practice-new-api.onrender.com/api
# INTERNAL_API_KEY   — Must match backend's INTERNAL_API_KEY
# GEMINI_API_KEY     — For LLM extraction fallback
# PROXY_URL          — Rotating proxy URL (optional)
# LOG_LEVEL          — info
# SAVE_RAW_HTML      — true
# RAW_HTML_DIR       — /tmp/scraper-snapshots
```

- [ ] **Step 2: Commit**

```bash
git add scraper/koyeb.yaml
git commit -m "feat(scraper): add Koyeb deployment config for Celery worker"
```

---

### Task 6: Verify ioredis is Installed in Backend

**Files:**
- Verify: `backend/package.json`

- [ ] **Step 1: Check if ioredis is in dependencies**

```bash
cd backend && grep ioredis package.json
```

If NOT found, install it:
```bash
cd backend && npm install ioredis
```

- [ ] **Step 2: Commit if package.json changed**

```bash
cd backend && git add package.json package-lock.json
git commit -m "chore(backend): add ioredis dependency for Redis-based job dispatch"
```

---

## Chunk 3: Site Migration + Verification

### Task 7: Seed Nigerian Property Site Configs

**Files:**
- Create: `backend/prisma/seed-sites.ts` (seed script)

- [ ] **Step 1: Create seed script for 5 Nigerian property sites**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sites = [
  {
    name: "PropertyPro",
    baseUrl: "https://www.propertypro.ng",
    listingUrl: "https://www.propertypro.ng/property-for-sale/in/lagos",
    selectors: {
      listing_link: "a.single-room-sale",
      title: "h2.listings-property-title, h1.property-title",
      price: "h3.listings-price, span.price",
      location: "h4.listings-location, address",
      bedrooms: "span[title='Bedrooms'], .beds",
      bathrooms: "span[title='Bathrooms'], .baths",
      toilets: "span[title='Toilets']",
      images: "img.property-image::attr(src), img.gallery-image::attr(src)",
      description: "div.property-description, div.description",
      agentName: "span.agent-name, a.agent-link",
      features: "li.feature, ul.amenities li",
    },
    paginationType: "URL_PARAM",
    maxPages: 10,
    requiresBrowser: false,
    scrapeIntervalHours: 24,
    enabled: true,
  },
  {
    name: "Nigeria Property Centre",
    baseUrl: "https://nigeriapropertycentre.com",
    listingUrl: "https://nigeriapropertycentre.com/for-sale/flats-apartments/lagos/showtype",
    selectors: {
      listing_link: "div.wp-block a[href*='/properties/']",
      title: "h1.property-title, h4.content-title",
      price: "span.price, h3.price",
      location: "address, span.location",
      bedrooms: "span.beds, li:has(i.bed)",
      bathrooms: "span.baths, li:has(i.bath)",
      images: "img.property-img::attr(src), div.gallery img::attr(data-src)",
      description: "div.description-text",
      agentName: "span.marketed-by, a.agent-name",
      features: "ul.features li, div.amenities span",
    },
    paginationType: "PATH_SEGMENT",
    maxPages: 10,
    requiresBrowser: false,
    scrapeIntervalHours: 24,
    enabled: true,
  },
  {
    name: "Jiji Nigeria",
    baseUrl: "https://jiji.ng",
    listingUrl: "https://jiji.ng/lagos/real-estate",
    selectors: {
      listing_link: "a[href*='/real-estate/']",
      title: "h1.b-advert-title, h3.qa-advert-title",
      price: "span.qa-advert-price, div.price",
      location: "span.b-advert-info-region, div.location",
      bedrooms: "li:contains('Bedrooms')",
      bathrooms: "li:contains('Bathrooms')",
      images: "img.b-advert-image::attr(src)",
      description: "div.b-advert-description",
      features: "ul.params li",
    },
    paginationType: "URL_PARAM",
    maxPages: 5,
    requiresBrowser: true,
    scrapeIntervalHours: 24,
    enabled: true,
  },
  {
    name: "Property24 Nigeria",
    baseUrl: "https://www.property24.com.ng",
    listingUrl: "https://www.property24.com.ng/property-for-sale/lagos",
    selectors: {
      listing_link: "a.js_rollover_container",
      title: "h1.p24_propertyTitle",
      price: "span.p24_price",
      location: "span.p24_location",
      bedrooms: "span.p24_featureDetails[title='Bedrooms']",
      bathrooms: "span.p24_featureDetails[title='Bathrooms']",
      images: "img.p24_mainImage::attr(src)",
      description: "div.p24_propertyDescription",
      agentName: "span.p24_agentName",
      features: "ul.p24_keyFeatures li",
    },
    paginationType: "URL_PARAM",
    maxPages: 10,
    requiresBrowser: false,
    scrapeIntervalHours: 48,
    enabled: true,
  },
  {
    name: "BuyLetLive",
    baseUrl: "https://buyletlive.com",
    listingUrl: "https://buyletlive.com/properties/sale",
    selectors: {
      listing_link: "a[href*='/property/']",
      title: "h1.property-title",
      price: "span.price, div.property-price",
      location: "span.location, div.property-location",
      bedrooms: "span.beds",
      bathrooms: "span.baths",
      images: "img.property-image::attr(src)",
      description: "div.property-description",
      features: "ul.amenities li",
    },
    paginationType: "URL_PARAM",
    maxPages: 5,
    requiresBrowser: true,
    scrapeIntervalHours: 24,
    enabled: true,
  },
];

async function main() {
  console.log("Seeding Nigerian property sites...");

  for (const site of sites) {
    const existing = await prisma.site.findFirst({
      where: { baseUrl: site.baseUrl, deletedAt: null },
    });

    if (existing) {
      console.log(`  Skipping ${site.name} — already exists`);
      continue;
    }

    await prisma.site.create({ data: site });
    console.log(`  Created: ${site.name}`);
  }

  console.log("Done! Sites seeded.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the seed script**

```bash
cd backend && npx tsx prisma/seed-sites.ts
```

Expected: 5 sites created (or skipped if they already exist).

- [ ] **Step 3: Verify via API**

```bash
curl -s http://localhost:5000/api/sites -H "Authorization: Bearer <token>" | python3 -m json.tool | head -20
```

Expected: Response with 5+ sites listed.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed-sites.ts
git commit -m "feat(backend): add seed script for 5 Nigerian property site configs"
```

---

### Task 8: Manual Setup — Upstash Redis + Koyeb (User Action)

These are manual steps the user must perform:

- [ ] **Step 1: Create Upstash Redis**

1. Go to https://console.upstash.com
2. Create new Redis database
3. Region: EU West (closest to Render)
4. Copy the `rediss://` connection URL

- [ ] **Step 2: Add REDIS_URL to backend .env**

Add to `.env`:
```
REDIS_URL="rediss://default:YOUR_PASSWORD@your-instance.upstash.io:6379"
```

- [ ] **Step 3: Add REDIS_URL to Render dashboard**

In Render dashboard → your backend service → Environment → add `REDIS_URL`.

- [ ] **Step 4: Deploy scraper to Koyeb**

1. Go to https://app.koyeb.com → Create Service
2. Connect GitHub repo
3. Builder: Docker, Dockerfile path: `scraper/Dockerfile`, context: `scraper/`
4. Service type: **Worker**
5. Override run command: `celery -A tasks worker --loglevel=info --concurrency=2 -Q celery --without-heartbeat --without-mingle`
6. Instance: Eco ($2.70/mo)
7. Set environment variables:
   - `REDIS_URL` — same Upstash URL
   - `API_BASE_URL` — `https://realtors-practice-new-api.onrender.com/api`
   - `INTERNAL_API_KEY` — same key as backend
   - `GEMINI_API_KEY` — your Gemini key
   - `SAVE_RAW_HTML` — `true`
   - `LOG_LEVEL` — `info`

- [ ] **Step 5: Verify worker is running**

Check Koyeb dashboard → Service logs. Should see:
```
[INFO] Connected to redis://...
[INFO] celery@... ready.
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Trigger scrape from UI**

1. Open http://localhost:3000/scraper (or production URL)
2. Select one site (e.g., PropertyPro)
3. Set max pages to 1
4. Click "Start Scrape"

- [ ] **Step 2: Verify job dispatched to Redis**

Check backend logs — should see:
```
Scrape job <id> dispatched to Celery Redis queue (1 sites)
```

- [ ] **Step 3: Verify worker picks up the job**

Check Koyeb worker logs — should see:
```
Starting job <id> (1 sites)
Scraping site: PropertyPro (https://www.propertypro.ng)
```

- [ ] **Step 4: Verify live logs stream to frontend**

The `/scraper` page should show real-time log entries via Socket.io.

- [ ] **Step 5: Verify properties appear in database**

```bash
curl -s "http://localhost:5000/api/properties?limit=5&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer <token>" | python3 -m json.tool
```

Should show newly scraped properties with quality scores.

- [ ] **Step 6: Verify deduplication**

Re-run the same scrape. Backend logs should show duplicates detected:
```
Job <id> completed: 0 new, X dups, 0 errors
```

- [ ] **Step 7: Update CHECKLIST.md**

Mark completed tasks in Phase 3 of CHECKLIST.md.

```bash
git add CHECKLIST.md
git commit -m "docs: update CHECKLIST.md — Phase 3 scraper tasks completed"
```
