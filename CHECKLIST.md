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
- [x] Backend: Scrape logs API with filtering, pagination, search (/scrape/logs, /scrape/logs/:id)
- [x] Backend: Socket.io namespace-wide broadcast for live log feed (fix event name mismatch)
- [x] Frontend: Full scrape logs section (date range picker, level/site filters, pagination, detail modal)
- [x] Frontend: useScrapeLogsHook (TanStack Query)
- [x] Frontend: AdvancedDateRangePicker component (controlled + uncontrolled modes)

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
- [x] Backend: Saved search service (CRUD, matching, new match detection)
- [x] Backend: Saved search controller + routes
- [x] Backend: Notification service (create, list, mark read, in-app + email)
- [x] Backend: Notification controller + routes
- [x] Backend: Email service (Resend API integration)
- [x] Backend: Cron job for checking saved search matches
- [x] Backend: Export service (CSV generation)
- [x] Backend: Export controller + routes
- [x] Backend: Audit log controller + routes
- [x] Frontend: Saved searches page (create, edit, view matches)
- [x] Frontend: Notification bell component (real-time via Socket.io)
- [x] Frontend: Notification dropdown/panel
- [x] Frontend: Data explorer page (tabs: All/Raw/Enriched/Flagged)
- [x] Frontend: Bulk action controls (approve, reject, merge duplicates, export)
- [x] Frontend: Data inspection detail view
- [x] Frontend: Audit log viewer page
- [x] Frontend: Export functionality (CSV download)
- [x] Frontend: useSavedSearches hook
- [x] Frontend: useNotifications hook
- [ ] Test: Create saved search -> matches appear when new properties arrive
- [ ] Test: Email notification sent on new match
- [ ] Test: In-app notification appears in real-time
- [ ] Test: Data explorer shows correct segmented views
- [ ] Test: Bulk actions work correctly
- [ ] Test: CSV export generates valid files

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
- [x] Documentation: Deployment guide (SETUP.md — Google OAuth, Resend, invite system)
- [ ] Documentation: README.md update
- [x] User management page (admin - list users, change roles, deactivate)
- [ ] Settings page - general settings
- [ ] Settings page - email notification config
- [ ] Settings page - environment variable management
- [ ] Testing: Jest setup for backend unit/integration tests
- [ ] Testing: Vitest setup for frontend component tests
- [ ] Testing: Core backend service tests (property CRUD, versioning, dedup)
- [ ] Testing: API endpoint integration tests
- [x] PWA: manifest.json + service worker for offline/mobile
- [x] PWA: App install prompt for mobile users
- [ ] Backup: Automated pg_dump cron for local PostgreSQL
- [ ] Backup: CockroachDB backup verification
- [ ] Monitoring: UptimeRobot for API health monitoring
- [ ] Monitoring: Scraper health dashboard (site success rates, data freshness)
- [ ] Legal: Privacy policy page
- [ ] Legal: robots.txt respect toggle per site
- [ ] Legal: Data retention policy + auto-purge cron for old data
- [ ] Fraud: Basic fraud detection signals (abnormally low price, duplicate images)
- [ ] Fraud: "Flag as suspicious" user action on property cards
- [x] Security: CSRF protection for Express backend
- [x] Security: Content Security Policy (CSP) headers
- [x] Security: Per-user API rate limiting (not just global)
- [x] Backend: API response gzip compression for large payloads
- [ ] Backend: Scrape job max-duration timeout (kill stuck jobs)
- [ ] Backend: Webhook/callback retry with dead-letter queue (scraper → backend)
- [ ] Backend: Database connection pooling tuning for CockroachDB
- [x] Frontend: Error boundary per page (crash isolation)
- [x] Frontend: Stale data indicator on properties page (last refresh time)
- [x] Frontend: Keyboard shortcuts (Cmd+K search, Cmd+/ help)
- [ ] Frontend: Better empty states with CTAs across all pages
- [ ] Frontend: Data explorer table column resize/reorder
- [ ] Scraper: Scrape result preview before DB insert
- [ ] Scraper: Selector test playground on Sites page (paste URL, test selectors live)
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

## Phase 9: UX Polish & Feature Completion

