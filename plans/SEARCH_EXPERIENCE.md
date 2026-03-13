# Interactive Search Experience — Implementation Research

> **Status**: Research only — not implementing yet.
> **Goal**: Airbnb/Zillow-grade map search with flyTo, staggered markers, price pills, and map-list sync.

---

## 1. Vision (from suggestions.md)

When a user types "3 bedroom flat under 5m in Lekki":
1. Map **flies** to Lekki with a smooth camera transition
2. Markers **stagger pop-in** one by one (live crawl effect)
3. Markers show **price pills** (₦5M) instead of generic pins
4. **Hovering** a property card highlights its marker, and vice versa

---

## 2. Existing Infrastructure

We already have:
- `components/map/osm-map.tsx` — OpenStreetMap base map
- `components/map/property-map.tsx` — Property markers
- `components/search/fullscreen-map.tsx` — Fullscreen search map
- `hooks/use-map-provider.ts` — Map provider abstraction
- `lib/map-providers/` — Map provider implementations

**Decision**: Use **Mapbox GL JS** via `react-map-gl` for production. Keep OSM as free fallback. Mapbox offers:
- `flyTo()` with configurable speed, curve, and zoom
- Custom HTML markers (needed for price pills + Framer Motion)
- Clustering for 1M+ properties
- Style switching (satellite/street/dark)

---

## 3. Technical Architecture

### 3.1 — FlyTo Geocoding Pipeline

```
User types query → NLP extracts location → Geocode API → map.flyTo()
```

| Step | Implementation |
|---|---|
| Query parsing | Extract area/state from search query (regex + fallback to Meilisearch facets) |
| Geocoding | Mapbox Geocoding API or pre-built Lagos coordinate lookup table |
| FlyTo execution | `mapRef.current.flyTo({ center: [lng, lat], zoom: 14, duration: 2000, essential: true })` |

**Lagos coordinate lookup table** (faster than API, free):
```typescript
const LAGOS_AREAS: Record<string, [number, number]> = {
  "lekki": [3.4746, 6.4394],
  "victoria island": [3.4226, 6.4281],
  "ikoyi": [3.4346, 6.4540],
  "ikeja": [3.3515, 6.5953],
  "ajah": [3.5852, 6.4676],
  "yaba": [3.3873, 6.5159],
  "surulere": [3.3570, 6.4947],
  "maryland": [3.3628, 6.5675],
  // ... 50+ more areas
};
```

This avoids API costs entirely at scale.

### 3.2 — Staggered Marker Animation (Live Crawl Effect)

**Approach**: Framer Motion `variants` + `staggerChildren` on an overlay layer.

```tsx
// Parent variant orchestrates stagger
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08, // 80ms between each marker pop-in
      delayChildren: 0.3,    // Start after flyTo settles
    },
  },
};

// Each marker pops in with scale + bounce
const markerVariants = {
  hidden: { scale: 0, opacity: 0, y: 20 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15,
    },
  },
};
```

**Key consideration**: Mapbox applies its own `transform` to marker positioning. Solution: wrap the visual content in an **inner div** that Framer Motion animates, not the marker container itself.

```tsx
<Marker longitude={lng} latitude={lat}>
  <motion.div variants={markerVariants}>
    <PricePill price={property.price} />
  </motion.div>
</Marker>
```

### 3.3 — Price Pill Markers

Instead of generic pins, show the price directly on the map.

```
┌────────────┐
│  ₦5.2M     │  ← Pill marker (white bg, shadow, rounded)
└──────┬─────┘
       ▼         ← Small triangle pointer
```

```tsx
function PricePill({ price, highlighted, listingType }: {
  price: number;
  highlighted: boolean;
  listingType: string;
}) {
  const color = listingType === "RENT" ? "#16a34a" : "#2563eb"; // Green for rent, blue for sale

  return (
    <div
      className={`
        px-2.5 py-1 rounded-full text-xs font-bold shadow-md whitespace-nowrap
        transition-all duration-200 cursor-pointer select-none
        ${highlighted ? "scale-125 z-50 ring-2 ring-offset-2" : "hover:scale-110"}
      `}
      style={{
        backgroundColor: highlighted ? color : "white",
        color: highlighted ? "white" : "var(--foreground)",
        borderColor: color,
        border: `1.5px solid ${color}`,
        ringColor: color,
      }}
    >
      {formatPrice(price)}
      <div
        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `5px solid ${highlighted ? color : "white"}`,
        }}
      />
    </div>
  );
}

function formatPrice(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n}`;
}
```

### 3.4 — Map ↔ List Synchronization

**State**: Lift `highlightedPropertyId` to the parent search page.

```tsx
const [highlightedId, setHighlightedId] = useState<string | null>(null);

// Property card → Map marker
<PropertyCard
  onMouseEnter={() => setHighlightedId(property.id)}
  onMouseLeave={() => setHighlightedId(null)}
/>

// Map marker → Property card
<PricePillMarker
  highlighted={highlightedId === property.id}
  onMouseEnter={() => setHighlightedId(property.id)}
  onMouseLeave={() => setHighlightedId(null)}
