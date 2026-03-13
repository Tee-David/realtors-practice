# Realtors' Practice

Nigerian property intelligence platform. Scrapes, validates, enriches, and displays Nigerian real estate listings.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (new-york style), Radix UI
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, Socket.io
- **Scraper:** Python 3.11, Playwright, BeautifulSoup, Flask (separate microservice)
- **Database:** CockroachDB (PostgreSQL-compatible) via Prisma
- **Search:** Meilisearch (self-hosted)
- **Auth:** Supabase (free tier, auth only)
- **Deployment:** Vercel (frontend), Render (backend + scraper)
- **CI/CD:** GitHub Actions

## Design System

- Primary: `#0001FC` (electric blue) -> CSS var: `var(--primary)`
- Accent: `#FF6600` (orange) -> CSS var: `var(--accent)` — used for prices
- Success: `#0a6906` (green)
- Background: `#F7F7F7`, Cards: `#FFFFFF`
- Text dark: `#1A1A1A`, Text light: `#F7F7F7`
- Font display: Space Grotesk (class: `font-display`)
- Font body: Outfit (class: `font-body`)
- ALWAYS use CSS variables, not hardcoded Tailwind color classes

## Project Structure

```
/
├── backend/          # Node.js/Express API server
│   ├── prisma/       # Prisma schema + migrations
│   └── src/          # TypeScript source (routes, controllers, services, middlewares)
├── frontend/         # Next.js application
│   ├── app/          # App Router pages
│   ├── components/   # UI components (ui/, layout/, property/, search/, etc.)
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utilities (api, supabase, socket, map-providers)
│   ├── stores/       # Zustand stores
│   └── types/        # TypeScript interfaces
├── scraper/          # Python scraper microservice (Phase 3)
└── assets/           # Logo and favicon files
```

## Commands

### Backend
```bash
cd backend
npm run dev              # Start dev server (nodemon, port 5000)
npm run build            # Compile TypeScript
npm start                # Start production server
npx prisma generate      # Generate Prisma client
npx prisma db push       # Push schema to DB
npx prisma studio        # Open Prisma Studio
npx prisma migrate deploy # Run migrations
```

### Frontend
```bash
cd frontend
npm run dev              # Start dev server (turbopack, port 3000)
npm run build            # Production build
npm start                # Start production server
npx shadcn@latest add    # Add shadcn/ui components
```

## Conventions

### Code Style
- TypeScript strict mode everywhere
- Zod for all API request validation
- Prisma for all database operations (never raw SQL unless necessary)
- All API responses use standardized format: `{ success, data, error, message }`
- Use `cuid()` for all primary keys

### Backend Patterns
- Route files: `*.routes.ts` -> Controller: `*.controller.ts` -> Service: `*.service.ts`
- Middleware order: helmet -> cors -> body parser -> rate limit -> per-route auth/validation
- Service-to-service auth: `X-Internal-Key` header
- All property mutations create a `PropertyVersion` record

### Frontend Patterns
- Server state: TanStack Query (React Query) via custom hooks (`useProperties`, `useSearch`, etc.)
- Client state: Zustand stores (`ui.store.ts`, `map.store.ts`)
- URL state: Next.js `searchParams` for filters (shareable URLs)
- Real-time: Socket.io via `useSocket` hook
- All colors via CSS variables, never hardcoded

### Map Providers
- OSM (default, free), Mapbox, Google Maps — switchable via settings
- Use `MapProvider` interface abstraction in `lib/map-providers/`

## DO NOT TOUCH
- `login/`, `forgot-password/`, `admin-register/` pages (once built)
- `.env` file (contains secrets)

## Environment
- Frontend runs on `localhost:3000`
- Backend runs on `localhost:5000`
- Production frontend: `https://realtors-practice-new.vercel.app`
- Production API: `https://realtors-practice-new-api.onrender.com/api`
