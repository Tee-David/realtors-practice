# Realtors' Practice — Full Rebuild Plan

## Context

Rebuilding the Nigerian property intelligence platform from scratch. The old project (Dynamic realtors_practice) is a Python/Flask monolith with Firestore — we're transforming it into a modern, enterprise-grade microservice architecture using Node.js + CockroachDB + Python scraper.

**Why rebuild:** Move from Python/Firestore to a proper relational database (CockroachDB), TypeScript backend, and separate scraper microservice for better scalability, type safety, and maintainability.

---

## Architecture Overview

```
  Vercel (Frontend)          Render (Backend)           Render (Scraper)
  ┌──────────────┐      ┌──────────────────┐      ┌──────────────────┐
  │  Next.js 16  │─────▶│  Node.js/Express │─────▶│  Python 3.11     │
  │  React 19    │ REST │  TypeScript      │ HTTP │  Playwright/BS4  │
  │  shadcn/ui   │◀─────│  Socket.io       │◀─────│  Adaptive fetch  │
  │  Tailwind v4 │  WS  │  Prisma ORM      │ CB   │                  │
  └──────────────┘      └────────┬─────────┘      └──────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              CockroachDB   Meilisearch   Supabase
              (main DB)     (search)      (auth only)
```

### Services

| Service | Stack | Host | Purpose |
|---------|-------|------|---------|
| Frontend | Next.js 16, React 19, shadcn/ui, Tailwind v4 | Vercel | SSR pages, UI |
| API Server | Node.js, Express, TypeScript, Prisma, Socket.io | Render (Web) | REST API, real-time, business logic |
| Scraper | Python 3.11, Playwright, BeautifulSoup, Flask | Render (Worker) | Web scraping, parsing, validation |
| Database | CockroachDB (PostgreSQL-compatible) | CockroachDB Serverless | Relational storage |
| Search | Meilisearch (self-hosted) | Render (Private Service) | Full-text search, facets |
| Auth | Supabase (free tier) | Supabase (managed) | JWT auth, user sessions |

### Communication Patterns

- **Frontend <-> API:** REST (HTTPS) + Socket.io (WebSocket) for live scrape logs/notifications
- **API -> Scraper:** HTTP POST to dispatch jobs with site configs + callback URL
- **Scraper -> API:** HTTP POST callbacks for progress/results/errors (API broadcasts via Socket.io)
- **API <-> CockroachDB:** Prisma Client with connection pooling
- **API <-> Meilisearch:** meilisearch npm client, real-time sync on property changes
- **API <-> Supabase:** JWT verification in auth middleware
- **Service-to-service auth:** `X-Internal-Key` header with shared secret

---

## Database Schema (CockroachDB + Prisma)

### Models

**Core:**
- `User` — linked to Supabase via `supabaseId`, roles (ADMIN/EDITOR/VIEWER/API_USER)
- `Site` — scraper site configs (replaces YAML), selectors stored as JSON, health tracking
- `Property` — 85+ fields across 9 categories (basic info, details, financial, location, amenities, media, agent, metadata, tags)
- `PropertyVersion` — full snapshot diffs for every edit (previousData/newData as JSON)
- `PriceHistory` — price change tracking per property

**Scraping:**
- `ScrapeJob` — job tracking with type (PASSIVE_BULK/ACTIVE_INTENT/RESCRAPE/SCHEDULED), status, stats
- `ScrapeLog` — per-job log entries with level/message/details

**User Features:**
- `SavedSearch` — stored filter criteria + NL query, monitoring config
- `SavedSearchMatch` — junction table linking saved searches to matching properties
- `Notification` — in-app notifications (NEW_MATCH/PRICE_DROP/SCRAPE_COMPLETE/etc.)

**System:**
- `AuditLog` — action/entity/entityId audit trail
- `SystemSetting` — key/value config (scraping defaults, email, map provider)

### Enums

PropertyCategory, ListingType, PropertyStatus, VerificationStatus, Furnishing, PropertyCondition, ScrapeJobStatus, ScrapeJobType, UserRole, ChangeSource, NotificationType