/>
```

When hovering a card:
- Marker **scales up** (1.25x) and changes to filled color
- Card gets a **subtle border glow** + slight elevation

When hovering a marker:
- Corresponding card **scrolls into view** (`scrollIntoView({ behavior: 'smooth', block: 'nearest' })`)
- Card gets highlighted border

### 3.5 — Search Flow (Full UX)

```
┌─────────────────────────────────────────────────────┐
│ 1. User types: "3 bed flat in Lekki under 5M"      │
│                                                      │
│ 2. Parse query → extract:                            │
│    { bedrooms: 3, area: "Lekki", maxPrice: 5000000 }│
│                                                      │
│ 3. Fetch from Meilisearch (instant) + PostgreSQL     │
│                                                      │
│ 4. map.flyTo(LAGOS_AREAS["lekki"], zoom: 14)         │
│    Duration: 2s, ease-in-out-cubic                   │
│                                                      │
│ 5. After flyTo settles (300ms delay):                │
│    → Markers start popping in one by one             │
│    → 80ms stagger between each (feels like live      │
│      crawling/discovery)                             │
│                                                      │
│ 6. Results list populates simultaneously with        │
│    stagger animation (Framer Motion)                 │
│                                                      │
│ 7. User can interact: hover cards ↔ markers          │
└─────────────────────────────────────────────────────┘
```

---

## 4. Performance at Scale (1M Properties)

| Challenge | Solution |
|---|---|
| Rendering 1M markers | Mapbox **Supercluster** — clusters at zoom < 14, individual pills at zoom ≥ 14 |
| Stagger 1000 markers | Cap visible markers at **100-200** in viewport. Stagger only visible ones |
| Hover sync with 10K cards | **Virtualized list** (`react-window` or `@tanstack/virtual`) — only renders visible cards |
| FlyTo + search speed | Pre-built coordinate lookup for Nigerian areas (no API call needed) |
| Mobile performance | Reduce marker complexity; use CSS-only pills (no shadow/rotation) |

### Clustering strategy:

```
Zoom ≤ 10:  Cluster circles with count: "247 properties"
Zoom 11-13: Cluster circles with price range: "₦2M - ₦45M"
Zoom ≥ 14:  Individual price pill markers
```

---

## 5. Libraries Needed

| Library | Purpose | Version | Size |
|---|---|---|---|
| `react-map-gl` | Mapbox GL React wrapper | ^7.x | ~50KB |
| `mapbox-gl` | Map rendering engine | ^3.x | ~250KB |
| `framer-motion` | Marker + list animations | ^11.x | Already installed |
| `supercluster` | Server-side marker clustering | ^8.x | ~8KB |
| `@tanstack/react-virtual` | Virtualized results list | ^3.x | ~12KB |

**Mapbox GL free tier**: 50K map loads/month (our scale: ~10K users × ~5 searches/day = ~50K/month ≈ free tier). Beyond that: $5 per 1K loads.

**Fallback**: Keep existing OSM map for when Mapbox quota is exceeded.

---

## 6. New Files Needed

```
frontend/
├── components/
│   ├── map/
│   │   ├── mapbox-map.tsx            # Mapbox GL wrapper with flyTo
│   │   ├── price-pill-marker.tsx     # Custom price pill component
│   │   ├── marker-cluster.tsx        # Supercluster integration
│   │   └── map-controls.tsx          # Zoom, style toggle, locate me
│   └── search/
│       ├── search-map-view.tsx       # Split view: list + map
│       ├── search-result-card.tsx    # Card with hover sync
│       └── live-crawl-overlay.tsx    # Stagger animation controller
├── hooks/
│   ├── use-flyto.ts                  # FlyTo with area geocoding
│   ├── use-marker-sync.ts           # Map ↔ list hover state
│   └── use-search-query-parser.ts   # NLP-lite query parsing
├── lib/
│   ├── lagos-coordinates.ts          # Pre-built area lookup table
│   └── cluster-config.ts            # Supercluster options
└── app/(dashboard)/
    └── search/
        └── page.tsx                  # Updated with new components
```

---

## 7. Implementation Priority

| Phase | Feature | Effort | Impact |
|---|---|---|---|
| **1** | Price pill markers (replace generic pins) | 1-2 days | 🔥🔥🔥 Biggest visual upgrade |
| **2** | Map ↔ list hover sync | 1 day | 🔥🔥🔥 Feels premium |
| **3** | FlyTo on search (with area lookup table) | 1 day | 🔥🔥 Smooth UX |
| **4** | Staggered marker pop-in animation | 1-2 days | 🔥🔥 "Wow" factor |
| **5** | Supercluster for zoom levels | 1 day | 🔥 Needed for scale |
| **6** | Virtualized results list | 0.5 day | Performance |
| **7** | Mobile optimized experience | 1 day | Polish |

**Total estimated effort: ~7-9 days**

---

## 8. Design Reference

### Airbnb's approach:
- White price pills with thin border, black text
- On hover: pill fills with dark color, text turns white
- Clustering at low zoom → individual at high zoom
- Split view: 50/50 list and map (desktop), full map toggle (mobile)

### Zillow's approach:
- Blue-themed price pills
- Map pins cluster into numbered circles
- Hover card → marker bounces subtly
- "Draw to search" polygon tool (future consideration)

### Our approach (blending both + Nigerian context):
- **Blue** pills for sale, **green** for rent (matches our brand)
- ₦ formatting with M/K suffixes
- Lagos-specific area recognition in query parser
- Naira-denominated clustering labels

---

*This document captures the research. Implementation will begin after Phase 6 completion and user approval.*
