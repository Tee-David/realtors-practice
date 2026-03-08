# Properties Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the properties page with a grid+map split layout, side-sheet panels for filters (left) and detail preview (right), category pills, view toggle (grid/list), and mobile bottom-sheet support.

**Architecture:** Split-view page with ~60% scrollable property cards (grid or list) and ~40% sticky Leaflet/OSM map. Filters live in a left SideSheet, property detail preview in a right SideSheet. State managed with useState in the page component. Existing `useProperties` hook and API client unchanged.

**Tech Stack:** Next.js 15, React 19, react-leaflet + leaflet (OSM map), @scrollxui/side-sheet, @scrollxui/top-sheet, Tailwind CSS v4, CSS variables per CLAUDE.md design system.

---

## Task 1: Install Dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install react-leaflet and leaflet**

```bash
cd frontend
npm install react-leaflet leaflet
npm install -D @types/leaflet
```

**Step 2: Install ScrollXUI side-sheet and top-sheet**

```bash
npx shadcn@latest add @scrollxui/side-sheet
npx shadcn@latest add @scrollxui/top-sheet
```

**Step 3: Verify installation**

Check that these files exist:
- `frontend/components/ui/side-sheet.tsx`
- `frontend/components/ui/top-sheet.tsx`
- `frontend/node_modules/leaflet/dist/leaflet.css`

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/components/ui/side-sheet.tsx frontend/components/ui/top-sheet.tsx
git commit -m "feat: install react-leaflet, scrollxui side-sheet and top-sheet"
```

---

## Task 2: Create Category Pills Component

**Files:**
- Create: `frontend/components/property/category-pills.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Home, Building2, Trees, Sunset, Factory } from "lucide-react";
import type { PropertyCategory } from "@/types/property";

interface CategoryPillsProps {
  value?: PropertyCategory;
  onChange: (category: PropertyCategory | undefined) => void;
}

const CATEGORIES: { value: PropertyCategory | "ALL"; label: string; icon: React.ElementType }[] = [
  { value: "ALL", label: "All", icon: Home },
  { value: "RESIDENTIAL", label: "Residential", icon: Home },
  { value: "COMMERCIAL", label: "Commercial", icon: Building2 },
  { value: "LAND", label: "Land", icon: Trees },
  { value: "SHORTLET", label: "Shortlet", icon: Sunset },
  { value: "INDUSTRIAL", label: "Industrial", icon: Factory },
];

