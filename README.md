# Realtors' Practice

Nigerian real estate data aggregation platform. Scrapes property listings from Nigerian property websites, stores and enriches them, and provides search, analytics, and market intelligence through a modern dashboard.

## Architecture

```
                         +------------------+
                         |    Vercel CDN    |
                         |  (Frontend SSR)  |
                         +--------+---------+
                                  |
                         HTTPS / WebSocket
                                  |
+-------------------+    +--------+---------+    +-------------------+
|   Supabase Auth   |<-->|  Render (API)    |<-->| CockroachDB       |
|   (JWT tokens)    |    |  Express + Prisma|    | (PostgreSQL)      |
+-------------------+    |  Socket.io       |    +-------------------+
                         +----+--------+----+
                              |        |
                    HTTP callback   Meilisearch
                              |        (full-text)
                    +---------+--------+
                    |  Koyeb (Scraper)  |
                    |  FastAPI + Python  |
                    |  4-layer fetcher   |
                    +---------+---------+
                              |
                    +---------+---------+
                    |  Upstash Redis    |
                    |  (task queue,     |
                    |   selector cache) |
                    +-------------------+
```

**Data flow:** The backend dispatches scrape jobs to the Python scraper via HTTP. The scraper fetches pages using a 4-layer adaptive fetcher (curl_cffi, Scrapling, Crawl4AI+Gemini, Playwright), extracts property data, and reports results back to the backend via HTTP callbacks. The backend stores properties in CockroachDB, indexes them in Meilisearch, and pushes live updates to the frontend via Socket.io.

## Tech Stack

| Layer        | Technology                                                        |
|--------------|-------------------------------------------------------------------|
| Frontend     | Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui     |
| Backend API  | Node.js 18+, Express 4, TypeScript, Prisma ORM, Socket.io        |
| Scraper      | Python 3.11, FastAPI, Playwright, curl_cffi, Scrapling, Crawl4AI |
| Database     | CockroachDB (PostgreSQL-compatible) via Prisma                    |
| Search       | Meilisearch (self-hosted on Render)                               |
| Auth         | Supabase (JWT verification, Google OAuth)                         |
| Queue        | Celery + Redis (Upstash serverless)                               |
| Email        | Resend API + Nodemailer (SMTP fallback)                           |
| Monitoring   | Sentry (frontend + backend error tracking and profiling)          |
| CI/CD        | GitHub Actions (lint, type-check, build, auto-deploy)             |
| Deployment   | Vercel (frontend), Render (backend + Meilisearch), Koyeb (scraper)|

## Prerequisites

- Node.js >= 18.0.0, npm >= 9.0.0
- Python 3.11+
- PostgreSQL-compatible database (CockroachDB recommended)
- Redis instance (Upstash free tier or local)
- Meilisearch instance
- Supabase project (for authentication)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-org/realtors-practice.git
cd realtors-practice

# Backend
cd backend && npm install
npx prisma generate
npx prisma db push
cd ..

# Frontend
cd frontend && npm install
cd ..

# Scraper
cd scraper && pip install -r requirements.txt
playwright install chromium
cd ..
```

### 2. Configure environment

Copy the example values from the Environment Variables section below into:
- `backend/.env`
- `frontend/.env.local`
- `scraper/.env`

### 3. Run locally

```bash
# Terminal 1 -- Backend (port 5000)
cd backend && npm run dev

# Terminal 2 -- Frontend (port 3000)
cd frontend && npm run dev

# Terminal 3 -- Scraper (port 8000)
cd scraper && python app.py
```

The frontend is available at `http://localhost:3000`, the API at `http://localhost:5000`, and Swagger docs at `http://localhost:5000/api-docs`.

## Environment Variables

### Backend (`backend/.env`)

| Variable              | Description                          | Example                                      |
|-----------------------|--------------------------------------|----------------------------------------------|
| `DATABASE_URL`        | PostgreSQL/CockroachDB connection    | `postgresql://user:pass@host:26257/db?sslmode=verify-full` |
| `PORT`                | Server port                          | `5000`                                       |
| `NODE_ENV`            | Environment                          | `development`                                |
| `SUPABASE_URL`        | Supabase project URL                 | `https://xxx.supabase.co`                    |
| `SUPABASE_KEY`        | Supabase anon key                    | `eyJ...`                                     |
| `SUPABASE_SERVICE_KEY`| Supabase service role key            | `eyJ...`                                     |
| `INTERNAL_API_KEY`    | Shared key for scraper auth          | `your-secret-key`                            |
| `SCRAPER_URL`         | Scraper microservice URL             | `http://localhost:8000`                      |
| `MEILI_HOST`          | Meilisearch host                     | `http://localhost:7700`                      |
| `MEILI_API_KEY`       | Meilisearch admin API key            | `your-meili-key`                             |
| `CORS_ORIGIN`         | Allowed frontend origin              | `http://localhost:3000`                      |
| `SENTRY_DSN`          | Sentry DSN for error tracking        | `https://xxx@sentry.io/xxx`                  |
| `RESEND_API_KEY`      | Resend API key for email             | `re_xxx`                                     |
| `REDIS_URL`           | Redis URL for caching                | `redis://localhost:6379`                     |

