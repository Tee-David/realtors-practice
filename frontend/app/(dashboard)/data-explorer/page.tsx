"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { properties as propertiesApi, exports as exportsApi, sites as sitesApi } from "@/lib/api";
import {
  Database, CheckCircle, AlertTriangle, Shield, Download, Search, ChevronDown,
  Eye, X, ArrowUpDown, FileSpreadsheet, FileText, Sparkles, Bot, Plus,
  SlidersHorizontal, Columns3, RotateCcw, Pencil, ExternalLink, ChevronLeft,
  ChevronRight, MapPin, BedDouble, Bath, Maximize2, Building2, Star, Link,
  Calendar, Loader2, Check, User, Phone, Layers,
  LayoutGrid, LayoutList, Columns, GripVertical, Clock, Trash2, Play, RefreshCcw,
} from "lucide-react";
import { AIPlaceholderCard } from "@/components/ai/ai-placeholder";
import { SearchableSelect, SearchableMultiSelect } from "@/components/ui/searchable-select";
import ModernLoader from "@/components/ui/modern-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetTitle,
} from "@/components/ui/side-sheet";
import { PropertyEditForm } from "@/components/property/property-edit-form";
import { useStartScrape } from "@/hooks/use-scrape-jobs";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = "all" | "raw" | "enriched" | "flagged";
type ViewMode = "table" | "cards" | "kanban";

interface AdvancedFilters {
  startDate: string;
  endDate: string;
  minPrice: string;
  maxPrice: string;
  minQuality: string;
  maxQuality: string;
  siteIds: string[];
  state: string;
  area: string;
  categories: string[];
  listingTypes: string[];
  hasImages: "any" | "yes" | "no";
  hasCoordinates: "any" | "yes" | "no";
  minBedrooms: string;
  maxBedrooms: string;
  minBathrooms: string;
  maxBathrooms: string;
}

const DEFAULT_FILTERS: AdvancedFilters = {
  startDate: "",
  endDate: "",
  minPrice: "",
  maxPrice: "",
  minQuality: "",
  maxQuality: "",
  siteIds: [],
  state: "",
  area: "",
  categories: [],
  listingTypes: [],
  hasImages: "any",
  hasCoordinates: "any",
  minBedrooms: "",
  maxBedrooms: "",
  minBathrooms: "",
  maxBathrooms: "",
};

// ─── Column definitions ──────────────────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  // Default visible
  { key: "title", label: "Title", sortable: true, defaultVisible: true },
  { key: "source", label: "Source", sortable: true, defaultVisible: true },
  { key: "listingType", label: "Type", sortable: true, defaultVisible: true },
  { key: "price", label: "Price", sortable: true, defaultVisible: true },
  { key: "area", label: "Area", sortable: true, defaultVisible: true },
  { key: "qualityScore", label: "Quality", sortable: true, defaultVisible: true },
  { key: "verificationStatus", label: "Status", sortable: true, defaultVisible: true },
  { key: "createdAt", label: "Date", sortable: true, defaultVisible: true },
  // Hidden by default — toggleable
  { key: "bedrooms", label: "Bedrooms", sortable: true, defaultVisible: false },
  { key: "bathrooms", label: "Bathrooms", sortable: true, defaultVisible: false },
  { key: "agentName", label: "Agent Name", sortable: false, defaultVisible: false },
  { key: "imagesCount", label: "Images", sortable: false, defaultVisible: false },
  { key: "hasCoordinates", label: "Has Coords", sortable: false, defaultVisible: false },
  { key: "daysOnMarket", label: "Days Listed", sortable: true, defaultVisible: false },
  { key: "viewCount", label: "Views", sortable: true, defaultVisible: false },
  { key: "landSizeSqm", label: "Land (sqm)", sortable: true, defaultVisible: false },
  { key: "buildingSizeSqm", label: "Building (sqm)", sortable: true, defaultVisible: false },
  { key: "pricePerSqm", label: "Price/sqm", sortable: true, defaultVisible: false },
  { key: "furnishing", label: "Furnishing", sortable: false, defaultVisible: false },
  { key: "condition", label: "Condition", sortable: false, defaultVisible: false },
  { key: "versionCount", label: "Versions", sortable: false, defaultVisible: false },
  { key: "updatedAt", label: "Last Scraped", sortable: true, defaultVisible: false },
  { key: "listingUrl", label: "Source URL", sortable: false, defaultVisible: false },
  { key: "completeness", label: "Completeness", sortable: false, defaultVisible: false },
  { key: "staleIndicator", label: "Stale", sortable: false, defaultVisible: false },
];

// ─── Staleness helper ─────────────────────────────────────────────────────────

function isStale(item: any): boolean {
  const date = item.lastScrapedAt || item.updatedAt || item.createdAt;
  if (!date) return false;
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24) > 30;
}

// ─── Completeness scoring ─────────────────────────────────────────────────────

interface FieldCheck { label: string; points: number; present: boolean; }

function computeCompleteness(item: any): { score: number; checks: FieldCheck[] } {
  const checks: FieldCheck[] = [
    { label: "Title", points: 15, present: !!item.title && item.title.trim().length > 0 },
    { label: "Price", points: 15, present: item.price != null && item.price > 0 },
    { label: "Description", points: 10, present: !!item.description && item.description.trim().length > 0 },
    { label: "Images", points: 10, present: Array.isArray(item.images) && item.images.length > 0 },
    { label: "Coordinates", points: 10, present: item.latitude != null && item.longitude != null },
    { label: "Bedrooms or Bathrooms", points: 10, present: item.bedrooms != null || item.bathrooms != null },
    { label: "Area or State", points: 10, present: !!item.area || !!item.state },
    { label: "Listing Type", points: 10, present: !!item.listingType },
    { label: "Category", points: 10, present: !!item.category },
    { label: "Agent Info", points: 10, present: !!item.agentName || !!item.agentPhone },
  ];
  return { score: checks.reduce((s, c) => s + (c.present ? c.points : 0), 0), checks };
}

function CompletenessBar({ item, compact = false }: { item: any; compact?: boolean }) {
  const { score, checks } = computeCompleteness(item);
  const color = score >= 80 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";
  const missing = checks.filter((c) => !c.present).map((c) => c.label);
  const present = checks.filter((c) => c.present).map((c) => c.label);
  const tooltip = [`Score: ${score}%`, missing.length > 0 ? `Missing: ${missing.join(", ")}` : "", `Present: ${present.join(", ")}`].filter(Boolean).join("\n");

  if (compact) return (
    <div title={tooltip} className="w-full">
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );

  return (
    <div title={tooltip} className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color }}>{score}%</span>
    </div>
  );
}

// ─── Quality breakdown popover ────────────────────────────────────────────────

interface QualityCat { label: string; max: number; score: number; suggestions: string[]; }

function computeQualityBreakdown(item: any): QualityCat[] {
  const hasTitle = !!item.title && item.title.trim().length > 3;
  const titleScore = hasTitle ? (item.title.length > 20 ? 10 : 5) : 0;
  const hasDesc = !!item.description && item.description.trim().length > 0;
  const descScore = !hasDesc ? 0 : item.description.length > 200 ? 15 : item.description.length > 50 ? 10 : 5;
  const hasPrice = item.price != null && item.price > 0;
  const hasBeds = item.bedrooms != null;
  const hasBaths = item.bathrooms != null;
  const hasArea = !!item.area;
  const hasCategory = !!item.category;
  const detailScore = (hasBeds ? 5 : 0) + (hasBaths ? 4 : 0) + (hasArea ? 3 : 0) + (hasCategory ? 3 : 0);
  const hasCoords = item.latitude != null && item.longitude != null;
  const hasState = !!item.state;
  const locationScore = (hasCoords ? 12 : 0) + (hasState ? 4 : 0) + (!!item.locationText ? 4 : 0);
  const images = Array.isArray(item.images) ? item.images : [];
  const imageScore = images.length === 0 ? 0 : images.length >= 5 ? 15 : images.length >= 3 ? 10 : 6;
  const hasAgentName = !!item.agentName;
  const hasAgentPhone = !!item.agentPhone;
  const agentScore = (hasAgentName ? 5 : 0) + (hasAgentPhone ? 5 : 0);
  const hasFeatures = Array.isArray(item.features) && item.features.length > 0;

  return [
    { label: "Title", max: 10, score: Math.min(titleScore, 10), suggestions: !hasTitle ? ["Add a descriptive title"] : titleScore < 10 ? ["Make title more descriptive (20+ chars)"] : [] },
    { label: "Description", max: 15, score: Math.min(descScore, 15), suggestions: !hasDesc ? ["Add a property description"] : descScore < 15 ? ["Expand description to 200+ chars"] : [] },
    { label: "Price", max: 10, score: hasPrice ? 10 : 0, suggestions: !hasPrice ? ["Add the listing price"] : [] },
    { label: "Property Details", max: 15, score: Math.min(detailScore, 15), suggestions: [...(!hasBeds ? ["Add bedrooms"] : []), ...(!hasBaths ? ["Add bathrooms"] : []), ...(!hasArea ? ["Add area"] : []), ...(!hasCategory ? ["Set category"] : [])] },
    { label: "Location", max: 20, score: Math.min(locationScore, 20), suggestions: [...(!hasCoords ? ["Add GPS coordinates"] : []), ...(!hasState ? ["Add state"] : []), ...(!item.locationText ? ["Add location description"] : [])] },
    { label: "Images", max: 15, score: Math.min(imageScore, 15), suggestions: images.length === 0 ? ["Add at least one image"] : images.length < 3 ? ["Add 3+ images"] : images.length < 5 ? ["Add 5+ images for full score"] : [] },
    { label: "Agent Info", max: 10, score: Math.min(agentScore, 10), suggestions: [...(!hasAgentName ? ["Add agent name"] : []), ...(!hasAgentPhone ? ["Add agent phone"] : [])] },
    { label: "Features", max: 5, score: hasFeatures ? 5 : 0, suggestions: !hasFeatures ? ["Add property features/amenities"] : [] },
  ];
}

