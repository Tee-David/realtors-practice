# Realtors' Practice — Full Project Checklist

> This file tracks every task from start to finish. Update status as work progresses.
> Status: [ ] = pending, [x] = done, [~] = in progress

---

## Phase 1: Foundation
- [x] Create CLAUDE.md with project conventions
- [x] Create PLAN.md with full architecture
- [x] Initialize git repo + GitHub remote
- [x] Set up main + staging branches
- [x] Create .gitignore (exclude secrets)
- [x] Scaffold backend directory structure
- [x] Write backend package.json + tsconfig
- [x] Write full Prisma schema (12 models, 11 enums, 85+ property fields)
- [x] Create Express app with middleware stack (helmet, cors, rate limit, body parser)
- [x] Create auth middleware (Supabase JWT verification)
- [x] Create RBAC middleware
- [x] Create Zod validation middleware
- [x] Create internal API key middleware (scraper auth)
- [x] Create error handling middleware (Prisma, Zod, generic)
- [x] Create health check route (with DB test)
- [x] Create auth routes (register, /me)
- [x] Create standardized API response utilities
- [x] Create logger utility
- [x] Create Supabase client utility
- [x] Create Prisma client singleton
- [x] Create server.ts with graceful shutdown
- [x] Create render.yaml deployment config
- [x] Scaffold frontend directory structure
- [x] Write frontend package.json + tsconfig
- [x] Write next.config.ts
- [x] Write postcss.config.mjs
- [x] Write components.json (shadcn/ui config)
- [x] Set up design system in globals.css (CSS variables, fonts)
- [x] Create root layout (fonts, metadata, toaster)
- [x] Create auth layout (centered, no sidebar)
- [x] Create login page (Supabase auth)
- [x] Create forgot-password page
- [x] Create dashboard layout (sidebar + main)
- [x] Create sidebar component (hover-to-expand, section labels)
- [x] Create mobile sidebar component
- [x] Create dashboard page (KPI placeholders)
- [x] Create API client with Supabase token interceptor
- [x] Create Supabase client (frontend)
- [x] Create utility functions (cn, formatPrice, formatNumber)
- [x] Copy logo + favicon to public/
- [x] Create backend .env file (local dev)
- [x] Create frontend .env.local file (local dev)
- [x] Push to GitHub (main + staging)
- [x] Install backend npm dependencies (user terminal)
- [x] Run prisma generate + db push (user terminal)
- [x] Install frontend npm dependencies (user terminal)
- [x] Run shadcn init + add components (user terminal)
- [x] Verify backend health check works
- [x] Verify frontend dev server runs
- [ ] Deploy backend to Render
- [ ] Deploy frontend to Vercel

## Phase 2: Properties Core
- [x] Backend: Property service (CRUD with versioning logic)
- [x] Backend: Property controller
- [x] Backend: Property routes (list, get, update, delete, versions, price-history, enrich, bulk-action, stats)
- [x] Backend: Property Zod validators
- [x] Backend: Version service (diff, snapshot, create version)
- [x] Backend: Price history tracking on price changes
- [x] Backend: Quality scoring service
- [x] Backend: Deduplication service (SHA256 hash)
- [x] Backend: Site service (CRUD)
- [x] Backend: Site controller + routes
- [x] Backend: Site Zod validators
- [x] Frontend: Property card component (Homegi-style gradient, star rating, badges)
- [x] Frontend: Property grid component
- [x] Frontend: Property filter sidebar (listing type, category, price, bedrooms, area)
- [x] Frontend: Properties page (grid + filter sidebar)
- [x] Frontend: Property detail page (image gallery, full info, version timeline, price chart)
- [x] Frontend: Version diff viewer component
- [x] Frontend: useProperties hook (TanStack Query)
- [x] Frontend: Property TypeScript types
- [x] Seed database with 50-100 sample properties
- [x] Frontend: Properties page redesign (grid+map split, side-sheets, view toggle)
  - [x] Install react-leaflet, @scrollxui/side-sheet, @scrollxui/top-sheet
  - [x] Create category pills component
  - [x] Create property list card (horizontal view)
  - [x] Create property map component (Leaflet/OSM)
  - [x] Create property detail panel (right side-sheet)
  - [x] Create filter sheet wrapper (left side-sheet)
  - [x] Update property card for side-sheet integration
  - [x] Rewrite properties page with new layout
  - [x] Add Leaflet CSS + custom marker styles
  - [x] Mobile responsive + bottom sheet
  - [x] Responsive grid (2-6 columns, default 4)
  - [x] Full-height responsive map with toggle
  - [x] Improved list view card design
