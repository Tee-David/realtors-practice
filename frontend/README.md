# Frontend Application

Next.js 15 dashboard application for the Realtors' Practice platform. Provides property browsing with interactive maps, natural language search, scraper management, analytics, market intelligence, and administrative tools.

## Tech Stack

| Component        | Technology                                             |
|------------------|--------------------------------------------------------|
| Framework        | Next.js 15 (App Router, Turbopack)                     |
| Language         | TypeScript (strict)                                    |
| Styling          | Tailwind CSS v4, CSS custom properties                 |
| UI Library       | shadcn/ui (new-york style) + Radix UI primitives       |
| Animation        | Framer Motion / Motion, GSAP                           |
| Charts           | Recharts                                               |
| Maps             | Leaflet (OSM), MapLibre GL, Mapbox GL, Google Maps     |
| 3D / WebGL       | Three.js, React Three Fiber, React Three Rapier        |
| State (server)   | TanStack React Query v5                                |
| State (client)   | Zustand 5                                              |
| Real-time        | Socket.io Client                                       |
| Auth             | Supabase (with Google OAuth)                           |
| Forms            | React Hook Form + Zod validation                       |
| Tour             | Shepherd.js (guided product walkthrough)               |
| Monitoring       | Sentry (error boundary + performance)                  |
| Testing          | Vitest                                                 |

## Pages and Routes

All dashboard pages live under `app/(dashboard)/` and share a common layout with a hover-to-expand sidebar, top bar, and mobile bottom navigation.

| Route                       | Page                  | Description                                         |
|-----------------------------|-----------------------|-----------------------------------------------------|
| `/`                         | Dashboard             | Globe hero, KPI cards, category chart, status donut, explore section |
| `/properties`               | Properties            | Grid/list/map split view, filters, detail side-sheet |
| `/properties/[id]`          | Property Detail       | Image gallery, full info, versions, price chart, comparables |
| `/properties/compare`       | Compare               | Side-by-side property comparison table              |
| `/search`                   | Search                | NL search bar, map with price pill markers, bottom sheet results, clustering |
| `/data-explorer`            | Data Explorer         | Tabbed table (All/Raw/Enriched/Flagged), bulk actions, inspection |
| `/scraper`                  | Scraper Control       | Start scrape, config sheet, live progress, property feed |
| `/scraper/sites`            | Site Management       | Site cards, enable/disable, edit selectors, bulk import |
| `/analytics`                | Analytics             | KPI hero, time-series chart, area/site leaderboards, heatmap, ledger |
| `/market`                   | Market Intelligence   | Price/sqm trends, rental yield, days-on-market charts |
| `/saved-searches`           | Saved Searches        | Create/edit searches with filters, view matches     |
| `/audit-log`                | Audit Log             | Filterable log table with expandable detail rows    |
| `/settings`                 | Settings              | 9-tab settings: Profile, Security, Notifications, Appearance, Data, Email, Backups, About, Users |
| `/privacy`                  | Privacy Policy        | Legal privacy policy page                           |
| `/login`                    | Login                 | Split layout with Supabase auth, Google OAuth       |
| `/forgot-password`          | Forgot Password       | Password reset flow                                 |
| `/admin-register`           | Admin Register        | 2-step invite code flow (enter code, create account)|

## Component Library

Components are organized by domain:

```
components/
├── layout/              # AppSidebar, MobileSidebar, TopBar, MobileBottomNav
├── property/            # PropertyCard, PropertyGrid, PropertyListCard,
│                        # PropertyDetailPanel, FilterSidebar, CategoryPills,
│                        # VersionDiffViewer, PropertyCompare
├── search/              # SearchBar, SearchResultCard, SearchMapView,
│                        # LiveCrawlOverlay, PricePillMarker, MarkerCluster
├── map/                 # PropertyMap, MapControls, DrawToSearch
├── ui/                  # 40+ shadcn/ui components: Button, Dialog, Card,
│                        # Tabs, Select, DateTimePicker, ModernLoader,
│                        # ThemeSwitch, TourProvider, TourSelectorModal,
│                        # KeyboardShortcutsModal, GlobeHero, Lanyard,
│                        # ProfileCard, BentoGrid, AdvancedDateRangePicker
├── dashboard/           # KPI cards, category chart, status donut, explore
├── scraper/             # ScrapeConfig, JobProgress, LiveLogs, SiteCard
├── analytics/           # AnalyticsHero, TimeSeriesChart, Leaderboard, Heatmap
└── settings/            # Profile, Security, Notifications, Appearance, etc.
```

