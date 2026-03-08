"use client";

import { use, useState, useRef, useEffect } from "react";
import { useProperty, useProperties, usePropertyVersions, usePropertyPriceHistory } from "@/hooks/useProperties";
import { PropertyCard } from "@/components/property/property-card";
import { MOCK_PROPERTIES } from "@/lib/mock-data";
import { formatPrice, formatNumber, pluralize, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ChevronLeft, MapPin, BedDouble, Bath, Maximize2, Calendar, Star, Shield,
  ExternalLink, Phone, Mail, Building, Building2, User, Clock, Tag, ChevronDown,
  ChevronUp, ChevronRight, Layers, TrendingUp, Share2, Heart, Copy, Check,
  Warehouse, Car, Zap, Wifi, Droplets, Trees, Fence, ShieldCheck, Eye,
  MessageCircle, Bookmark, SquareStack, Ruler, Home, ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { Property, PropertyVersion, PriceHistoryEntry } from "@/types/property";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS: Record<string, string> = {
  RESIDENTIAL: "#3b82f6",
  LAND: "#10b981",
  SHORTLET: "#f97316",
  COMMERCIAL: "#8b5cf6",
  INDUSTRIAL: "#64748b",
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  AVAILABLE: { bg: "#dcfce7", color: "#166534", label: "Active" },
  SOLD: { bg: "#fee2e2", color: "#991b1b", label: "Sold" },
  RENTED: { bg: "#dbeafe", color: "#1e40af", label: "Rented" },
  UNDER_OFFER: { bg: "#fef3c7", color: "#92400e", label: "Under Offer" },
  WITHDRAWN: { bg: "#f3f4f6", color: "#374151", label: "Withdrawn" },
  EXPIRED: { bg: "#f3f4f6", color: "#6b7280", label: "Expired" },
};

const LISTING_TYPE_LABELS: Record<string, string> = {
  SALE: "For Sale",
  RENT: "For Rent",
  LEASE: "For Lease",
  SHORTLET: "Shortlet",
};

const AMENITY_ICONS: Record<string, React.ElementType> = {
  parking: Car,
  garage: Car,
  swimming: Droplets,
  pool: Droplets,
  wifi: Wifi,
  internet: Wifi,
  security: ShieldCheck,
  guard: ShieldCheck,
  garden: Trees,
  electricity: Zap,
  generator: Zap,
  power: Zap,
  water: Droplets,
  borehole: Droplets,
  fence: Fence,
  warehouse: Warehouse,
};

function getAmenityIcon(feature: string): React.ElementType {
  const lower = feature.toLowerCase();
  for (const [key, Icon] of Object.entries(AMENITY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return Check;
}

/* ------------------------------------------------------------------ */
/*  Image Gallery                                                      */
/* ------------------------------------------------------------------ */

function ImageGallery({ images }: { images: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);

  if (!images.length) {
    return (
      <div
        className="w-full aspect-[16/9] rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <Building2 size={48} style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  return (
    <>
      {/* Main Image */}
      <div className="relative group">
        <div
          className="w-full aspect-[16/9] md:aspect-[2/1] rounded-2xl overflow-hidden cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        >
          <motion.img
            key={activeIndex}
            src={images[activeIndex]}
            alt=""
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />

          {/* Status + count overlay */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white backdrop-blur-md"
              style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            >
              <Eye size={14} />
              View All {images.length} {pluralize(images.length, "Image")}
            </button>
          </div>

          {/* Nav arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIndex(i => (i - 1 + images.length) % images.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
                style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
              >
                <ChevronDown size={18} className="rotate-90" style={{ color: "var(--foreground)" }} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveIndex(i => (i + 1) % images.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
                style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
              >
                <ChevronDown size={18} className="-rotate-90" style={{ color: "var(--foreground)" }} />
              </button>
            </>
          )}
        </div>

        {/* Thumbnails strip */}
        {images.length > 1 && (
          <div ref={thumbsRef} className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className="shrink-0 w-16 h-12 md:w-20 md:h-14 rounded-lg overflow-hidden transition-all"
                style={{
                  outline: i === activeIndex ? "2px solid var(--primary)" : "2px solid transparent",
                  outlineOffset: "2px",
                  opacity: i === activeIndex ? 1 : 0.6,
                }}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/90"
              onClick={() => setLightboxOpen(false)}
            />
            <div className="relative z-10 max-w-[90vw] max-h-[90vh]">
              <motion.img
                key={activeIndex}
                src={images[activeIndex]}
                alt=""
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
              {/* Lightbox nav */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 p-4">
                <button
                  onClick={() => setActiveIndex(i => (i - 1 + images.length) % images.length)}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                  <ChevronDown size={20} className="rotate-90 text-white" />
                </button>
                <span className="text-white text-sm font-medium">
                  {activeIndex + 1} / {images.length}
                </span>
                <button
                  onClick={() => setActiveIndex(i => (i + 1) % images.length)}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                  <ChevronDown size={20} className="-rotate-90 text-white" />
                </button>
              </div>
              {/* Close */}
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-12 right-0 text-white/80 hover:text-white text-sm font-medium"
              >
                Close (Esc)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick Stat Pill                                                    */
/* ------------------------------------------------------------------ */

function QuickStat({ icon: Icon, value, label }: {
  icon: React.ElementType;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-3 sm:px-5 sm:py-4 min-w-0">
      <Icon size={20} style={{ color: "var(--primary)" }} />
      <p className="text-base sm:text-lg font-display font-bold" style={{ color: "var(--foreground)" }}>
        {value}
      </p>
      <p className="text-[10px] sm:text-xs uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible Section                                                */
/* ------------------------------------------------------------------ */

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children }: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-5 text-left transition-colors"
        style={{ color: "var(--foreground)" }}
      >
        <div className="flex items-center gap-2.5">
          <Icon size={16} style={{ color: "var(--primary)" }} />
          <h3 className="font-display font-semibold text-sm">{title}</h3>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} style={{ color: "var(--muted-foreground)" }} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Row                                                         */
/* ------------------------------------------------------------------ */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]" style={{ color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Version Timeline                                                   */
/* ------------------------------------------------------------------ */

function VersionTimeline({ versions = [] }: { versions: PropertyVersion[] }) {
  if (!versions.length) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No version history available</p>;
  }

  return (
    <div className="space-y-0">
      {versions.map((v, i) => (
        <div key={v.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full mt-1.5" style={{ backgroundColor: "var(--primary)" }} />
            {i < versions.length - 1 && (
              <div className="w-px flex-1 min-h-[20px]" style={{ backgroundColor: "var(--border)" }} />
            )}
          </div>
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>v{v.version}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
              >
                {v.changeSource}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {v.changeSummary || v.changedFields?.join(", ") || "Initial version"}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--muted-foreground)" }}>
              {new Date(v.createdAt).toLocaleString()}
              {v.editor && ` by ${v.editor.firstName || v.editor.email}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Price History Chart                                                */
/* ------------------------------------------------------------------ */

function PriceChart({ history }: { history: PriceHistoryEntry[] }) {
  if (!history.length) {
    return <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No price history recorded</p>;
  }

  const prices = history.map((h) => h.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const range = maxPrice - minPrice || 1;
  const latestChange = history.length > 1
    ? ((history[history.length - 1].price - history[history.length - 2].price) / history[history.length - 2].price) * 100
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
        <div className="flex items-center gap-4">
          <span>Low: <strong style={{ color: "var(--foreground)" }}>{formatPrice(minPrice)}</strong></span>
          <span>High: <strong style={{ color: "var(--foreground)" }}>{formatPrice(maxPrice)}</strong></span>
        </div>
        {latestChange !== 0 && (
          <span className="font-semibold" style={{ color: latestChange > 0 ? "var(--success)" : "var(--destructive)" }}>
            {latestChange > 0 ? "+" : ""}{latestChange.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-end gap-1.5 h-28">
        {history.map((h, i) => {
          const height = ((h.price - minPrice) / range) * 100 || 20;
          return (
            <motion.div
              key={h.id}
              className="flex-1 flex flex-col items-center gap-1 group relative"
              initial={{ height: 0 }}
              animate={{ height: "100%" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
            >
              <div className="flex-1 w-full flex items-end">
                <div
                  className="w-full rounded-t-sm transition-colors group-hover:opacity-100"
                  style={{
                    height: `${Math.max(height, 8)}%`,
                    backgroundColor: "var(--accent)",
                    opacity: 0.5 + (i / history.length) * 0.5,
                  }}
                />
              </div>
              <span className="text-[8px] sm:text-[9px]" style={{ color: "var(--muted-foreground)" }}>
                {new Date(h.recordedAt).toLocaleDateString("en-NG", { month: "short", year: "2-digit" })}
              </span>
              {/* Hover tooltip */}
              <div
                className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
                style={{ backgroundColor: "var(--foreground)", color: "var(--background)" }}
              >
                {formatPrice(h.price)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton Loading                                                   */
/* ------------------------------------------------------------------ */

function PropertyDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-300">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Image */}
      <Skeleton className="w-full aspect-[16/9] md:aspect-[2/1] rounded-2xl" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="w-20 h-14 rounded-lg shrink-0" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          {/* Stats row */}
          <Skeleton className="h-24 w-full rounded-xl" />
          {/* Description */}
          <Skeleton className="h-40 w-full rounded-xl" />
          {/* Details */}
          <Skeleton className="h-60 w-full rounded-xl" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: apiProperty, isLoading } = useProperty(id);
  const { data: versionsData } = usePropertyVersions(id);
  const { data: priceHistory } = usePropertyPriceHistory(id);

  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);

  const mockProperty = MOCK_PROPERTIES.find(p => p.id === id);
  const property = apiProperty || mockProperty;

  // Fetch similar properties (same category + area, fallback to same category)
  const { data: similarData } = useProperties({
    category: property ? [property.category] : undefined,
    limit: 8,
  });

  if (isLoading) return <PropertyDetailSkeleton />;

  if (!property) {
    return (
      <div className="text-center py-20">
        <Building2 size={48} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
        <p className="text-lg font-display font-semibold" style={{ color: "var(--foreground)" }}>Property not found</p>
        <p className="text-sm mt-1 mb-4" style={{ color: "var(--muted-foreground)" }}>
          This property may have been removed or the link is incorrect.
        </p>
        <Link
          href="/properties"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white"
          style={{ backgroundColor: "var(--primary)" }}
        >
          <ArrowLeft size={14} />
          Back to Properties
        </Link>
      </div>
    );
  }

  const images = Array.isArray(property.images) ? property.images : [];
  const statusStyle = STATUS_STYLES[property.status] || STATUS_STYLES.AVAILABLE;
  const categoryColor = CATEGORY_COLORS[property.category] || CATEGORY_COLORS.RESIDENTIAL;
  const location = property.locationText || [property.area, property.lga, property.state].filter(Boolean).join(", ");
  const versions = versionsData?.data || [];
  const desc = property.description || "";
  const isLongDesc = desc.length > 300;
  const allFeatures = [...(property.features || []), ...(property.security || []), ...(property.utilities || [])];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
        <Link href="/" className="hover:underline">Dashboard</Link>
        <ChevronRight size={12} />
        <Link href="/properties" className="hover:underline">Properties</Link>
        <ChevronRight size={12} />
        <span className="font-medium truncate max-w-[200px]" style={{ color: "var(--foreground)" }}>
          {property.title}
        </span>
      </div>

      {/* Image Gallery */}
      <ImageGallery images={images} />

      {/* Title + Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
              style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
            >
              {statusStyle.label}
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white uppercase"
              style={{ backgroundColor: categoryColor }}
            >
              {property.category}
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
            >
              {LISTING_TYPE_LABELS[property.listingType] || property.listingType}
            </span>
            {property.isPremium && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
                Premium
              </span>
            )}
            {property.isFeatured && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
                Featured
              </span>
            )}
            {property.isHotDeal && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700">
                Hot Deal
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-display font-bold leading-tight" style={{ color: "var(--foreground)" }}>
            {property.title}
          </h1>
          <div className="flex items-center gap-1.5 mt-1.5">
            <MapPin size={13} style={{ color: "var(--muted-foreground)" }} />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>{location || "Location not specified"}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyLink}
            className="p-2.5 rounded-xl transition-colors"
            style={{ backgroundColor: "var(--secondary)" }}
            title="Copy link"
          >
            {copied ? <Check size={16} style={{ color: "var(--success)" }} /> : <Copy size={16} style={{ color: "var(--muted-foreground)" }} />}
          </button>
          <button
            className="p-2.5 rounded-xl transition-colors"
            style={{ backgroundColor: "var(--secondary)" }}
            title="Share"
          >
            <Share2 size={16} style={{ color: "var(--muted-foreground)" }} />
          </button>
          {property.listingUrl && (
            <a
              href={property.listingUrl}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">View Source</span>
            </a>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ============= Left: Main Content ============= */}
        <div className="lg:col-span-2 space-y-5">

          {/* Quick Stats Row */}
          <div
            className="rounded-xl grid grid-cols-2 sm:grid-cols-4 divide-x"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            {property.bedrooms != null && (
              <QuickStat icon={BedDouble} value={property.bedrooms} label={pluralize(property.bedrooms, "Bedroom")} />
            )}
            {property.bathrooms != null && (
              <QuickStat icon={Bath} value={property.bathrooms} label={pluralize(property.bathrooms, "Bathroom")} />
            )}
            {(property.landSizeSqm || property.buildingSizeSqm) && (
              <QuickStat
                icon={Maximize2}
                value={`${formatNumber(Math.round(property.landSizeSqm || property.buildingSizeSqm || 0))}`}
                label={property.landSizeSqm ? "Land (sqm)" : "Building (sqm)"}
              />
            )}
            {property.floors != null && (
              <QuickStat icon={Layers} value={property.floors} label={pluralize(property.floors, "Floor")} />
            )}
            {property.parkingSpaces != null && property.parkingSpaces > 0 && !property.floors && (
              <QuickStat icon={Car} value={property.parkingSpaces} label={pluralize(property.parkingSpaces, "Parking")} />
            )}
            {property.toilets != null && property.toilets > 0 && !property.floors && (
              <QuickStat icon={Droplets} value={property.toilets} label={pluralize(property.toilets, "Toilet")} />
            )}
          </div>

          {/* About / Description */}
          {desc && (
            <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
              <h2 className="font-display font-semibold text-sm mb-3" style={{ color: "var(--foreground)" }}>
                About this property
              </h2>
              <div className="relative">
                <p
                  className={cn(
                    "text-sm leading-relaxed whitespace-pre-line",
                    !descExpanded && isLongDesc && "line-clamp-5"
                  )}
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {desc}
                </p>
                {isLongDesc && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="flex items-center gap-1 mt-2 text-xs font-semibold transition-colors"
                    style={{ color: "var(--primary)" }}
                  >
                    {descExpanded ? (
                      <>Show less <ChevronUp size={14} /></>
                    ) : (
                      <>Read more <ChevronDown size={14} /></>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Features & Amenities */}
          {allFeatures.length > 0 && (
            <CollapsibleSection title="Features & Amenities" icon={Star}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allFeatures.map((f) => {
                  const FeatureIcon = getAmenityIcon(f);
                  return (
                    <div
                      key={f}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
                      style={{ backgroundColor: "var(--secondary)" }}
                    >
                      <FeatureIcon size={14} style={{ color: "var(--primary)" }} />
                      <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{f}</span>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          {/* Property Details (Specs) */}
          <CollapsibleSection title="Property Details" icon={Building}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <div>
                <DetailRow label="Property Type" value={property.propertyType} />
                <DetailRow label="Listing Type" value={LISTING_TYPE_LABELS[property.listingType] || property.listingType} />
                <DetailRow label="Category" value={property.category} />
                <DetailRow label="Condition" value={property.condition !== "UNKNOWN" ? property.condition?.replace("_", " ") : undefined} />
                <DetailRow label="Furnishing" value={property.furnishing !== "UNKNOWN" ? property.furnishing?.replace("_", " ") : undefined} />
                <DetailRow label="Year Built" value={property.yearBuilt} />
              </div>
              <div>
                <DetailRow label="Land Size" value={property.landSize || (property.landSizeSqm ? `${formatNumber(Math.round(property.landSizeSqm))} sqm` : undefined)} />
                <DetailRow label="Building Size" value={property.buildingSize || (property.buildingSizeSqm ? `${formatNumber(Math.round(property.buildingSizeSqm))} sqm` : undefined)} />
                <DetailRow label="Plot Dimensions" value={property.plotDimensions} />
                <DetailRow label="Parking Spaces" value={property.parkingSpaces} />
                <DetailRow label="BQ" value={property.bq ? `${property.bq} room${property.bq > 1 ? "s" : ""}` : undefined} />
                <DetailRow label="Units Available" value={property.unitsAvailable} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Location */}
          <CollapsibleSection title="Location" icon={MapPin}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                <DetailRow label="Full Address" value={property.fullAddress} />
                <DetailRow label="Estate" value={property.estateName} />
                <DetailRow label="Area" value={property.area} />
                <DetailRow label="LGA" value={property.lga} />
                <DetailRow label="State" value={property.state} />
                <DetailRow label="Country" value={property.country !== "NG" ? property.country : "Nigeria"} />
              </div>
              {property.landmarks && property.landmarks.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium mb-2" style={{ color: "var(--muted-foreground)" }}>Nearby Landmarks</p>
                  <div className="flex flex-wrap gap-2">
                    {property.landmarks.map((l: string) => (
                      <span
                        key={l}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
                        style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Version History */}
          <CollapsibleSection title="Version History" icon={Clock} defaultOpen={false}>
            <VersionTimeline versions={versions} />
          </CollapsibleSection>
        </div>

        {/* ============= Right: Sidebar ============= */}
        <div className="space-y-5">

          {/* Price Card */}
          <div className="rounded-xl p-5 sticky top-[72px]" style={{ backgroundColor: "var(--card)" }}>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
              {property.listingType === "RENT" ? "Monthly Rent" : "Total Price"}
            </p>
            <p className="text-2xl sm:text-3xl font-display font-bold" style={{ color: "var(--accent)" }}>
              {formatPrice(property.price)}
            </p>
            {property.rentFrequency && (
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                per {property.rentFrequency}
              </span>
            )}

            {/* Price breakdown */}
            <div className="mt-4 space-y-0">
              {property.pricePerSqm != null && property.pricePerSqm > 0 && (
                <DetailRow label="Price per sqm" value={formatPrice(property.pricePerSqm)} />
              )}
              {property.serviceCharge != null && property.serviceCharge > 0 && (
                <DetailRow
                  label={`Service Charge${property.serviceChargeFreq ? ` (${property.serviceChargeFreq})` : ""}`}
                  value={formatPrice(property.serviceCharge)}
                />
              )}
              {property.legalFees != null && property.legalFees > 0 && (
                <DetailRow label="Legal Fees" value={formatPrice(property.legalFees)} />
              )}
              {property.agentCommission != null && property.agentCommission > 0 && (
                <DetailRow label="Agent Commission" value={`${property.agentCommission}%`} />
              )}
              {property.initialDeposit != null && property.initialDeposit > 0 && (
                <DetailRow label="Initial Deposit" value={formatPrice(property.initialDeposit)} />
              )}
              {property.priceNegotiable && (
                <div className="flex items-center gap-1.5 pt-2">
                  <Check size={12} style={{ color: "var(--success)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--success)" }}>Price negotiable</span>
                </div>
              )}
            </div>

            {/* Quality score */}
            {property.qualityScore != null && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)" }}>
                <Star size={14} fill="#facc15" stroke="#facc15" />
                <div className="flex-1">
                  <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                    Quality Score: {property.qualityScore}/100
                  </p>
                  <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${property.qualityScore}%`,
                        backgroundColor: property.qualityScore >= 70 ? "var(--success)" : property.qualityScore >= 40 ? "#f59e0b" : "var(--destructive)",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Agent / Contact Card */}
          {(property.agentName || property.agencyName) && (
            <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
              <h3 className="font-display font-semibold text-sm mb-4" style={{ color: "var(--foreground)" }}>
                Contact Agent
              </h3>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "var(--secondary)" }}
                >
                  {property.agencyLogo ? (
                    <img src={property.agencyLogo} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User size={20} style={{ color: "var(--muted-foreground)" }} />
                  )}
                </div>
                <div>
                  {property.agentName && (
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      {property.agentName}
                    </p>
                  )}
                  {property.agencyName && (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {property.agencyName}
                    </p>
                  )}
                  {property.agentVerified && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <ShieldCheck size={10} style={{ color: "var(--success)" }} />
                      <span className="text-[10px] font-medium" style={{ color: "var(--success)" }}>Verified</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {property.agentPhone && (
                  <a
                    href={`tel:${property.agentPhone}`}
                    className="flex items-center gap-2.5 w-full py-3 px-4 rounded-xl text-sm font-semibold text-white text-center justify-center transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    <Phone size={15} />
                    {property.agentPhone}
                  </a>
                )}
                {property.agentEmail && (
                  <a
                    href={`mailto:${property.agentEmail}`}
                    className="flex items-center gap-2.5 w-full py-3 px-4 rounded-xl text-sm font-semibold text-center justify-center transition-colors"
                    style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                  >
                    <Mail size={15} />
                    Send Email
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Price History */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={14} style={{ color: "var(--accent)" }} />
              <h3 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                Price History
              </h3>
            </div>
            <PriceChart history={priceHistory || []} />
          </div>

          {/* Metadata */}
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)" }}>
            <h3 className="font-display font-semibold text-sm mb-3" style={{ color: "var(--foreground)" }}>
              Listing Info
            </h3>
            <div className="space-y-0">
              <DetailRow label="Property ID" value={
                <span className="font-mono text-[11px]">{property.id.slice(0, 12)}...</span>
              } />
              <DetailRow label="Version" value={`v${property.currentVersion}`} />
              <DetailRow label="Verification" value={property.verificationStatus} />
              <DetailRow label="Source" value={property.site?.name || property.source} />
              <DetailRow label="Days on Market" value={property.daysOnMarket} />
              <DetailRow label="Views" value={property.viewCount > 0 ? formatNumber(property.viewCount) : undefined} />
              <DetailRow label="Inquiries" value={property.inquiryCount > 0 ? formatNumber(property.inquiryCount) : undefined} />
              <DetailRow label="Created" value={new Date(property.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} />
              <DetailRow label="Last Updated" value={new Date(property.updatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} />
            </div>
          </div>
        </div>
      </div>

      {/* ============= Similar Properties Carousel ============= */}
      {(() => {
        const similarProperties = (similarData?.data || MOCK_PROPERTIES)
          .filter((p: Property) => p.id !== property.id)
          .slice(0, 8);

        if (!similarProperties.length) return null;

        return (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-semibold text-base sm:text-lg" style={{ color: "var(--foreground)" }}>
                  Similar Properties
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {property.category.toLowerCase()} properties you might be interested in
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => carouselRef.current?.scrollBy({ left: -320, behavior: "smooth" })}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ backgroundColor: "var(--secondary)" }}
                >
                  <ChevronLeft size={16} style={{ color: "var(--foreground)" }} />
                </button>
                <button
                  onClick={() => carouselRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ backgroundColor: "var(--secondary)" }}
                >
                  <ChevronRight size={16} style={{ color: "var(--foreground)" }} />
                </button>
              </div>
            </div>

            <div
              ref={carouselRef}
              className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory"
            >
              {similarProperties.map((p: Property, i: number) => {
                const isSelected = compareIds.includes(p.id);
                return (
                  <motion.div
                    key={p.id}
                    className="shrink-0 w-[280px] sm:w-[300px] snap-start relative"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    {/* Compare checkbox overlay */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompareIds(prev =>
                          prev.includes(p.id)
                            ? prev.filter(cid => cid !== p.id)
                            : prev.length < 3
                              ? [...prev, p.id]
                              : prev
                        );
                      }}
                      className="absolute top-2 left-2 z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                      style={{
                        backgroundColor: isSelected ? "var(--primary)" : "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(4px)",
                      }}
                      title={isSelected ? "Remove from compare" : "Add to compare"}
                    >
                      {isSelected ? (
                        <Check size={14} className="text-white" />
                      ) : (
                        <ArrowRightLeft size={12} className="text-white/80" />
                      )}
                    </button>
                    <PropertyCard
                      property={p}
                      onClick={(pid) => {
                        window.location.href = `/properties/${pid}`;
                      }}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ============= Compare Floating Bar ============= */}
      <AnimatePresence>
        {compareIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl backdrop-blur-xl"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
          >
            <ArrowRightLeft size={16} style={{ color: "var(--primary)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {compareIds.length} {pluralize(compareIds.length, "property", "properties")} selected
            </span>
            <Link
              href={`/properties/compare?ids=${[property.id, ...compareIds].join(",")}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Compare Now
              <ChevronRight size={14} />
            </Link>
            <button
              onClick={() => setCompareIds([])}
              className="text-xs font-medium transition-colors ml-1"
              style={{ color: "var(--muted-foreground)" }}
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