### Property Fields (85+)

Organized in the Property model:
- **Basic:** title, listingUrl, source, siteId, status, verificationStatus, listingType, category
- **Details:** propertyType, propertySubtype, bedrooms, bathrooms, toilets, bq, landSize, landSizeSqm, buildingSize, buildingSizeSqm, yearBuilt, furnishing, condition, floors, description
- **Financial:** price, priceCurrency, pricePerSqm, pricePerBedroom, initialDeposit, paymentPlan, serviceCharge, agentCommission, priceNegotiable, rentFrequency
- **Location:** fullAddress, locationText, estateName, streetName, area, lga, state, country, latitude, longitude, landmarks[]
- **Amenities:** features[], security[], utilities[], parkingSpaces
- **Media:** images (JSON), videos (JSON), virtualTourUrl, floorPlanUrl
- **Agent:** agentName, agentPhone, agentEmail, agencyName, agentVerified
- **Metadata:** qualityScore (0-100), scrapeTimestamp, viewCount, searchKeywords[], daysOnMarket
- **Tags:** promoTags[], isPremium, isFeatured, isHotDeal

### Indexing Strategy

- Single-column indexes on all FKs and filter columns (status, listingType, category, price, bedrooms, qualityScore)
- Composite indexes for common queries:
  - `[listingType, category, state, area]` — main browse
  - `[state, area, listingType, price]` — location-first filter
  - `[category, bedrooms, price]` — bedroom+budget search
  - `[latitude, longitude]` — geospatial bounding-box
- Soft delete via `deletedAt` column + index

### Data Versioning

Every property edit (scraper re-scrape, manual edit, enrichment):
1. Diff current vs new values -> compute `changedFields`
2. Create `PropertyVersion` with full snapshots (previousData/newData)
3. Increment `property.currentVersion`
4. If price changed, insert `PriceHistory` record
5. All in a Prisma transaction

---

## Backend API (Node.js/Express)

### Directory Structure

```
backend/
├── prisma/schema.prisma
├── src/
│   ├── app.ts                      # Express + middleware stack
│   ├── server.ts                   # Bootstrap, graceful shutdown
│   ├── prismaClient.ts             # Prisma singleton
│   ├── socketServer.ts             # Socket.io setup
│   ├── config/env.ts               # Env validation
│   ├── routes/                     # 14 route files
│   │   ├── index.ts, property.routes.ts, search.routes.ts,
│   │   ├── scrape.routes.ts, site.routes.ts, analytics.routes.ts,
│   │   ├── savedSearch.routes.ts, notification.routes.ts,
│   │   ├── user.routes.ts, auth.routes.ts, settings.routes.ts,
│   │   ├── export.routes.ts, auditLog.routes.ts, health.routes.ts,
│   │   └── internal.routes.ts      # Scraper callbacks
│   ├── controllers/                # Matching controllers
│   ├── services/                   # Business logic
│   │   ├── property.service.ts     # CRUD + versioning
│   │   ├── search.service.ts       # Meilisearch + NLP parsing
│   │   ├── scrape.service.ts       # Job dispatch to Python
│   │   ├── meili.service.ts        # Meilisearch sync
│   │   ├── quality.service.ts      # Quality scoring
│   │   ├── dedup.service.ts        # SHA256 deduplication
│   │   ├── geo.service.ts          # OSM Nominatim geocoding
│   │   ├── enrichment.service.ts   # Data enrichment pipeline
│   │   ├── version.service.ts      # Property versioning
│   │   ├── email.service.ts        # Resend API
│   │   └── ... (analytics, auth, export, notification, site, savedSearch)
│   ├── middlewares/
│   │   ├── auth.middleware.ts       # JWT + Supabase verification
│   │   ├── role.middleware.ts       # RBAC
│   │   ├── validation.middleware.ts # Zod schemas
│   │   ├── audit.middleware.ts      # Auto audit logging
│   │   ├── error.middleware.ts      # Global error handler
│   │   ├── rateLimiter.middleware.ts
│   │   └── internal.middleware.ts   # X-Internal-Key check
│   ├── validators/                  # Zod schemas per domain
│   ├── utils/                       # apiResponse, logger, supabase, meilisearch, socket
│   └── types/                       # TypeScript types
├── package.json
├── tsconfig.json
└── render.yaml
```

