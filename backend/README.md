# Backend API Server

Express.js REST API powering the Realtors' Practice platform. Handles property CRUD with versioning, full-text search via Meilisearch, scraper job orchestration, real-time events via Socket.io, analytics, market intelligence, and user management.

## Tech Stack

| Component      | Technology                                      |
|----------------|-------------------------------------------------|
| Runtime        | Node.js 18+                                     |
| Framework      | Express 4                                        |
| Language       | TypeScript (strict mode)                         |
| ORM            | Prisma 5 (PostgreSQL/CockroachDB)               |
| Search         | Meilisearch 0.44                                 |
| Real-time      | Socket.io 4                                      |
| Auth           | Supabase JWT verification                        |
| Email          | Resend API + Nodemailer (SMTP fallback)          |
| Monitoring     | Sentry (error tracking + profiling)              |
| Caching        | IORedis                                          |
| Docs           | Swagger/OpenAPI via swagger-jsdoc                |
| Testing        | Jest                                             |

## API Endpoints

All routes are available under both `/api` (unversioned) and `/api/v1` (versioned).

### Health

| Method | Path           | Description            | Auth     |
|--------|----------------|------------------------|----------|
| GET    | `/health`      | Server health check    | None     |
| GET    | `/api/health`  | API health + DB ping   | None     |

### Authentication

| Method | Path                | Description                      | Auth     |
|--------|---------------------|----------------------------------|----------|
| POST   | `/api/auth/register`| Register new user                | None     |
| GET    | `/api/auth/me`      | Get current user profile         | JWT      |

### Properties

| Method | Path                              | Description                        | Auth     |
|--------|-----------------------------------|------------------------------------|----------|
| GET    | `/api/properties`                 | List properties (paginated, filtered) | JWT   |
| GET    | `/api/properties/:id`             | Get single property                | JWT      |
| POST   | `/api/properties`                 | Create property                    | JWT+RBAC |
| PUT    | `/api/properties/:id`             | Update property (creates version)  | JWT+RBAC |
| DELETE | `/api/properties/:id`             | Soft-delete property               | JWT+RBAC |
| GET    | `/api/properties/:id/versions`    | Get version history                | JWT      |
| GET    | `/api/properties/:id/price-history` | Get price change history         | JWT      |
| POST   | `/api/properties/:id/enrich`      | Trigger enrichment                 | JWT+RBAC |
| POST   | `/api/properties/bulk-action`     | Bulk approve/reject/delete         | JWT+RBAC |
| GET    | `/api/properties/stats`           | Property statistics                | JWT      |

### Geospatial

| Method | Path                        | Description                          | Auth     |
|--------|-----------------------------|--------------------------------------|----------|
| GET    | `/api/properties/geo/bbox`  | Properties within bounding box       | JWT      |
| GET    | `/api/properties/geo/radius`| Properties within radius of point    | JWT      |

### Search

| Method | Path                       | Description                         | Auth     |
|--------|----------------------------|-------------------------------------|----------|
| GET    | `/api/search`              | Meilisearch query                   | JWT      |
| GET    | `/api/search/natural`      | Natural language query               | JWT      |
| GET    | `/api/search/suggestions`  | Autocomplete suggestions             | JWT      |
| GET    | `/api/search/facets`       | Available facet values               | JWT      |

### Sites (Scraper Sources)

| Method | Path               | Description                   | Auth     |
|--------|--------------------|-------------------------------|----------|
| GET    | `/api/sites`       | List all sites                | JWT      |
| GET    | `/api/sites/:id`   | Get single site               | JWT      |
| POST   | `/api/sites`       | Create site config            | JWT+RBAC |
| PUT    | `/api/sites/:id`   | Update site config            | JWT+RBAC |
| DELETE | `/api/sites/:id`   | Delete site                   | JWT+RBAC |

### Scraping

| Method | Path                      | Description                      | Auth     |
|--------|---------------------------|----------------------------------|----------|
| POST   | `/api/scrape/start`       | Start a scrape job               | JWT+RBAC |
| GET    | `/api/scrape/jobs`        | List scrape jobs                 | JWT      |
| GET    | `/api/scrape/jobs/:id`    | Get job details                  | JWT      |
| POST   | `/api/scrape/jobs/:id/stop` | Stop a running job             | JWT+RBAC |
| GET    | `/api/scrape/logs`        | Get scrape logs (filtered)       | JWT      |
| GET    | `/api/scrape/logs/:id`    | Get logs for specific job        | JWT      |
| POST   | `/api/scrape/schedule`    | Schedule a scrape                | JWT+RBAC |

### Internal (Scraper Callbacks)