export function CategoryPills({ value, onChange }: CategoryPillsProps) {
  const active = value || "ALL";

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {CATEGORIES.map((cat) => {
        const isActive = active === cat.value;
        const Icon = cat.icon;
        return (
          <button
            key={cat.value}
            onClick={() => onChange(cat.value === "ALL" ? undefined : cat.value as PropertyCategory)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
              isActive
                ? "border-transparent"
                : "border-[var(--border)] hover:border-[var(--primary)]"
            )}
            style={{
              backgroundColor: isActive ? "var(--primary)" : "var(--card)",
              color: isActive ? "var(--primary-foreground)" : "var(--foreground)",
            }}
          >
            <Icon size={16} />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: Verify it renders**

Import into properties page temporarily and confirm pills render at `http://localhost:3000/properties`.

**Step 3: Commit**

```bash
git add frontend/components/property/category-pills.tsx
git commit -m "feat: add category pills component for properties page"
```

---

## Task 3: Create Property List Card (Horizontal View)

**Files:**
- Create: `frontend/components/property/property-list-card.tsx`

**Step 1: Create the horizontal card component**

```tsx
"use client";

import { MapPin, BedDouble, Bath, Maximize2, Heart } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Property } from "@/types/property";

const LISTING_LABELS: Record<string, string> = {
  SALE: "For Sale",
  RENT: "For Rent",
  LEASE: "Lease",
  SHORTLET: "Shortlet",
};

interface PropertyListCardProps {
  property: Property;
  isActive?: boolean;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
}

export function PropertyListCard({ property, isActive, onHover, onClick }: PropertyListCardProps) {
  const {
    id, title, listingType, price, rentFrequency,
    bedrooms, bathrooms, area, state, locationText, images,
  } = property;

  const imageUrl = Array.isArray(images) && images.length > 0 ? images[0] : "/placeholder-property.jpg";
  const location = locationText || [area, state].filter(Boolean).join(", ") || "Lagos, Nigeria";

  return (
    <div
      className="flex gap-4 rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md"
      style={{
        backgroundColor: "var(--card)",
        border: isActive ? "2px solid var(--primary)" : "1px solid var(--border)",
      }}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(id)}
    >
      {/* Image */}
      <div className="relative w-[180px] shrink-0">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <span
          className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white"
          style={{ backgroundColor: "var(--primary)" }}
        >
          {LISTING_LABELS[listingType] || listingType}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 py-3 pr-4 flex flex-col justify-between min-w-0">
        <div>
          <h3
            className="font-display font-semibold text-sm leading-snug line-clamp-1"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h3>
          <div className="flex items-center gap-1 mt-1">
            <MapPin size={12} style={{ color: "var(--muted-foreground)" }} />
            <span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
              {location}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {bedrooms != null && (
            <span className="flex items-center gap-1">
              <BedDouble size={13} /> {bedrooms} Bed
            </span>
          )}
          {bathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath size={13} /> {bathrooms} Bath
            </span>
          )}
          {(property.landSizeSqm || property.buildingSizeSqm) && (
            <span className="flex items-center gap-1">
              <Maximize2 size={12} /> {Math.round(property.landSizeSqm || property.buildingSizeSqm || 0)} sqm
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="font-display font-bold text-base" style={{ color: "var(--accent)" }}>
            {formatPrice(price)}
            {rentFrequency && (
              <span className="text-xs font-normal ml-1" style={{ color: "var(--muted-foreground)" }}>
                /{rentFrequency}
              </span>
            )}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Heart size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/components/property/property-list-card.tsx
git commit -m "feat: add horizontal property list card component"
```

---

## Task 4: Create Property Map Component

**Files:**
- Create: `frontend/components/property/property-map.tsx`

**Step 1: Create the map component**

This component uses react-leaflet with OSM tiles. It must be dynamically imported (no SSR) since Leaflet requires `window`.

```tsx
"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatPrice } from "@/lib/utils";
import type { Property } from "@/types/property";

// Fix default marker icons in webpack/next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function createPriceIcon(price: number | undefined, isHighlighted: boolean) {
  const label = price ? formatPrice(price) : "N/A";
  return L.divIcon({
    className: "custom-price-marker",
    html: `<div style="
      background: ${isHighlighted ? "var(--primary)" : "var(--card)"};
      color: ${isHighlighted ? "#fff" : "var(--foreground)"};
      border: 2px solid ${isHighlighted ? "var(--primary)" : "var(--border)"};
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      font-family: var(--font-space-grotesk), sans-serif;
    ">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [40, 20],
  });
}

function FitBounds({ properties }: { properties: Property[] }) {
  const map = useMap();
  useEffect(() => {
    const coords = properties
      .filter((p) => p.latitude && p.longitude)
      .map((p) => [p.latitude!, p.longitude!] as [number, number]);
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 });
    }
  }, [properties, map]);
  return null;
}

interface PropertyMapProps {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
}