### Route Structure (under `/api`)

```
/health                              GET     Health check
/auth/login|register|me|refresh      POST/GET Auth (Supabase)
/users                               CRUD    User management (admin)
/properties                          CRUD    Properties + versions + price-history + enrich + bulk-action + stats
/search                              GET/POST Full-text + NL search + suggestions + facets
/scrape/start|jobs|schedule           POST/GET Scrape job management
/sites                               CRUD    Site config + toggle + health + test-scrape
/saved-searches                      CRUD    + matches + force-check
/analytics/overview|trends|market    GET     Dashboard KPIs + trends
/notifications                       GET/PATCH Notification management
/export/generate|download            POST/GET CSV/XLSX export
/settings                            GET/PUT  System settings + email + map-provider
/audit-logs                          GET     Audit log query
/internal/scrape-results|progress|error  POST Scraper callbacks (internal auth)
```

### Middleware Stack (order)

1. helmet -> 2. cors -> 3. express.json (10mb) -> 4. express-rate-limit (500/15min) -> 5. auth rate limit on /api/auth (20/hr)
Per-route: authenticate -> authorize(roles) -> validate(zodSchema) -> auditLog(action)
Global: notFoundHandler -> errorHandler (Prisma/JWT/generic)

### Socket.io

- Path: `/ws`
- Namespaces: `/scrape` (live logs), `/notify` (user notifications)
- Auth middleware on connection (JWT verification)
- Events: `job:started`, `job:progress`, `job:log`, `job:completed`, `job:error`, `notification:new`

---

## Scraper Microservice (Python)

### Directory Structure

```
scraper/
├── app.py                    # Flask/FastAPI HTTP server (receives jobs)
├── config.py                 # Environment config
├── requirements.txt
├── engine/
│   ├── adaptive_fetcher.py   # requests -> Playwright -> ScraperAPI fallback
│   ├── page_renderer.py      # Playwright browser management
│   ├── pagination.py         # Universal pagination handler
│   └── cookie_handler.py     # Cookie/consent banner dismissal
├── extractors/
│   ├── universal_extractor.py    # Pattern-based field extraction
│   ├── universal_nlp.py          # Listing type detection (sale/rent/land)
│   ├── price_parser.py           # Nigerian price parsing
│   ├── location_parser.py        # Location hierarchy extraction
│   └── feature_extractor.py      # Amenity/feature extraction
├── pipeline/
│   ├── validator.py          # Field validation + quality scoring (0-100)
│   ├── deduplicator.py       # SHA256 hash dedup
│   ├── enricher.py           # Geocoding (OSM Nominatim, cached)
│   ├── normalizer.py         # Data cleaning + normalization
│   └── writer.py             # POST results to Node.js API via callback
├── utils/
│   ├── rate_limiter.py
│   ├── logger.py
│   └── callback.py           # HTTP callback helpers
└── render.yaml
```

### Job Flow

1. Node.js API POSTs to `/api/jobs` with job config (jobId, sites[], parameters, callbackUrl)
2. Scraper iterates sites, fetches with adaptive fallback chain
3. For each listing: extract -> normalize -> NLP detect type -> validate -> score quality -> deduplicate -> geocode
4. Reports progress via HTTP POST to `/api/internal/scrape-progress`
5. On completion: POSTs results to `/api/internal/scrape-results`
6. Node.js API upserts properties, syncs Meilisearch, checks saved searches, broadcasts via Socket.io

### Site configs stored in DB (not YAML)

Site configurations (selectors, pagination type, etc.) are stored in the `Site` table and sent as part of the job payload. No direct DB access from scraper.

### Key modules to port from old project