## Custom Hooks

| Hook                      | Purpose                                             |
|---------------------------|-----------------------------------------------------|
| `useProperties`           | Property list with pagination, filtering (TanStack Query) |
| `useSearch`               | Search queries with NL parsing, facets              |
| `useSearchQueryParser`    | Client-side NLP query parsing (bedrooms, price, location) |
| `useScrapeJobs`           | Scrape job list and status polling                  |
| `useScrapeLogs`           | Scrape log fetching with filters                    |
| `useSites`                | Site CRUD operations                                |
| `useSavedSearches`        | Saved search CRUD                                   |
| `useNotifications`        | Real-time notification feed                         |
| `useAnalytics`            | Analytics data fetching                             |
| `useMarket`               | Market intelligence data                            |
| `useSocket`               | Socket.io connection management                     |
| `useMapProvider`          | Active map provider selection                       |
| `useFlyTo`                | Map camera transitions with Lagos area geocoding    |
| `useMarkerSync`           | Map marker and list card hover synchronization      |
| `useGeocode`              | Geocoding operations                                |
| `useKeyboardShortcuts`    | Global keyboard shortcuts (Cmd+K search, Cmd+/ help)|
| `usePersistedState`       | localStorage-backed state                           |

## Map Providers

The map system uses a provider abstraction (`lib/map-providers/types.ts`) allowing runtime switching between three providers:

| Provider    | Library            | Free Tier        | Features                    |
|-------------|--------------------|------------------|-----------------------------|
| OSM         | react-leaflet      | Unlimited        | Default, Nominatim geocoding|
| Mapbox      | react-map-gl       | 50K loads/month  | FlyTo, vector tiles         |
| Google Maps | @react-google-maps | $200/month credit| Places API, Street View     |

Users switch providers in Settings > Data & Display. Map-specific components (price pill markers, clustering via Supercluster, draw-to-search) work across all providers.

## Theming

Dark mode is fully supported through CSS custom properties and `next-themes`:

| Token               | Light                | Dark                  | Variable             |
|----------------------|----------------------|-----------------------|----------------------|
| Background           | `#F7F7F7`           | `#0A0A0A`            | `--background`       |
| Card                 | `#FFFFFF`           | `#1A1A1A`            | `--card`             |
| Primary              | `#0001FC`           | `#0001FC`            | `--primary`          |
| Accent               | `#FF6600`           | `#FF6600`            | `--accent`           |
| Text                 | `#1A1A1A`           | `#F7F7F7`            | `--foreground`       |

Fonts: Space Grotesk (display/headings, class `font-display`), Outfit (body, class `font-body`).

All components use `var(--token)` references and inline `style` props rather than Tailwind color classes to ensure theme consistency.

## PWA Support

The app includes a `manifest.json` and service worker for progressive web app capabilities:
- Installable on mobile and desktop
- App install prompt for mobile users
- Offline-capable for previously visited pages

## Keyboard Shortcuts

| Shortcut       | Action                     |
|----------------|----------------------------|
| `Cmd/Ctrl + K` | Focus search bar           |
| `Cmd/Ctrl + /` | Toggle shortcuts help modal|

## Building and Deploying

```bash
# Development (Turbopack, port 3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Bundle analysis
npm run analyze

# Run tests
npm test
npm run test:watch
npm run test:coverage
```

### Deployment (Vercel)

The frontend auto-deploys to Vercel on push to `main`. Required environment variables must be configured in the Vercel project settings (see root README).

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx          # Optional, for Mapbox provider
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...      # Optional, for Google Maps provider
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Performance Optimizations

- Heavy components lazy-loaded via `next/dynamic` (globe, maps, charts, Three.js, tour)
- TanStack Query caching with tuned `staleTime` and `gcTime`
- Supercluster for map marker clustering at scale
- Error boundaries per page for crash isolation
- Bundle analysis via `@next/bundle-analyzer`
- Image optimization via Next.js `<Image>`