function QualityPopover({ item, onClose }: { item: any; onClose: () => void }) {
  const cats = computeQualityBreakdown(item);
  const total = cats.reduce((s, c) => s + c.score, 0);
  const maxTotal = cats.reduce((s, c) => s + c.max, 0);
  const suggestions = cats.flatMap((c) => c.suggestions);
  const barColor = (s: number, m: number) => (s / m >= 0.8 ? "#16a34a" : s / m >= 0.5 ? "#ca8a04" : "#dc2626");
  const totalColor = total >= 80 ? "#16a34a" : total >= 50 ? "#ca8a04" : "#dc2626";

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border shadow-2xl overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Quality Score Breakdown</p>
            <p className="text-2xl font-bold mt-0.5" style={{ color: totalColor }}>{total}<span className="text-sm font-normal ml-1" style={{ color: "var(--muted-foreground)" }}>/ {maxTotal}</span></p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--secondary)]"><X className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {cats.map((cat) => (
            <div key={cat.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{cat.label}</span>
                <span className="text-xs tabular-nums" style={{ color: "var(--muted-foreground)" }}>{cat.score}/{cat.max}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                <div className="h-full rounded-full" style={{ width: `${(cat.score / cat.max) * 100}%`, backgroundColor: barColor(cat.score, cat.max) }} />
              </div>
            </div>
          ))}
          {suggestions.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--foreground)" }}>What&apos;s Missing</p>
              <ul className="space-y-1">{suggestions.map((s, i) => <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}><span className="mt-0.5 shrink-0" style={{ color: "#ca8a04" }}>•</span>{s}</li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Property Card (Cards view) ───────────────────────────────────────────────

function PropertyCard({ item, onInspect }: { item: any; onInspect: (item: any) => void }) {
  const { score: completeness } = computeCompleteness(item);
  const stale = isStale(item);
  const images = Array.isArray(item.images) ? item.images : [];
  const qColor = item.qualityScore != null ? (item.qualityScore >= 80 ? "#16a34a" : item.qualityScore >= 50 ? "#ca8a04" : "#dc2626") : "#6b7280";

  return (
    <div onClick={() => onInspect(item)} className="rounded-xl border overflow-hidden cursor-pointer transition-all hover:shadow-md" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
      <div className="h-36 relative overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        {images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[0]} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Building2 className="w-10 h-10 opacity-20" style={{ color: "var(--muted-foreground)" }} /></div>
        )}
        {stale && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: "rgba(245,158,11,0.92)", color: "#fff" }} title="Not re-scraped in 30+ days">
            <Clock className="w-3 h-3" />Stale
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: "var(--foreground)" }}>{item.title || "Untitled Property"}</p>
        <p className="text-base font-bold" style={{ color: "var(--accent, #FF6600)" }}>{item.price ? `₦${new Intl.NumberFormat().format(item.price)}` : "—"}</p>
        {(item.area || item.state) && (
          <div className="flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" style={{ color: "var(--muted-foreground)" }} /><span className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>{[item.area, item.state].filter(Boolean).join(", ")}</span></div>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.listingType && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}>{item.listingType}</span>}
          {item.category && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(0,1,252,0.08)", color: "var(--primary)" }}>{item.category}</span>}
          <StatusBadge status={item.verificationStatus} />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] font-bold shrink-0" style={{ color: qColor }}>Q: {item.qualityScore ?? "—"}</span>
          <div className="flex-1"><CompletenessBar item={item} compact /></div>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

const KANBAN_STATUSES = ["UNVERIFIED", "VERIFIED", "FLAGGED", "REJECTED"] as const;

function KanbanColumn({ status, items, onInspect, onDrop }: { status: string; items: any[]; onInspect: (item: any) => void; onDrop: (id: string, newStatus: string) => void; }) {
  const palette: Record<string, { bg: string; text: string; border: string }> = {
    UNVERIFIED: { bg: "rgba(234,179,8,0.06)", text: "#ca8a04", border: "rgba(234,179,8,0.25)" },
    VERIFIED: { bg: "rgba(34,197,94,0.06)", text: "#16a34a", border: "rgba(34,197,94,0.25)" },
    FLAGGED: { bg: "rgba(239,68,68,0.06)", text: "#dc2626", border: "rgba(239,68,68,0.25)" },
    REJECTED: { bg: "rgba(107,114,128,0.06)", text: "#6b7280", border: "rgba(107,114,128,0.25)" },
  };
  const c = palette[status] || palette.UNVERIFIED;

  return (
    <div className="flex flex-col rounded-xl border overflow-hidden min-h-[400px]" style={{ borderColor: c.border, backgroundColor: c.bg }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) onDrop(id, status); }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: c.border }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: c.text }}>{status}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: c.text + "22", color: c.text }}>{items.length}</span>
        </div>
      </div>
      <div className="flex-1 p-2.5 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); e.dataTransfer.effectAllowed = "move"; }} onClick={() => onInspect(item)}
            className="rounded-lg border p-2.5 cursor-pointer transition-shadow hover:shadow-sm" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-start gap-1.5">
              <GripVertical className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-30" style={{ color: "var(--muted-foreground)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--foreground)" }}>{item.title || "Untitled"}</p>
                <p className="text-xs font-bold mt-0.5" style={{ color: "var(--accent, #FF6600)" }}>{item.price ? `₦${new Intl.NumberFormat().format(item.price)}` : "—"}</p>
                {item.area && <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{item.area}</p>}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="flex items-center justify-center h-20 text-xs italic" style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>Drop cards here</div>}
      </div>
    </div>
  );
}

const LS_COLUMNS_KEY = "data-explorer-columns";

function loadColumnVisibility(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.defaultVisible]));
  }
  try {
    const stored = localStorage.getItem(LS_COLUMNS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.defaultVisible]));
}

function saveColumnVisibility(vis: Record<string, boolean>) {
  try {
    localStorage.setItem(LS_COLUMNS_KEY, JSON.stringify(vis));
  } catch {}
}

// ─── Nigerian States ─────────────────────────────────────────────────────────

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT - Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const CATEGORIES = ["RESIDENTIAL", "COMMERCIAL", "LAND", "SHORTLET", "INDUSTRIAL"];
const LISTING_TYPES = ["SALE", "RENT", "LEASE", "SHORTLET"];

// ─── Tabs ────────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ReactNode; filter?: Record<string, string> }[] = [
  { key: "all", label: "All", icon: <Database className="w-4 h-4" /> },
  { key: "raw", label: "Raw (Unverified)", icon: <AlertTriangle className="w-4 h-4" />, filter: { verificationStatus: "UNVERIFIED" } },
  { key: "enriched", label: "Enriched (Verified)", icon: <CheckCircle className="w-4 h-4" />, filter: { verificationStatus: "VERIFIED" } },
  { key: "flagged", label: "Flagged", icon: <Shield className="w-4 h-4" />, filter: { verificationStatus: "FLAGGED" } },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countActiveFilters(f: AdvancedFilters): number {
  let count = 0;
  if (f.startDate) count++;
  if (f.endDate) count++;
  if (f.minPrice) count++;
  if (f.maxPrice) count++;
  if (f.minQuality) count++;
  if (f.maxQuality) count++;
  if (f.siteIds.length > 0) count++;
  if (f.state) count++;
  if (f.area) count++;
  if (f.categories.length > 0) count++;
  if (f.listingTypes.length > 0) count++;
  if (f.hasImages !== "any") count++;
  if (f.hasCoordinates !== "any") count++;
  if (f.minBedrooms) count++;
  if (f.maxBedrooms) count++;
  if (f.minBathrooms) count++;
  if (f.maxBathrooms) count++;
  return count;
}

function buildApiParams(f: AdvancedFilters): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (f.startDate) params.startDate = f.startDate;
  if (f.endDate) params.endDate = f.endDate;
  if (f.minPrice) params.minPrice = parseFloat(f.minPrice);
  if (f.maxPrice) params.maxPrice = parseFloat(f.maxPrice);
  if (f.minQuality) params.minQuality = parseInt(f.minQuality);
  if (f.maxQuality) params.maxQuality = parseInt(f.maxQuality);
  if (f.siteIds.length > 0) params.siteIds = f.siteIds.join(",");
  if (f.state) params.state = f.state;
  if (f.area) params.area = f.area;
  if (f.categories.length > 0) params.category = f.categories.join(",");
  if (f.listingTypes.length > 0) params.listingType = f.listingTypes.join(",");
  if (f.hasImages !== "any") params.hasImages = f.hasImages === "yes";
  if (f.hasCoordinates !== "any") params.hasCoordinates = f.hasCoordinates === "yes";
  if (f.minBedrooms) params.minBedrooms = parseInt(f.minBedrooms);
  if (f.maxBedrooms) params.maxBedrooms = parseInt(f.maxBedrooms);
  if (f.minBathrooms) params.minBathrooms = parseInt(f.minBathrooms);
  if (f.maxBathrooms) params.maxBathrooms = parseInt(f.maxBathrooms);
  return params;
}

function getActiveChips(f: AdvancedFilters, sites: { id: string; name: string }[]): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];
  if (f.startDate) chips.push({ key: "startDate", label: `From: ${f.startDate}` });
  if (f.endDate) chips.push({ key: "endDate", label: `To: ${f.endDate}` });
  if (f.minPrice) chips.push({ key: "minPrice", label: `Min ₦${Number(f.minPrice).toLocaleString()}` });
  if (f.maxPrice) chips.push({ key: "maxPrice", label: `Max ₦${Number(f.maxPrice).toLocaleString()}` });
  if (f.minQuality) chips.push({ key: "minQuality", label: `Quality ≥ ${f.minQuality}` });
  if (f.maxQuality) chips.push({ key: "maxQuality", label: `Quality ≤ ${f.maxQuality}` });
  if (f.siteIds.length > 0) {
    const names = f.siteIds.map((id) => sites.find((s) => s.id === id)?.name || id).join(", ");
    chips.push({ key: "siteIds", label: `Sites: ${names}` });
  }
  if (f.state) chips.push({ key: "state", label: `State: ${f.state}` });
  if (f.area) chips.push({ key: "area", label: `Area: ${f.area}` });
  if (f.categories.length > 0) chips.push({ key: "categories", label: `Category: ${f.categories.join(", ")}` });
  if (f.listingTypes.length > 0) chips.push({ key: "listingTypes", label: `Type: ${f.listingTypes.join(", ")}` });
  if (f.hasImages !== "any") chips.push({ key: "hasImages", label: `Images: ${f.hasImages}` });
  if (f.hasCoordinates !== "any") chips.push({ key: "hasCoordinates", label: `Coords: ${f.hasCoordinates}` });
  if (f.minBedrooms) chips.push({ key: "minBedrooms", label: `Min Beds: ${f.minBedrooms}` });
  if (f.maxBedrooms) chips.push({ key: "maxBedrooms", label: `Max Beds: ${f.maxBedrooms}` });
  if (f.minBathrooms) chips.push({ key: "minBathrooms", label: `Min Baths: ${f.minBathrooms}` });
  if (f.maxBathrooms) chips.push({ key: "maxBathrooms", label: `Max Baths: ${f.maxBathrooms}` });
  return chips;
}