- [x] Frontend: Login page redesign (split layout with visual panel)
- [x] Frontend: Forgot password page redesign
- [x] Frontend: Admin register page (Manual Approval Flow)
- [x] Frontend: Dashboard page (KPI cards, category chart, status donut, explore section)
- [x] Frontend: Mobile bottom navigation (Dashboard, Properties, Scrape, Search, More)
- [x] Frontend: Desktop top bar (notifications, theme switch, profile)
- [x] Frontend: Dark mode theme support (CSS variables + ThemeProvider)
- [x] Frontend: Settings page (profile, security, notifications, preferences)
- [x] Frontend: Grid column selector (2-6 columns with inline CSS grid)
- [x] Frontend: Per-page items selector on pagination
- [x] Test: Create property via API -> appears in DB with version 1
- [x] Test: Edit property -> version 2 created, diff visible
- [x] Test: Filter by listingType + price range -> correct results
- [x] Test: Frontend displays property cards correctly

## Phase 2.5: UX Polish
- [x] Sidebar: Bigger favicon, logout button, theme switch, profile section
- [x] Move reusable components from root to frontend/components/ui/
- [x] Property detail page redesign (image gallery, collapsible sections, skeleton, breadcrumbs)
- [x] Similar properties carousel on detail page
- [x] Compare properties page (side-by-side table, add/remove, search modal)
- [x] Mobile map expandable to fullscreen on properties page
- [x] TextType greeter animation (runs once, no re-triggers)
- [x] OnboardJS guided tour (product walkthrough)
- [x] Animated list transitions (motion library)
- [x] Skeleton loading states: property detail page
- [x] Skeleton loading states: remaining pages

## Phase 3: Scraper Microservice
### Infrastructure
- [x] Create scraper/ directory structure
- [x] Write Dockerfile for scraper service
- [x] Write scraper app.py (FastAPI entry point — async, better than Flask for I/O)
- [x] Write config.py (environment config incl. proxy + Redis URLs)
- [x] Write requirements.txt

### Engine (ported + enhanced from old project)
- [x] Port adaptive_fetcher.py (requests -> Playwright -> ScraperAPI fallback)
- [x] Port page_renderer.py (Playwright browser management, stealth args)
- [x] Port pagination.py (universal pagination handler)
- [x] Port cookie_handler.py (consent banner dismissal)
- [x] Add proxy rotation support (rotating proxy URL as env var, Brightdata/Smartproxy compatible)
- [x] Add user-agent rotation pool (50+ realistic UAs, randomized per request)
- [x] Add request header rotation (Accept-Language, Referer, etc.)
- [x] Add randomized delays + human-like behavior simulation

### Extraction
- [x] Port universal_extractor.py (pattern-based field extraction)
- [x] Port universal_nlp.py (listing type detection: sale/rent/land)
- [x] Write price_parser.py (Nigerian price parsing: ₦, "million", "per annum")
- [x] Write location_parser.py (location hierarchy: estate > area > LGA > state)
- [x] Write feature_extractor.py (amenity extraction)
- [x] Add LLM-assisted parsing fallback (when universal extractor confidence is low)

### Pipeline
- [x] Write validator.py (field validation + quality scoring 0-100)
- [x] Write deduplicator.py (SHA256 exact dedup + fuzzy matching on title+price+location)
- [x] Write enricher.py (geocoding via OSM Nominatim, cached in Redis/memory)
- [x] Write normalizer.py (data cleaning + normalization)
- [x] Write writer.py (POST results to Node.js API via callback)
- [x] Write callback.py (HTTP callback helpers + progress reporting)
- [x] Write rate_limiter.py
- [x] Write logger.py
- [x] Add raw HTML snapshot storage (save failed parses for debugging, auto-purge after 7 days)

### Task Queue (Celery + Redis)
- [x] Set up Celery with Redis broker for parallel site scraping
- [x] Configure task retries with exponential backoff (30s→480s, max 3 retries)
- [x] Add task priority (active-intent=1 > rescrape=3 > bulk=7)
- [x] Add concurrency limits per site (per-domain Redis locks, 30min TTL)

### Deployment
- [x] Write scraper koyeb.yaml (Eco worker, Celery CMD override)
- [x] Set up Redis (Upstash serverless Redis)
- [x] Deploy scraper worker to Koyeb (Docker + Celery worker)
- [x] Add task priority to backend Celery dispatch (scrape.service.ts)
- [x] Migrate 5 site configs to Site table (PropertyPro, NPC, Jiji, Property24, BuyLetLive)

### Backend Integration
- [x] Backend: Scrape service (job dispatch to Python microservice)
- [x] Backend: Scrape controller + routes (start, jobs, jobs/:id, stop, logs, schedule)
- [x] Backend: Internal routes (scrape-results, scrape-progress, scrape-error callbacks)
- [x] Backend: Socket.io server setup (socketServer.ts)
- [x] Backend: Socket.io namespaces (/scrape for live logs, /notify for notifications)
- [x] Backend: Socket.io auth middleware
- [x] Backend: Broadcast scrape events on callback receipt

