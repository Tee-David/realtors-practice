# Phase 3 Completion: Scraper Production Pipeline

## Context

The scraper microservice code is 100% complete (19/40 Phase 3 tasks done) but cannot run in production. Celery has no retry logic, no task priority, and no concurrency limits. No deployment config exists. Redis isn't provisioned. This spec covers the remaining 21 tasks to make the scraper pipeline fully operational end-to-end.

## Architecture

```
[Frontend UI] → [Backend (Render)] → [Redis (Upstash)] ← [Celery Worker (Koyeb)]
                        ↑                                          |
                        └──── HTTP callbacks (scrape-results, ─────┘
                              scrape-progress, scrape-error,
                              scrape-log)
```

**Deployment targets:**
- Scraper worker: Koyeb (Eco instance, $2.70/mo, 512MB RAM)
- Redis: Upstash (free tier dev, pay-as-you-go production)
- Backend: Render (existing)
- Frontend: Vercel (existing)

## Chunk 1: Celery Hardening

### 1.1 Task Retries with Exponential Backoff

**File:** `scraper/tasks.py`

- Max 3 retries per task
- Backoff: 30s, 120s, 480s (base=30, multiplier=4)
- Retry only on transient errors: `ConnectionError`, `TimeoutError`, HTTP 429/503
- Permanent failures (404, invalid selectors, parse errors) fail immediately
- Use Celery's built-in `autoretry_for`, `retry_backoff`, `retry_backoff_max`

### 1.2 Task Priority

**Files:** `scraper/tasks.py`, `backend/src/services/scrape.service.ts`

Celery priority levels (0 = highest):
- `1` — Active-intent scrapes (triggered by search with 0 results)
- `3` — Manual UI-triggered scrapes
- `7` — Scheduled bulk scrapes (cron)

Backend passes `priority` field in the Celery task message.

### 1.3 Concurrency Limits

**Files:** `scraper/tasks.py`, `scraper/app.py`

- Celery worker `--concurrency=2` (max 2 simultaneous tasks)
- Per-domain Redis lock: only 1 active scrape per domain at any time
- Lock key: `domain:lock:{domain}` with 30-minute TTL
- If domain is locked, task is retried after 60s (counts as a retry)

### 1.4 Raw HTML Snapshots

**File:** `scraper/app.py` (within `_run_scrape_job`)

- On extraction failure (0 properties from a page), save raw HTML
- Storage: `snapshots/{site_name}_{ISO_timestamp}.html`
- Auto-purge on worker startup: delete snapshots older than 7 days
- Log the snapshot path for debugging

## Chunk 2: Deployment Infrastructure

### 2.1 Upstash Redis

Manual setup (user action):
1. Create Upstash Redis database at console.upstash.com
2. Select EU region (closest to Render backend)
3. Copy the `rediss://` connection URL

### 2.2 Backend Redis Integration

**Files:** `backend/package.json`, `backend/src/services/scrape.service.ts`, `backend/src/config/env.ts`

- Install `ioredis` package
- Update scrape service to dispatch jobs by pushing Celery-compatible messages to Redis
- Message format: JSON with `body` (base64-encoded task args), `content-type`, `properties` (delivery_tag, priority)
- Remove direct HTTP calls to scraper API for job dispatch
- Keep HTTP callback endpoints unchanged

### 2.3 Koyeb Deployment

**File:** `scraper/koyeb.yaml` (new)

```yaml
name: realtors-scraper
type: worker
instance_type: eco
regions: [fra]
docker:
  dockerfile: Dockerfile
  context: .
  command: celery -A tasks worker --loglevel=info --concurrency=2
env:
  - key: REDIS_URL
    value: (set in Koyeb dashboard)
  - key: API_CALLBACK_URL
    value: https://realtors-practice-new-api.onrender.com/api
  - key: INTERNAL_API_KEY
    value: (set in Koyeb dashboard)
  - key: GEMINI_API_KEY
    value: (set in Koyeb dashboard)
```

### 2.4 Dockerfile Update

**File:** `scraper/Dockerfile`

Current CMD runs uvicorn (FastAPI). For Koyeb worker deployment, the CMD should be overridden by koyeb.yaml to run Celery instead. Keep the Dockerfile CMD as uvicorn for local dev / HTTP API mode, and override in deployment config.

### 2.5 Environment Variables

Add to backend `.env`:
- `REDIS_URL` — Upstash Redis URL
- `INTERNAL_API_KEY` — shared secret for scraper ↔ backend auth

Add to Koyeb dashboard:
- `REDIS_URL` — same Upstash Redis URL
- `API_CALLBACK_URL` — Render backend URL
- `INTERNAL_API_KEY` — same shared secret
- `GEMINI_API_KEY` — for LLM extraction fallback
- `PROXY_URL` — rotating proxy (optional)

## Chunk 3: Site Migration + Testing

### 3.1 Site Migration

Migrate configs for these Nigerian property sites to the Site table:
1. PropertyPro.ng (propertypro.ng) — static, URL param pagination
2. Nigeria Property Centre (nigeriapropertycentre.com) — static, path segment pagination
3. Jiji.ng (jiji.ng) — JS-rendered, needs Playwright
4. Property24 Nigeria (property24.com.ng) — static, URL param
5. BuyLetLive (buyletlive.com) — JS-rendered, React SPA

Each site needs: name, baseUrl, listingUrl, listingSelector, selectors JSON, paginationType, requiresJs, maxPages.

### 3.2 End-to-End Tests

1. **UI → Worker:** Trigger scrape from `/scraper` page → verify job appears in Celery worker logs
2. **Live logs:** Verify Socket.io streams scrape progress/logs to frontend in real-time
3. **Data flow:** Properties from real sites appear in DB with quality scores > 30
4. **Dedup:** Re-scrape same site → duplicates detected and skipped
5. **Priority:** Active-intent job processes before bulk scrape job
6. **Retry:** Simulate transient failure → verify task retries with backoff

## Files Modified

| File | Change |
|------|--------|
| `scraper/tasks.py` | Add retry config, priority handling, domain locks |
| `scraper/app.py` | Add HTML snapshot storage, snapshot purge on startup |
| `scraper/config.py` | Add snapshot dir, retry config |
| `scraper/Dockerfile` | Verify production-ready (already is) |
| `scraper/koyeb.yaml` | New — Koyeb deployment config |
| `backend/src/services/scrape.service.ts` | Redis-based job dispatch, priority field |
| `backend/src/config/env.ts` or equivalent | Add REDIS_URL, INTERNAL_API_KEY |
| `backend/package.json` | Add ioredis dependency |
| `.env` | Add REDIS_URL, INTERNAL_API_KEY |

## Success Criteria

1. Scraper worker runs on Koyeb, picks up jobs from Redis queue
2. Backend dispatches jobs via Redis (no direct HTTP to scraper)
3. Failed tasks retry with exponential backoff (visible in logs)
4. Active-intent scrapes process before bulk scrapes
5. Only 1 scrape per domain runs at a time
6. Failed extractions save HTML snapshots for debugging
7. Properties from real Nigerian sites appear in the database with quality scores
8. Live logs stream to the frontend via Socket.io
9. Duplicates are detected and skipped on re-scrape