| Method | Path                              | Description                     | Auth          |
|--------|-----------------------------------|---------------------------------|---------------|
| POST   | `/api/internal/scrape-results`    | Receive scraped properties      | X-Internal-Key|
| POST   | `/api/internal/scrape-progress`   | Receive progress updates        | X-Internal-Key|
| POST   | `/api/internal/scrape-error`      | Receive error reports           | X-Internal-Key|
| POST   | `/api/internal/scrape/scheduled`  | Trigger scheduled scrape        | X-Internal-Key|

### Analytics

| Method | Path                        | Description                        | Auth     |
|--------|-----------------------------|------------------------------------|----------|
| GET    | `/api/analytics/overview`   | KPI summary (total, new, quality)  | JWT      |
| GET    | `/api/analytics/trends`     | Time-series property data          | JWT      |
| GET    | `/api/analytics/insights`   | Market insights and patterns       | JWT      |

### Market Intelligence

| Method | Path                          | Description                          | Auth     |
|--------|-------------------------------|--------------------------------------|----------|
| GET    | `/api/market/price-per-sqm`   | Price per sqm by area                | JWT      |
| GET    | `/api/market/rental-yield`    | Rental yield calculations            | JWT      |
| GET    | `/api/market/days-on-market`  | Days-on-market trends                | JWT      |
| GET    | `/api/market/comparables/:id` | Comparable properties                | JWT      |

### Users

| Method | Path               | Description                   | Auth     |
|--------|--------------------|-------------------------------|----------|
| GET    | `/api/users`       | List all users                | JWT+ADMIN|
| PUT    | `/api/users/:id`   | Update user role/status       | JWT+ADMIN|

### Saved Searches

| Method | Path                           | Description                    | Auth     |
|--------|--------------------------------|--------------------------------|----------|
| GET    | `/api/saved-searches`          | List user's saved searches     | JWT      |
| POST   | `/api/saved-searches`          | Create saved search            | JWT      |
| PUT    | `/api/saved-searches/:id`      | Update saved search            | JWT      |
| DELETE | `/api/saved-searches/:id`      | Delete saved search            | JWT      |

### Notifications

| Method | Path                               | Description                   | Auth     |
|--------|-------------------------------------|-------------------------------|----------|
| GET    | `/api/notifications`               | List user notifications        | JWT      |
| PUT    | `/api/notifications/:id/read`      | Mark as read                   | JWT      |
| PUT    | `/api/notifications/read-all`      | Mark all as read               | JWT      |

### Export

| Method | Path                   | Description                        | Auth     |
|--------|------------------------|------------------------------------|----------|
| GET    | `/api/export/csv`      | Export properties as CSV           | JWT      |
| GET    | `/api/export/xlsx`     | Export properties as XLSX          | JWT      |
| GET    | `/api/export/pdf`      | Export properties as PDF           | JWT      |

### Audit Logs

| Method | Path                | Description                       | Auth     |
|--------|---------------------|-----------------------------------|----------|
| GET    | `/api/audit-logs`   | List audit log entries (filtered) | JWT+ADMIN|

### System Settings

| Method | Path                     | Description                   | Auth     |
|--------|--------------------------|-------------------------------|----------|
| GET    | `/api/settings`          | Get all system settings       | JWT+ADMIN|
| PUT    | `/api/settings/:key`     | Update a system setting       | JWT+ADMIN|

### Backups

| Method | Path                  | Description                      | Auth     |
|--------|-----------------------|----------------------------------|----------|
| GET    | `/api/backups`        | List backups                     | JWT+ADMIN|
| POST   | `/api/backups`        | Create manual backup             | JWT+ADMIN|

## Prisma Schema Overview

The database schema contains 15 models and 11 enums.

### Core Models

| Model             | Purpose                                                     |
|-------------------|-------------------------------------------------------------|
| `User`            | Platform users with Supabase ID, roles, profile fields      |
| `Invitation`      | Invite code system (6-char code, 24h expiry, role assignment)|
| `Property`        | Central model: 85+ fields covering basic info, details, financials, location, amenities, media, agent info, metadata, tags |
| `PropertyVersion` | Immutable snapshots on every property mutation (change source, diff, changed fields) |
| `PriceHistory`    | Price change records over time                              |
| `Site`            | Scraper source configs (selectors, pagination, health score)|

### Scraping Models

| Model                | Purpose                                             |
|----------------------|-----------------------------------------------------|
| `ScrapeJob`          | Job tracking (type, status, site IDs, stats, timing)|
| `ScrapeLog`          | Per-job log entries (level, message, details)       |
| `CallbackDeadLetter` | Failed callback retry queue                         |