### Frontend
- [x] Frontend: Scraper control page (start scrape, select sites, parameters)
- [x] Frontend: Job progress component (progress bars, status)
- [x] Frontend: Live logs viewer (Socket.io connected)
- [x] Frontend: Site management page (enable/disable, edit selectors, test scrape)
- [x] Frontend: Site card component
- [x] Frontend: useSocket hook
- [x] Frontend: useScrapeJobs hook

### Testing
- [ ] Test: Trigger scrape from UI -> Python scraper receives job
- [ ] Test: Live logs stream to frontend via Socket.io
- [ ] Test: Properties from real sites appear in DB with quality scores
- [ ] Test: Deduplication prevents duplicate inserts (exact + fuzzy)
- [ ] Test: Proxy rotation works (no IP bans)
- [ ] Test: Celery task queue processes sites in parallel

## Phase 4: Search + Dashboard (MVP Complete)
- [x] Deploy Meilisearch on Render (private service)
- [x] Backend: Meilisearch client setup (utils/meili.util.ts)
- [x] Backend: Meili service (index config, sync, upsert, delete, batch sync, full re-index)
- [x] Backend: Search service (NL query parser + Meilisearch integration)
- [x] Backend: NL query parser (bedrooms, property type, location, price, features regex)
- [x] Backend: Search routes (search, natural, suggestions, facets)
- [x] Backend: Active scraping trigger (on zero results)
- [x] Backend: Wire property create/update/delete to Meilisearch sync
- [x] Backend: Analytics service (overview KPIs, trends, market insights)
- [x] Backend: Analytics controller + routes
- [x] Frontend: Search page (large NL search bar, suggestions, faceted results)
- [x] Frontend: Search bar component
- [x] Frontend: Search results component (with facet filters)
- [x] Frontend: Search suggestions component
- [x] Frontend: "No results? Search the web" active scrape trigger UI
- [x] Frontend: useSearch hook
- [x] Frontend: Dashboard KPI cards (total properties, new today, avg quality, data sources)
- [x] Frontend: Donut chart (properties by status)
- [x] Frontend: Category bar chart (properties by category)
- [x] Frontend: Explore properties section (latest cards)
- [ ] Test: "3 bedroom flat in Lekki under 30 million" returns relevant results
- [ ] Test: Dashboard KPIs reflect actual DB data
- [x] Test: Active scrape fires when search yields 0 results

## Phase 4.5: Intelligence
- [x] Backend: Site quality ranking service (auto-score sites by data freshness, completeness, error rate)
- [x] Backend: Site ranking recommendations API
- [x] Frontend: Site quality dashboard widget

## Phase 5: Maps + Geospatial
- [x] Frontend: Map provider abstraction (MapProvider interface)
- [x] Frontend: OSM provider (react-leaflet, Nominatim geocoding)
- [ ] Frontend: Mapbox provider (react-map-gl)
- [ ] Frontend: Google Maps provider (@react-google-maps/api)
- [x] Frontend: Map container component (provider-agnostic wrapper)
- [x] Frontend: Property marker component (with popup)
- [ ] Frontend: Draw-to-search component (polygon area selection)
- [x] Frontend: Map panel on properties page (split view: cards + map)
- [x] Frontend: Map store (Zustand - active provider, viewport)
- [x] Frontend: useMapProvider hook
- [ ] Backend: Bounding-box queries for map viewport
- [ ] Backend: Radius-based amenity detection
- [ ] Backend: Geocoding service enhancements
- [ ] Frontend: Settings page - map provider selection
- [ ] Test: Properties visible on map with markers
- [ ] Test: Can draw search area and get filtered results
- [ ] Test: Can switch between OSM/Mapbox/Google Maps

## Phase 6: Saved Searches + Notifications + Data Explorer
- [ ] Backend: Saved search service (CRUD, matching, new match detection)
- [ ] Backend: Saved search controller + routes
- [ ] Backend: Notification service (create, list, mark read, in-app + email)
- [ ] Backend: Notification controller + routes
- [ ] Backend: Email service (Resend API integration)
- [ ] Backend: Cron job for checking saved search matches
- [ ] Backend: Export service (CSV/XLSX generation)
- [ ] Backend: Export controller + routes
- [ ] Backend: Audit log controller + routes
- [ ] Frontend: Saved searches page (create, edit, view matches)
- [ ] Frontend: Notification bell component (real-time via Socket.io)
- [ ] Frontend: Notification dropdown/panel
- [ ] Frontend: Data explorer page (tabs: All/Raw/Enriched/Flagged)
- [ ] Frontend: Bulk action controls (approve, reject, merge duplicates, export)
- [ ] Frontend: Data inspection detail view
- [ ] Frontend: Audit log viewer page
- [ ] Frontend: Export functionality (CSV/XLSX download)
- [ ] Frontend: useSavedSearches hook
- [ ] Frontend: useNotifications hook
- [ ] Test: Create saved search -> matches appear when new properties arrive
- [ ] Test: Email notification sent on new match
- [ ] Test: In-app notification appears in real-time
- [ ] Test: Data explorer shows correct segmented views
- [ ] Test: Bulk actions work correctly
- [ ] Test: CSV/XLSX export generates valid files