### Settings Page Overhaul
- [x] Settings: Redesign to left sidebar nav (desktop) + full-screen sections (mobile)
- [x] Settings/Profile: Avatar upload, name, phone, bio, company, email locked, Save button
- [x] Settings/Security: Password change, Google OAuth link/unlink (Supabase identity API), active sessions list, login history
- [x] Settings/Notifications: Email + in-app toggles, digest frequency, quiet hours, Save button
- [x] Settings/Appearance: Theme toggle (Light/Dark/System), sidebar state, font size, accent color, compact mode
- [x] Settings/Data & Display: Map provider + API keys, per-page count, default sort, voice search auto-submit, date/currency format
- [x] Settings/Email Settings: SMTP/SendGrid/Resend config, from/reply-to, test email, template editor
- [x] Settings/Backups: Manual + scheduled backups, retention policy, backup table with download/restore
- [x] Settings/About: Version, credits, system info, legal links, danger zone (delete account)
- [x] Settings/Users: Existing user table preserved and integrated into sidebar nav
- [x] Settings/Users: Invite code system (6-char code, 24h expiry, Resend email, admin-register validates code)
- [x] Settings/Users: ADMIN role option in invite modal
- [x] Admin Register: 2-step flow (enter code → create account), email locked to invitation

### Dashboard Bento Grid
- [x] Upgrade BentoGrid + BentoGridItem with Aceternity-style title/description/header/icon props
- [x] Add hover glow + scale effects to bento items
- [x] Fix responsive breakpoints: 1→2→4 columns
- [x] Add border + hover styling to KPI cards

### Saved Searches
- [x] Add listing types: Buy, Sell, Rent, Land, Lease, Shortlet
- [x] Add property types chip selector (Flat, Duplex, Bungalow, Penthouse, Studio, etc.)
- [x] Add bathrooms, furnishing status, parking, serviced toggle filters
- [x] Improve modal UI with chip-style selectors and logical grouping

### Audit Logs
- [x] Set filters panel visible by default
- [x] Add user dropdown filter
- [x] Add IP address text filter
- [x] Add severity filter (info/warning/critical)
- [x] Add keyword search across log details
- [x] Add scraper session ID filter
- [x] Add more action types: SEARCH, IMPORT, SETTINGS_CHANGE, PASSWORD_CHANGE, ROLE_CHANGE, BACKUP
- [x] Add more entity types: SETTINGS, BACKUP, EMAIL_TEMPLATE
- [x] Add expandable row detail view (full JSON diff)
- [x] Add Export CSV button

### Analytics Page
- [x] Replace "Coming Soon" with full analytics dashboard
- [x] KPI cards: hero dark card + 4 mini cards with trend indicators
- [x] Properties-over-time combined bar+area chart with time range selector
- [x] Top Areas leaderboard with animated progress bars
- [x] Top Sites leaderboard with animated progress bars
- [x] Scraping activity heatmap (day × hour, intensity-shaded)
- [x] Full property ledger table at bottom: tabs (All/Active/Sold/Rented/Pending), search, CSV export
- [x] Analytics page redesigned to match ShipNow reference (hero card, leaderboards, heatmap, table)

### Shepherd.js Tour System Overhaul
- [x] Replace auto-start logic with animated Tour Selector Modal (Framer Motion)
- [x] Tour Selector: two options — Full Tour vs Choose a Page
- [x] Full App Tour: ~30 steps across all pages with router.push() navigation between
- [x] Per-page tours: dashboardSteps, propertiesSteps, propertyDetailSteps, searchSteps
- [x] Per-page tours: scraperSteps, savedSearchesSteps, dataExplorerSteps, analyticsSteps
- [x] Per-page tours: auditLogSteps, settingsSteps
- [x] Tour step rich content: emoji header, description, action hint, step counter pill
- [x] Tour step progress bar with motivational text variants
- [x] Tour Selector Modal: animated page-cards grid when "Choose a Page" selected
- [x] Override Shepherd CSS to match brand blue theme
- [x] New TourSelectorModal component (Framer Motion, backdrop blur, spring animations)
- [x] data-tour attributes added to every major UI element across all pages
- [x] Tour config: modular steps file, easy to add/update per page
- [x] Tour button CSS: three distinct brand colors (blue primary, orange skip, green back/exit)
- [x] Tour button layout: 2-row flex layout (first two buttons share row, third full-width)

---

## Phase 10: Interactive Search Experience (SEARCH_EXPERIENCE.md)

> Airbnb/Zillow-grade map search. See SEARCH_EXPERIENCE.md for full technical spec.