function removeFilter(f: AdvancedFilters, key: string): AdvancedFilters {
  const updated = { ...f };
  switch (key) {
    case "startDate": updated.startDate = ""; break;
    case "endDate": updated.endDate = ""; break;
    case "minPrice": updated.minPrice = ""; break;
    case "maxPrice": updated.maxPrice = ""; break;
    case "minQuality": updated.minQuality = ""; break;
    case "maxQuality": updated.maxQuality = ""; break;
    case "siteIds": updated.siteIds = []; break;
    case "state": updated.state = ""; break;
    case "area": updated.area = ""; break;
    case "categories": updated.categories = []; break;
    case "listingTypes": updated.listingTypes = []; break;
    case "hasImages": updated.hasImages = "any"; break;
    case "hasCoordinates": updated.hasCoordinates = "any"; break;
    case "minBedrooms": updated.minBedrooms = ""; break;
    case "maxBedrooms": updated.maxBedrooms = ""; break;
    case "minBathrooms": updated.minBathrooms = ""; break;
    case "maxBathrooms": updated.maxBathrooms = ""; break;
  }
  return updated;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// Input shared style
const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--background)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
};

const inputCls =
  "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";

// Section label in filter panel
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

// Toggle tri-state button
function TriStateToggle({
  value,
  onChange,
}: {
  value: "any" | "yes" | "no";
  onChange: (v: "any" | "yes" | "no") => void;
}) {
  const opts: { key: "any" | "yes" | "no"; label: string }[] = [
    { key: "any", label: "Any" },
    { key: "yes", label: "Yes" },
    { key: "no", label: "No" },
  ];
  return (
    <div
      className="flex rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      {opts.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className="flex-1 py-1.5 text-xs font-medium transition-colors"
          style={{
            backgroundColor: value === opt.key ? "var(--primary)" : "var(--background)",
            color: value === opt.key ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Multi-select chips for categories / listing types
function ChipMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
            style={{
              backgroundColor: active ? "var(--primary)" : "transparent",
              borderColor: active ? "var(--primary)" : "var(--border)",
              color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Column cell renderer ─────────────────────────────────────────────────────

function CellValue({ col, item }: { col: string; item: any }) {
  switch (col) {
    case "title":
      return (
        <span className="font-medium truncate max-w-[200px] block" style={{ color: "var(--foreground)" }}>
          {item.title}
        </span>
      );
    case "source":
      return <span style={{ color: "var(--muted-foreground)" }}>{item.source}</span>;
    case "listingType":
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
          style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
        >
          {item.listingType}
        </span>
      );
    case "price":
      return (
        <span className="font-medium" style={{ color: "var(--foreground)" }}>
          {item.price ? `₦${new Intl.NumberFormat().format(item.price)}` : "—"}
        </span>
      );
    case "area":
      return <span style={{ color: "var(--muted-foreground)" }}>{item.area || "—"}</span>;
    case "qualityScore":
      return item.qualityScore != null ? (
        <span
          className="text-xs font-bold"
          style={{
            color:
              item.qualityScore >= 80
                ? "#16a34a"
                : item.qualityScore >= 50
                ? "#ca8a04"
                : "#dc2626",
          }}
        >
          {item.qualityScore}
        </span>
      ) : (
        <span>—</span>
      );
    case "verificationStatus":
      return <StatusBadge status={item.verificationStatus} />;
    case "createdAt":
      return (
        <span className="whitespace-nowrap text-xs" style={{ color: "var(--muted-foreground)" }}>
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      );
    case "bedrooms":
      return <span style={{ color: "var(--muted-foreground)" }}>{item.bedrooms ?? "—"}</span>;
    case "bathrooms":
      return <span style={{ color: "var(--muted-foreground)" }}>{item.bathrooms ?? "—"}</span>;
    case "agentName":
      return <span style={{ color: "var(--muted-foreground)" }}>{item.agentName || "—"}</span>;
    case "imagesCount":
      return (
        <span style={{ color: "var(--muted-foreground)" }}>
          {Array.isArray(item.images) ? item.images.length : item.imagesCount ?? "—"}
        </span>
      );
    case "hasCoordinates":
      return (
        <span style={{ color: item.latitude && item.longitude ? "#16a34a" : "var(--muted-foreground)" }}>
          {item.latitude && item.longitude ? "Yes" : "No"}
        </span>
      );
    case "daysOnMarket":
      return <span style={{ color: "var(--muted-foreground)" }}>{item.daysOnMarket ?? "—"}</span>;
    case "viewCount":
      return <span style={{ color: "var(--muted-foreground)" }}>{item.viewCount ?? "—"}</span>;
    case "landSizeSqm":
      return (
        <span style={{ color: "var(--muted-foreground)" }}>
          {item.landSizeSqm ? `${item.landSizeSqm} sqm` : "—"}
        </span>
      );
    case "buildingSizeSqm":
      return (
        <span style={{ color: "var(--muted-foreground)" }}>
          {item.buildingSizeSqm ? `${item.buildingSizeSqm} sqm` : "—"}
        </span>
      );
    case "pricePerSqm":
      return (
        <span style={{ color: "var(--muted-foreground)" }}>
          {item.pricePerSqm ? `₦${new Intl.NumberFormat().format(item.pricePerSqm)}` : "—"}
        </span>
      );
    case "furnishing":
      return <span style={{ color: "var(--muted-foreground)" }}>{item.furnishing || "—"}</span>;
    case "condition":
      return <span style={{ color: "var(--muted-foreground)" }}>{item.condition || "—"}</span>;
    case "versionCount":
      return (
        <span style={{ color: "var(--muted-foreground)" }}>
          {item._count?.versions ?? item.currentVersion ?? "—"}
        </span>
      );
    case "updatedAt":
      return (
        <span className="whitespace-nowrap text-xs" style={{ color: "var(--muted-foreground)" }}>
          {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "—"}
        </span>
      );
    case "listingUrl":
      return item.listingUrl ? (
        <a
          href={item.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline truncate max-w-[150px] block"
          style={{ color: "var(--primary)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {item.listingUrl}
        </a>
      ) : (
        <span>—</span>
      );
    case "completeness":
      return <CompletenessBar item={item} />;
    case "staleIndicator":
      return isStale(item) ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#f59e0b" }} title="Not re-scraped in 30+ days">
          <Clock className="w-3 h-3" />Stale
        </span>
      ) : <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Fresh</span>;
    default:
      return <span>—</span>;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    UNVERIFIED: { bg: "rgba(234,179,8,0.15)", text: "#ca8a04" },
    VERIFIED: { bg: "rgba(34,197,94,0.15)", text: "#16a34a" },
    FLAGGED: { bg: "rgba(239,68,68,0.15)", text: "#dc2626" },
    REJECTED: { bg: "rgba(107,114,128,0.15)", text: "#6b7280" },
  };
  const c = colors[status] || colors.UNVERIFIED;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}

// ─── Inline Cell Editor ───────────────────────────────────────────────────────

type EditableCol = "title" | "price" | "area" | "verificationStatus";

interface CellSaveState {
  id: string;
  col: EditableCol;
  status: "saving" | "success" | "error";
}

const VERIFICATION_STATUSES = ["UNVERIFIED", "VERIFIED", "FLAGGED", "REJECTED"];

function EditableCell({
  item,
  col,
  children,
  onSave,
  saveState,
}: {
  item: any;
  col: EditableCol;
  children: React.ReactNode;
  onSave: (id: string, col: EditableCol, value: string) => void;
  saveState?: CellSaveState | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const startEdit = () => {
    const raw =
      col === "title" ? (item.title || "") :
      col === "price" ? (item.price != null ? String(item.price) : "") :
      col === "area" ? (item.area || "") :
      (item.verificationStatus || "UNVERIFIED");
    setValue(raw);
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const commit = () => {
    if (!editing) return;
    setEditing(false);
    onSave(item.id, col, value);
  };

  const cancel = () => setEditing(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  const isSaving = saveState?.id === item.id && saveState?.col === col && saveState?.status === "saving";
  const isSuccess = saveState?.id === item.id && saveState?.col === col && saveState?.status === "success";

  if (isSaving) {
    return (
      <div className="flex items-center gap-1.5 px-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: "var(--primary)" }} />
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Saving…</span>
      </div>
    );
  }

  if (editing) {
    if (col === "verificationStatus") {
      return (
        <select
          ref={inputRef as React.Ref<HTMLSelectElement>}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 rounded text-xs border focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          style={{ backgroundColor: "var(--background)", borderColor: "var(--primary)", color: "var(--foreground)" }}
        >
          {VERIFICATION_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        ref={inputRef as React.Ref<HTMLInputElement>}
        type={col === "price" ? "number" : "text"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 rounded text-xs border focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        style={{
          backgroundColor: "var(--background)",
          borderColor: "var(--primary)",
          color: "var(--foreground)",
          minWidth: col === "title" ? "160px" : "80px",
        }}
      />
    );
  }

  return (
    <div
      onDoubleClick={startEdit}
      title="Double-click to edit"
      className="cursor-default select-none flex items-center gap-1"
    >
      {isSuccess && <Check className="w-3 h-3 shrink-0" style={{ color: "#16a34a" }} />}
      {children}
    </div>
  );
}

// ─── Property Detail Slide-Over ───────────────────────────────────────────────

function qualityColor(score: number) {
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#ca8a04";
  return "#dc2626";
}

function PropertyDetailSlideOver({
  property,
  open,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onEditOpen,
  onReScrape,
  onQualityClick,
}: {
  property: any | null;
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onEditOpen: (property: any) => void;
  onReScrape?: (property: any) => void;
  onQualityClick?: (property: any) => void;
}) {
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    setImgIndex(0);
    setShowFullDesc(false);
  }, [property?.id]);

  if (!property) return null;

  const images: string[] = Array.isArray(property.images) ? property.images : [];
  const features: string[] = Array.isArray(property.features) ? property.features : [];
  const desc = property.description || "";
  const descTruncated = desc.length > 400 ? desc.slice(0, 400) + "…" : desc;
  const scrapedAt = property.lastScrapedAt || property.createdAt;
  const versionCount = property.currentVersion || 1;
  const qualityScore = property.qualityScore;

  return (
    <SideSheet open={open} onOpenChange={(v) => !v && onClose()} side="right" width="680px">
      <SideSheetContent>
        {/* ── Header */}
        <div
          className="pb-4 border-b mb-4"
          style={{ borderColor: "var(--border)" }}
        >
          <SideSheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <SideSheetTitle
                  className="font-display text-base leading-tight line-clamp-2 [color:var(--foreground)]"
                >
                  {property.title}
                </SideSheetTitle>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {property.listingType && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                      style={{ backgroundColor: "rgba(0,1,252,0.08)", color: "var(--primary)" }}
                    >
                      {property.listingType}
                    </span>
                  )}
                  {property.category && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
                    >
                      {property.category}
                    </span>
                  )}
                  <StatusBadge status={property.verificationStatus} />
                </div>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {isStale(property) && onReScrape && (
                  <button
                    onClick={() => onReScrape(property)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                    style={{ borderColor: "#f59e0b", color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.08)" }}
                    title="Not re-scraped in 30+ days"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Re-scrape
                  </button>
                )}
                <button
                  onClick={() => onEditOpen(property)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:opacity-80"
                  style={{ borderColor: "var(--primary)", color: "var(--primary)", backgroundColor: "rgba(0,1,252,0.05)" }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
                <a
                  href={`/properties/${property.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Full Page
                </a>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-[var(--secondary)] transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                </button>
              </div>
            </div>
          </SideSheetHeader>

          {/* Prev / Next */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40 hover:bg-[var(--secondary)] transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40 hover:bg-[var(--secondary)] transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body (SideSheetContent already scrolls) */}
        <div className="space-y-5 pb-8">

          {/* Image carousel */}
          <div
            className="relative w-full rounded-xl overflow-hidden"
            style={{ height: "200px", backgroundColor: "var(--secondary)" }}
          >
            {images.length > 0 ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[imgIndex]}
                  alt={`Property image ${imgIndex + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImgIndex((i) => Math.max(0, i - 1))}
                      disabled={imgIndex === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white disabled:opacity-30 hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setImgIndex((i) => Math.min(images.length - 1, i + 1))}
                      disabled={imgIndex === images.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white disabled:opacity-30 hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setImgIndex(i)}
                          className="w-1.5 h-1.5 rounded-full transition-colors"
                          style={{ backgroundColor: i === imgIndex ? "white" : "rgba(255,255,255,0.5)" }}
                        />
                      ))}
                    </div>
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-black/50">
                      {imgIndex + 1}/{images.length}
                    </span>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                <Building2 className="w-10 h-10 opacity-30" />
                <span className="text-xs">No images available</span>
              </div>
            )}
          </div>

          {/* Price */}
          <div>
            <p
              className="text-2xl font-bold font-display"
              style={{ color: property.price ? "var(--accent, #FF6600)" : "var(--muted-foreground)" }}
            >
              {property.price ? `₦${new Intl.NumberFormat("en-NG").format(property.price)}` : "Price not listed"}
            </p>
            {property.priceText && (
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{property.priceText}</p>
            )}
          </div>

          {/* Location */}
          {(property.area || property.state || property.locationText) && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
              <div>
                {(property.area || property.state) && (
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {[property.area, property.state].filter(Boolean).join(", ")}
                  </p>
                )}
                {property.locationText && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{property.locationText}</p>
                )}
              </div>
            </div>
          )}

          {/* Details grid */}
          <div
            className="grid grid-cols-2 gap-3 p-4 rounded-xl"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            {property.bedrooms != null && (
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Bedrooms</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{property.bedrooms}</p>
                </div>
              </div>
            )}
            {property.bathrooms != null && (
              <div className="flex items-center gap-2">
                <Bath className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Bathrooms</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{property.bathrooms}</p>
                </div>
              </div>
            )}
            {property.landSizeSqm != null && (
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Land Size</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{property.landSizeSqm} sqm</p>
                </div>
              </div>
            )}
            {property.buildingSizeSqm != null && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Building Size</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{property.buildingSizeSqm} sqm</p>
                </div>
              </div>
            )}
            {property.condition && (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Condition</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{property.condition}</p>
                </div>
              </div>
            )}
            {property.furnishing && (
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Furnishing</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{property.furnishing}</p>
                </div>
              </div>
            )}
            {property.floors != null && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>Floors</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{property.floors}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {desc && (
            <div>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Description</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                {showFullDesc || desc.length <= 400 ? desc : descTruncated}
              </p>
              {desc.length > 400 && (
                <button
                  onClick={() => setShowFullDesc((v) => !v)}
                  className="mt-1 text-xs font-semibold"
                  style={{ color: "var(--primary)" }}
                >
                  {showFullDesc ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {/* Features */}
          {features.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Features</p>
              <div className="flex flex-wrap gap-1.5">
                {features.map((f, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: "rgba(0,1,252,0.07)", color: "var(--primary)" }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Agent info */}
          {(property.agentName || property.agentPhone || property.agencyName) && (
            <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Agent</p>
              {property.agentName && (
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{property.agentName}</span>
                </div>
              )}
              {property.agentPhone && (
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                  <span className="text-sm" style={{ color: "var(--foreground)" }}>{property.agentPhone}</span>
                </div>
              )}
              {property.agencyName && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                  <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{property.agencyName}</span>
                </div>
              )}
            </div>
          )}

          {/* Quality score — clickable for breakdown */}
          {qualityScore != null && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Quality Score</p>
                <button
                  onClick={() => onQualityClick && onQualityClick(property)}
                  className="text-xs font-bold underline decoration-dotted underline-offset-2 hover:opacity-80"
                  style={{ color: qualityColor(qualityScore) }}
                  title="Click to see breakdown"
                >
                  {qualityScore}/100
                </button>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, qualityScore)}%`, backgroundColor: qualityColor(qualityScore) }}
                />
              </div>
            </div>
          )}

          {/* Data Completeness */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Data Completeness</p>
            </div>
            <CompletenessBar item={property} />
          </div>

          {/* Stale warning */}
          {isStale(property) && (
            <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: "rgba(245,158,11,0.3)", backgroundColor: "rgba(245,158,11,0.06)" }}>
              <Clock className="w-4 h-4 shrink-0" style={{ color: "#f59e0b" }} />
              <p className="text-xs font-medium" style={{ color: "#f59e0b" }}>
                Not re-scraped in 30+ days. Data may be outdated.
              </p>
            </div>
          )}

          {/* Meta */}
          <div className="space-y-2">
            {property.listingUrl && (
              <div className="flex items-center gap-2">
                <Link className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <a
                  href={property.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs truncate hover:underline"
                  style={{ color: "var(--primary)" }}
                >
                  {property.listingUrl}
                </a>
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {versionCount} version{versionCount !== 1 ? "s" : ""}
                </span>
              </div>
              {scrapedAt && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Scraped {new Date(scrapedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SideSheetContent>
    </SideSheet>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DataExplorerPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [inspectItem, setInspectItem] = useState<any>(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const limit = 25;

  // ── View Mode (table | cards | kanban)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("data-explorer-view") as ViewMode) || "table";
    return "table";
  });
  const persistView = (v: ViewMode) => { setViewMode(v); if (typeof window !== "undefined") localStorage.setItem("data-explorer-view", v); };

  // ── Stale filter
  const [showStaleOnly, setShowStaleOnly] = useState(false);

  // ── Quality breakdown popover
  const [qualityPopoverItem, setQualityPopoverItem] = useState<any>(null);

  // ── Bulk extended dropdown
  const [showBulkDropdown, setShowBulkDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── LLM Enrichment state
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number } | null>(null);
  const [showEnrichBySiteDropdown, setShowEnrichBySiteDropdown] = useState(false);
  const [enrichBySiteConfirm, setEnrichBySiteConfirm] = useState<{ site: { id: string; name: string }; count: number } | null>(null);
  const [enrichBySiteLoading, setEnrichBySiteLoading] = useState(false);

  // ── Property Detail Slide-Over
  const [slideOverItem, setSlideOverItem] = useState<any>(null);
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  // ── Edit form (opens on top of slide-over)
  const [editItem, setEditItem] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

  // ── Keyboard navigation: focused row index in current page
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

  // ── Inline cell editing save state
  const [cellSave, setCellSave] = useState<CellSaveState | null>(null);

  // ── Advanced Filters
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  // Draft state used inside the panel — only committed on Apply
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);

  const openFilterPanel = () => {
    setDraftFilters(advancedFilters);
    setFilterPanelOpen(true);
  };
  const applyFilters = () => {
    setAdvancedFilters(draftFilters);
    setPage(1);
    setFilterPanelOpen(false);
  };
  const clearAllFilters = () => {
    setAdvancedFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const activeFilterCount = countActiveFilters(advancedFilters);

  // ── Column Visibility
  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>(() => loadColumnVisibility());
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);

  const visibleColumns = ALL_COLUMNS.filter((c) => colVisibility[c.key]);

  const toggleColumn = (key: string) => {
    setColVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveColumnVisibility(next);
      return next;
    });
  };

  const resetColumns = () => {
    const defaults = Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.defaultVisible]));
    setColVisibility(defaults);
    saveColumnVisibility(defaults);
  };

  // Close col picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false);
      }
    };
    if (colPickerOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colPickerOpen]);

  // ── Sites for filter panel
  const { data: allSitesData } = useQuery({
    queryKey: ["sites-for-filter"],
    queryFn: async () => {
      const res = await sitesApi.list();
      return (res.data?.data || []) as { id: string; name: string }[];
    },
  });
  const allSites: { id: string; name: string }[] = allSitesData || [];

  // ── Tab filter
  const tabFilter = TABS.find((t) => t.key === activeTab)?.filter || {};

  // ── Main query
  const advancedParams = buildApiParams(advancedFilters);
  const { data, isLoading } = useQuery({
    queryKey: ["data-explorer", activeTab, page, sortBy, sortOrder, searchQuery, advancedFilters],
    queryFn: async () => {
      const res = await propertiesApi.list({
        ...tabFilter,
        ...advancedParams,
        page,
        limit,
        sortBy,
        sortOrder,
        search: searchQuery || undefined,
      });
      return res.data;
    },
  });

  const total = data?.meta?.total || 0;
  const totalPages = data?.meta?.totalPages || 1;

  // Apply client-side stale filter
  const rawItems: any[] = data?.data || [];
  const filteredItems = showStaleOnly ? rawItems.filter(isStale) : rawItems;
  const staleCount = rawItems.filter(isStale).length;
  // items alias used throughout existing code
  const items = filteredItems;

  // ── Bulk action
  const bulkAction = useMutation({
    mutationFn: async ({ action }: { action: string }) => {
      const ids = Array.from(selectedIds);
      await propertiesApi.bulkAction({ ids, action });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["data-explorer"] });
      setSelectedIds(new Set());
      const labels: Record<string, string> = {
        verify: "Verified", flag: "Flagged", reject: "Rejected", delete: "Deleted",
        status_available: "Set to Available", status_sold: "Set to Sold",
        status_expired: "Set to Expired", status_rented: "Set to Rented",
      };
      toast.success(labels[action] || "Action applied");
    },
    onError: () => toast.error("Bulk action failed"),
  });

  // ── Scrape hook
  const startScrape = useStartScrape();

  const handleReScrapeProperty = useCallback(async (item: any) => {
    if (!item.listingUrl) { toast.error("No listing URL on this property"); return; }
    try {
      await startScrape.mutateAsync({ type: "url", parameters: { url: item.listingUrl } });
      toast.success("Re-scrape triggered for this property");
    } catch { toast.error("Failed to trigger re-scrape"); }
  }, [startScrape]);

  const handleBulkReScrape = useCallback(async () => {
    const urls = filteredItems.filter((i: any) => selectedIds.has(i.id)).map((i: any) => i.listingUrl).filter(Boolean);
    if (urls.length === 0) { toast.error("No selected properties have listing URLs"); return; }
    try {
      await startScrape.mutateAsync({ type: "urls", parameters: { urls } });
      toast.success(`Re-scrape triggered for ${urls.length} properties`);
    } catch { toast.error("Failed to trigger bulk re-scrape"); }
  }, [filteredItems, selectedIds, startScrape]);

  // ── LLM Enrich Selected — calls llmEnrich for each selected property sequentially
  const handleLLMEnrichSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setEnrichProgress({ current: 0, total: ids.length });
    let enriched = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      setEnrichProgress({ current: i + 1, total: ids.length });
      try {
        await propertiesApi.llmEnrich(ids[i]);
        enriched++;
      } catch {
        failed++;
      }
    }
    setEnrichProgress(null);
    queryClient.invalidateQueries({ queryKey: ["data-explorer"] });
    if (failed === 0) {
      toast.success(`Enriched ${enriched} ${enriched === 1 ? "property" : "properties"} via LLM`);
    } else {
      toast.success(`Enriched ${enriched} properties. ${failed} failed.`);
    }
    setSelectedIds(new Set());
  }, [selectedIds, queryClient]);

  // ── LLM Enrich by Site — fetch count then show confirmation dialog
  const handleEnrichBySiteClick = useCallback(async (site: { id: string; name: string }) => {
    setShowEnrichBySiteDropdown(false);
    try {
      const res = await propertiesApi.llmEnrichCount(site.id);
      const count = res.data?.data?.count ?? 0;
      setEnrichBySiteConfirm({ site, count });
    } catch {
      toast.error("Failed to fetch property count for this site");
    }
  }, []);

  const handleConfirmEnrichBySite = useCallback(async () => {
    if (!enrichBySiteConfirm) return;
    setEnrichBySiteLoading(true);
    setEnrichBySiteConfirm(null);
    try {
      const res = await propertiesApi.llmEnrichBySite(enrichBySiteConfirm.site.id);
      const result = res.data?.data;
      queryClient.invalidateQueries({ queryKey: ["data-explorer"] });
      toast.success(
        `Enriched ${result?.enriched ?? "?"} of ${result?.total ?? "?"} properties from ${enrichBySiteConfirm.site.name}`
      );
    } catch {
      toast.error("Enrichment by site failed");
    } finally {
      setEnrichBySiteLoading(false);
    }
  }, [enrichBySiteConfirm, queryClient]);

  const handleKanbanDrop = useCallback(async (itemId: string, newStatus: string) => {
    const actionMap: Record<string, string> = { VERIFIED: "verify", FLAGGED: "flag", REJECTED: "reject" };
    const action = actionMap[newStatus];
    if (!action) return;
    try {
      await propertiesApi.bulkAction({ ids: [itemId], action });
      queryClient.invalidateQueries({ queryKey: ["data-explorer"] });
      toast.success(`Moved to ${newStatus}`);
    } catch { toast.error("Failed to update status"); }
  }, [queryClient]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i: any) => i.id)));
    }
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
  };

  // ── Slide-over helpers
  const openSlideOver = useCallback((item: any) => {
    setSlideOverItem(item);
    setSlideOverOpen(true);
    const idx = items.findIndex((i: any) => i.id === item.id);
    if (idx !== -1) setFocusedRowIndex(idx);
  }, [items]);

  const closeSlideOver = useCallback(() => {
    setSlideOverOpen(false);
    setSlideOverItem(null);
  }, []);

  const navigateSlideOver = useCallback((dir: "prev" | "next") => {
    if (!slideOverItem) return;
    const idx = items.findIndex((i: any) => i.id === slideOverItem.id);
    if (idx === -1) return;
    const next = dir === "prev" ? idx - 1 : idx + 1;
    if (next >= 0 && next < items.length) {
      setSlideOverItem(items[next]);
      setFocusedRowIndex(next);
    }
  }, [slideOverItem, items]);

  const slideOverIndex = slideOverItem ? items.findIndex((i: any) => i.id === slideOverItem.id) : -1;
  const hasPrev = slideOverIndex > 0;
  const hasNext = slideOverIndex !== -1 && slideOverIndex < items.length - 1;

  // ── Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "Escape") {
        if (slideOverOpen) { closeSlideOver(); return; }
      }

      if (slideOverOpen && !isInput) {
        if (e.key === "ArrowDown") { e.preventDefault(); navigateSlideOver("next"); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); navigateSlideOver("prev"); return; }
      }

      if (!slideOverOpen && !isInput && items.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setFocusedRowIndex((prev) => Math.min(items.length - 1, (prev ?? -1) + 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setFocusedRowIndex((prev) => Math.max(0, (prev ?? 1) - 1));
          return;
        }
        if (e.key === "Enter" && focusedRowIndex != null && items[focusedRowIndex]) {
          e.preventDefault();
          openSlideOver(items[focusedRowIndex]);
          return;
        }
        if (e.key === " " && focusedRowIndex != null && items[focusedRowIndex]) {
          e.preventDefault();
          toggleSelect(items[focusedRowIndex].id);
          return;
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideOverOpen, focusedRowIndex, items, navigateSlideOver, openSlideOver, closeSlideOver]);

  // ── Inline cell save
  const handleCellSave = async (id: string, col: EditableCol, value: string) => {
    const payload: Record<string, unknown> = { changeSource: "MANUAL_EDIT" };
    if (col === "title") payload.title = value;
    else if (col === "price") payload.price = value ? parseFloat(value) : null;
    else if (col === "area") payload.area = value;
    else if (col === "verificationStatus") payload.verificationStatus = value;

    setCellSave({ id, col, status: "saving" });
    try {
      await propertiesApi.update(id, payload);
      setCellSave({ id, col, status: "success" });
      queryClient.invalidateQueries({ queryKey: ["data-explorer"] });
      queryClient.invalidateQueries({ queryKey: ["property", id] });
      setTimeout(() => {
        setCellSave((prev) => (prev?.id === id && prev?.col === col ? null : prev));
      }, 1500);
    } catch {
      setCellSave(null);
      toast.error("Failed to save — please try again");
    }
  };

  // ── Export
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const handleExport = async (format: "csv" | "xlsx" | "pdf" = "csv") => {
    try {
      setExportMenuOpen(false);
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      let res;
      let mimeType: string;
      let ext: string;
      switch (format) {
        case "xlsx":
          res = await exportsApi.xlsx(ids);
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          ext = "xlsx";
          break;
        case "pdf":
          res = await exportsApi.pdf(ids);
          mimeType = "application/pdf";
          ext = "pdf";
          break;
        default:
          res = await exportsApi.csv(ids);
          mimeType = "text/csv";
          ext = "csv";
      }
      const blob = new Blob([res.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `properties-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  // ── Manual property creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "", listingUrl: "", source: "MANUAL", siteId: "",
    listingType: "SALE" as string, category: "RESIDENTIAL" as string,
    price: "", bedrooms: "", bathrooms: "", description: "", state: "", area: "", locationText: "",
    imageUrls: [] as string[], currentImageUrl: "",
    amenities: [] as string[],
  });

  const NIGERIAN_AMENITIES = [
    "Swimming Pool", "Gym / Fitness Center", "24hr Power Supply", "Borehole",
    "Security / Gatehouse", "Parking Space", "Garden", "Balcony",
    "Elevator / Lift", "CCTV", "Children Playground", "Boys Quarters (BQ)",
    "Air Conditioning", "Ensuite Rooms", "Walk-in Closet", "Smart Home",
    "Solar Panels", "Water Treatment", "Tennis Court", "Laundry Room",
    "Generator", "Intercom", "Fiber Optic Internet", "Gated Estate",
  ];

  const { data: sitesData } = useQuery({
    queryKey: ["sites-list"],
    queryFn: async () => {
      const res = await sitesApi.list();
      return res.data?.data || [];
    },
    enabled: showCreateForm,
  });

  const createProperty = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await propertiesApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-explorer"] });
      toast.success("Property created successfully");
      setShowCreateForm(false);
      setCreateForm({
        title: "", listingUrl: "", source: "MANUAL", siteId: "", listingType: "SALE",
        category: "RESIDENTIAL", price: "", bedrooms: "", bathrooms: "", description: "",
        state: "", area: "", locationText: "",
        imageUrls: [], currentImageUrl: "", amenities: [],
      });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to create property");
    },
  });

  const handleCreateProperty = () => {
    const payload: Record<string, unknown> = {
      title: createForm.title,
      listingUrl: createForm.listingUrl,
      source: createForm.source || "MANUAL",
      siteId: createForm.siteId,
      listingType: createForm.listingType,
      category: createForm.category,
      description: createForm.description || undefined,
      state: createForm.state || undefined,
      area: createForm.area || undefined,
      locationText: createForm.locationText || undefined,
    };
    if (createForm.price) payload.price = parseFloat(createForm.price);
    if (createForm.bedrooms) payload.bedrooms = parseInt(createForm.bedrooms);
    if (createForm.bathrooms) payload.bathrooms = parseInt(createForm.bathrooms);
    if (createForm.imageUrls.length > 0) payload.images = createForm.imageUrls;
    if (createForm.amenities.length > 0) payload.features = createForm.amenities;
    createProperty.mutate(payload);
  };

  // Active chips for display
  const activeChips = getActiveChips(advancedFilters, allSites);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Data Explorer</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            Inspect, verify, and manage scraped property data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 border"
            style={{ borderColor: "var(--primary)", color: "var(--primary)", backgroundColor: "transparent" }}
          >
            <Plus className="w-4 h-4" />
            Add Property
          </button>
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <Download className="w-4 h-4" />
              Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {exportMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border shadow-lg overflow-hidden"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                >
                  {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => handleExport(fmt)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-left"
                      style={{ color: "var(--foreground)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {fmt === "csv" ? <Download className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /> :
                       fmt === "xlsx" ? <FileSpreadsheet className="w-4 h-4" style={{ color: "#16a34a" }} /> :
                       <FileText className="w-4 h-4" style={{ color: "#dc2626" }} />}
                      {fmt === "csv" ? "CSV" : fmt === "xlsx" ? "Excel (.xlsx)" : "PDF"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl mb-4" style={{ backgroundColor: "var(--secondary)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); setSelectedIds(new Set()); setFocusedRowIndex(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? "var(--card)" : "transparent",
              color: activeTab === tab.key ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: activeTab === tab.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Toolbar: Search + Filter + Columns + Bulk Actions */}
      <div data-tour="bulk-actions" className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search properties..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
        </div>

        {/* Filter Button */}
        <button
          onClick={openFilterPanel}
          className="relative flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all hover:border-[var(--primary)]"
          style={{
            borderColor: activeFilterCount > 0 ? "var(--primary)" : "var(--border)",
            color: activeFilterCount > 0 ? "var(--primary)" : "var(--foreground)",
            backgroundColor: activeFilterCount > 0 ? "rgba(0,1,252,0.06)" : "var(--background)",
          }}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span
              className="ml-0.5 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Columns Button */}
        <div className="relative" ref={colPickerRef}>
          <button
            onClick={() => setColPickerOpen(!colPickerOpen)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all hover:border-[var(--primary)]"
            style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--background)" }}
          >
            <Columns3 className="w-4 h-4" />
            Columns
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
          </button>

          {colPickerOpen && (
            <div
              className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border shadow-xl overflow-hidden"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  Column Visibility
                </span>
                <button
                  onClick={resetColumns}
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {ALL_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors text-sm"
                    style={{ color: "var(--foreground)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <input
                      type="checkbox"
                      checked={!!colVisibility[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded accent-[var(--primary)]"
                    />
                    <span>{col.label}</span>
                    {!col.defaultVisible && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
                        extra
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-0.5 p-1 rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--secondary)" }}>
          {([
            { mode: "table" as ViewMode, icon: <LayoutList className="w-4 h-4" />, title: "Table view" },
            { mode: "cards" as ViewMode, icon: <LayoutGrid className="w-4 h-4" />, title: "Cards view" },
            { mode: "kanban" as ViewMode, icon: <Columns className="w-4 h-4" />, title: "Kanban view" },
          ]).map(({ mode, icon, title }) => (
            <button key={mode} onClick={() => persistView(mode)} title={title}
              className="p-1.5 rounded-md transition-colors"
              style={{ backgroundColor: viewMode === mode ? "var(--card)" : "transparent", color: viewMode === mode ? "var(--foreground)" : "var(--muted-foreground)" }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Stale filter toggle */}
        <button
          onClick={() => setShowStaleOnly(!showStaleOnly)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
          style={{
            borderColor: showStaleOnly ? "#f59e0b" : "var(--border)",
            backgroundColor: showStaleOnly ? "rgba(245,158,11,0.1)" : "transparent",
            color: showStaleOnly ? "#f59e0b" : "var(--muted-foreground)",
          }}
          title="Filter to properties not re-scraped in 30+ days"
        >
          <Clock className="w-3.5 h-3.5" />
          Stale{staleCount > 0 ? ` (${staleCount})` : ""}
        </button>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              {selectedIds.size} selected
            </span>
            <button onClick={() => bulkAction.mutate({ action: "verify" })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#16a34a" }}>
              Verify
            </button>
            <button onClick={() => bulkAction.mutate({ action: "flag" })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: "rgba(234,179,8,0.15)", color: "#ca8a04" }}>
              Flag
            </button>
            <button onClick={() => bulkAction.mutate({ action: "reject" })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#dc2626" }}>
              Reject
            </button>
            {/* Enrich Selected button */}
            <button
              onClick={handleLLMEnrichSelected}
              disabled={!!enrichProgress}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-60"
              style={{ borderColor: "var(--primary)", color: "var(--primary)", backgroundColor: "rgba(0,1,252,0.07)" }}
              title="Extract structured data from property descriptions using AI"
            >
              {enrichProgress ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enriching {enrichProgress.current} of {enrichProgress.total}…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Enrich Selected
                </>
              )}
            </button>
            {/* Extended bulk actions dropdown */}
            <div className="relative">
              <button onClick={() => setShowBulkDropdown(!showBulkDropdown)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--secondary)" }}>
                More <ChevronDown className="w-3 h-3" />
              </button>
              {showBulkDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowBulkDropdown(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-xl border shadow-lg overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
                    <div className="px-3 py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Set Status</p>
                    </div>
                    {[
                      { action: "status_available", label: "Set Available" },
                      { action: "status_sold", label: "Set Sold" },
                      { action: "status_expired", label: "Set Expired" },
                      { action: "status_rented", label: "Set Rented" },
                    ].map((opt) => (
                      <button key={opt.action} onClick={() => { bulkAction.mutate({ action: opt.action }); setShowBulkDropdown(false); }}
                        className="w-full text-left px-4 py-2 text-xs font-medium transition-colors" style={{ color: "var(--foreground)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                        {opt.label}
                      </button>
                    ))}
                    <div className="px-3 py-1.5 border-t border-b" style={{ borderColor: "var(--border)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Actions</p>
                    </div>
                    <button onClick={() => { handleBulkReScrape(); setShowBulkDropdown(false); }}
                      className="w-full flex items-center gap-2 text-left px-4 py-2 text-xs font-medium transition-colors" style={{ color: "var(--foreground)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <Play className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
                      Bulk Re-scrape Selected
                    </button>
                    <button onClick={() => { setShowDeleteConfirm(true); setShowBulkDropdown(false); }}
                      className="w-full flex items-center gap-2 text-left px-4 py-2 text-xs font-medium transition-colors" style={{ color: "#dc2626" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <Trash2 className="w-3.5 h-3.5" />
                      Bulk Delete ({selectedIds.size})
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Enrich by Site dropdown — always visible in toolbar */}
        <div className="relative">
          <button
            onClick={() => setShowEnrichBySiteDropdown(!showEnrichBySiteDropdown)}
            disabled={enrichBySiteLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all hover:border-[var(--primary)] disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--foreground)", backgroundColor: "var(--background)" }}
            title="Enrich all properties from a specific site using AI"
          >
            {enrichBySiteLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
            ) : (
              <Bot className="w-4 h-4" style={{ color: "var(--primary)" }} />
            )}
            <span className="hidden sm:inline">Enrich by Site</span>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
          </button>
          {showEnrichBySiteDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowEnrichBySiteDropdown(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border shadow-xl overflow-hidden"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Choose a site to enrich</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>AI will extract data from descriptions</p>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {allSites.length === 0 ? (
                    <p className="px-4 py-3 text-xs italic" style={{ color: "var(--muted-foreground)" }}>No sites found</p>
                  ) : (
                    allSites.map((site) => (
                      <button
                        key={site.id}
                        onClick={() => handleEnrichBySiteClick(site)}
                        className="w-full text-left px-4 py-2.5 text-xs font-medium flex items-center gap-2 transition-colors"
                        style={{ color: "var(--foreground)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                        {site.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium border"
              style={{
                borderColor: "var(--primary)",
                backgroundColor: "rgba(0,1,252,0.07)",
                color: "var(--primary)",
              }}
            >
              {chip.label}
              <button
                onClick={() => {
                  setAdvancedFilters((f) => removeFilter(f, chip.key));
                  setPage(1);
                }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-[rgba(0,1,252,0.15)] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs font-medium underline underline-offset-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            Clear All
          </button>
        </div>
      )}

      {/* ── CARDS VIEW ── */}
      {viewMode === "cards" && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}>
                  <Skeleton className="aspect-[4/3] w-full" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <Database size={28} style={{ color: "var(--primary)", opacity: 0.4 }} />
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No properties to display</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item: any) => (
                <PropertyCard key={item.id} item={item} onInspect={openSlideOver} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── KANBAN VIEW ── */}
      {viewMode === "kanban" && (
        <>
          {isLoading ? (
            <div className="py-8"><ModernLoader words={["Loading kanban...", "Grouping by status..."]} /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {KANBAN_STATUSES.map((status) => (
                <KanbanColumn key={status} status={status} items={items.filter((i: any) => i.verificationStatus === status)} onInspect={openSlideOver} onDrop={handleKanbanDrop} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === "table" && items.length > 0 && (
        <p className="text-[10px] mb-2" style={{ color: "var(--muted-foreground)" }}>
          Tip: ↑↓ keys navigate rows · Enter opens detail · Space toggles checkbox · Double-click a cell to edit
        </p>
      )}

      {/* Table */}
      {viewMode === "table" && <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--secondary)" }}>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className="px-3 py-3 text-left text-xs font-semibold whitespace-nowrap"
                    style={{
                      color: "var(--muted-foreground)",
                      cursor: col.sortable ? "pointer" : "default",
                    }}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortBy === col.key && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                ))}
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-3"><Skeleton className="w-4 h-4 rounded" /></td>
                      {visibleColumns.map((col) => (
                        <td key={col.key} className="px-3 py-3">
                          <Skeleton className="h-4 w-full" style={{ maxWidth: col.key === "title" ? 200 : col.key === "price" ? 80 : 120 }} />
                        </td>
                      ))}
                      <td className="px-3 py-3"><Skeleton className="w-6 h-4 rounded" /></td>
                    </tr>
                  ))}
                </>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: "rgba(0,1,252,0.08)" }}
                      >
                        <Database size={28} style={{ color: "var(--primary)", opacity: 0.5 }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                          No data to explore
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                          {searchQuery || activeFilterCount > 0
                            ? "No properties match your current filters."
                            : "Scraped property data will appear here once available."}
                        </p>
                      </div>
                      {(searchQuery || activeFilterCount > 0) && (
                        <button
                          onClick={() => { setSearchQuery(""); clearAllFilters(); }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mt-1 border transition-colors"
                          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                        >
                          Clear filters
                        </button>
                      )}
                      {!searchQuery && activeFilterCount === 0 && (
                        <a
                          href="/scraper"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mt-1 transition-colors hover:opacity-90"
                          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                        >
                          Go to Scraper
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item: any, rowIdx: number) => {
                  const isFocused = focusedRowIndex === rowIdx;
                  const isSelected = selectedIds.has(item.id);
                  // Which columns are inline-editable
                  const editableCols = new Set<string>(["title", "price", "area", "verificationStatus"]);
                  return (
                    <tr
                      key={item.id}
                      className="border-t transition-colors"
                      style={{
                        borderColor: "var(--border)",
                        backgroundColor: isFocused
                          ? "rgba(0,1,252,0.05)"
                          : isSelected
                          ? "rgba(0,1,252,0.03)"
                          : "transparent",
                        outline: isFocused ? "2px solid rgba(0,1,252,0.2)" : "none",
                        outlineOffset: "-2px",
                        cursor: "default",
                      }}
                      onClick={() => setFocusedRowIndex(rowIdx)}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      {visibleColumns.map((col) => {
                        // Special rendering for quality score — clickable popover
                        if (col.key === "qualityScore") {
                          return (
                            <td key={col.key} className="px-3 py-3 text-sm">
                              {item.qualityScore != null ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setQualityPopoverItem(item); }}
                                  className="text-xs font-bold underline decoration-dotted underline-offset-2 hover:opacity-80"
                                  style={{ color: item.qualityScore >= 80 ? "#16a34a" : item.qualityScore >= 50 ? "#ca8a04" : "#dc2626" }}
                                  title="Click to see quality breakdown"
                                >
                                  {item.qualityScore}
                                </button>
                              ) : <span>—</span>}
                            </td>
                          );
                        }
                        // Special rendering for title — stale dot indicator
                        if (col.key === "title") {
                          const stale = isStale(item);
                          return (
                            <td key={col.key} className="px-3 py-3 text-sm">
                              {editableCols.has(col.key) ? (
                                <EditableCell item={item} col={col.key as EditableCol} onSave={handleCellSave} saveState={cellSave}>
                                  <div className="flex items-center gap-1.5">
                                    {stale && <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: "#f59e0b" }} title="Stale — not re-scraped in 30+ days" />}
                                    <CellValue col={col.key} item={item} />
                                  </div>
                                </EditableCell>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {stale && <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: "#f59e0b" }} title="Stale — not re-scraped in 30+ days" />}
                                  <CellValue col={col.key} item={item} />
                                </div>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={col.key} className="px-3 py-3 text-sm">
                            {editableCols.has(col.key) ? (
                              <EditableCell
                                item={item}
                                col={col.key as EditableCol}
                                onSave={handleCellSave}
                                saveState={cellSave}
                              >
                                <CellValue col={col.key} item={item} />
                              </EditableCell>
                            ) : (
                              <CellValue col={col.key} item={item} />
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {/* Open slide-over */}
                          <button
                            onClick={(e) => { e.stopPropagation(); openSlideOver(item); }}
                            className="p-1.5 rounded-lg hover:bg-[var(--secondary)] transition-colors"
                            title="View detail"
                          >
                            <Eye className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                          </button>
                          {/* Open edit form */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditItem(item); setEditOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-[var(--secondary)] transition-colors"
                            title="Edit property"
                          >
                            <Pencil className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                          </button>
                          {/* Re-scrape (shown for stale properties) */}
                          {isStale(item) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReScrapeProperty(item); }}
                              className="p-1.5 rounded-lg hover:bg-[var(--secondary)] transition-colors"
                              title="Re-scrape this property (stale)"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Pagination */}
      {totalPages > 1 && viewMode !== "kanban" && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => { setPage(page - 1); setFocusedRowIndex(null); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => { setPage(page + 1); setFocusedRowIndex(null); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* AI Data Quality */}
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <AIPlaceholderCard
          icon={Sparkles}
          title="AI Auto-Tagging"
          description="Automatically classify, tag, and enrich raw listings with standardized categories and features."
          features={["Auto-categorize", "Feature extraction", "Normalization"]}
          compact
        />
        <AIPlaceholderCard
          icon={Bot}
          title="Duplicate Detection"
          description="AI finds the same property listed across multiple sources with different titles and prices."
          features={["Cross-source matching", "Best deal flag", "Merge suggestions"]}
          compact
        />
      </div>

      {/* ─── Property Detail Slide-Over ─────────────────────────────────────────── */}
      <PropertyDetailSlideOver
        property={slideOverItem}
        open={slideOverOpen}
        onClose={closeSlideOver}
        onPrev={() => navigateSlideOver("prev")}
        onNext={() => navigateSlideOver("next")}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onEditOpen={(prop) => {
          setEditItem(prop);
          setEditOpen(true);
        }}
        onReScrape={handleReScrapeProperty}
        onQualityClick={setQualityPopoverItem}
      />

      {/* ─── Quality Score Breakdown Popover ─────────────────────────────────────── */}
      {qualityPopoverItem && (
        <QualityPopover item={qualityPopoverItem} onClose={() => setQualityPopoverItem(null)} />
      )}

      {/* ─── Bulk Delete Confirmation ─────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border shadow-2xl" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="px-6 py-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <Trash2 className="w-6 h-6" style={{ color: "#dc2626" }} />
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: "var(--foreground)" }}>
                Delete {selectedIds.size} {selectedIds.size === 1 ? "Property" : "Properties"}?
              </h3>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                This soft-deletes the selected properties. They can be restored from trash.
              </p>
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                Cancel
              </button>
              <button onClick={() => { bulkAction.mutate({ action: "delete" }); setShowDeleteConfirm(false); }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: "#dc2626", color: "#fff" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Enrich by Site Confirmation ─────────────────────────────────────────── */}
      {enrichBySiteConfirm && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border shadow-2xl" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="px-6 py-5">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(0,1,252,0.1)" }}>
                <Sparkles className="w-6 h-6" style={{ color: "var(--primary)" }} />
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: "var(--foreground)" }}>
                Enrich {enrichBySiteConfirm.count} {enrichBySiteConfirm.count === 1 ? "Property" : "Properties"}?
              </h3>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                AI will extract structured data from the descriptions of all {enrichBySiteConfirm.count} properties from{" "}
                <span className="font-semibold" style={{ color: "var(--foreground)" }}>{enrichBySiteConfirm.site.name}</span>.
                Only missing fields will be filled — existing data is never overwritten.
              </p>
              {enrichBySiteConfirm.count > 50 && (
                <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(234,179,8,0.1)", color: "#ca8a04" }}>
                  This may take several minutes for large batches.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setEnrichBySiteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEnrichBySite}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Enrich {enrichBySiteConfirm.count}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PropertyEditForm ────────────────────────────────────────────────────── */}
      {editItem && (
        <PropertyEditForm
          property={editItem}
          open={editOpen}
          onOpenChange={(v) => {
            setEditOpen(v);
            if (!v) {
              queryClient.invalidateQueries({ queryKey: ["data-explorer"] });
            }
          }}
        />
      )}

      {/* ─── Advanced Filter Side Panel ────────────────────────────────────────── */}
      <SideSheet open={filterPanelOpen} onOpenChange={setFilterPanelOpen} side="right" width="420px">
        <SideSheetContent>
          {/* Header */}
          <div
            className="flex items-center justify-between pb-4 border-b mb-5"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <SideSheetHeader>
                <SideSheetTitle>
                  <span style={{ color: "var(--foreground)" }}>Advanced Filters</span>
                </SideSheetTitle>
              </SideSheetHeader>
              {countActiveFilters(draftFilters) > 0 && (
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {countActiveFilters(draftFilters)} filter{countActiveFilters(draftFilters) !== 1 ? "s" : ""} active
                </p>
              )}
            </div>
            <button
              onClick={() => setFilterPanelOpen(false)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--muted-foreground)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--secondary)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter form */}
          <div className="space-y-5 pb-24">

            {/* Date Range */}
            <FilterSection title="Date Range (Scraped)">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>From</label>
                  <input
                    type="date"
                    value={draftFilters.startDate}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, startDate: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>To</label>
                  <input
                    type="date"
                    value={draftFilters.endDate}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, endDate: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
            </FilterSection>

            {/* Price Range */}
            <FilterSection title="Price Range (₦)">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Min Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>₦</span>
                    <input
                      type="number"
                      min={0}
                      value={draftFilters.minPrice}
                      onChange={(e) => setDraftFilters((f) => ({ ...f, minPrice: e.target.value }))}
                      placeholder="0"
                      className={inputCls + " pl-7"}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Max Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>₦</span>
                    <input
                      type="number"
                      min={0}
                      value={draftFilters.maxPrice}
                      onChange={(e) => setDraftFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                      placeholder="Any"
                      className={inputCls + " pl-7"}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </FilterSection>

            {/* Quality Score */}
            <FilterSection title="Quality Score (0–100)">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Min</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draftFilters.minQuality}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, minQuality: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Max</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draftFilters.maxQuality}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, maxQuality: e.target.value }))}
                    placeholder="100"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
            </FilterSection>

            {/* Source Site */}
            <FilterSection title="Source Site">
              {allSites.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>No sites configured.</p>
              ) : (
                <SearchableMultiSelect
                  values={draftFilters.siteIds}
                  onChange={(v) => setDraftFilters((f) => ({ ...f, siteIds: v }))}
                  options={allSites.map((site) => ({ value: site.id, label: site.name }))}
                  placeholder="Select sites..."
                  searchPlaceholder="Search sites..."
                  maxHeight={144}
                />
              )}
            </FilterSection>

            {/* Location */}
            <FilterSection title="Location">
              <div>
                <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>State</label>
                <SearchableSelect
                  value={draftFilters.state}
                  onChange={(v) => setDraftFilters((f) => ({ ...f, state: v, area: "" }))}
                  options={NIGERIAN_STATES.map((s) => ({ value: s, label: s }))}
                  placeholder="All States"
                  searchPlaceholder="Search states..."
                />
              </div>
              <div className="mt-2">
                <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                  Area {draftFilters.state && <span style={{ color: "var(--primary)" }}>in {draftFilters.state}</span>}
                </label>
                <input
                  type="text"
                  value={draftFilters.area}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, area: e.target.value }))}
                  placeholder="e.g. Lekki Phase 1"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </FilterSection>

            {/* Category */}
            <FilterSection title="Category">
              <ChipMultiSelect
                options={CATEGORIES}
                selected={draftFilters.categories}
                onChange={(v) => setDraftFilters((f) => ({ ...f, categories: v }))}
              />
            </FilterSection>

            {/* Listing Type */}
            <FilterSection title="Listing Type">
              <ChipMultiSelect
                options={LISTING_TYPES}
                selected={draftFilters.listingTypes}
                onChange={(v) => setDraftFilters((f) => ({ ...f, listingTypes: v }))}
              />
            </FilterSection>

            {/* Has Images */}
            <FilterSection title="Has Images">
              <TriStateToggle
                value={draftFilters.hasImages}
                onChange={(v) => setDraftFilters((f) => ({ ...f, hasImages: v }))}
              />
            </FilterSection>

            {/* Has Coordinates */}
            <FilterSection title="Has Coordinates">
              <TriStateToggle
                value={draftFilters.hasCoordinates}
                onChange={(v) => setDraftFilters((f) => ({ ...f, hasCoordinates: v }))}
              />
            </FilterSection>

            {/* Bedrooms */}
            <FilterSection title="Bedrooms">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Min</label>
                  <input
                    type="number"
                    min={0}
                    value={draftFilters.minBedrooms}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, minBedrooms: e.target.value }))}
                    placeholder="Any"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Max</label>
                  <input
                    type="number"
                    min={0}
                    value={draftFilters.maxBedrooms}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, maxBedrooms: e.target.value }))}
                    placeholder="Any"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
            </FilterSection>

            {/* Bathrooms */}
            <FilterSection title="Bathrooms">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Min</label>
                  <input
                    type="number"
                    min={0}
                    value={draftFilters.minBathrooms}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, minBathrooms: e.target.value }))}
                    placeholder="Any"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Max</label>
                  <input
                    type="number"
                    min={0}
                    value={draftFilters.maxBathrooms}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, maxBathrooms: e.target.value }))}
                    placeholder="Any"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
            </FilterSection>
          </div>

          {/* Sticky footer with Apply / Reset */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center gap-3 px-6 py-4 border-t"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => {
                setDraftFilters(DEFAULT_FILTERS);
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              Reset
            </button>
            <button
              onClick={applyFilters}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Apply Filters
              {countActiveFilters(draftFilters) > 0 && (
                <span className="ml-1.5 opacity-80">({countActiveFilters(draftFilters)})</span>
              )}
            </button>
          </div>
        </SideSheetContent>
      </SideSheet>

      {/* ─── Inspect Panel ──────────────────────────────────────────────────────── */}
      {inspectItem && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-2xl max-h-[80vh] rounded-xl border shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <h2 className="text-lg font-semibold truncate" style={{ color: "var(--foreground)" }}>
                {inspectItem.title}
              </h2>
              <button onClick={() => setInspectItem(null)} className="p-1 rounded-lg hover:bg-[var(--secondary)]">
                <X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <pre
                className="text-xs whitespace-pre-wrap break-all rounded-lg p-4"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
              >
                {JSON.stringify(inspectItem, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ─── Manual Property Creation Modal ─────────────────────────────────────── */}
      {showCreateForm && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-lg max-h-[85vh] rounded-xl border shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                Add Property Manually
              </h2>
              <button onClick={() => setShowCreateForm(false)} className="p-1 rounded-lg hover:bg-[var(--secondary)]">
                <X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Title *</label>
                <input
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. 3 Bedroom Flat in Lekki"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              {/* Listing URL */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Listing URL *</label>
                <input
                  value={createForm.listingUrl}
                  onChange={(e) => setCreateForm((f) => ({ ...f, listingUrl: e.target.value }))}
                  placeholder="https://example.com/property/123"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              {/* Site */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Source Site *</label>
                <SearchableSelect
                  value={createForm.siteId}
                  onChange={(v) => setCreateForm((f) => ({ ...f, siteId: v }))}
                  options={(sitesData || []).map((site: any) => ({ value: site.id, label: site.name }))}
                  placeholder="Select a site..."
                  searchPlaceholder="Search sites..."
                />
              </div>
              {/* Type + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Listing Type *</label>
                  <select
                    value={createForm.listingType}
                    onChange={(e) => setCreateForm((f) => ({ ...f, listingType: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                  >
                    <option value="SALE">For Sale</option>
                    <option value="RENT">For Rent</option>
                    <option value="LEASE">Lease</option>
                    <option value="SHORTLET">Shortlet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Category</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                  >
                    <option value="RESIDENTIAL">Residential</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="LAND">Land</option>
                    <option value="SHORTLET">Shortlet</option>
                    <option value="INDUSTRIAL">Industrial</option>
                  </select>
                </div>
              </div>
              {/* Price + Beds + Baths */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Price</label>
                  <input
                    type="number"
                    value={createForm.price}
                    onChange={(e) => setCreateForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Bedrooms</label>
                  <input
                    type="number"
                    value={createForm.bedrooms}
                    onChange={(e) => setCreateForm((f) => ({ ...f, bedrooms: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Bathrooms</label>
                  <input
                    type="number"
                    value={createForm.bathrooms}
                    onChange={(e) => setCreateForm((f) => ({ ...f, bathrooms: e.target.value }))}
                    placeholder="0"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
              {/* Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>State</label>
                  <SearchableSelect
                    value={createForm.state}
                    onChange={(v) => setCreateForm((f) => ({ ...f, state: v }))}
                    options={NIGERIAN_STATES.map((s) => ({ value: s, label: s }))}
                    placeholder="e.g. Lagos"
                    searchPlaceholder="Search states..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Area</label>
                  <input
                    value={createForm.area}
                    onChange={(e) => setCreateForm((f) => ({ ...f, area: e.target.value }))}
                    placeholder="e.g. Lekki Phase 1"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Property description..."
                  rows={3}
                  className={inputCls + " resize-none"}
                  style={inputStyle}
                />
              </div>

              {/* ── Image URLs ─────────────────────────────────────────────── */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                  Image URLs
                </label>
                <div className="flex gap-2">
                  <input
                    value={createForm.currentImageUrl}
                    onChange={(e) => setCreateForm((f) => ({ ...f, currentImageUrl: e.target.value }))}
                    placeholder="https://example.com/image.jpg"
                    className={inputCls}
                    style={inputStyle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const url = createForm.currentImageUrl.trim();
                        if (url && !createForm.imageUrls.includes(url)) {
                          setCreateForm((f) => ({
                            ...f,
                            imageUrls: [...f.imageUrls, url],
                            currentImageUrl: "",
                          }));
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = createForm.currentImageUrl.trim();
                      if (url && !createForm.imageUrls.includes(url)) {
                        setCreateForm((f) => ({
                          ...f,
                          imageUrls: [...f.imageUrls, url],
                          currentImageUrl: "",
                        }));
                      }
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-colors"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
                  Press Enter or click + to add. Add multiple image URLs.
                </p>
                {createForm.imageUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {createForm.imageUrls.map((url, i) => (
                      <div
                        key={i}
                        className="group relative w-16 h-16 rounded-lg overflow-hidden border"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Image ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).parentElement!.classList.add("bg-red-50");
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setCreateForm((f) => ({
                            ...f,
                            imageUrls: f.imageUrls.filter((_, idx) => idx !== i),
                          }))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                        <span
                          className="absolute bottom-0 left-0 right-0 text-[8px] text-center py-0.5 truncate px-1"
                          style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff" }}
                        >
                          {i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Amenities / Features ────────────────────────────────────── */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>
                  Amenities / Features
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {NIGERIAN_AMENITIES.map((amenity) => {
                    const isActive = createForm.amenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => {
                          setCreateForm((f) => ({
                            ...f,
                            amenities: isActive
                              ? f.amenities.filter((a) => a !== amenity)
                              : [...f.amenities, amenity],
                          }));
                        }}
                        className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                        style={{
                          backgroundColor: isActive ? "var(--primary)" : "transparent",
                          borderColor: isActive ? "var(--primary)" : "var(--border)",
                          color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
                        }}
                      >
                        {amenity}
                      </button>
                    );
                  })}
                </div>
                {createForm.amenities.length > 0 && (
                  <p className="text-[10px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                    {createForm.amenities.length} selected
                  </p>
                )}
              </div>
            </div>
            {/* Footer */}
            <div
              className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProperty}
                disabled={!createForm.title || !createForm.listingUrl || !createForm.siteId || createProperty.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {createProperty.isPending ? "Creating..." : "Create Property"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