### Search and Notification Models

| Model             | Purpose                                               |
|-------------------|-------------------------------------------------------|
| `SavedSearch`     | User-saved search filters with notification prefs     |
| `SavedSearchMatch`| Properties matching saved searches                    |
| `Notification`    | In-app and email notifications                        |

### System Models

| Model           | Purpose                                                 |
|-----------------|---------------------------------------------------------|
| `AuditLog`      | User action audit trail (action, entity, IP, details)   |
| `SystemSetting` | Key-value app settings (categorized)                    |
| `PropertyFlag`  | Fraud flags (user-reported or system-detected)          |
| `SearchQuery`   | Zero-result search logging for scraper targeting        |

### Key Enums

`PropertyCategory` (Residential, Commercial, Land, Shortlet, Industrial), `ListingType` (Sale, Rent, Lease, Shortlet), `PropertyStatus` (Available, Sold, Rented, Under Offer, Withdrawn, Expired), `UserRole` (Admin, Pending Admin, Editor, Viewer, API User), `ScrapeJobType` (Passive Bulk, Active Intent, Rescrape, Scheduled).

## Services Architecture

The backend follows the Route -> Controller -> Service pattern:

| Service              | Responsibility                                             |
|----------------------|------------------------------------------------------------|
| `property.service`   | CRUD with automatic versioning, price history tracking     |
| `version.service`    | Diff computation, snapshot creation                        |
| `quality.service`    | Quality scoring (0-100) for property completeness          |
| `dedup.service`      | SHA256 exact dedup + fuzzy matching                        |
| `scrape.service`     | Job dispatch to Python scraper, result ingestion           |
| `search.service`     | Meilisearch integration, NL query parsing                  |
| `meili.service`      | Index config, sync, upsert, batch operations               |
| `analytics.service`  | KPI aggregation, trends, market insights                   |
| `market.service`     | Price/sqm, rental yield, days-on-market, comparables       |
| `savedSearch.service`| CRUD, match detection, new match notifications             |
| `notification.service`| Create, list, mark read, email dispatch                   |
| `email.service`      | Resend API + SMTP via Nodemailer                           |
| `export.service`     | CSV, XLSX (ExcelJS), PDF (PDFKit) generation               |
| `cron.service`       | Scheduled tasks (saved search checks, data retention, Meili re-index) |
| `geo.service`        | Bounding-box and radius queries                            |
| `backup.service`     | Database backup management                                 |

## Middleware Stack

Applied in order:

1. **Sentry** -- Error tracking initialization
2. **Helmet** -- Security headers (CSP, X-Content-Type-Options, etc.)
3. **CORS** -- Origin whitelist with credentials
4. **Rate Limiting** -- 300 req/15min (API), 10 req/hr (auth)
5. **Body Parser** -- JSON + URL-encoded (10MB limit)
6. **Mongo Sanitize** -- Strip `$` and `.` keys from input
7. **Compression** -- Gzip response compression
8. **Per-User Rate Limiting** -- JWT-based per-user limits
9. **CSRF Protection** -- Origin/Referer validation on mutations

Per-route middleware: `authenticate` (Supabase JWT), `authorize` (RBAC), `validate` (Zod schemas).

## Environment Variables

See the root README for the full list. Key variables:

```env
DATABASE_URL=postgresql://...
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
INTERNAL_API_KEY=your-secret-key
SCRAPER_URL=http://localhost:8000
MEILI_HOST=http://localhost:7700
MEILI_API_KEY=your-meili-key
CORS_ORIGIN=http://localhost:3000
SENTRY_DSN=https://xxx@sentry.io/xxx
RESEND_API_KEY=re_xxx
REDIS_URL=redis://localhost:6379
```

## Running Locally

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start dev server (port 5000, auto-reload via nodemon)
npm run dev

# Open Prisma Studio (database browser)
npx prisma studio
```

## Building for Production

```bash
npm run build          # Generates Prisma client + compiles TypeScript
npm start              # Runs compiled JS from dist/
```

## Testing

```bash
npm test               # Run all tests (Jest)
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

Tests are located in `src/__tests__/` and cover core services (property CRUD, versioning, deduplication).

## Socket.io Namespaces

| Namespace  | Purpose                                              |
|------------|------------------------------------------------------|
| `/scrape`  | Live scrape job progress, logs, and property feed    |
| `/notify`  | Real-time notification delivery                      |

Both namespaces require Supabase JWT authentication via the Socket.io auth middleware.

## API Documentation

Swagger UI is available at `/api-docs` when the server is running. OpenAPI spec is auto-generated from JSDoc annotations in route files.