### Phase 1 Priority (High Impact)
- [x] Search: Replace generic map pins with Price Pill markers (₦5M displayed on map)
- [x] Search: Price pill shows ₦ with M/K suffix, blue for sale, green for rent
- [x] Search: Pill highlights (scale 1.25x, fill color) on hover

### Phase 2 Priority (Premium UX)
- [x] Search: Map ↔ List hover sync — hover card highlights marker and vice versa
- [x] Search: Hover marker → scroll corresponding card into view (smooth)
- [x] Search: Highlighted card gets border glow + elevation

### Phase 3 Priority (Wow Factor)
- [x] Search: FlyTo on search — extract area from query → smooth camera transition
- [x] Search: Pre-built Lagos coordinate lookup table (50+ areas, no API cost)
- [x] Search: Staggered marker pop-in (80ms stagger, spring animation, "live crawl" feel)
- [x] Search: Markers stagger only after flyTo settles (300ms delay)

### Phase 4 Priority (Scale)
- [x] Search: Supercluster integration for zoom-based clustering
- [x] Search: Zoom ≤10 → cluster circles with counts, zoom ≥14 → individual price pills
- [x] Search: Cluster labels show price range (₦2M–₦45M)
- [x] Search: Cap staggered markers at 100–200 visible in viewport

### Phase 5 Priority (Performance)
- [ ] Search: Virtualized results list (`@tanstack/react-virtual`) for 10K+ cards
- [x] Search: Mobile optimized — CSS-only pills, reduced shadows

### New Files Required (from spec)
- [ ] `components/map/mapbox-map.tsx` — Mapbox GL wrapper with flyTo
- [x] `components/map/price-pill-marker.tsx` — Custom price pill component
- [x] `components/map/marker-cluster.tsx` — Supercluster integration
- [x] `components/map/map-controls.tsx` — Zoom, style switch, locate me
- [x] `components/search/search-map-view.tsx` — 50/50 split view
- [x] `components/search/search-result-card.tsx` — Card with hover sync
- [x] `components/search/live-crawl-overlay.tsx` — Stagger animation controller
- [x] `hooks/use-flyto.ts` — FlyTo with area geocoding (updated for MapLibre GL)
- [x] `hooks/use-marker-sync.ts` — Map ↔ list hover state
- [x] `hooks/use-search-query-parser.ts` — NLP-lite query parsing
- [x] `lib/lagos-coordinates.ts` — Pre-built area coordinate lookup table
- [x] `lib/cluster-config.ts` — Supercluster options

---

## Phase 11: Dashboard Hero Redesign

### Globe Hero Component
- [x] Create `GlobeHero` component with lightweight cobe-based `@scrollxui/globe` (replaced react-globe.gl)
- [x] Add 4 Framer Motion animated KPI stat cards (Index Volume, Asset Velocity, etc.) matching dark neon reference
- [x] Globe drops in, eases in, and rotates for a futuristic feel
- [x] Mobile responsive: hide globe on small screens, stack cards, relative positioning for meta/greeting

### Settings: Lanyard + Profile Card
- [x] Lanyard component with react-three-fiber, rapier physics, meshline
- [x] ProfileCard component for settings profile tab
- [x] Error boundary + GLB validation for corrupt model files
- [x] Dynamic import (SSR disabled) to reduce initial chunk size

---

## Phase 12: Bug Fixes & Polish (from suggestions.md)

### Dashboard & Theme
- [x] Fix dashboard hero section light mode — still dark-themed in light mode
- [x] Ensure all dashboard components respect light/dark CSS variables

### Tour System
- [ ] Make tour responsive on both mobile and desktop
- [ ] Tour must highlight the exact element being explained (overlay + highlight)
- [ ] Tour must be interactive — click sidebar to navigate pages during tour
- [x] Tour modal button layout: 2 rows — first row has 2 buttons (50/50 width), second row has 1 button (full width)
- [ ] Fix confetti animation at tour end (not popping/animating properly)
- [ ] Tour should cover every part of the app with specific steps per scenario

### Email & Communications
- [x] Fix email template editor responsiveness (cutoff on desktop and mobile)
- [x] Add more shortcodes to the email template editor
- [x] Ensure email configuration (SMTP/Resend) is working correctly
- [x] Test email button must validate config fields and actually send a test email

### Authentication & Users
- [x] Set up Google OAuth link/unlink (provide setup requirements to user)
- [x] Ensure Sign in with Google works end-to-end
- [ ] Verify invite users system works for different roles (ADMIN, VIEWER, etc.)