- `scraper_engine.py` -> `engine/adaptive_fetcher.py` (adaptive fetch, stealth Playwright, cookie dismissal)
- `universal_extractor.py` -> `extractors/universal_extractor.py`
- `universal_nlp.py` -> `extractors/universal_nlp.py`
- `universal_validator.py` -> `pipeline/validator.py`
- `quality_scorer.py` -> `pipeline/validator.py` (merged)
- `duplicate_detector.py` -> `pipeline/deduplicator.py`
- `geo.py` -> `pipeline/enricher.py`
- `cleaner.py` + `data_cleaner.py` -> `pipeline/normalizer.py`

---

## Search Architecture (Meilisearch)

### Index: `properties`

- **Searchable:** title, description, propertyType, locationText, area, lga, state, features, agentName, searchKeywords
- **Filterable:** listingType, category, status, propertyType, bedrooms, bathrooms, price, state, area, lga, furnishing, qualityScore, isPremium, siteId, createdAt
- **Sortable:** price, bedrooms, qualityScore, createdAt, updatedAt, daysOnMarket
- **Custom ranking:** qualityScore:desc (higher quality = higher rank)

### NL Query Parser

Port from old Python `NaturalLanguageSearchParser` to TypeScript:
- Extract bedrooms: `/(\d+)\s*(?:bedroom|bed|br)/i`
- Extract property type: `/\b(flat|apartment|duplex|terrace|land)\b/i`
- Extract location: match against known Lagos areas
- Extract price: `/under\s*(?:N)?\s*(\d+(?:\.\d+)?)\s*([MmKk]?)/`
- Extract features: `/\b(pool|bq|serviced|furnished|gated)\b/i`

### Sync Strategy

- **Real-time:** After every property create/update/delete
- **Batch:** After scraper submits bulk results
- **Full re-index:** Admin operation / weekly cron

### Active Scraping Trigger

When search yields 0 results and user opts in -> create `ScrapeJob` with type `ACTIVE_INTENT` -> dispatch to scraper with focused parameters.

---

## Frontend Architecture (Next.js)

### Design System

- Primary: `#0001FC` (electric blue) -> `var(--primary)`
- Accent: `#FF6600` (orange) -> `var(--accent)` — prices
- Success: `#0a6906` (green)
- Background: `#F7F7F7`, Cards: `#FFFFFF`
- Text dark: `#1A1A1A`, Text light: `#F7F7F7`
- Font display: Space Grotesk (`font-display`)
- Font body: Outfit (`font-body`)
- All colors via CSS variables, never hardcoded Tailwind classes

### Directory Structure

```
frontend/
├── app/
│   ├── layout.tsx                    # Root (fonts, providers)
│   ├── globals.css                   # CSS vars, Tailwind config
│   ├── (auth)/                       # Auth layout (centered, no sidebar)
│   │   ├── login/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (dashboard)/                  # Dashboard layout (sidebar + main)
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Dashboard (KPIs, charts, explore)
│   │   ├── properties/page.tsx       # Split view: filters + grid + map
│   │   ├── properties/[id]/page.tsx  # Property detail
│   │   ├── search/page.tsx           # NL search
│   │   ├── data-explorer/page.tsx    # Raw/enriched/flagged views
│   │   ├── scraper/page.tsx          # Scraper control + live logs
│   │   ├── scraper/sites/page.tsx    # Site management
│   │   ├── saved-searches/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── settings/page.tsx         # General + email + map + users
│   │   └── audit-log/page.tsx
│   └── api/[...proxy]/route.ts       # Thin proxy to backend
├── components/
│   ├── ui/                           # shadcn/ui
│   ├── layout/                       # app-sidebar, mobile-sidebar, top-bar
│   ├── property/                     # property-card, grid, detail, filters, map, version-diff
│   ├── search/                       # search-bar, results, suggestions
│   ├── scraper/                      # controls, live-logs, site-card, job-progress
│   ├── analytics/                    # kpi-card, donut-chart, bar-chart, sparkline
│   ├── map/                          # map-container, property-marker, draw-area
│   └── common/                       # data-table, stat-card, empty-state, loading-skeleton
├── hooks/                            # useProperties, useSearch, useSocket, useAuth, useMapProvider
├── lib/
│   ├── api.ts                        # Axios instance + API methods
│   ├── supabase.ts                   # Supabase client
│   ├── socket.ts                     # Socket.io client
│   ├── utils.ts                      # cn(), formatPrice()
│   └── map-providers/                # OSM, Mapbox, Google Maps adapters
├── stores/                           # Zustand: ui.store.ts, map.store.ts
├── types/                            # TypeScript interfaces
├── components.json                   # shadcn/ui config
└── package.json
```