## Phase 7: Production Hardening
- [x] Backend: Query optimization (analyze slow queries, add missing indexes)
- [x] Backend: Response caching (Redis or in-memory for analytics)
- [x] Backend: Meilisearch weekly full re-index cron
- [x] Backend: Sentry error tracking integration
- [x] Frontend: Sentry error tracking integration
- [x] GitHub Actions: CI pipeline (lint, type-check, build)
- [x] GitHub Actions: CD pipeline (auto-deploy on push to main)
- [x] GitHub Actions: Scheduled scraping workflow (from old project pattern)
- [x] Security: Rate limiting tuning for production
- [x] Security: Input sanitization audit
- [x] Security: CORS configuration review
- [x] Security: Environment variable audit (no secrets in code)
- [x] Performance: Frontend bundle analysis
- [x] Performance: Image optimization
- [x] Performance: Lazy loading for heavy components (maps, charts)
- [ ] Documentation: API documentation (Swagger/OpenAPI spec)
- [ ] Documentation: Deployment guide
- [ ] Documentation: README.md update
- [ ] User management page (admin - list users, change roles, deactivate)
- [ ] Settings page - general settings
- [ ] Settings page - email notification config
- [ ] Settings page - environment variable management
- [ ] Testing: Jest setup for backend unit/integration tests
- [ ] Testing: Vitest setup for frontend component tests
- [ ] Testing: Core backend service tests (property CRUD, versioning, dedup)
- [ ] Testing: API endpoint integration tests
- [ ] PWA: manifest.json + service worker for offline/mobile
- [ ] PWA: App install prompt for mobile users
- [ ] Backup: Automated pg_dump cron for local PostgreSQL
- [ ] Backup: CockroachDB backup verification
- [ ] Monitoring: UptimeRobot for API health monitoring
- [ ] Monitoring: Scraper health dashboard (site success rates, data freshness)
- [ ] Legal: Privacy policy page
- [ ] Legal: robots.txt respect toggle per site
- [ ] Legal: Data retention policy + auto-purge cron for old data
- [ ] Fraud: Basic fraud detection signals (abnormally low price, duplicate images)
- [ ] Fraud: "Flag as suspicious" user action on property cards
- [ ] Final production deployment verification
- [ ] Domain configuration (if applicable)

## Phase 8: Market Intelligence (Post-MVP)
- [ ] Backend: Taxonomy synonym mapping table (BQ/boys quarters, self-contain/studio, etc.)
- [ ] Backend: Price-per-sqm by area aggregation service
- [ ] Backend: Rental yield calculator
- [ ] Backend: Days-on-market trend analysis
- [ ] Backend: Comparable properties algorithm (similar beds/area/price)
- [ ] Backend: Zero-result search logging (for scraper targeting)
- [ ] Backend: Most-viewed properties tracking
- [ ] Backend: API versioning (/v1/ prefix)
- [ ] Backend: External API key management for third-party access
- [ ] Frontend: Market trends page (price-per-sqm charts by area)
- [ ] Frontend: Rental yield display on property detail
- [ ] Frontend: Comparable properties section on detail page
- [ ] External enrichment: Infrastructure proximity (schools, hospitals, BRT)
- [ ] External enrichment: Flood zone mapping for Lagos areas
- [ ] External enrichment: DISCO/power supply zone information

---

## Running Totals
- **Phase 1:** 42 tasks (40 done, 2 deployment pending)
- **Phase 2:** 30 tasks (30 done ✅)
- **Phase 2.5:** 11 tasks (11 done ✅)
- **Phase 3:** 40 tasks (30 done, 10 pending — testing/verification)
- **Phase 4:** 21 tasks (19 done, 2 pending — deploy + tests)
- **Phase 4.5:** 3 tasks (3 done)
- **Phase 5:** 16 tasks (7 done, 9 pending)
- **Phase 6:** 22 tasks (0 done)
- **Phase 7:** 38 tasks (15 done)
- **Phase 8:** 15 tasks (0 done)
- **TOTAL:** ~238 tasks (~129 done, ~109 remaining)
