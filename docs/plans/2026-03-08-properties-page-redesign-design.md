# Properties Page Redesign — Design Document

## Context

The current properties page has a filter sidebar + card grid layout. The redesign transforms it into a modern split-view with grid+map, side-sheet panels for filters and property detail, and multiple view modes (grid, list). Inspired by Perum and Realys reference designs.

## Layout

### Desktop (default: Grid + Map)

```
┌──────────────────────────────────────────────────────────────────┐
│ Category pills: [All] [Residential] [Commercial] [Land] ...     │
│                                                                  │
│ 🔍 Search properties...           Sort: Newest ▾  [⊞][≡] [Filter]│
│ "649 properties found"                                           │
├────────────────────────────────────┬─────────────────────────────┤
│  Property Cards (scrollable)       │  Leaflet/OSM Map (sticky)   │
│  Grid: 2-3 cols ~60% width        │  ~40% width                 │
│  List: horizontal rows             │  Price markers on pins      │
│                                    │  Hover card = highlight pin │
│  Pagination at bottom              │  Click pin = open detail    │
├────────────────────────────────────┴─────────────────────────────┤
│ LEFT SIDE-SHEET: Filters         RIGHT SIDE-SHEET: Detail Preview│
└──────────────────────────────────────────────────────────────────┘
```

### Mobile

- Cards stack full-width, single column
- Map hidden by default, toggle button to show (full-width overlay)
- Bottom-sheet for filters (using @scrollxui/top-sheet as bottom sheet)
- Bottom-sheet or full-screen for property detail preview

## Components

### 1. Top Bar (`properties/page.tsx`)
- **Category pills**: Horizontal scrollable pills — All, Residential, Commercial, Land, Shortlet, Industrial. Active pill uses `var(--primary)`.
- **Search input**: Inline search with icon, rounded, `var(--secondary)` bg.
- **Sort dropdown**: "Sort by: Newest" with chevron.
- **View toggle**: Grid / List icons. Active view highlighted.
- **Filter button**: Opens left side-sheet. Shows badge count of active filters.

### 2. Property Card — Grid View (`property-card.tsx` — refine existing)
- Keep current card design (image with gradient overlay, category accent, star rating, listing badge, price, bed/bath/sqm footer)
- Ensure click opens right side-sheet detail panel instead of navigating

### 3. Property Card — List View (`property-list-card.tsx` — new)
- Horizontal layout: image thumbnail left (~150px), details right
- Title, location, bed/bath/sqm inline, price prominent
- More compact than grid card, like the first reference (Realys) screenshot
- Click opens right side-sheet

### 4. Property Map (`property-map.tsx` — new)
- react-leaflet with OpenStreetMap tiles
- Markers at property lat/lng with price label tooltips
- Highlighted marker state when hovering corresponding card
- Click marker opens right side-sheet detail
- Zoom controls (+/-)
- Sticky positioning so map stays visible while scrolling cards

### 5. Filter Side-Sheet (`property-filter-sheet.tsx` — new, wraps existing filters)
- Slides from left using `@scrollxui/side-sheet`
- Contains all existing filter sections: listing type, category, price range, bedrooms, area
- "Clear all" + "Apply" buttons at bottom
- Active filter count badge on trigger button

### 6. Property Detail Panel (`property-detail-panel.tsx` — new)
- Slides from right using `@scrollxui/side-sheet`
- Content: image carousel/gallery, title, price, location, bed/bath/sqm, description excerpt, features list, agent info
- "Open full page" button → navigates to `/properties/[id]`
- Close button (X)

### 7. Mobile Bottom Sheet (`property-mobile-sheets.tsx` — new)
- Uses `@scrollxui/top-sheet` configured as bottom sheet
- For filters on mobile
- For detail preview on mobile (or full-screen takeover)

## State Management

- **View mode**: `useState<'grid' | 'list'>('grid')` in page
- **Selected property**: `useState<string | null>(null)` — controls right side-sheet
- **Filter sheet open**: `useState<boolean>(false)` — controls left side-sheet
- **Hovered property**: `useState<string | null>(null)` — for map marker highlight
- **Filters**: existing `useState<PropertyFilters>` — unchanged

## Data Flow

1. Category pills + filters → update `PropertyFilters` → `useProperties(filters)` fetches
2. Card hover → set `hoveredPropertyId` → map highlights marker
3. Card click / marker click → set `selectedPropertyId` → right side-sheet opens with property data
4. Detail panel "Open full page" → `router.push(/properties/[id])`

## New Dependencies

- `react-leaflet` + `leaflet` + `@types/leaflet` — OSM map
- `@scrollxui/side-sheet` — left/right sliding panels
- `@scrollxui/top-sheet` — mobile bottom sheet

## Files

| File | Action |
|------|--------|
| `frontend/app/(dashboard)/properties/page.tsx` | Rewrite |
| `frontend/components/property/property-card.tsx` | Modify (click → side-sheet) |
| `frontend/components/property/property-list-card.tsx` | Create |
| `frontend/components/property/property-map.tsx` | Create |
| `frontend/components/property/property-detail-panel.tsx` | Create |
| `frontend/components/property/property-filter-sheet.tsx` | Create |
| `frontend/components/property/category-pills.tsx` | Create |
| `frontend/components/property/property-mobile-sheets.tsx` | Create |
| `frontend/components/property/property-filters.tsx` | Keep as-is (reused inside sheet) |
| `frontend/components/property/property-grid.tsx` | Keep as-is |
| `frontend/components/property/pagination.tsx` | Keep as-is |

## Verification

- Grid + Map displays correctly side by side on desktop
- Category pills filter properties
- Filter button opens left side-sheet, applying filters works
- Click card opens right side-sheet with property detail
- "Open full page" navigates to `/properties/[id]`
- Hover card highlights map marker
- Click map marker opens detail panel
- List view shows horizontal cards
- Mobile: full-width cards, bottom sheet filters, map toggle