### State Management

- **Server state:** TanStack Query (React Query) — properties, search, scrape jobs, analytics
- **Client state:** Zustand — sidebar toggle, map provider, UI preferences
- **Real-time:** Custom `useSocket` hook -> updates React Query cache on Socket.io events
- **URL state:** Next.js `searchParams` — property filters serialized to URL for shareability

### Key Pages

- **Dashboard:** KPI cards, donut chart (by category), bar chart (by area), explore properties section
- **Properties:** 3-panel layout (filter sidebar | property grid | map panel), URL-driven filters
- **Property Detail:** Image gallery, full info, version history timeline, price chart, edit form
- **Search:** Large NL search bar, suggestions, faceted results, "search the web" active scrape trigger
- **Scraper:** Start scrape (select sites, params), active jobs with progress bars, live log viewer
- **Data Explorer:** Tabs (All/Raw/Enriched/Flagged), bulk actions, export

### Map Provider Abstraction

```typescript
interface MapProvider {
  name: string;
  getTileUrl(): string;
  geocode(query: string): Promise<GeoResult[]>;
  reverseGeocode(lat: number, lng: number): Promise<GeoResult>;
  MapComponent: React.ComponentType<MapComponentProps>;
}
```

- **OSM (default):** react-leaflet, free, Nominatim geocoding
- **Mapbox:** react-map-gl, requires token, better tiles
- **Google Maps:** @react-google-maps/api, best Nigerian geocoding accuracy
- Switchable from Settings page, stored in SystemSetting table + Zustand store

---

## Build Phases

### Phase 1: Foundation
**Goal:** Backend skeleton + database + auth + frontend scaffold

- Initialize monorepo (backend/, frontend/, scraper/)
- Create CLAUDE.md
- Git init + GitHub repo
- CockroachDB: run Prisma schema migration
- Backend: Express app with full middleware stack
- Auth: Supabase integration, auth middleware, user CRUD
- Health check, error handling, logger
- Deploy backend to Render
- Frontend: Next.js scaffold, layout, sidebar, auth pages (login, forgot-password)
- Deploy frontend to Vercel

**Deliverable:** Login works. Health check OK. DB connected.

### Phase 2: Properties Core
**Goal:** Properties CRUD + display

- Backend: Property service (CRUD with versioning), routes, Zod validators
- Backend: Site management CRUD
- Frontend: Properties page (grid + filter sidebar)
- Frontend: Property cards (Homegi-style gradient)
- Frontend: Property detail page
- Seed 50-100 sample properties

**Deliverable:** Create/view/edit properties. Version history works. Filter/paginate.

### Phase 3: Scraper Microservice
**Goal:** Automated data collection

- Python scraper service (Flask entry point)
- Port adaptive fetcher, universal extractor, NLP detector, price parser
- Pipeline: validate -> deduplicate -> normalize -> enrich (geocode)
- HTTP callback integration with Node.js API
- Backend: Scrape job management + Socket.io live logs
- Frontend: Scraper control page + site management
- Deploy scraper to Render
- Test with 5-10 real Nigerian property sites

**Deliverable:** Trigger scrapes from UI, see live progress, properties appear in DB.

### Phase 4: Search + Dashboard
**Goal:** Intelligent search + analytics

- Deploy Meilisearch on Render
- Backend: Meilisearch sync + NL query parser + search routes
- Frontend: Search page with NL input + faceted results
- Active scraping trigger on zero results
- Backend: Analytics service (KPIs, trends)
- Frontend: Dashboard (KPI cards, charts)

