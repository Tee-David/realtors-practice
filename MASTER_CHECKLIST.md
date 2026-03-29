# Master Checklist — Realtors' Practice

> Every feature must work properly before AI features are implemented.
> Generated: 2026-03-27 | Status: PRE-AI AUDIT

---

## Legend

- [ ] = Not started
- [~] = Partially working / needs improvement
- [x] = Working correctly
- **STRIP** = Remove entirely
- **DEFER** = Skip for now, build later


## Phase 0: Critical Bugs (Fix First)

### 0.1 Meilisearch Field Mapping (Search is broken)
- [x] Fix `property.location` → should be `locationText`
- [x] Fix `property.estate` → should be `estateName`
- [x] Fix `property.currency` → should be `priceCurrency`
- [x] Fix `property.totalArea` → should be `buildingSizeSqm || landSizeSqm`
- [x] Fix invalid ranking rules format in meili.service.ts
- [x] Re-index: added `MeiliService.configureIndex()` on server startup + `POST /internal/reindex` endpoint

### 0.2 Geocoding Not Wired (THIS IS WHY MAP MARKERS DON'T SHOW)
The map component (`osm-map.tsx:88`) filters: `properties.filter(p => p.latitude && p.longitude)`.
Since geocoding is never called during scraping, ALL properties have null lat/lng = zero markers.

- [x] Wire geocoding service into property ingestion pipeline (`PropertyService.create()` now geocodes async)
- [x] Call `GeocodingService.geocode(locationText, state, area)` for each new property
- [~] Backfill lat/lng for ALL existing properties with null coordinates (batch job — endpoint added, trigger from Settings > Data & Display)
- [x] After backfill, map markers will appear immediately — no frontend changes needed
- [x] Add rate limiting for Nominatim geocoding (1 req/sec per their policy) — already built into GeocodingService
- [x] Cache geocoding results by location string to avoid duplicate API calls — Redis cache 24h built-in

### 0.3 Sidebar Hardcoded User
- [x] Replace hardcoded `initials = "AD"` / `name = "Admin"` in app-sidebar.tsx
- [x] Fetch actual user from auth context (via `auth.me()`)
- [x] Show real avatar, name, and initials

### 0.4 Socket Race Condition
- [x] Fix ScraperSocketProvider: listeners set up in useEffect `[]` may fire before `connect()` resolves
- [x] Ensure socket is connected before registering event handlers — added `socketReady` state gate

---

## Phase 1: Scraper & Data Pipeline (DEEP AUDIT)

> The scraper is the entire point of the app. This section is comprehensive.

### 1.0 Architecture Overview (from audit)

**Three trigger methods:**
1. **Scheduled cron** — GitHub Actions currently hardcoded to 1 AM UTC (`scrape_cron.yml`) — **must be user-configurable**
2. **Manual** — User triggers from GitHub Actions UI (`workflow_dispatch`)
3. **From app** — User clicks "Save & Run" → backend sends `repository_dispatch` to GitHub

**Data flow:**
```
Frontend (Save & Run) → Backend POST /scrape/start → GitHub Actions repository_dispatch
→ GH Actions starts Python scraper locally (127.0.0.1:8000)
→ Scraper processes sites → sends results back to Backend via HTTP callbacks
→ Backend receives callbacks → persists to DB + broadcasts via Socket.io
→ Frontend receives Socket.io events → updates live UI
```