### Frontend (`frontend/.env.local`)

| Variable                        | Description                  | Example                               |
|---------------------------------|------------------------------|---------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL         | `https://xxx.supabase.co`            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key            | `eyJ...`                             |
| `NEXT_PUBLIC_API_URL`           | Backend API URL              | `http://localhost:5000/api`          |
| `NEXT_PUBLIC_SOCKET_URL`        | Socket.io server URL         | `http://localhost:5000`              |
| `NEXT_PUBLIC_MAPBOX_TOKEN`      | Mapbox GL access token       | `pk.xxx` (optional)                  |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY`   | Google Maps API key          | `AIza...` (optional)                 |
| `SENTRY_DSN`                    | Sentry DSN                   | `https://xxx@sentry.io/xxx`         |

### Scraper (`scraper/.env`)

| Variable            | Description                         | Example                                |
|---------------------|-------------------------------------|----------------------------------------|
| `API_BASE_URL`      | Backend API callback URL            | `http://localhost:5000/api`            |
| `INTERNAL_API_KEY`  | Shared key matching backend         | `your-secret-key`                      |
| `REDIS_URL`         | Redis for task queue / caching      | `redis://localhost:6379/0`             |
| `PROXY_LIST`        | Comma-separated proxy URLs          | `http://user:pass@proxy1:port,...`     |
| `GEMINI_API_KEY`    | Google Gemini API key (LLM fallback)| `AIza...`                              |

## Deployment

### Frontend -- Vercel

Auto-deploys on push to `main` via Vercel GitHub integration. Framework preset: Next.js.

### Backend -- Render

Deployed as a Web Service on Render. Build command:

```bash
npm install && npx prisma generate && npx prisma db push && npm run build
```

Start command: `node dist/server.js`

### Scraper -- Koyeb

Deployed as a Docker service on Koyeb using `scraper/Dockerfile`. Base image: `mcr.microsoft.com/playwright/python:v1.52.0-jammy`. Runs a FastAPI web worker.

### CI/CD Pipelines

| Workflow                | Trigger                    | What it does                                      |
|-------------------------|----------------------------|---------------------------------------------------|
| `ci.yml`                | Push/PR to `main`/`staging`| Type-check and build backend + frontend            |
| `cd.yml`                | Push to `main`             | Trigger Render and Vercel deploy hooks             |
| `scrape_cron.yml`       | Daily 01:00 UTC + manual   | Trigger scheduled bulk scrape via backend API      |

## Project Structure

```
realtors-practice/
├── backend/                 # Express API server
│   ├── prisma/              #   Prisma schema (15 models, 11 enums, 85+ property fields)
│   └── src/
│       ├── config/          #   Environment config, Swagger setup
│       ├── controllers/     #   Request handlers (18 controllers)
│       ├── middlewares/      #   Auth, RBAC, validation, rate limiting, CSRF
│       ├── routes/          #   18 route modules
│       ├── services/        #   Business logic (property, scrape, search, analytics, market, ...)
│       └── utils/           #   Prisma client, Supabase, Meilisearch, logger
├── frontend/                # Next.js 15 application
│   ├── app/                 #   App Router (auth + dashboard layouts, 11+ pages)
│   ├── components/          #   60+ UI components (property, search, map, layout, ui)
│   ├── hooks/               #   17 custom React hooks
│   ├── lib/                 #   API client, map providers, Lagos coordinates, utilities
│   └── types/               #   TypeScript interfaces
├── scraper/                 # Python scraper microservice
│   ├── engine/              #   4-layer adaptive fetcher, Scrapling, Crawl4AI, pagination
│   ├── extractors/          #   Universal extractor, JSON-LD, NLP, LLM schema extractor
│   ├── pipeline/            #   Validator, deduplicator, normalizer, enricher, page classifier
│   └── utils/               #   Callbacks, rate limiter, URL normalizer, user agents
├── .github/workflows/       # CI/CD pipelines (ci, cd, scrape_cron)
├── docs/                    # Additional documentation and specs
└── CHECKLIST.md             # Full feature tracking (430+ tasks)
```

## Design System

| Token               | Value                    | CSS Variable            |
|----------------------|--------------------------|-------------------------|
| Primary              | `#0001FC` (electric blue)| `var(--primary)`        |
| Accent               | `#FF6600` (orange)       | `var(--accent)`         |
| Success              | `#0a6906` (green)        | `var(--success)`        |
| Font (display)       | Space Grotesk            | `.font-display`         |
| Font (body)          | Outfit                   | `.font-body`            |

Full dark mode support via CSS variables and `next-themes`. All colors are referenced through CSS custom properties, never hardcoded Tailwind classes.

## License

Proprietary. All rights reserved.