### AI Assistant
- [ ] Give AI assistant read access to database so it can answer data questions
- [ ] Make AI ubiquitous — available across all app pages for inquiries

### Data & Mock Removal
- [ ] Remove all mock data from production URL
- [x] Analytics page: replace mock data generation with real API data
- [ ] Active sessions: replace mock session data with real Supabase sessions
- [ ] Backup section: connect to real backup endpoints (not just toasts)

### Export System
- [x] Add XLSX export support
- [x] Add PDF export support
- [ ] Add logo watermark to all export formats (CSV, XLSX, PDF)

### Mobile Fixes
- [x] Sites page: move options/bulk-action bar above sites list (covered by mobile bottom nav)
- [x] Saved searches: make "New Search" button responsive (text wrapping issue)
- [x] Sidebar: fix mobile scroll — admin/logout buttons unreachable on Chrome mobile
- [x] Notification modal: make responsive on mobile (page is fine, modal isn't)

### Profile & Avatar
- [x] Profile avatar click in top bar should navigate to profile settings
- [x] Fix profile image upload — must save and persist
- [x] Uploaded image must appear on: profile card (lanyard), avatar in settings, avatar in top bar

### Settings & Security
- [ ] Fix "Revoke session" in active sessions (currently only shows toast)
- [ ] Ensure password change works correctly
- [x] Remove "current password" field from password change form
- [x] Add "Save Settings" button to Appearance section
- [ ] Fix schedule datetime picker in scrape config sheet (not clickable)
- [x] Remove "Delete Account" button from About tab
- [ ] Fix profile name save failing on live URL

### Activity Logs & Notifications
- [ ] Ensure audit logs capture and record every user action
- [ ] Ensure notifications system works end-to-end (in-app + email)

### Backups
- [ ] Ensure backups truly work (not just UI — actual backup/restore)
- [ ] Fix backup toast not dismissing after click
- [ ] Add timezone settings for the app (affects scrape schedules, logs, backups)

### Globe Hero (Light Mode)
- [x] Fix globe not rendering/visible in light mode (dark globe imagery invisible on white bg)
- [x] Adjust globe or add light-mode alternative globe texture

### Search Page
- [ ] Fix search page AxiosError (Network Error) — backend connection issue on localhost/prod
- [x] Fix search autocomplete: NL queries like "3 bed flat in magodo under 5m" return no suggestions (only location-only queries work)
- [x] Apply NLP parsing to autocomplete suggestions (extract location/keywords, ignore price/bedroom tokens for Meilisearch)
- [x] Fix autocomplete dropdown z-index — currently blocked/hidden by results sidesheet
- [x] Convert desktop results from left sidesheet → draggable bottom sheet (3 snap points: peek, half, full)
- [x] Make bottom sheet draggable with touch + mouse support, responsive on all screen sizes
- [x] Keep search bar at top with proper z-index, never blocked by the bottom sheet
- [x] Update "Want more results?" → "Didn't find what you were looking for?"
- [x] Update subtitle → `Run a targeted scrape for "[query]"`
- [x] "Search the Web" button navigates to scraper page with config sheet open, active mode, all sources selected, query pre-filled
- [x] Ensure search page is fully responsive (desktop + tablet + mobile)

### Scraper Configuration
- [x] Replace scraper schedule date-time picker with a new UI (calendar + scrollable time columns) that matches the app's styling
- [x] Fix "No active sources" in config — sites added on Sites page not appearing in config picker
- [x] Fix phantom "2 sources" appearing after saving config when no real sources exist
- [x] Ensure config sheet works correctly with both localhost and production API URLs

### Site Management
- [ ] Fix "Failed to add site" error on single site creation
- [ ] Fix bulk import not working
- [x] Ensure site CRUD works on both localhost (port 5000) and production URL

### Saved Searches
- [x] Fix saved search creation — currently failing silently
- [x] Change single-select dropdowns to multi-select where appropriate (location, property type, features)

### Lanyard & Profile Card
- [x] Center profile card on lanyard (currently offset)
- [x] Show real user full name on lanyard (not hardcoded "Tee David")
- [x] Show real user role under name on lanyard
- [x] Show real user profile picture on lanyard
- [ ] Make lanyard card text responsive

### Profile Image Upload
- [x] Fix profile image upload button (currently non-functional)
- [x] Save uploaded image to database (Supabase storage or CockroachDB)
- [x] Persist uploaded image across: lanyard card, settings avatar, top bar avatar

### App-Wide Settings (Admin Defaults)
- [ ] Admin-saved settings (theme, font, etc.) become app-wide defaults for all users
- [ ] Each user can override defaults with their own preferences
- [ ] Store user-specific overrides in DB, fall back to admin defaults

### Google OAuth
- [x] Provide setup instructions for Google OAuth in Supabase (client ID, redirect URLs)
- [x] Test Google link/unlink flow end-to-end
- [x] Test "Continue with Google" sign-in flow

### Email & SMTP
- [x] Fix Resend integration (not sending emails)
- [x] Fix SMTP test email button (must validate fields + actually send)
- [x] Fix email template editor — cut off on mobile and desktop, needs full-screen mode
- [x] Add more relevant shortcodes to email template editor (e.g. {{property.location}}, {{property.bedrooms}}, {{savedSearch.name}})

### Invite Users
- [ ] Fix invite users flow end-to-end (invite → email → accept → account creation)
- [ ] Test invite for all roles: ADMIN, EDITOR, VIEWER

### UI Polish
- [x] Install ModernLoader component (`npx shadcn@latest add @scrollxui/modern-loader`)
- [x] Replace all page loading spinners/skeletons with `<ModernLoader>` using contextual word arrays
- [ ] Use contextual loading messages per page (search: "Scanning listings...", scraper: "Writing magic...", etc.)

### Page Load Performance
- [x] Investigate and fix slow page load times across the app
- [x] Audit dynamic imports — ensure heavy components (globe, maps, charts, three.js) are properly lazy-loaded
- [x] Check for unnecessary re-renders and optimize React component memoization
- [x] Verify TanStack Query caching settings (staleTime, gcTime) are optimal
- [x] Check if large client-side bundles are being shipped unnecessarily

### Scraper Reliability
- [x] Detailed scraper dispatch → execution → callback → result pipeline verification
- [x] Add scraper health check endpoint
- [x] Ensure scraper logs show meaningful error messages when dispatch fails
- [ ] GitHub Actions cron trigger tested and verified working

---

## Phase 3.5: Scraper Engine Overhaul — "Penetration-Grade" Upgrade

> Replaces the current fetcher/extractor with a multi-layer fallback system
> that can scrape ANY Nigerian property site regardless of anti-bot protection.
> See `new-ideas-for-scraper-tech.md` for the original vision.

### Architecture Fixes (✅ Done)
- [x] Fix `listingSelector` mapping bug in scrape.service.ts (was sending wrong selector type)
- [x] Rewrite `adaptive_fetcher.py` with `curl_cffi` (Chrome TLS fingerprint bypass)
- [x] Add comprehensive Playwright stealth script (WebGL, canvas, plugins, navigator)
- [x] Add Cloudflare challenge auto-wait (detects "Just a moment..." and waits)
- [x] Add consecutive block detection with smart backoff
- [x] Port JSON-LD extraction from v2.0 (extracts structured data from `<script type="application/ld+json">`)
- [x] Add pipe-separated fallback selectors (e.g., "h1.title | h1 | .name")
- [x] Add auto-detection fallbacks (title from `<title>`/`<h1>`, price from `[class*='price']`, images from `og:image`)
- [x] Seed 9 Nigerian property sites with verified selectors from v2.0 config.yaml
- [x] Update `requirements.txt` with `curl_cffi`
- [x] Update Dockerfile for new dependencies

### Scrapling Integration (Anti-Bot + Self-Healing — ✅ Done)
- [x] Install `scrapling` library in scraper requirements
- [x] Create `engine/scrapling_fetcher.py` — StealthyFetcher with anti-bot bypass + adaptive parser
- [x] Integrate Scrapling as Layer 2 in `adaptive_fetcher.py` (after curl_cffi, before Playwright)
- [x] Add adaptive self-healing element matching (element fingerprints + similarity matching)
- [x] Rewrite `adaptive_fetcher.py` with 4-layer cognitive loop architecture

### Crawl4AI Integration (LLM-Assisted Scraping)
- [x] Install `crawl4ai` library in scraper
- [x] Create `engine/crawl4ai_fetcher.py` — Crawl4AI renders page to clean Markdown
- [x] Create `extractors/llm_schema_extractor.py` — Gemini Flash extracts structured property data from Markdown
- [x] Define Pydantic schema for property extraction (price, bedrooms, location, etc.)
- [x] Integrate into `adaptive_fetcher.py` as Layer 3 fallback (after Scrapling, before Playwright)
- [x] Add auto-selector discovery — Gemini analyzes a page and returns CSS selectors for new sites
- [x] Cache discovered selectors per-site in Redis (avoid re-discovering on every page)
- [x] Add LLM-based data normalization (e.g., "3 Baths" → 3, "₦5 Million" → 5000000)

### Anti-Detection Hardening
- [x] Add residential proxy rotation support (BrightData/Smartproxy compatible)
- [x] Add session/cookie persistence across pages for same domain
- [x] Add request fingerprint randomization (TLS, headers, viewport)
- [ ] Integrate ScraperAPI as Layer 4 fallback (paid, handles all anti-bot)
- [ ] Add `SCRAPERAPI_KEY` env var support

### Pipeline Improvements (Ported from v2.0)
- [ ] Port category page detection (skip index/directory pages)
- [x] Port URL validation (filter WhatsApp, mailto, tel, javascript links)
- [ ] Port incremental scraping (track seen URLs, stop after N consecutive known)
- [ ] Port relevance scoring heuristics (multi-signal element scoring)
- [ ] Port 3-strategy pagination (next button click → numeric page links → URL param fallback)
- [x] Add detail page enrichment (two-level scraping: list page + detail page)

### Image Intelligence (Gemini Vision)
- [ ] Pass property images to Gemini Flash Vision for description
- [ ] Extract: renovation status, kitchen quality, interior style, outdoor features
- [ ] Store image analysis as property metadata
- [ ] Use image data for fraud detection (stock photos, mismatched descriptions)

### Testing & Verification
- [ ] Test: Scraper successfully fetches page from PropertyPro.ng
- [ ] Test: Scraper successfully fetches page from Nigeria Property Centre
- [ ] Test: Scraper successfully fetches page from Jiji.ng
- [ ] Test: JSON-LD extraction returns structured data
- [ ] Test: Crawl4AI + Gemini extracts property data from unknown site
- [ ] Test: Fallback chain works (JSON-LD → Crawl4AI → CSS → ScraperAPI)
- [ ] Test: Scraped properties appear in database with quality scores
- [ ] Test: Deduplication prevents duplicate inserts
- [ ] Test: Full scrape job dispatched from UI completes successfully

---

## Phase 13: AI Intelligence Layer (BitNet + ZeroClaw + Oracle Free Tier)

> ⚠️ **DO NOT START THIS PHASE** until we are fully confident that all other parts of the app (Phases 1–12) are working correctly — frontend, backend, scraper, search, notifications, settings, and all bug fixes. This phase adds a new layer on top of a stable foundation. Starting it on a broken app will only create more problems.
>
> See `AI_INTELLIGENCE.md` for the full technical vision and `AI_SETUP_GUIDE.md` for step-by-step setup instructions.

### Phase 13.1: Oracle Cloud VM Setup (🔵 You Do This)
- [ ] Create Oracle Cloud Always Free account ([oracle.com/cloud/free](https://oracle.com/cloud/free))
- [ ] Create ARM VM instance (VM.Standard.A1.Flex — 4 OCPUs, 24GB RAM, Ubuntu 22.04)
- [ ] Download SSH private key and connect to VM via terminal
- [ ] Run initial server setup (apt update, firewall, essential tools)

### Phase 13.2: BitNet Model Deployment (🟡 You Run Commands)
- [ ] Clone and build BitNet on Oracle VM (`git clone --recursive https://github.com/microsoft/BitNet.git`)
- [ ] Download model weights (`microsoft/bitnet-b1.58-2B-4T`, ~400MB)
- [ ] Run test inference and verify output (~5–7 tokens/sec on ARM)
- [ ] Create FastAPI REST wrapper (`/v1/chat/completions` — OpenAI-compatible format)
- [ ] Test REST API locally on VM (`curl http://localhost:8080/health`)
- [ ] Create systemd service for auto-start on reboot (`bitnet-api.service`)

### Phase 13.3: ZeroClaw Agent Runtime (🟡 You Run Commands)
- [ ] Install ZeroClaw on Oracle VM (official installer or build from Rust source)
- [ ] Configure `agent.toml` (point LLM to local BitNet, enable tools + SQLite memory)
- [ ] Start ZeroClaw agent and verify it connects to BitNet
- [ ] Create systemd service for auto-start (`zeroclaw.service`)

### Phase 13.4: Oracle VM Security & Networking (🔵 You Do This)
- [ ] Open port 8080 (BitNet API) in Oracle Security List
- [ ] Open port 9090 (ZeroClaw) in Oracle Security List
- [ ] Restrict ingress to Render backend IP only (not 0.0.0.0/0) for production
- [ ] (Optional) Set up Nginx reverse proxy + Let's Encrypt HTTPS

### Phase 13.5: Backend AI Service Integration (🟢 Antigravity Does This)
- [ ] Add AI env vars to `.env` (`BITNET_URL`, `OLLAMA_URL`, `ZEROCLAW_URL`, `AI_ENABLED`)
- [ ] Create `backend/src/services/ai.service.ts` (dual-model routing: BitNet for fast tasks, Ollama for complex reasoning)
- [ ] Create `backend/src/controllers/ai.controller.ts`
- [ ] Create `backend/src/routes/ai.routes.ts` (query-parse, listing-analysis, market-report, chat, health)
- [ ] Register AI routes in Express app
- [ ] Add AI service tests

### Phase 13.6: Frontend AI Components (🟢 Antigravity Does This)
- [ ] Floating AI Chat Button — available on every page, WebSocket to ZeroClaw
- [ ] Insight Cards on dashboard — auto-populated market summaries from BitNet
- [ ] "AI Analyze" button on property detail page — investment analysis + yield estimate
- [ ] Smart Search Enhancement — show AI-interpreted query ("Interpreted as: 3-bed flat in Lekki, max ₦30M")

### Phase 13.7: AI Use Case Implementation (🟢 Antigravity Does This)
- [ ] Natural Language Query Parser (replace regex parser with BitNet)
- [ ] Property Description Quality & Fraud Scoring (semantic analysis on scraped listings)
- [ ] Auto-Generated Area Market Reports (weekly cron, plain-English summaries)
- [ ] Comparable Property Matching (embedding-based semantic similarity via SQLite vector store)
- [ ] Scrape Failure Diagnosis Agent (ZeroClaw auto-diagnoses scraper errors)
- [ ] Notification Smart Digest (AI-generated weekly email summaries)
- [ ] Data Explorer Anomaly Detection (nightly agent job — price outliers, near-duplicates, bad geocoding)

### Phase 13.8: Testing & Verification
- [ ] Test: BitNet API responds from backend server (network connectivity)
- [ ] Test: NL query parser returns correct structured filters for Nigerian property queries
- [ ] Test: Fraud scoring flags "too good to be true" listings
- [ ] Test: AI chat answers data questions ("How many properties this week?")
- [ ] Test: Market report generates readable English summary from real data
- [ ] Test: Dual-model routing sends simple tasks to BitNet, complex to Ollama
- [ ] Test: ZeroClaw agent maintains memory across sessions

---

## Running Totals
- **Phase 1:** 42 tasks (40 done, 2 deployment pending)
- **Phase 2:** 30 tasks (30 done ✅)
- **Phase 2.5:** 11 tasks (11 done ✅)
- **Phase 3:** 40 tasks (30 done, 10 pending — testing/verification)
- **Phase 3.5:** ~47 tasks (23 done — architecture + Scrapling + Crawl4AI complete, anti-detection + pipeline pending)
- **Phase 4:** 21 tasks (19 done, 2 pending — deploy + tests)
- **Phase 4.5:** 3 tasks (3 done ✅)
- **Phase 5:** 16 tasks (7 done, 9 pending)
- **Phase 6:** 22 tasks (19 done, 6 tests pending)
- **Phase 7:** 38 tasks (17 done — PWA + exports added)
- **Phase 8:** 15 tasks (0 done)
- **Phase 9:** 47 tasks (46 done, 1 pending — `data-tour` attributes)
- **Phase 10:** 22 tasks (17 done, 5 pending — mapbox, search-map-view, search-result-card, virtualized list)
- **Phase 11:** 3 tasks (3 done ✅)
- **Phase 12:** ~75 tasks (~30 done — email, OAuth, profile, perf, saved search, site CRUD, scraper fixes)
- **Phase 13:** 39 tasks (0 done — ⚠️ blocked until Phases 1–12 are stable)
- **TOTAL:** ~431 tasks (~206 done, ~225 remaining)