export function PropertyMap({ properties, hoveredId, onMarkerClick }: PropertyMapProps) {
  const geoProperties = properties.filter((p) => p.latitude && p.longitude);

  // Default center: Lagos
  const defaultCenter: [number, number] = [6.5244, 3.3792];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      className="w-full h-full rounded-xl"
      style={{ minHeight: "400px" }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds properties={geoProperties} />
      {geoProperties.map((property) => (
        <Marker
          key={property.id}
          position={[property.latitude!, property.longitude!]}
          icon={createPriceIcon(property.price, hoveredId === property.id)}
          eventHandlers={{
            click: () => onMarkerClick(property.id),
          }}
        >
          <Popup>
            <div style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
              <p className="font-semibold text-sm">{property.title}</p>
              <p className="text-xs" style={{ color: "var(--accent)" }}>{formatPrice(property.price)}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

**Step 2: Create dynamic import wrapper**

Since Leaflet needs `window`, create a wrapper for Next.js dynamic import.

Create `frontend/components/property/property-map-dynamic.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/types/property";

const PropertyMap = dynamic(
  () => import("./property-map").then((mod) => ({ default: mod.PropertyMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full rounded-xl flex items-center justify-center"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
      </div>
    ),
  }
);

interface Props {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
}

export function DynamicPropertyMap(props: Props) {
  return <PropertyMap {...props} />;
}
```

**Step 3: Commit**

```bash
git add frontend/components/property/property-map.tsx frontend/components/property/property-map-dynamic.tsx
git commit -m "feat: add Leaflet/OSM property map with price markers"
```

---

## Task 5: Create Property Detail Panel

**Files:**
- Create: `frontend/components/property/property-detail-panel.tsx`

**Step 1: Create the detail panel content**

This is the content that goes inside the right SideSheet when a property is selected.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { MapPin, BedDouble, Bath, Maximize2, Phone, Mail, User, ExternalLink, Star } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Property } from "@/types/property";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  AVAILABLE: { bg: "#dcfce7", color: "#166534" },
  SOLD: { bg: "#fee2e2", color: "#991b1b" },
  RENTED: { bg: "#dbeafe", color: "#1e40af" },
  UNDER_OFFER: { bg: "#fef3c7", color: "#92400e" },
  WITHDRAWN: { bg: "#f3f4f6", color: "#374151" },
  EXPIRED: { bg: "#f3f4f6", color: "#6b7280" },
};

interface PropertyDetailPanelProps {
  property: Property;
}

export function PropertyDetailPanel({ property }: PropertyDetailPanelProps) {
  const router = useRouter();
  const images = Array.isArray(property.images) ? property.images : [];
  const location = property.locationText || [property.area, property.lga, property.state].filter(Boolean).join(", ");
  const statusStyle = STATUS_STYLES[property.status] || STATUS_STYLES.AVAILABLE;

  return (
    <div className="space-y-5">
      {/* Image gallery */}
      {images.length > 0 && (
        <div className="relative rounded-xl overflow-hidden aspect-[16/10]">
          <img src={images[0]} alt={property.title} className="w-full h-full object-cover" />
          {images.length > 1 && (
            <div
              className="absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-medium"
              style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
            >
              1/{images.length}
            </div>
          )}
        </div>
      )}

      {/* Title + status */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display font-bold text-lg leading-snug" style={{ color: "var(--foreground)" }}>
            {property.title}
          </h2>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
          >
            {property.status.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <MapPin size={13} style={{ color: "var(--muted-foreground)" }} />
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{location}</span>
        </div>
      </div>

      {/* Price */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--secondary)" }}>
        <span className="font-display font-bold text-2xl" style={{ color: "var(--accent)" }}>
          {formatPrice(property.price)}
        </span>
        {property.rentFrequency && (
          <span className="text-sm ml-1" style={{ color: "var(--muted-foreground)" }}>/{property.rentFrequency}</span>
        )}
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-3">
        {property.bedrooms != null && (
          <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--secondary)" }}>
            <BedDouble size={18} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
            <p className="font-display font-bold" style={{ color: "var(--foreground)" }}>{property.bedrooms}</p>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Beds</p>
          </div>
        )}
        {property.bathrooms != null && (
          <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--secondary)" }}>
            <Bath size={18} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
            <p className="font-display font-bold" style={{ color: "var(--foreground)" }}>{property.bathrooms}</p>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Baths</p>
          </div>
        )}
        {(property.landSizeSqm || property.buildingSizeSqm) && (
          <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--secondary)" }}>
            <Maximize2 size={18} className="mx-auto mb-1" style={{ color: "var(--primary)" }} />
            <p className="font-display font-bold" style={{ color: "var(--foreground)" }}>
              {Math.round(property.landSizeSqm || property.buildingSizeSqm || 0)}
            </p>
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Sqm</p>
          </div>
        )}
      </div>

      {/* Description excerpt */}
      {property.description && (
        <div>
          <h3 className="font-display font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>Description</h3>
          <p className="text-sm leading-relaxed line-clamp-4" style={{ color: "var(--muted-foreground)" }}>
            {property.description}
          </p>
        </div>
      )}

      {/* Features */}
      {property.features.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-sm mb-2" style={{ color: "var(--foreground)" }}>Features</h3>
          <div className="flex flex-wrap gap-1.5">
            {property.features.slice(0, 8).map((f: string) => (
              <span
                key={f}
                className="px-2.5 py-1 rounded-lg text-xs"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agent info */}
      {(property.agentName || property.agencyName) && (
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--secondary)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--card)" }}>
              <User size={18} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{property.agentName}</p>
              {property.agencyName && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{property.agencyName}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {property.agentPhone && (
              <a href={`tel:${property.agentPhone}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: "var(--primary)" }}>
                <Phone size={12} /> Call
              </a>
            )}
            {property.agentEmail && (
              <a href={`mailto:${property.agentEmail}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}>
                <Mail size={12} /> Email
              </a>
            )}
          </div>
        </div>
      )}

      {/* Open full page + original listing buttons */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => router.push(`/properties/${property.id}`)}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white text-center"
          style={{ backgroundColor: "var(--primary)" }}
        >
          Open Full Page
        </button>
        {property.listingUrl && (
          <a
            href={property.listingUrl}
            target="_blank"
            rel="noopener"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
          >
            <ExternalLink size={14} /> Source
          </a>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/components/property/property-detail-panel.tsx
git commit -m "feat: add property detail panel for right side-sheet"
```

---

## Task 6: Create Filter Sheet Wrapper

**Files:**
- Create: `frontend/components/property/property-filter-sheet.tsx`

**Step 1: Wrap existing filters in a SideSheet**

```tsx
"use client";

import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetTitle,
  SideSheetFooter,
  SideSheetClose,
} from "@/components/ui/side-sheet";
import { PropertyFilterSidebar } from "./property-filters";
import type { PropertyFilters } from "@/types/property";

interface PropertyFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PropertyFilters;
  onChange: (filters: PropertyFilters) => void;
  total?: number;
}

export function PropertyFilterSheet({ open, onOpenChange, filters, onChange, total }: PropertyFilterSheetProps) {
  return (
    <SideSheet open={open} onOpenChange={onOpenChange} side="left" width="340px">
      <SideSheetContent>
        <SideSheetHeader>
          <SideSheetTitle>Filters</SideSheetTitle>
        </SideSheetHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <PropertyFilterSidebar filters={filters} onChange={onChange} total={total} />
        </div>
        <SideSheetFooter>
          <SideSheetClose asChild>
            <button
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Apply Filters
            </button>
          </SideSheetClose>
        </SideSheetFooter>
      </SideSheetContent>
    </SideSheet>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/components/property/property-filter-sheet.tsx
git commit -m "feat: add filter side-sheet wrapper (slides from left)"
```

---

## Task 7: Update Property Card for Side-Sheet Integration

**Files:**
- Modify: `frontend/components/property/property-card.tsx`

**Step 1: Add onHover and onClick props instead of Link wrapper**

Change the card so it:
- Calls `onClick(id)` instead of wrapping in `<Link>`
- Calls `onHover(id | null)` for map marker highlighting
- Accepts `isActive` prop for border highlight when selected

Key changes:
- Replace `<Link href={...}>` wrapper with `<div onClick={...}>`
- Add `onHover`, `onClick`, `isActive` props
- Add `cursor-pointer` class
- Keep all existing styling

**Step 2: Commit**

```bash
git add frontend/components/property/property-card.tsx
git commit -m "refactor: property card accepts onClick/onHover for side-sheet integration"
```

---

## Task 8: Rewrite Properties Page

**Files:**
- Modify: `frontend/app/(dashboard)/properties/page.tsx`

**Step 1: Rewrite with new layout**

The page should have:
1. Category pills row
2. Search + Sort + View toggle + Filter button row
3. Split view: cards (left, scrollable) + map (right, sticky)
4. Left SideSheet for filters
5. Right SideSheet for property detail

State variables:
- `filters` — PropertyFilters (existing)
- `viewMode` — 'grid' | 'list'
- `filterSheetOpen` — boolean
- `selectedPropertyId` — string | null
- `hoveredPropertyId` — string | null

The page wires everything together:
- CategoryPills → updates `filters.category`
- Search input → updates `filters.search`
- Sort dropdown → updates `filters.sortBy`
- View toggle → switches grid/list
- Filter button → opens left sheet
- Card click / marker click → opens right sheet
- Card hover → highlights map marker

**Step 2: Verify at `http://localhost:3000/properties`**

- Category pills render and filter
- Grid/List toggle works
- Map shows with markers
- Filter button opens left side-sheet
- Click card opens right side-sheet with detail
- Hover card highlights map marker
- "Open full page" button navigates to `/properties/[id]`

**Step 3: Commit**

```bash
git add frontend/app/(dashboard)/properties/page.tsx
git commit -m "feat: rewrite properties page with grid+map split, side-sheets, view toggle"
```

---

## Task 9: Add Leaflet CSS Import

**Files:**
- Modify: `frontend/app/globals.css`

**Step 1: Import leaflet CSS**

Add at the top of `globals.css`:

```css
@import "leaflet/dist/leaflet.css";
```

Also add custom styles for the price markers:

```css
.custom-price-marker {
  background: none !important;
  border: none !important;
}
```

**Step 2: Commit**

```bash
git add frontend/app/globals.css
git commit -m "feat: import leaflet CSS and custom marker styles"
```

---

## Task 10: Mobile Responsive + Bottom Sheet

**Files:**
- Modify: `frontend/app/(dashboard)/properties/page.tsx` (add mobile handling)

**Step 1: Mobile adjustments**

- Hide map on mobile by default, add a "Map" toggle button
- On mobile, filter button opens bottom sheet (TopSheet positioned at bottom) instead of side-sheet
- Property detail on mobile uses bottom sheet or full-width overlay
- Cards go single column on mobile

**Step 2: Verify on narrow viewport**

Resize browser to ~375px width and verify:
- Cards stack single column
- Map is hidden, toggle shows it
- Filter uses bottom sheet
- Detail uses bottom sheet

**Step 3: Commit**

```bash
git add frontend/app/(dashboard)/properties/page.tsx
git commit -m "feat: add mobile responsive layout with bottom sheets"
```

---

## Task 11: Update CHECKLIST.md

**Files:**
- Modify: `CHECKLIST.md`

**Step 1: Mark completed items**

Update Phase 2 and Phase 5 items as appropriate:
- [x] Frontend: Properties page redesign (grid+map split, side-sheets)
- [x] Frontend: Map provider — OSM (react-leaflet)

**Step 2: Commit**

```bash
git add CHECKLIST.md
git commit -m "docs: update checklist with properties page redesign progress"
```

---

## Verification Checklist

After all tasks are complete, verify:

1. `http://localhost:3000/properties` loads with category pills, search, sort, view toggle
2. Grid view shows property cards with map on right
3. List view shows horizontal cards with map on right
4. Filter button opens left side-sheet with all filter options
5. Clicking a card opens right side-sheet with property detail
6. "Open full page" in detail panel navigates to `/properties/[id]`
7. Hovering a card highlights corresponding map marker
8. Clicking a map marker opens the detail panel
9. Mobile: single column, bottom sheets for filters/detail, map toggle
10. All CSS uses `var(--*)` variables per design system