**41 Python files in scraper/**, organized as:
- `app.py` (911 lines) — FastAPI server, job orchestration
- `engine/` — Fetching (4-layer adaptive: curl_cffi → Scrapling → Crawl4AI → Playwright)
- `extractors/` — LLM extraction, CSS selector learning, NLP, price/location parsing
- `pipeline/` — Dedup, validation, normalization, enrichment, site health
- `utils/` — Callback batching, rate limiting, robots.txt, logging

### 1.1 WHY PRODUCTION SCRAPING FAILS — Root Causes to Check

**A. GitHub Actions secrets (MOST LIKELY ISSUE):**
- [ ] Verify `PROD_API_URL` secret in GitHub → must be the live Render URL (e.g. `https://your-app.onrender.com/api`)
- [ ] Verify `INTERNAL_API_KEY` secret in GitHub → must match backend's `INTERNAL_API_KEY` env var on Render
- [x] If either is missing, the workflow fails with clear error (prepare step checks + config.py validates)
- [x] Check: does `config.py` raise `RuntimeError` in production if `INTERNAL_API_KEY` is missing/default?

**B. Callback URL resolution:**
- [x] Python scraper reads `API_BASE_URL` env var (or `API_CALLBACK_URL` fallback)
- [x] In GitHub Actions, this is set to `${{ secrets.PROD_API_URL }}`
- [x] If secret is empty → defaults to `http://localhost:5000/api` → config.py now raises RuntimeError in production
- [x] **FIX**: Added startup validation that `API_BASE_URL` is not localhost when `ENVIRONMENT=production` + logs callback URL at startup

**C. Backend `/internal/*` routes authentication:**
- [x] All callbacks include `X-Internal-Key` header (verified in callback.py `_headers()`)
- [ ] Backend must validate this header — check `internal.routes.ts` middleware
- [ ] If backend expects a different header name or the key doesn't match → 401 on every callback
- [x] Backend startup now validates INTERNAL_API_KEY is set (server.ts) — fatal in production

**D. Render cold starts / timeouts:**
- [x] Scraper sends callbacks via HTTP POST to Render
- [x] If Render is sleeping (free tier), first request may timeout — health-check ping wakes it up
- [x] CallbackBatcher has retry with exponential backoff (max 60s between retries, 5 attempts)
- [ ] But if ALL 5 retries fail → results saved to `/tmp/scraper-results-{jobId}.json` on GH runner (LOST when runner terminates)
- [x] **FIX**: Added health-check ping (3 retries, 10s delays) before processing sites — aborts early if backend unreachable

**E. Prisma schema drift (PROVEN BUG — happened with Sites):**
- [ ] If new columns were added to Property/ScrapeJob models but `prisma db push` was never run on production CockroachDB
- [ ] `PropertyService.create()` would throw → entire batch of properties lost
- [ ] **FIX**: Always run `prisma db push` after schema changes, add to CD pipeline (manual step — not code-fixable)

**F. Multi-batch completion logic:**
- [x] Backend splits sites into batches of 5, dispatches each as separate GH Actions run
- [x] `handleResults()` increments `completedBatches` counter
- [x] Job only marked COMPLETED when `completedBatches >= totalBatches`
- [x] If one batch fails (GH runner crash, timeout), watchdog catches it — `killStuckJobs()` runs every 5 min
- [x] **FIX**: Watchdog implemented — `killStuckJobs()` marks RUNNING/PENDING jobs FAILED after 30 min, broadcasts error via Socket.io
- [x] **FIX**: Batch mismatch warning — logs if `completedBatches > totalBatches` (duplicate callback detection)
- [x] **FIX**: `handleError()` counts failed batches separately — job only FAILED if ALL batches fail

**G. Socket.io auth on production:**
- [x] Socket provider connects to `/scrape` namespace — now uses httpOnly cookies with `withCredentials: true` (Better Auth)
- [x] **Auth migration to Better Auth complete** — socket uses cookie-based session, no token format needed
- [x] Backend socket middleware validates Better Auth session cookie
- [x] Socket auth fixed — uses `withCredentials: true`, cookies sent automatically

### 1.2 Scraper Callback Endpoints (Backend)

| Endpoint | Purpose | Auth | Retry |
|----------|---------|------|-------|
| `POST /internal/scrape-results` | Final batch of properties → DB persist | X-Internal-Key | 5x exp backoff |
| `POST /internal/scrape-progress` | Live progress → Socket.io broadcast | X-Internal-Key | Batched 5s |
| `POST /internal/scrape-property` | Live property → Socket.io broadcast | X-Internal-Key | Batched 5s |
| `POST /internal/scrape-log-batch` | Logs → DB + Socket.io | X-Internal-Key | Fire & forget |
| `POST /internal/scrape-error` | Fatal error → mark job failed | X-Internal-Key | 3x exp backoff |
| `POST /internal/scrape-learned` | Learned CSS selectors → save to site | X-Internal-Key | 3x exp backoff |

**Critical path**: `/internal/scrape-results` is the ONLY one that persists properties to DB. If this fails, properties are lost.

### 1.3 Property Persistence Pipeline

```
Scraper sends POST /internal/scrape-results with:
  { jobId, properties: [...], stats: { totalScraped, totalErrors, ... } }

Backend handleResults():
  1. Validates jobId exists
  2. For each property:
     a. sanitizeScrapedProperty() — whitelist fields, validate enums
     b. PropertyService.create() — dedup hash, quality score, Meilisearch sync
     c. Track new vs duplicate count
  3. If multi-batch: increment completedBatches
  4. If all batches done: mark job COMPLETED, broadcast job:completed
  5. Update site health scores
```

**Failure points in this pipeline:**
- [x] `sanitizeScrapedProperty()` has field whitelist — logs stripped fields would help but not critical
- [x] `PropertyService.create()` — constraint violations handled by dedup hash check
- [x] Per-property try-catch already in `handleResults()` (line 548-561) — one bad property won't kill batch
- [x] Each property wrapped in try-catch with detailed error logging

### 1.4 LLM Extraction (4 providers)

| Provider | Model | RPM Limit | API Key Secret |
|----------|-------|-----------|----------------|
| Groq | llama-3.3-70b | 30 | `GROQ_API_KEY` |
| Cerebras | qwen-3-235b | 30 | `CEREBRAS_API_KEY` |
| SambaNova | Meta-Llama-3.3-70B | 10 | `SAMBANOVA_API_KEY` |
| Gemini | gemini-2.0-flash | 15 | `GEMINI_API_KEY` |

- [x] Verify at least ONE LLM key is set in GitHub Actions secrets (all 4 passed as secrets in scrape_cron.yml)
- [x] If zero keys: extraction fails with clear FATAL error at startup and per-job start
- [x] Provider rotation: RPM limit triggers rotate to next with exponential cooldown (30s to 300s max) -- verified
- [x] **FIXED**: Added compact startup summary log (LLM Providers: Groq OK, Cerebras NO KEY, ...) + FATAL error when no keys

### 1.5 Anti-Bot & Fetching (4-layer cascade)

```
Layer 1: curl_cffi (Chrome TLS fingerprint) — fastest
Layer 2: Scrapling StealthyFetcher — anti-bot bypass
Layer 3: Crawl4AI — page-to-markdown for LLM
Layer 4: Playwright — full browser with stealth fingerprinting
```

- [x] Block detection (captcha, Cloudflare, "Access Denied")
- [x] Per-domain rate limiting (2-5s random delay)
- [x] robots.txt compliance
- [x] Proxy support (random rotation from PROXY_LIST)
- [x] Stealth measures (webdriver masking, viewport randomization, etc.)
- [x] Verify Playwright installs correctly in GitHub Actions -- `playwright install --with-deps chromium` in both batch and dispatch jobs
- [ ] Check if sites are actually blocking GH Actions IPs -- may need proxies

### 1.6 Extraction Pipeline per Property

```
1. Structured data (JSON-LD, __NEXT_DATA__) [FREE, no LLM needed]
2. CSS selectors (if site was previously learned) [FREE]
3. LLM extraction [PAID, RPM-limited]
4. Detail page enrichment (if quality < threshold)
```

- [x] Deduplication via SHA256 hash
- [x] Quality scoring (0-100)
- [x] Field normalization (whitespace, HTML strip, aliases)
- [x] Price parsing (₦, NGN, "million", "k")
- [x] Location parsing with geocoding
- [x] Verify selector learning works end-to-end: LLM extract -> learn_selectors_from_extraction -> POST /internal/scrape-learned -> DB Site.selectors -> sent back in payload -> used in extraction cascade (app.py lines 512-531)
- [x] Verify detail enrichment: properties missing 2+ fields (description, images, bedrooms, agent) get enriched from detail pages via structured data/OpenGraph/LLM cascade (app.py lines 635-749)

### 1.7 GitHub Actions Workflow Structure

```
Job 1: "Prepare" (5 min timeout)
  - Creates job via POST /api/internal/scrape/create-job
  - Splits sites into batches of 8
  - Creates matrix for parallel execution

Job 2: "Scrape-Batch" (30 min timeout, max 3 parallel)
  - Per batch: setup Python 3.11 → install deps → install Playwright
  - Starts scraper server on 127.0.0.1:8000
  - Polls health endpoint (30 attempts, 2s intervals)
  - Submits batch → polls status every 15s (max 25 min)

Job 3: "Scrape-Dispatch" (45 min timeout)
  - Triggered by repository_dispatch from app
  - Handles both "scrape" and "learn" job types
  - Reports final status back to backend
```

**Timeout hierarchy:**
- Per-site: 10 minutes hard kill
- Per-learn: 15 minutes hard kill
- Overall job: 10 min × site count, min 15 min, max 90 min
- GH Actions job timeout: 30 min (batch) / 45 min (dispatch)

### 1.8 Configurable Cron Schedule
- [x] Cron is currently hardcoded to `0 1 * * *` (1 AM UTC) in `scrape_cron.yml`
- [x] User must be able to set their own schedule time from the Settings or Scraper page
- [x] Options: store schedule in DB (SystemSetting) — backend node-cron in `CronService.initScheduledScrape()` reads `scrape_schedule_enabled` + `scrape_schedule_hour`
- [x] Config sheet has "Recurring Daily Schedule" toggle + hour picker, saves to SystemSetting, backend reschedules on save via `CronService.rescheduleScrapeCron()`
- [x] The GitHub Actions cron is a fallback/default; server-side node-cron is the primary scheduler now

### 1.9 Scraper Page UX

- [x] Live terminal logs with filtering (last 200, level filter)
- [x] Live progress stats (found, duplicates, errors, pages)
- [x] Pipeline queue for multi-site scrapes
- [x] Execution history with status filter tabs
- [x] Incoming properties feed (real-time, last 100)
- [x] Config side sheet (mode, sources, max listings, schedule)
- [x] Scrape estimate calculation (per-site + total)
- [x] Saved config in localStorage (persists between sessions)
- [x] Schedule feature — One-time DateTimePicker clearly labeled + Recurring Daily Schedule toggle/picker with server-side cron
- [~] Site learning — UI triggers `useBulkLearnSites()`, verify backend + scraper end-to-end
- [ ] **Socket auth will break after Supabase → Better Auth migration** — must update token format

### 1.9 Scraper Page Layout Suggestions

- [x] **Tabbed right panel**: Terminal | Incoming Properties | Errors — reduces scrolling, keeps live data above fold
- [ ] **Mobile**: Collapsible accordion sections (stats → terminal → properties → history)
- [x] **Quick Re-run button** on completed jobs in execution history
- [x] **Scrape health summary card** — show last 5 runs success/fail rate, avg properties per run
- [x] **Property count delta** — shown in completion stats + execution history items

### 1.10 Required GitHub Actions Secrets

| Secret | Required | Current Status |
|--------|----------|---------------|
| `PROD_API_URL` | YES — callbacks go here | **CHECK** |
| `INTERNAL_API_KEY` | YES — auth for callbacks | **CHECK** |
| `GROQ_API_KEY` | At least 1 LLM key needed | **CHECK** |
| `CEREBRAS_API_KEY` | Optional (backup LLM) | **CHECK** |
| `SAMBANOVA_API_KEY` | Optional (backup LLM) | **CHECK** |
| `GEMINI_API_KEY` | Optional (backup LLM) | **CHECK** |
| `PROXY_LIST` | Optional (anti-bot) | **CHECK** |

### 1.11 Immediate Action Items (Scraper)

1. [ ] **CHECK GitHub secrets** — `PROD_API_URL` and `INTERNAL_API_KEY` must be set and correct
2. [ ] **CHECK at least 1 LLM API key** is configured in GitHub secrets
3. [ ] **Run `prisma db push`** on production CockroachDB to sync any missing columns
4. [x] **Per-property try-catch** in `handleResults()` — one bad property doesn't kill the batch; errors counted and persisted to job record
5. [ ] **Add startup health-check** — scraper pings backend `/health` before starting work
6. [x] **Job watchdog** — `killStuckJobs()` runs every 5 min via cron, marks stuck jobs FAILED after 30 min
7. [x] **Scrape summary logging** — `[SCRAPE SUMMARY]` log with new/dups/errors/total/duration; summary also broadcast in `job:completed` Socket.io event and stored in DB fields (newListings, duplicates, errors, durationMs)
8. [ ] **Test end-to-end on production** — trigger scrape from UI, watch Render logs, verify DB rows
9. [x] **Fix socket auth for Better Auth** — updated to cookies + `withCredentials: true`, no token header needed
10. [ ] **Recover lost properties** — check if `/tmp/scraper-results-*.json` fallback files exist on any GH runner artifacts

---

## Phase 2: Search & Meilisearch

### 2.1 Backend Search Infrastructure
- [~] Meilisearch service exists but field mappings are broken (see Phase 0)
- [x] NLP query parsing (price, bedrooms, listing type extraction)
- [x] Graceful fallback when Meilisearch is down
- [x] Rate limiting on search endpoint (200 req/5min)
- [ ] Deploy Meilisearch to production (is it running?)
- [x] Wire up SearchQuery logging from frontend (model exists, never called) — useSearch hook fire-and-forget logs to POST /market/log-search

### 2.2 Search Page (frontend/app/(dashboard)/search/)
- [x] Full-text search with faceting (category, listing type, bedrooms, state)
- [x] Voice search with Nigerian phonetic dictionary
- [x] Suggestions dropdown (properties + Nominatim locations)
- [x] Map clustering with Supercluster
- [x] Active scrape trigger on zero results
- [x] Autocomplete/typeahead — limited to 8 suggestions, 300ms debounce on search, 400ms on geocode
- [x] **Improvement: Ajax as-you-type results** — property cards update live as user types (300ms debounce)
- [x] **Improvement: Search understands combined queries** — "3 bed Lekki under 5M" parses all 3 dimensions simultaneously via NL regex parser (60+ Nigerian areas, price/bedroom/type)
- [x] **Improvement: Map pins should update with search results** — price-label pill pins + popup cards + fitBounds for multi-area queries

### 2.3 Search UX Consistency
- [x] Properties page now uses Meilisearch when `q` param present, falls back to direct API for browsing
- [x] Properties page uses Meilisearch for text search
- [x] Data Explorer has basic text search only — acceptable for admin tool.

### 2.4 Saved Searches
- [x] Server-side model exists (SavedSearch with notifyEmail, notifyInApp)
- [x] Frontend saved-searches page uses real API (hooks + TanStack Query)
- [x] Wire frontend "Save Search" to server-side SavedSearch API
- [x] Implement saved search match checking (cron job verified working)
- [x] Wire email notifications for new matches — checks `notifEmailNewMatches` preference, sends via notification service

---

## Phase 3: Properties & Versioning

### 3.1 Properties Page
- [x] Grid/list/map view toggle
- [x] Filters (category, listing type, price range, bedrooms, state, area)
- [x] Pagination with per-page selector
- [x] Sorting (newest, price, quality, bedrooms)
- [x] Property cards with images, price, details
- [~] Map view only shows properties with lat/lng (most are null — see geocoding fix)
- [ ] **Improvement**: After geocoding backfill, map becomes the primary discovery tool

### 3.2 Property Detail Page
- [x] Full property info display (images, price, details, description, features)
- [x] Location map (when lat/lng exists)
- [x] **Share buttons wired** — Facebook, Telegram, WhatsApp, LinkedIn share + copy link
- [x] **Print button** — calls `window.print()`, hidden during print via `print:hidden`
- [x] **Copy Link button** — `navigator.clipboard.writeText(window.location.href)` with check icon feedback
- [x] **Quality score breakdown** — visual progress bar (color-coded), missing fields list, version count
- [x] **Version history fetched and rendered** — VersionTimeline component with color-coded sources, expandable diffs
- [x] **Edit form exists** — slide-over panel with diff confirmation, creates MANUAL_EDIT version (see 3.3)

### 3.3 Property Versioning & Editing (NEW — Major Feature)

**Data model already exists:**
- PropertyVersion with `changeSource` (SCRAPER, MANUAL_EDIT, ENRICHMENT, SYSTEM)
- PriceHistory model
- Diff tracking (changes JSON field)

**What needs to be built:**

- [x] **Edit form on property detail page** (slide-over panel)
  - Editable fields: title, description, price, bedrooms, bathrooms, features, category, listing type, status, area, state
  - Each save creates a new PropertyVersion with `changeSource: MANUAL_EDIT`
  - Show diff of what changed in confirmation dialog before saving

- [x] **Version timeline on property detail page**
  - Visual timeline showing: Original Scrape → Enrichment → Manual Edit → Re-scrape Update
  - Each version shows: who/what changed it, when, what fields changed
  - Color-coded by source: SCRAPER=blue, MANUAL_EDIT=green, ENRICHMENT=purple, SYSTEM=gray
  - Expandable diffs showing old → new values per field
  - [x] Ability to view any version's full snapshot (modal with reconstructed data)
  - [x] Ability to revert to a previous version (confirmation dialog showing diff, creates SYSTEM version)

- [x] **Price history chart**
  - Area chart (Recharts) showing price changes over time with gradient fill
  - Source-colored dots on data points
  - Stats row (low, high, % change)
  - Custom tooltips with source labels
  - This feeds directly into Analytics

- [x] **Re-scrape detection**
  - When the same property is scraped again with different details, auto-create a new PropertyVersion with changeSource: SCRAPER
  - Records what changed (price drop, status change, etc.)
  - This is the foundation for price drop alerts

- [x] **Version types to track:**
  1. `v1 SCRAPER` — Original scrape
  2. `v2 ENRICHMENT` — AI-assisted enrichment (later)
  3. `v3 MANUAL_EDIT` — User edits
  4. `v4 SCRAPER` — Re-scrape with updated data
  5. `v5 SYSTEM` — Automated status changes (e.g., expired)

### 3.4 Compare Properties
- [x] Page exists — replaced MOCK_PROPERTIES with real API search
- [x] Replace mock search with real property API search (useProperties hook)
- [x] Side-by-side comparison works with real properties

---

## Phase 4: Data Explorer (Primary Property Management Tool)

> The Data Explorer is the **power-user command center** for managing all property data.
> Inspired by Airtable (multi-view, inline edit), Retool (data grids, bulk ops), and Notion (linked records, formulas).
> Must feel like a spreadsheet but backed by a real database with versioning, quality scoring, and AI enrichment.

### 4.1 Current State
- [x] Verification tabs (All, Raw/Unverified, Enriched/Verified, Flagged) — pass `verificationStatus` filter to API
- [x] Bulk actions (Verify, Flag, Reject) — call real `POST /properties/bulk-action` via `propertiesApi.bulkAction()`
- [x] Export (CSV, XLSX, PDF) — real `exportsApi.csv/xlsx/pdf()` with blob download
- [x] Sortable columns
- [x] Search with text filter
- [x] Manual property creation — "Add Property" button + full form modal, calls `POST /properties`

### 4.2 Tier 1 — Core Power Features

**4.2A Inline Editing (Spreadsheet-like)**
- [x] Click any cell to enter edit mode (text, number, select, date inputs depending on field type) — double-click on Title, Price, Area, Status columns
- [x] Enter to confirm, Escape to cancel
- [x] Each save calls `PUT /properties/:id` with `MANUAL_EDIT` changeSource
- [~] Optimistic UI update — cell updates immediately, rolls back on API error (spinner + checkmark done, full optimistic pending)
- [x] Visual indicator on edited cells (spinner while saving, green checkmark for 1.5s on success)
- [ ] Batch edit: select multiple rows → edit a field → apply to all selected (e.g., set all to "SOLD")

**4.2B Advanced Filter Panel**
- [x] Collapsible filter panel (slide-out or inline, toggleable via Filter button)
- [x] Filter by: date range (scraped, updated), price range (min/max with ₦), quality score range (slider)
- [x] Filter by: source site (multi-select from real sites API), state (dropdown), area (cascading from state)
- [x] Filter by: category, listing type, status, verification status (multi-select chips)
- [x] Filter by: has images (yes/no/any), has coordinates (yes/no/any), has description (yes/no/any)
- [x] Filter by: bedrooms range, bathrooms range, property type
- [ ] Filter by: days on market (range), agent name (text)
- [x] **Saveable filter presets** — name a filter combination, saved to localStorage, quick-switch dropdown in toolbar with built-in presets (High Quality, No Images, No Coordinates, Stale, Unverified)
- [x] Active filter chips shown above table with individual clear buttons
- [x] "Clear All Filters" button
- [x] Filter count badge on the Filter button

**4.2C Column Customization**
- [x] Column visibility toggle (dropdown with checkboxes for all available columns)
- [ ] Column reorder via drag-and-drop on headers
- [ ] Column resize by dragging header borders
- [ ] Column pinning (freeze left/right)
- [x] Persist column config to localStorage (per user)
- [x] Available columns beyond current 8: bedrooms, bathrooms, toilets, agent name, agent phone, images count, has coordinates, days on market, view count, land size, building size, price per sqm, furnishing, condition, features count, version count, last scraped, source URL
- [x] "Reset to Default" button to restore original column layout

**4.2D Property Detail Slide-Over**
- [x] Click eye icon or Enter on focused row → 680px SideSheet slides open from right
- [x] Shows: images carousel, price, location, details grid (beds/baths/land/building/condition/furnishing/floors), description (truncated at 400 chars with "Show more"), features chips, agent info, quality score bar, source URL, version count, scraped date
- [x] Edit button in slide-over opens PropertyEditForm slide-over
- [x] Navigate between properties with Prev/Next buttons or Up/Down arrow keys while slide-over is open
- [x] Close with Escape or X button
- [ ] Deep link support — URL updates to include property ID so slide-over reopens on page refresh

**4.2E Keyboard Navigation**
- [x] Arrow Up/Down to navigate between rows (highlights focused row)
- [x] Enter on focused row opens the Detail Slide-Over
- [x] Space on focused row toggles its checkbox
- [x] Escape closes the slide-over
- [ ] Arrow keys to navigate between cells (cell-level, not row-level)
- [x] Ctrl+S / Cmd+S to save current edit
- [x] Shift+Click for range selection
- [x] Ctrl+Click for multi-select individual rows
- [x] Ctrl+A to select all visible rows
- [x] Delete key on selected rows → confirmation dialog → soft delete
- [x] Ctrl+Z to undo last edit (single-level undo)
- [x] Keyboard shortcut help overlay (? key)

### 4.3 Tier 2 — Data Quality & Integrity

**4.3A Duplicate Detection & Merge**
- [x] "Find Duplicates" button in toolbar — scans visible/filtered properties
- [x] Uses `GET /api/properties/duplicates` — groups by similar title+area or same price±5%+area
- [x] Results shown as clusters: group of similar properties
- [x] Side-by-side comparison view within each cluster
- [x] Field-level merge: pick best value from each duplicate (longest description, most images, newest price)
- [x] "Merge & Delete Duplicates" action — `POST /api/properties/merge`, keeps winner, soft-deletes losers, creates SYSTEM version
- [x] Bulk duplicate scan option: "Find Duplicates" scans entire filtered set

**4.3B Data Completeness Indicator**
- [x] Per-row visual bar (like a progress bar) showing field fill rate
- [x] Weighted scoring: title ✓, description ✓, price ✓, images ✓, coords ✓, agent ✓, features ✓, etc.
- [x] Color-coded: green (>80%), yellow (50-80%), red (<50%)
- [ ] Sort by completeness to find properties needing attention (client-side sort deferred — backend field needed)
- [x] Tooltip on hover shows exactly which fields are missing
- [x] Column available: "Completeness" with the percentage (toggleable via Columns picker)

**4.3C Bulk Enrichment**
- [x] Select N properties → "Enrich Selected" button with live progress indicator
- [x] Calls `POST /properties/:id/llm-enrich` for each selected property
- [x] Shows per-property progress (✓ done, ✗ failed counts)
- [x] "Enrich by Site" dropdown — triggers `POST /properties/llm-enrich-by-site` with confirmation dialog showing count
- [ ] Shows before/after quality score change (deferred)
- [ ] **DEFER full AI enrichment to Phase 11** — LLM enrichment service built with provider rotation

**4.3D Quality Score Deep Dive**
- [x] Click quality score → popover/modal showing 8-category breakdown:
  - Title (0-10), Description (0-15), Price (0-10), Property Details (0-15)
  - Location (0-20), Images (0-15), Agent Info (0-10), Features (0-5)
- [x] Color-coded bars per category
- [x] "What's missing" section with actionable suggestions
- [ ] Manual score override option (with reason, creates audit log entry)
- [ ] Bulk recalculate quality scores button

**4.3E Stale Data Detection**
- [x] Visual indicator for properties not re-scraped in 30+ days (amber dot on title, Clock badge on card/slide-over)
- [x] "Re-scrape This Property" button — triggers targeted scrape for that listing URL (in row actions + slide-over)
- [x] Bulk re-scrape selected — via "More" bulk dropdown
- [x] Filter preset: "Stale (30+ days)" for quick access (Stale toggle in toolbar)
- [x] Automatic staleness badge in the Status column (staleIndicator column, toggleable)

### 4.4 Tier 3 — Views & Workflow

**4.4A Multiple View Types (Airtable-inspired)**
- [x] **Grid View** (default) — current table, enhanced with all Tier 1 features
- [x] **Gallery/Card View** — property cards in a 4-column grid layout with image, price, badges, completeness bar
- [x] **Kanban View** — columns by verification status, drag a card to change status
- [ ] **Map View** — all filtered properties on a map (DEFER to Phase 8)
- [x] View switcher in toolbar (Grid | Cards | Kanban)
- [x] Each view respects current filters and sort
- [x] Persist last-used view to localStorage (`data-explorer-view` key)

**4.4B Saved Views (Smart Views)**
- [ ] Save a combination of: filters + columns + sort + view type + grouping as a named view
- [ ] Examples: "Lekki Flagged Properties", "High Quality Unverified", "No Images", "Price Drops This Week"
- [ ] Quick-switch dropdown in toolbar
- [ ] Shared views (accessible to all team members) vs personal views
- [ ] View count badge showing how many properties match
- [ ] Persist to backend (new model: `SavedView { name, filters, columns, sort, viewType, userId }`)

**4.4C Row Grouping & Aggregation**
- [ ] Group by: source site, area, state, category, listing type, verification status, status
- [ ] Collapsible group headers with aggregate stats: count, avg price, avg quality score
- [ ] Sub-totals per group
- [ ] Multi-level grouping (e.g., State → Area → Source)
- [ ] Group sort: by count, by name, by avg price

**4.4D Batch Operations (Extended)**
- [x] Beyond verify/flag/reject: set listing status (AVAILABLE, SOLD, EXPIRED, RENTED) — via "More" dropdown
- [ ] Bulk set category, listing type, property type
- [ ] Bulk assign to source site (for manually added properties)
- [x] Bulk soft-delete with confirmation dialog
- [ ] Bulk restore from trash
- [ ] Bulk add/remove tags (if tags feature is added)
- [ ] Bulk geocode (trigger geocoding for selected properties with missing coords)
- [x] Bulk re-scrape selected properties (triggers scrape for each listing URL)

**4.4E Smart Exports (Enhanced)**
- [ ] Export uses current filters + column selection (not just IDs) via `POST /export/csv/filtered`
- [ ] Export format options: CSV, XLSX (styled), PDF (landscape report), JSON
- [ ] Include/exclude version history in export (checkbox)
- [ ] Include/exclude images URLs in export
- [ ] Export template presets (e.g., "Client Report", "Full Data Dump", "Price Comparison")
- [ ] Scheduled exports (daily/weekly email with latest data) — DEFER

### 4.5 Tier 4 — Intelligence & Automation (bridges to AI Phase 11)

**4.5A AI Auto-Tagging**
- [ ] Button to auto-categorize properties from description text
- [ ] Auto-detect: property type, features, amenities, condition
- [ ] Auto-extract: landmarks, nearby POIs from description
- [ ] Confidence score shown, user confirms/rejects suggestions
- [ ] **DEFER to Phase 11** — placeholder card exists

**4.5B AI Duplicate Resolution**
- [ ] AI compares suspected duplicates, suggests which fields to keep
- [ ] Learns from user merge decisions to improve future suggestions
- [ ] **DEFER to Phase 11** — placeholder card exists

**4.5C Trash & Archive**
- [ ] Trash view — see all soft-deleted properties
- [ ] Bulk restore, permanent delete with confirmation
- [ ] Auto-purge trash after 30 days (configurable)
- [ ] Archive view — properties manually archived (not deleted, just hidden from main views)

**4.5D Audit Trail Integration**
- [ ] Per-property audit trail: who changed what, when, from where (scraper/manual/enrichment/system)
- [ ] Link to full audit log page filtered by property ID
- [ ] "Last edited by" column option showing user name + timestamp

**4.5E Property Relationships**
- [ ] Link related properties (e.g., same building, same agent, same estate)
- [ ] "Similar Properties" panel in slide-over (using nearby + same area + similar price)
- [ ] Price comparison with linked properties

**4.5F Computed/Formula Columns**
- [ ] Price per sqm (auto-calculated from price + building/land size)
- [ ] Price per bedroom
- [ ] Days since last update
- [ ] Days on market
- [ ] Price change % (from price history)
- [ ] These should be sortable and filterable like regular columns

---

## Phase 5: Analytics (Real Data, Not Random)

### 5.1 Dashboard Home
- [x] KPI cards use real data from `useDashboardKPIs()` hook
- [x] Sparkline bars wired to real `useWeeklySparkline()` data (12 weeks)
- [x] Trend percentages — real period-over-period calculation via /analytics/kpi-trends endpoint
- [x] Category breakdown bars (real data from property stats)
- [x] Status distribution dots (real data)
- [x] Recent properties grid (real data)
- [x] Site quality widget
- [x] Globe hero visualization
- [x] Compute real trend percentages from period-over-period data — useKPITrends() hook + backend getKPITrends()

### 5.2 Analytics Page
- [x] Replaced `genSeries()` with real `useListingVelocity()` data (last 30 days)
- [x] Replaced `buildHeatmap()` with real `useActivityHeatmap()` data (90 days)
- [x] KPI cards at top use real `useDashboardKPIs()` hook
- [x] Properties over time — real time-series from listing velocity endpoint
- [x] Price trends — wired usePriceTrends() hook + PriceTrendsChart component on analytics page
- [x] Scraping activity heatmap — real data from `getActivityHeatmap()` (7×24 grid)
- [x] Top areas — real aggregation by area
- [x] Top sources — real aggregation by source site
- [ ] Category distribution over time
- [ ] Listing type distribution
- [x] Quality score distribution — backend endpoint exists (`/analytics/quality-distribution`)
- [ ] Properties by verification status over time

### 5.3 What Real Analytics Are Useful for Property Intelligence
- [ ] **Price per sqm by area** — key metric for property valuation
- [ ] **Days on market** — how long properties stay AVAILABLE before status change
- [ ] **Price drop frequency** — which areas/categories see most price reductions
- [ ] **Supply trends** — new listings per week by area, showing market activity
- [ ] **Scraper health dashboard** — success rate by site, properties found per run, error trends
- [ ] **Data quality trends** — average quality score over time, completeness improving?

### 5.4 Market Intelligence Page
- [~] Backend endpoints exist and work, but need sufficient property data to be useful
- [ ] Will become valuable automatically as scraper brings in more data
- [ ] Trending searches (from SearchQuery model — needs to be wired)

---

## Phase 6: Settings Page (Section by Section)

### 6.1 Profile
- [x] View/edit name, phone, bio, company
- [x] Avatar upload with resize
- [x] Calls real `auth.updateProfile()` API
- [x] Email shown as locked (correct — managed by Better Auth)

### 6.2 Security
- [x] Password change via Better Auth `changePassword()`
- [x] Google account link/unlink via Better Auth `linkSocial()` / `unlinkAccount()`
- [x] Active sessions display via Better Auth `listSessions()`
- [x] Revoke other sessions via Better Auth `revokeOtherSessions()`
- **Updated with Phase 9 (Better Auth migration complete)**

### 6.3 Notifications
- [x] **Preferences wired to backend** — 10 fields added to User model (notifEmail*, notifInApp*, quietHours, digest)
- [x] Removed fake "Save Preferences" button — replaced with "auto-save" info text
- [x] Create backend NotificationPreference fields on User model
- [x] Create API endpoints: `GET /api/users/me/notification-preferences`, `PATCH /api/users/me/notification-preferences`
- [x] Wire frontend toggles to real API — `useNotificationPreferences()` hook with debounced 500ms PATCH
- [~] Implement actual email sending for:
  - [x] New saved search matches — checks `notifEmailNewMatches`, sends via notification service
  - [ ] Price drops on watched properties
  - [x] Scrape job completion — `SCRAPE_COMPLETE`/`SCRAPE_FAILED` notifications in notification.service.ts
- [x] Implement in-app notifications for same events (Socket.io `/notify` namespace)
- [x] Quiet hours feature (11pm-7am) — enforced on backend in notification.service.ts
- [ ] Digest frequency (realtime/daily/weekly) — implement digest email job

### 6.4 Appearance
- [x] Theme switching (light/dark/system) — works, persisted
- [x] Custom primary colors (light and dark)
- [x] Font family selection (display + body, Google Fonts)
- [x] Font size (small/default/large)
- [x] Compact mode toggle
- [x] Live preview lanyard
- **Working correctly. Nice feature.**

### 6.5 Data & Display
- [x] Map provider selection (OSM/Mapbox/Google) with API key inputs
- [x] Display preferences (per page, default sort, listing type, date format)
- [x] Voice search auto-submit toggle
- [x] Removed misleading "Save" button — replaced with "auto-saved" info text (prefs use `usePersistedState`)
- [ ] Consider syncing to backend for cross-device persistence

### 6.6 Email Settings
- [x] Provider selection (SMTP/Resend)
- [x] SMTP config fields (host, port, user, pass)
- [x] Resend API key field
- [x] From address and reply-to
- [x] Send test email (calls real `auth.testEmail()` API)
- [x] Email template builder (drag-and-drop Unlayer editor)
- [~] SMTP/Resend config saved to localStorage, not backend — should be env vars
- [x] Clarify that email provider config is via backend env vars (UI already shows this note)
- [x] Template saves wired to backend — `EmailTemplate` model + `POST /api/email-templates` upsert + `GET /api/email-templates` list; builder loads saved design on edit

### 6.7 Backups
- [x] Stripped mock data and fake controls
- [x] Replaced with CockroachDB managed backup notice
- **CockroachDB handles backups automatically. Manual backup controls deferred.**

### 6.8 About
- [x] App info display (version, environment, tech stack)
- [x] Auto-detect version from package.json (was hardcoded "v2.5.0")
- [~] Legal links ("Coming soon" toast)
- **Low priority, mostly fine.**

### 6.9 Users (Team Management)
- [x] User list with role, last login, login count, status
- [x] Role changing (Admin/Editor/Viewer/API_User)
- [x] Toggle user active/inactive
- [x] Invite user modal (email, name, role)
- [x] Super admin protection (wedigcreativity@gmail.com)
- [x] Delete user — wired to `DELETE /api/users/:id` (soft delete via `deletedAt` + deactivate, super admin protected)
- [x] Implement user deletion backend endpoint — soft delete, audit logged, excludes deleted users from list
- [ ] Add user search/filter for large teams

### 6.10 Site Intelligence (Scraper Settings)
- [x] Settings wired to backend SystemSetting model (category: `site_intelligence`)
- [x] Frontend `useSettingsByCategory` / `useUpdateSettings` hooks created
- [x] Auto-learn on site creation (site controller fires learn job when `si_auto_learn_on_create` is true)
- [x] Auto-learn before scrape (scrape service learns unlearned sites when `si_auto_learn_before_scrape` is true)
- [x] Periodic re-learn interval setting stored (enforcement deferred to scheduled job / cron)
- [x] CSS selector confidence threshold passed to scraper payloads

### 6.11 AI Intelligence
- [~] Shows AI provider status and feature toggles
- [ ] **DEFER** — this is for the AI phase

---

## Phase 7: Remaining Pages

### 7.1 Notifications Page
- [x] Notification list with mark as read (real API: `notifications.list()`, `markRead()`, `markAllRead()`)
- [x] Real-time via Socket.io `/notify` namespace (unread count polls 30s + socket events)
- [x] Pagination, tab filtering (all/unread), time-ago display
- [x] Verify notifications are being created by backend events (scrape complete, new matches, etc.) — `NotificationService.create()` called in `scrape.service.ts` on COMPLETED and FAILED

### 7.2 Saved Searches Page
- [x] CRUD operations work
- [x] Filter display
- [x] Show match count and "new since last check" badge — badge shows `_count.matches` + green `+N new` badge from `newSinceCheck`
- [x] Link to search results for each saved search — "Matches (N)" button opens matches panel + "Search Now" button navigates to `/search` with filters as URL params

### 7.3 Audit Log
- [x] Log display with filters
- [x] Real data from backend
- **Working correctly.**

### 7.4 Privacy Center
- [x] **STRIPPED** — replaced with redirect to dashboard

### 7.5 AI Assistant Page
- **DEFER** — 100% placeholder, will be built with AI Elements in AI phase

---

## Phase 8: App-Wide UX & Responsive Improvements

### 8.1 Navigation Rethink
- [x] Reorganized sidebar into: OVERVIEW (Dashboard) | PROPERTIES (Browse & Map, Data Explorer, Compare, Saved Searches) | SCRAPING (Scraper, Sites) | INTELLIGENCE (Analytics, Market Intel, AI Assistant) | SYSTEM (Notifications, Audit Log, Settings)

### 8.2 Responsive Design Audit
- [ ] **Scraper page**: Terminal and stats should stack cleanly on mobile; incoming properties should be swipeable cards
- [ ] **Properties page**: Map should be toggleable overlay on mobile (not side-by-side)
- [ ] **Data Explorer**: Horizontal scroll on table is OK, but add a card view option for mobile
- [ ] **Settings**: Already uses max-w-2xl — works well on mobile
- [ ] **Analytics**: Charts should be full-width on mobile with horizontal scroll for heatmap
- [ ] **Sidebar**: Verify mobile drawer works correctly with all new nav changes

### 8.3 Global UX Improvements
- [x] **Consistent empty states** — all key pages audited: Properties, Notifications, Saved Searches, Scraper history, Sites, Data Explorer all have icon + title + description + action button empty states
- [x] **Loading skeletons everywhere** — replaced ModernLoader spinners with skeleton UI on: notification list, saved searches grid, data explorer table/cards, properties list, sites list, scraper history
- [x] **Toast consolidation** — removed fake "Saved!" toasts from Settings (Notifications, Appearance, Display sections); replaced with "auto-saved" info text.
- [ ] **Breadcrumbs** — add breadcrumb navigation for deep pages (property detail, settings sections)

---

## Phase 9: Auth — Better Auth

> Using **Better Auth** (not Supabase). Google OAuth + Remember Me required.
> Current codebase still has Supabase references — this phase rips them all out.

### 9.1 Files to Replace (Blast Radius)

**Frontend (9 files with Supabase references to remove):**
- `lib/supabase.ts` → replace with `lib/auth-client.ts` (Better Auth client)
- `lib/api.ts` → remove Supabase JWT interceptor; Better Auth uses httpOnly cookies (sent automatically)
- `hooks/use-auth.ts` → replace with Better Auth `useSession()` hook
- `app/(auth)/login/page.tsx` → replace `signInWithPassword` / `signInWithOAuth`
- `app/(auth)/forgot-password/page.tsx` → replace `resetPasswordForEmail`
- `app/(dashboard)/settings/page.tsx` → replace `getUser`, `updateUser`, `linkIdentity`, `unlinkIdentity`, `signOut`
- `components/layout/app-sidebar.tsx` → replace `signOut()`
- `hooks/use-socket.ts` → get token from Better Auth instead of Supabase
- `components/scraper/scraper-socket-provider.tsx` → get token from Better Auth

**Backend (6 files with Supabase references to remove):**
- `utils/supabase.ts` → delete; replace with `lib/auth.ts` (Better Auth server)
- `middlewares/auth.middleware.ts` → validate Better Auth session cookie instead of Supabase JWT
- `middlewares/perUserRateLimit.middleware.ts` → extract user ID from Better Auth session
- `routes/auth.routes.ts` → user creation via Better Auth `auth.api.createUser()`
- `socketServer.ts` → validate Better Auth session for WebSocket auth
- `config/env.ts` → remove all `SUPABASE_*` env var requirements

### 9.2 Backend Setup

- [x] Install: `npm install better-auth` in backend
- [x] Create `backend/src/lib/auth.ts` — Better Auth server instance:
  - Email/password authentication
  - Google OAuth (clientId + clientSecret from env)
  - Session management with httpOnly secure cookies
  - Prisma adapter for CockroachDB
  - `trustedOrigins`: frontend URL
- [x] Mount Better Auth handler in `app.ts`: `app.all("/api/auth/*", toNodeHandler(auth))`
- [x] Delete `backend/src/utils/supabase.ts`
- [x] Remove `@supabase/supabase-js` from `backend/package.json`

### 9.3 Frontend Setup

- [x] Install: `npm install better-auth` in frontend (client exported from same package)
- [x] Create `frontend/lib/auth-client.ts` — Better Auth client instance pointing to backend
- [x] Delete `frontend/lib/supabase.ts`
- [x] Remove `@supabase/supabase-js` from `frontend/package.json`

### 9.4 Session & Cookie Standards

- [x] httpOnly cookies — tokens in httpOnly secure cookies, NOT localStorage
- [x] Secure flag — HTTPS-only in production (Better Auth default)
- [x] SameSite=Lax — CSRF protection (Better Auth default)
- [x] Remember Me: checked → 30-day persistent cookie; unchecked → session cookie (via `rememberMe` param in `signIn.email()`)
- [x] Refresh token rotation — automatic, invisible to user (Better Auth handles)
- [x] Logout — clears cookies + invalidates session server-side (`signOut()`)
- [x] Session revocation — `revokeOtherSessions()` in Settings Security section

### 9.5 Frontend Auth Wiring

- [x] `hooks/use-auth.ts` → uses Better Auth `useSession()` — returns `{ data: session, isPending, error }`
- [x] Login page: `signIn.email({ email, password, rememberMe })` + `signIn.social({ provider: "google" })`
- [x] Forgot password: `(authClient as any).forgetPassword?.()` (typed as any due to client type gap)
- [x] Settings security section:
  - [x] Password change → `authClient.changePassword({ currentPassword, newPassword })`
  - [x] Google link/unlink → `authClient.linkSocial({ provider: "google" })` / `authClient.unlinkAccount({ providerId })`
  - [x] Active sessions → `authClient.listSessions()` displayed as a list
  - [x] Revoke other sessions → `authClient.revokeOtherSessions()`
- [x] Sidebar logout → `signOut()` from auth-client
- [x] `lib/api.ts` — Supabase JWT interceptor removed; `withCredentials: true` set; cookies sent automatically
- [x] Socket.io auth — `(io as any)(url, { withCredentials: true })` — cookies sent automatically with socket handshake

### 9.6 Backend Auth Wiring

- [x] `auth.middleware.ts` → `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` — attaches user to `req.user`
- [x] `perUserRateLimit.middleware.ts` → extracts user ID from Better Auth session
- [x] `auth.routes.ts` → uses `auth.api.signUpEmail()` for invites and registration
- [x] `socketServer.ts` → validates Better Auth session cookie from socket handshake headers
- [x] `config/env.ts` → removed all `SUPABASE_*` vars, added `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### 9.7 Database Changes

- [x] Run Better Auth migration: `BetterAuthSession`, `BetterAuthAccount`, `BetterAuthVerification` tables added via Prisma (@@map to "session", "account", "verification")
- [x] Remove `User.supabaseId` field from Prisma schema
- [x] Existing users: first login after migration creates a Better Auth `account` record automatically
- [x] `prisma db push` run successfully

### 9.8 Environment Variables

**Remove from all environments (Doppler + Vercel + Render):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Add to all environments:**
- `BETTER_AUTH_SECRET` — random 32-char secret for session encryption
- `BETTER_AUTH_URL` — backend URL (e.g. `https://realtors-practice-new-api.onrender.com`)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret

### 9.9 Testing Checklist (manual QA needed in production)

- [ ] Email/password sign up → user created in DB, session cookie set
- [ ] Email/password sign in → session cookie set, user profile loads
- [ ] Google OAuth sign in → user created/linked, session cookie set
- [ ] Remember Me checked → cookie survives browser close and reopen
- [ ] Remember Me unchecked → cookie cleared on browser close
- [ ] Logout → cookie cleared, session invalidated server-side, redirect to login
- [ ] Token refresh → automatic, transparent to user
- [ ] Password change → works from Settings → Security
- [ ] Forgot password → email sent with reset link, reset flow completes
- [ ] Session list → shows all active sessions with device/IP
- [ ] Revoke other sessions → only current session remains
- [ ] All API endpoints require valid session → 401 if missing
- [ ] Socket.io (scraper + notifications) authenticated → events fire correctly
- [ ] Unauthorized access → redirects to login page
- [ ] CSRF protection → cross-site requests blocked

---

## Phase 10: Backend & Infrastructure

### 10.1 API Fixes
- [ ] Express route shadowing for geo routes — verify route order
- [ ] Ensure all API endpoints have proper error responses (not generic 500s)

### 10.2 Meilisearch Production
- [ ] Deploy Meilisearch instance (or confirm it's running)
- [ ] Set MEILISEARCH_HOST and MEILISEARCH_KEY in production env
- [ ] Run full reindex after field mapping fixes

### 10.3 Email Infrastructure
- [ ] Configure Resend or SMTP in production env vars
- [ ] Test email delivery end-to-end (welcome, alerts, digests)

### 10.4 Notification System
- [x] Create notification preference storage (backend) — 10 fields on User model (notifEmail*, notifInApp*, quietHours, digest)
- [~] Implement notification triggers:
  - [x] Scrape job complete → in-app + email (`NotificationService.create()` in scrape.service.ts)
  - [x] Saved search new match → in-app + email (cron job + `notifEmailNewMatches` check)
  - [ ] Price drop on viewed property → in-app + email
  - [ ] Property status change → in-app
- [ ] Implement digest aggregation (daily/weekly email summaries)

---

## Phase 11: AI Features (LAST)

> Only after Phases 0-10 are complete.
> Every AI feature is **opt-in and toggle-able**. The app must work perfectly without any AI feature enabled.
> Full architecture spec in `AI_INTELLIGENCE_PLAN.md`. Providers: Groq, Cerebras, SambaNova, Gemini (free tiers).

### AI Architecture: ZeroClaw Intent Router + Specialized Agents

The AI layer uses a **ZeroClaw-style intent router** (from AI_INTELLIGENCE_PLAN.md §1) that classifies user messages and dispatches to a specialist agent — each a master of its domain:

| Agent | Domain | Tools |
|-------|--------|-------|
| **PropertySearchAgent** | NL → property search | searchProperties, getMeilisearchResults |
| **PriceIntelAgent** | Price analysis, over/underpriced detection | getAreaPriceStats, getPriceHistory, getSimilarProperties |
| **MarketAnalysisAgent** | Supply/demand trends, area reports | getMarketTrends, getAreaStats, getSupplyTrends |
| **EnrichmentAgent** | Fill missing property fields from text | updateProperty, geocode, normalizeFields |
| **ScraperDiagAgent** | Diagnose scrape failures, CSS selector fixes | getRecentJobs, getSiteHealth, getJobErrors |
| **OracleAgent** | General Nigerian real estate Q&A | all tools as fallback |

**LLM fallback chain**: Groq → Cerebras → SambaNova → Gemini (circuit breaker + auto-rotate on rate limit)
**Memory**: Mem0 + Qdrant on Oracle Cloud VM — per-user preference memory injected into agent context
**Voice (REVISED)**: Oracle VM pipeline — Moonshine (STT) + Kokoro-82M (TTS) + Pipecat bridge. Gemini 2.0 Flash Live is deprecated (March 2026). Fallback: Groq Whisper STT + edge-tts.
**Implementation**: Vercel AI SDK (TypeScript, no separate Python process) — see AI_INTELLIGENCE_PLAN.md

### AI Design Principles
- **Enhancement, not dependency** — Every AI feature has a non-AI fallback that already works
- **Feature toggles** — Global master switch + per-feature switches in Settings (DB-backed)
- **Graceful degradation** — If all providers are down, features silently fall back to non-AI behavior
- **User clarity** — AI-generated content always labeled with "AI" badge; no provider names/models shown in user-facing UI
- **Rate limit awareness** — Track usage per provider, auto-rotate on limit, show usage in admin panel only
- **Privacy** — No property data leaves system except through AI provider APIs. mem0 stores preferences on Oracle VM only

### Revised Voice Stack (as of 2026-03-29)

> Gemini 2.0 Flash Live was deprecated March 3, 2026 (shutdown Sep 2026). We switch to a fully self-hosted, zero-cost pipeline on the Oracle Cloud VM.

```
Browser mic → WebRTC/WebSocket → Backend proxy → Oracle VM (Pipecat)
                                                    ├── Moonshine (STT, ARM64-optimised, real-time)
                                                    ├── Groq LLM (text response, streaming tokens)
                                                    └── Kokoro-82M (TTS, near-ElevenLabs quality, CPU only)
                             ← Audio chunks ← Backend proxy ← Oracle VM
```

**Fallback chain**: Oracle VM pipeline → Groq Whisper STT + Groq LLM + edge-tts (if Oracle VM is down)

### 11.0 AI Foundation (Do First)

**11.0.1 AI Feature Toggle System**
- [ ] Create `ai_feature_flags` table in Prisma: `id, featureKey (unique), enabled (bool), config (JSON), updatedAt`
- [ ] Seed default flags (all disabled): `ai_master`, `ai_chat`, `ai_nl_search`, `ai_property_scoring`, `ai_market_reports`, `ai_enrichment`, `ai_duplicate_detection`, `ai_scraper_diagnosis`, `ai_smart_notifications`, `ai_investment_analysis`, `ai_neighborhood_profiles`, `ai_telegram_bot`
- [ ] Backend: `GET /api/settings/ai-features` — returns all flags
- [ ] Backend: `PATCH /api/settings/ai-features/:key` — toggle a feature
- [ ] Frontend: "AI Features" section in Settings with master toggle + per-feature toggles (name, description, on/off/no-key status)
- [ ] Frontend: `useAIFeatures()` hook caching flags via React Query
- [ ] Middleware: `requireAIFeature(key)` Express middleware that checks flag before processing AI routes

**11.0.2 Backend AI Service (Provider Router)**
- [ ] Create `backend/src/services/ai.service.ts`: provider rotation (Groq → Cerebras → SambaNova → Gemini), SSE streaming, per-provider rate limit tracking, auto-retry with next provider, configurable thinking mode, token counting
- [ ] Create `backend/src/services/ai-usage.service.ts`: track requests/tokens per provider per day, `ai_usage_log` table (provider, tokens_in, tokens_out, latency_ms, feature, created_at), expose via `GET /api/ai/usage`
- [ ] Update AI health endpoint with rate limit proximity warnings

**11.0.3 AI Status Panel Enhancement**
- [ ] Rate limit usage bars per provider (X/Y requests today)
- [ ] Token usage summary (total in/out today across all providers)
- [ ] "Last successful request" timestamp per provider
- [ ] Provider failover log (last 10 failovers with reason)

### 11.1 AI Chat Assistant

**11.1.1 Backend Chat API**
- [ ] `POST /api/ai/chat` — SSE streaming endpoint (Vercel AI SDK `streamText`): accepts `{ message, conversationId?, context?, propertyId? }`, injects Nigerian property system prompt, respects `ai_chat` flag
- [ ] LLM tools the assistant can call: `search_properties`, `get_property_detail`, `get_market_stats`, `get_analytics`
- [ ] Conversation history: `ai_conversations` table (userId, messages JSON, title, createdAt, updatedAt)
- [ ] Rate limit: max 30 messages/hour per user (configurable via feature flag config JSON)
- [ ] **Voice WebSocket proxy** (`/ws/voice`): proxies audio stream between browser and Oracle VM Pipecat service via WebSocket. Handles auth, injects system prompt, streams audio chunks back. Falls back to Groq Whisper + edge-tts if Oracle VM unreachable.
- [ ] Oracle VM setup guide in `docs/oracle-vm-voice-setup.md`: Docker Compose with Moonshine + Kokoro-82M + Pipecat container

**11.1.2 Frontend Chat UI (AI Elements + custom voice)**
- [ ] Install AI Elements: `npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/all.json`
- [ ] Restyle all AI Elements components to match theme (primary #0001FC, accent #FF6600, Space Grotesk/Outfit)
- [ ] Replace ALL existing AI placeholder components with real implementations (remove skeleton cards, disabled buttons, "Coming soon" chips)
- [ ] Replace placeholder chat FAB with real full-page AI Assistant at `/assistant` (not a floating panel — dedicated page with 3-tab layout)
- [ ] **3-tab layout**: Chat | Voice | History
- [ ] **Chat tab**: ConversationWrapper, Message + MessageContent (user/assistant), PromptInput with textarea + submit, markdown renderer, ToolInvocation for property cards, reasoning panel (collapsible), typing indicator
- [ ] **Context @mentions**: Type `@` in chat to reference a property by name/ID — context chip appears in input bar (Cursor-style), property data injected into LLM context
- [ ] **Suggested action chips** (shown on empty state, with icons): "Find a property", "Market report", "Analyze investment", "Check scraper health"
- [ ] **Contextual awareness**: detect current page URL, auto-load context — "Ask about this property" pre-fills on property detail, "Diagnose last failure" pre-fills on scraper page with last job ID
- [ ] **Voice tab**: Push-to-talk button (hold) + continuous listening toggle. Animated waveform visualizer. Real-time transcription shown as user speaks. AI agent avatar/icon with "Listening..." / "Thinking..." / "Speaking..." states. Mute + End Call buttons. Full-screen on mobile.
- [ ] **Voice**: connects to backend WebSocket proxy → Oracle VM Pipecat pipeline (Moonshine STT + Kokoro TTS). Fallback: Groq Whisper + edge-tts.
- [ ] **History tab**: list of past conversations with title (auto-generated from first message), date, message count. Click to resume. Search conversations. Delete conversation.
- [ ] **No provider names / model names shown** to regular users — admin-only in Settings AI panel

**11.1.3 Chat Edge Cases**
- [ ] Empty/gibberish responses → "I couldn't process that. Try rephrasing?" — no raw errors shown
- [ ] Tool call failures → LLM responds naturally ("no results found"), not empty card grid
- [ ] Long responses → truncate at ~2000 tokens with "Show more"
- [ ] Basic content filter for offensive content / Nigerian fraud patterns
- [ ] Mobile UX: full-screen on mobile, not small floating panel
- [ ] Offline state: FAB shows "Backend unreachable", doesn't open broken panel

### 11.2 Natural Language Search

**11.2.1 Backend NL Parser**
- [ ] `POST /api/ai/parse-query`: input `{ query }` → output `{ bedrooms, type, area, maxPrice, ... }`, uses Groq (`/no_think`), respects `ai_nl_search` flag
- [ ] Nigerian slang dictionary in system prompt: "selfcon"→studio, "BQ"→guest quarters, "face-me-I-face-you"→shared compound, "VI"→Victoria Island, "5M"→5,000,000, "30k"→30,000, etc.
- [ ] Cache common query patterns in Redis (TTL 24h)
- [ ] Fallback: existing regex parser when AI is off or fails

**11.2.2 Frontend Search Enhancement**
- [x] "NL-interpreted" banner shown when NL parser detects filters (non-AI, regex-based)
- [x] Display parsed interpretation: "Searching for: 3 bedroom flat in Lekki, max ₦5,000,000"
- [ ] Allow user to edit parsed filters (click to modify)
- [x] Ambiguous queries → reasonable defaults, not 10 clarifying questions (regex parser approach)
- [x] Mixed language / Pidgin support: "I wan buy house for Lekki" — 60+ Nigerian area name mapping
- [x] Currency handling: default Naira, "5M"→5000000, "30k"→30000 (regex parser)
- [ ] "Why this property" one-liner per search result (batch LLM call for top 10, not 10 separate calls)

### 11.3 Property Intelligence

**11.3.1 Quality & Fraud Scoring**
- [ ] Background job: score new properties on scrape completion (completeness, price plausibility ±2σ area median, description quality via LLM)
- [ ] Fraud flags (LLM-detected): "viewing fee" scam pattern, price too low for area, copy-pasted descriptions, multiple listings same phone different agents
- [ ] Store in `Property.qualityScore` (exists) + new `Property.fraudFlags` JSON field
- [ ] Re-score on every property update (don't keep stale scores)
- [ ] Batch scoring: 10-20 properties per LLM call, not one-by-one
- [ ] Fallback: rule-based completeness scoring (no LLM)
- [ ] Feature flag: `ai_property_scoring`

**11.3.2 Auto-Enrichment**
- [ ] After scraping, LLM extracts from description: nearby amenities ("close to Shoprite"), condition hints ("newly built", "just renovated"), suggested tags
- [ ] Store in `Property.aiEnrichment` JSON field
- [ ] Feature flag: `ai_enrichment`
- [ ] Fallback: property displays without enrichment

**11.3.3 Frontend Property Intelligence UI**
- [ ] Quality score badge on property cards (green/yellow/red, clickable for breakdown)
- [ ] Fraud warning banner on property detail if flagged ("Review suggested" not "Fraud detected" — never hide listings)
- [ ] "AI Enriched" tag on enriched listings
- [ ] Score breakdown shows: completeness sub-score, price plausibility, description quality

### 11.4 Market Intelligence

**11.4.1 Auto-Generated Area Reports**
- [ ] Weekly cron: for each active area (>10 listings), aggregate stats → LLM generates 3-paragraph market summary → store in `market_reports` table (area, period, content, generatedAt)
- [ ] `GET /api/ai/market-report/:area` — returns cached report
- [ ] Minimum data threshold: "Limited data" if <5 listings — no confident-sounding reports from sparse data
- [ ] Show generation date prominently: "Generated Mar 2026 from 234 listings"
- [ ] Area normalization: "Lekki Phase 1" / "Lekki Ph. 1" / "Lekki Phase One" → same area
- [ ] Feature flag: `ai_market_reports`
- [ ] Fallback: market page shows raw stats without AI narrative

**11.4.2 Investment Analysis**
- [ ] `POST /api/ai/analyze-investment`: pulls comparables within 2km, calculates estimated rental yield, LLM generates verdict
- [ ] Comparative analysis: 2-5 properties → markdown table + recommendation
- [ ] Clear disclaimer: "AI estimate for informational purposes only. Not financial advice."
- [ ] Feature flag: `ai_investment_analysis`

**11.4.3 Neighborhood Profiles**
- [ ] AI profile per neighborhood: avg prices, typical property types, nearby amenities (from OSM or listing descriptions), transport links, 3-sentence summary
- [ ] Cache heavily (refresh weekly)
- [ ] Feature flag: `ai_neighborhood_profiles`
- [ ] Fallback: map/search shows properties without area narratives

### 11.5 Scraper Intelligence

**11.5.1 Failure Diagnosis**
- [ ] When scrape job completes with 0 results or high error rate: pull last 50 log lines → LLM returns `{ diagnosis, severity, suggestedAction }` → store in `scrape_diagnoses` table
- [ ] Show diagnosis card on scraper page when available
- [ ] Feature flag: `ai_scraper_diagnosis`

**11.5.2 Auto-Heal CSS Selectors**
- [ ] When CSS extraction fails: fetch page HTML sample (first 8K tokens) → LLM generates fresh selectors → cache in Redis per domain (TTL 7 days) → use on next attempt
- [ ] Validate LLM-generated selectors against HTML before caching (discard if 0 results)
- [ ] Show in scraper page: "AI auto-healed selectors for propertypro.ng (2 days ago)"
- [ ] Feature flag: part of `ai_scraper_diagnosis`

**11.5.3 Smart Scraper Scheduling**
- [ ] LLM analyzes scrape success/failure patterns to suggest optimal scrape times
- [ ] Auto-adjust schedule to avoid peak anti-bot hours

### 11.6 Smart Notifications

**11.6.1 AI Notification Digest**
- [ ] Weekly digest instead of individual "new match" alerts: "12 new properties matching your searches. Best value: [X] at ₦27M. Prices trending down 3% in Lekki."
- [ ] Default to weekly digest, not daily (prevent notification fatigue)
- [ ] Clear "Stop these" unsubscribe per AI-generated alert
- [ ] Settings preview: let user see what digest would look like before enabling
- [ ] Feature flag: `ai_smart_notifications`
- [ ] Fallback: individual notification cards (already works)

**11.6.2 Semantic Saved Search Alerts**
- [ ] Store embedding of original saved search query alongside structured filters
- [ ] New listings: embed → similarity check against saved searches → alert on semantic match even without keyword overlap
- [ ] Feature flag: part of `ai_smart_notifications`
- [ ] Fallback: exact filter matching (already works)

### 11.7 Telegram Bot

- [ ] Create Telegram bot via @BotFather, set up webhook, whitelist-based access control (authorized user IDs in DB)
- [ ] Commands: `/search 3 bed Lekki under 5M`, `/market Lekki`, `/alert 2bed Ikoyi under 20M`, `/status`
- [ ] Rate limit per user: 30 messages/hour
- [ ] Rich formatting: Telegram Markdown for property cards (bold title, italic area, price)
- [ ] Photo support: send first property image as inline photo
- [ ] Authorization flow: unknown users get "Contact admin for access" — not silence
- [ ] Feature flag: `ai_telegram_bot`

### 11.8 Embeddings & Semantic Search

- [ ] Embed all existing properties using `nomic-embed-text` or provider embedding API
- [ ] Store vectors in pgvector column on Property (or separate `property_embeddings` table)
- [ ] Embed new properties on scrape completion (background job)
- [ ] Embed text: `{title} {description} {area} {category} {features}`
- [ ] `POST /api/search/semantic` — 60% semantic score + 40% filter score blend
- [ ] Re-embed when property is updated (don't serve stale similarity results)
- [ ] Fallback: Meilisearch keyword search (already works)
- [ ] Feature flag: part of `ai_nl_search`

### 11.9 mem0 Memory Layer

- [ ] Docker Compose on Oracle VM: mem0 FastAPI + PostgreSQL/pgvector + FalkorDB (or vector-only mode)
- [ ] Configure mem0 to use Groq API for memory extraction
- [ ] Chat assistant stores user preferences: "I prefer Lekki", "budget is 30M"
- [ ] Next session: mem0 retrieves relevant memories, injects into system prompt
- [ ] Per-user memory isolation
- [ ] Users can view and delete their AI memories in Settings
- [ ] Memory drift handling: "I changed my budget to 50M" updates old memory, doesn't duplicate
- [ ] Settings shows: "The AI assistant remembers: your preferred areas, budget range, property preferences"
- [ ] Optional: chat works without mem0 (no memory between sessions) — don't block other features on mem0 setup

### 11.10 AI Cross-Cutting Concerns

**Error Handling**
- [ ] Every AI call has 10s timeout (8s for health checks)
- [ ] Every AI feature has explicit non-AI fallback path
- [ ] Failed AI calls logged but never shown as errors to users
- [ ] Provider failover invisible to users

**Cost Tracking**
- [ ] `ai_usage_log` table tracks every LLM call
- [ ] Dashboard widget: daily/weekly usage across providers
- [ ] Alert when approaching 80% of any provider's daily limit

**Security**
- [ ] AI API keys never exposed to frontend (all calls via backend)
- [ ] Chat input sanitized before LLM: strip HTML, limit to 2000 chars
- [ ] LLM output sanitized before rendering: prevent XSS via markdown injection
- [ ] Telegram bot validates webhook signatures
- [ ] Rate limit all AI endpoints per user

**AI Implementation Order**
| Priority | Item | Effort |
|----------|------|--------|
| 1 | 11.0.1 Feature Toggle System | 1 day |
| 2 | 11.0.2 Backend AI Service | 1 day |
| 3 | 11.0.3 Status Panel | 0.5 day |
| 4 | 11.2 NL Search | 1 day |
| 5 | 11.1 Chat Assistant | 2-3 days |
| 6 | 11.3.1 Property Scoring | 1 day |
| 7 | 11.4.1 Market Reports | 1 day |
| 8 | 11.5 Scraper Intelligence | 1 day |
| 9 | 11.3.2 Auto-Enrichment | 0.5 day |
| 10 | 11.6 Smart Notifications | 1 day |
| 11 | 11.4.2-11.4.3 Investment + Neighborhoods | 1 day |
| 12 | 11.8 Embeddings/Semantic Search | 1-2 days |
| 13 | 11.7 Telegram Bot | 1-2 days |
| 14 | 11.9 mem0 Memory | 1 day |

---

## Execution Order (Suggested)

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | 0 — Critical Bugs | Small | Unblocks search, map, auth display |
| 2 | 9 — Auth Migration (Supabase → Better Auth) | Large | Must happen early — everything depends on auth |
| 3 | 1 — Scraper Reliability | Medium | Data pipeline must work to feed everything |
| 4 | 2 — Search Fixes | Medium | Core feature, currently broken |
| 5 | 3 — Property Detail + Versioning | Large | Foundation for analytics & AI |
| 6 | 5 — Analytics (real data) | Medium | High value once data flows |
| 7 | 4 — Data Explorer Power-ups | Medium | Primary management tool |
| 8 | 6 — Notifications (real) | Medium | User engagement |
| 9 | 8 — UX & Responsive | Medium | Polish |
| 10 | 7.4 — Strip Privacy Center | Tiny | Cleanup |
| 11 | 10 — Backend Infrastructure | Medium | Production readiness |
| 12 | 11 — AI Features | Large | The finale |

---

## Answered Questions

1. **Backups section in Settings** — **KEEP.** Research best free/open-source comprehensive backup solutions. pgBackRest + CockroachDB native `BACKUP` command. Wire UI to real backup operations (trigger, list, download, schedule, retention). See AI_INTELLIGENCE_PLAN.md §7.
2. **Properties page vs Search page** — **MERGE.** But the merged UI must be very clean, extensive, and well thought out with all the right features. See Phase 3.5 below.
3. **Email template builder** — **DEFER.** Do templates last.
4. **User deletion** — Do alongside **Phase 9** (auth migration).
5. **Site Intelligence settings** — **DONE.** Wired to backend SystemSetting model with auto-learn on create/before scrape and CSS confidence threshold.

---

## Phase 3.5: Property Data Model Enhancement (Versioning & Origin)

> Clean separation of scraped, manual, enriched, and versioned property data.

### 3.5.1 New Schema Fields

- [x] Add `PropertyOrigin` enum: `SCRAPED`, `MANUAL`, `IMPORTED`, `API`
- [x] Add `EnrichmentStatus` enum: `RAW`, `GEOCODED`, `ENRICHED`, `VERIFIED`, `PUBLISHED`
- [x] Add `origin` field to Property model (default: `SCRAPED`)
- [x] Add `originDetail` field to Property model (nullable — source site, user ID, CSV filename)
- [x] Add `enrichmentStatus` field to Property model (default: `RAW`)
- [x] Expand `ChangeSource` enum: add `GEOCODING`, `PRICE_UPDATE`
- [x] Run non-breaking migration — prisma db push applied, all existing properties get defaults

### 3.5.2 Data Flow Enforcement

- [x] Scraper pipeline sets `origin = SCRAPED`, `enrichmentStatus = RAW`
- [x] Geocoding updates `enrichmentStatus = GEOCODED`
- [x] LLM enrichment updates `enrichmentStatus = ENRICHED`
- [x] Manual edits create version with `ChangeSource.MANUAL_EDIT`
- [x] Price changes on re-scrape create `ChangeSource.PRICE_UPDATE` version
- [x] Manual property creation sets `origin = MANUAL`, `enrichmentStatus = VERIFIED`

### 3.5.3 UI Integration

- [x] Data Explorer: filter by `origin` (Scraped / Manual / Imported)
- [x] Data Explorer: filter by `enrichmentStatus` (Raw / Geocoded / Enriched / Verified)
- [x] Data Explorer: "Data completeness" visual bar per property
- [x] Property Detail: Version History tab shows change source labels clearly
- [ ] Property Detail: "Needs Review" badge for `enrichmentStatus = RAW` + `qualityScore < 50`

### 3.5.4 AI Integration

- [ ] AI assistant understands the full property lifecycle (see AI_INTELLIGENCE_PLAN.md §11)
- [ ] AI can explain version history to users
- [ ] AI suggests enrichment for RAW properties

---

## Phase 3.6: Property Listing Card Redesign (match reference design)

> Cards must look like Nigerian property listing sites — clean, consumer-friendly, responsive.

### 3.6.1 Card Changes

- [x] Image carousel dots on image if multiple images
- [x] "Listed X ago" time badge (top-left, dark pill)
- [x] Bookmark icon (top-right, replaces heart)
- [x] Status badge — AVAILABLE/SOLD/RENTED/EXPIRED/SHORT_LET color-coded pill
- [x] Rounded pill badges for bed/bath/type with icons
- [x] Conditional agent type label (only shown if data exists): "Direct to Owner's Agent" / "Direct to Developer" / "Direct to Landlord" — green label
- [x] Removed star rating overlay
- [x] Simplified image overlay — subtle bottom gradient only
- [x] Removed colored accent bar at bottom
- [x] More whitespace, rounded-xl, soft shadows
- [x] Hover: shadow lift + primary border
- [x] Action buttons (Eye, ExternalLink) fade in on hover

### 3.6.2 Mobile Card

- [x] Image carousel with dot indicators
- [x] Responsive grid — 1/2/3 columns
- [x] Touch-friendly tap targets

---

## Phase 3.7: Property Detail Page Redesign (match reference design)

> Detail page must look like a professional Nigerian listing site.

### 3.7.1 Image Gallery

- [x] 1 large + 2 small stacked grid layout (60/40 split) on desktop
- [x] "See more photos" overlay button on last small image ("+N more")
- [x] Full-width single image with swipe + dot indicators on mobile

### 3.7.2 Layout Changes

- [x] Breadcrumbs: State > Area > "Listing Details" + "Save Property" button top-right
- [x] Listing type indicator: green dot + "FOR RENT" / "FOR SALE" / "SHORT LET" (uppercase)
- [x] Huge price (text-4xl bold, primary color dominant)
- [x] Beds • Baths inline below price (simple)
- [x] Agent phone partially masked with reveal button + WhatsApp link
- [x] "About this property" section with left border accent card

### 3.7.3 Right Sticky Sidebar

- [x] Agent card — conditional label (only if agentType field exists): "Direct to Owner's Agent" / "Direct to Developer" / "Direct to Landlord" — green icon
- [x] Circular Call + WhatsApp buttons
- [x] Embedded map in sidebar
- [x] "View on full map" link below map
- [x] Sticky positioning while scrolling

### 3.7.4 Property Specs

- [x] Clean 2x2 icon grid: Property Type, Land Size, Time on listing, Listing ID

### 3.7.5 Price Intelligence Section

- [x] Three comparison cards: Area Average Price | This Property | Difference (red/green %)
- [x] Price trend line chart — property price over time (from priceHistory)
- [ ] Transaction table for similar properties — deferred (needs market data volume)

### 3.7.6 Bottom Sections

- [x] "Similar homes you might like" horizontal carousel
- [x] Intelligence panel (collapsible, admin/editor only) — version history, data quality, source
- **Note**: "Tell us what you think" section NOT added per user feedback

### 3.7.7 Intelligence Data (admin view)

- [x] Version history, data quality, source info moved to collapsible "Intelligence" accordion
- [x] Hidden for VIEWER role, visible/collapsed for ADMIN/EDITOR

### 3.7.8 Mobile Detail Page

- [x] Full-width image with swipe + dots
- [x] Agent card above fold (below price, before description) on mobile
- [x] Map tappable thumbnail
- [x] Similar homes horizontal scroll

---

## Updated Execution Order

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| 1 | 0 — Critical Bugs | Small | Unblocks search, map, auth display |
| 2 | 9 — Auth Migration (Supabase → Better Auth) | Large | Must happen early — everything depends on auth |
| 3 | 1 — Scraper Reliability | Medium | Data pipeline must work to feed everything |
| 4 | 2 — Search Fixes | Medium | Core feature, currently broken |
| 5 | 3.5 — Property Data Model (versioning/origin) | Medium | Foundation for everything below |
| 6 | 3.6 — Property Card Redesign | Medium | Most visible UI change |
| 7 | 3.7 — Property Detail Page Redesign | Large | Key user experience |
| 8 | 3 — Property Detail + Versioning UI | Medium | Wire new data model to UI |
| 9 | 5 — Analytics (real data) | Medium | High value once data flows |
| 10 | 4 — Data Explorer Power-ups | Medium | Primary management tool |
| 11 | 6 — Settings (wire real backends) | Medium | Notifications, backups, intelligence |
| 12 | 8 — UX & Responsive | Medium | Polish |
| 13 | 7.4 — Strip Privacy Center | Tiny | Cleanup |
| 14 | 10 — Backend Infrastructure | Medium | Production readiness |
| 15 | 11 — AI Features (see AI_INTELLIGENCE_PLAN.md) | Large | The finale |

---

*This checklist is the source of truth. Update it as items are completed.*
*AI plan is in `AI_INTELLIGENCE_PLAN.md` — pending approval before merging into Phase 11.*