**Deliverable:** NL search works. Dashboard shows live stats. **MVP complete.**

### Phase 5: Maps + Geospatial
**Goal:** Map-based property discovery

- Map provider abstraction (OSM/Mapbox/Google Maps)
- Frontend: Map panel on properties page (split view)
- Frontend: Draw-to-search (polygon area selection)
- Backend: Bounding-box queries, radius-based amenity detection
- Settings page for map provider selection

**Deliverable:** Properties visible on map. Can draw search areas.

### Phase 6: Saved Searches + Notifications + Data Explorer
**Goal:** Monitoring, alerting, data management

- Backend: Saved search service + notification service (Resend email)
- Frontend: Saved searches page + notification bell (Socket.io)
- Data explorer (raw/enriched/flagged views, bulk actions)
- Audit log viewer + export (CSV/XLSX)

**Deliverable:** Full monitoring workflow. Alerts for new matches.

### Phase 7: Production Hardening
**Goal:** Production-ready

- Performance optimization (query tuning, caching)
- GitHub Actions CI/CD (lint, test, deploy)
- Scheduled scraping via GitHub Actions
- Meilisearch weekly re-index cron
- Security audit, Sentry error tracking
- API documentation

**Deliverable:** Production-ready platform.

---

## Key Reference Files (Old Project)

| File | What to port |
|------|-------------|
| `Dynamic realtors_practice/backend/core/scraper_engine.py` | Adaptive fetch, stealth Playwright, pagination |
| `Dynamic realtors_practice/backend/core/universal_extractor.py` | Pattern-based field extraction |
| `Dynamic realtors_practice/backend/core/universal_nlp.py` | Listing type detection logic |
| `Dynamic realtors_practice/backend/core/universal_validator.py` | Data validation rules |
| `Dynamic realtors_practice/backend/core/quality_scorer.py` | Quality scoring algorithm |
| `Dynamic realtors_practice/backend/core/duplicate_detector.py` | SHA256 deduplication |
| `Dynamic realtors_practice/backend/core/geo.py` | OSM Nominatim geocoding |
| `Dynamic realtors_practice/backend/core/natural_language_search.py` | NL query parsing patterns |
| `Dynamic realtors_practice/backend/config.yaml` | 51 site configs (migrate to DB) |

## Key Reference Files (Millenium Project)

| File | What to reuse |
|------|--------------|
| `Millenium/backend/src/app.ts` | Express middleware stack pattern |
| `Millenium/backend/prisma/schema.prisma` | Prisma + CockroachDB config pattern |
| `Millenium/frontend/components.json` | shadcn/ui configuration |
| `Millenium/frontend/app/layout.tsx` | Root layout pattern |

---

## Verification

### After Phase 1:
- `GET /api/health` returns 200
- Prisma migration runs successfully against CockroachDB
- Login via Supabase works end-to-end
- Frontend deploys to Vercel, backend to Render

### After Phase 2:
- Create property via API -> appears in DB with version 1
- Edit property -> version 2 created, diff visible
- Filter properties by listingType + price range -> correct results
- Frontend displays property cards correctly

### After Phase 3:
- Start scrape from UI -> Python scraper receives job
- Live logs stream to frontend via Socket.io
- Properties from real sites appear in DB with quality scores
- Deduplication prevents duplicate inserts

### After Phase 4 (MVP):
- "3 bedroom flat in Lekki under 30 million" -> returns relevant results from Meilisearch
- Dashboard KPIs reflect actual DB data
- Active scrape trigger fires when search yields 0 results

---

## First Implementation Step

We start with **Phase 1: Foundation**. Specifically:

1. Create `CLAUDE.md` with project conventions
2. `git init` the repo
3. Scaffold `backend/` with Express + TypeScript + Prisma
4. Write the full Prisma schema and run migration
5. Implement middleware stack + auth + health check
6. Scaffold `frontend/` with Next.js 16 + shadcn/ui
7. Set up the design system (CSS variables, fonts)
8. Build sidebar + auth pages
9. Deploy both to Render + Vercel
