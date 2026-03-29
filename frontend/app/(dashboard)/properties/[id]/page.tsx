"use client";

import { use, useState, useRef } from "react";
import {
  useProperty, useProperties, usePropertyVersions, usePropertyPriceHistory,
} from "@/hooks/useProperties";
import { PropertyCard } from "@/components/property/property-card";
import { MOCK_PROPERTIES } from "@/lib/mock-data";
import { formatPrice, formatNumber, formatPriceShort, pluralize, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  MapPin, BedDouble, Bath, Maximize2, Star, Building, Building2,
  User, Clock, Tag, Layers, TrendingUp, Share2, Copy, Check,
  Car, Zap, Wifi, Droplets, Trees, Fence, ShieldCheck, Warehouse,
  Eye, MessageCircle, Bookmark, SquareStack, Home, ArrowRightLeft,
  Printer, Phone, Mail, ExternalLink, Users, TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { Property } from "@/types/property";
import { AIPlaceholderCard } from "@/components/ai/ai-placeholder";
import { Sparkles, Brain, BarChart3 as BarChartIcon, Pencil } from "lucide-react";
import { VersionTimeline } from "@/components/property/version-timeline";
import { PriceHistoryChart } from "@/components/property/price-history-chart";
import { PropertyEditForm } from "@/components/property/property-edit-form";
import { DynamicPropertyMap } from "@/components/property/property-map-dynamic";
import { useAuth } from "@/hooks/use-auth";

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

const LISTING_TYPE_CONFIG: Record<string, { label: string; dot: string }> = {
  SALE: { label: "For Sale", dot: "var(--primary)" },
  RENT: { label: "For Rent", dot: "#16a34a" },
  LEASE: { label: "For Lease", dot: "#f59e0b" },
  SHORTLET: { label: "Shortlet", dot: "var(--accent)" },
};

const AMENITY_ICONS: Record<string, React.ComponentType<any>> = {
  parking: Car, garage: Car, swimming: Droplets, pool: Droplets,
  wifi: Wifi, internet: Wifi, security: ShieldCheck, guard: ShieldCheck,
  garden: Trees, electricity: Zap, generator: Zap, power: Zap,
  water: Droplets, borehole: Droplets, fence: Fence, warehouse: Warehouse,
};

function getAmenityIcon(feature: string): React.ComponentType<any> {
  const lower = feature.toLowerCase();
  for (const [key, Icon] of Object.entries(AMENITY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return Check;
}

/** Mask phone: show country code, mask middle, show last 4 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, "");
  if (digits.length < 7) return phone;
  // Nigerian numbers: +234XXXXXXXXXX or 08XXXXXXXXX
  if (digits.startsWith("+234") && digits.length >= 13) {
    return `${digits.slice(0, 4)} *** *** ${digits.slice(-4)}`;
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return `${digits.slice(0, 4)} *** ${digits.slice(-4)}`;
  }
  return `+234 *** *** ${digits.slice(-4)}`;
}

function whatsappHref(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, "").replace(/^0/, "234");
  return `https://wa.me/${digits}`;
}

/* ------------------------------------------------------------------ */
/*  Image Gallery — 1 large + 2 stacked (60/40 split)                 */
/* ------------------------------------------------------------------ */

function ImageGallery({ images }: { images: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);

  if (!images.length) {
    return (
      <div
        className="w-full aspect-[16/9] rounded-2xl flex flex-col items-center justify-center gap-3"
        style={{
          background: "linear-gradient(135deg, var(--secondary) 0%, color-mix(in srgb, var(--secondary) 60%, var(--border)) 100%)",
        }}
      >
        <Building2 size={52} style={{ color: "var(--muted-foreground)" }} strokeWidth={1.5} />
        <span className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>No photos available</span>
      </div>
    );
  }

  const main = images[activeIndex];
  const side1 = images[(activeIndex + 1) % images.length];
  const side2 = images[(activeIndex + 2) % images.length];
  const hasMultiple = images.length > 1;

  const goTo = (idx: number) => {
    setActiveIndex(idx);
    // Scroll thumbnail into view
    const container = thumbsRef.current;
    if (container) {
      const thumb = container.children[idx] as HTMLElement;
      if (thumb) {
        thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  };

  return (
    <div className="space-y-2">
      {/* Desktop: large + 2 stacked */}
      <div className="hidden md:flex gap-2 rounded-2xl overflow-hidden" style={{ height: "440px" }}>
        {/* Large hero image — 60% */}
        <div
          className="relative cursor-pointer flex-[3] overflow-hidden group/img"
          onClick={() => setLightboxOpen(true)}
        >
          <motion.img
            key={activeIndex}
            src={main}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-[1.02]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          />
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

          {/* Counter badge */}
          <div
            className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          >
            {activeIndex + 1} / {images.length}
          </div>

          {/* Expand hint */}
          <div
            className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          >
            <Eye size={13} />
            View all {images.length} photos
          </div>

          {/* Arrow nav on large image */}
          {hasMultiple && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goTo((activeIndex - 1 + images.length) % images.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-lg"
                style={{ backgroundColor: "rgba(255,255,255,0.92)" }}
              >
                <ChevronLeft size={20} style={{ color: "var(--foreground)" }} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goTo((activeIndex + 1) % images.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-lg"
                style={{ backgroundColor: "rgba(255,255,255,0.92)" }}
              >
                <ChevronRight size={20} style={{ color: "var(--foreground)" }} />
              </button>
            </>
          )}
        </div>

        {/* Two stacked — 40% */}
        {hasMultiple && (
          <div className="flex flex-col flex-[2] gap-2">
            {/* Top small */}
            <div
              className="relative flex-1 overflow-hidden cursor-pointer group/sm"
              onClick={() => goTo((activeIndex + 1) % images.length)}
            >
              <img
                src={side1}
                alt=""
                className="w-full h-full object-cover transition-transform duration-500 group-hover/sm:scale-[1.03]"
              />
            </div>

            {/* Bottom small — "See more photos" overlay when 3+ images */}
            <div
              className="relative flex-1 overflow-hidden cursor-pointer group/sm2"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={side2}
                alt=""
                className="w-full h-full object-cover transition-transform duration-500 group-hover/sm2:scale-[1.03]"
              />
              {images.length > 3 && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                  <div className="text-center text-white">
                    <Eye size={24} className="mx-auto mb-1.5 opacity-90" />
                    <p className="text-sm font-bold">+{images.length - 3} photos</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Thumbnail strip */}
      {hasMultiple && (
        <div
          ref={thumbsRef}
          className="hidden md:flex gap-2 overflow-x-auto no-scrollbar pb-1"
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="shrink-0 w-16 h-16 rounded-xl overflow-hidden transition-all duration-200 relative"
              style={{
                outline: i === activeIndex ? "2.5px solid var(--primary)" : "2px solid transparent",
                outlineOffset: "1px",
                opacity: i === activeIndex ? 1 : 0.65,
              }}
              aria-label={`View image ${i + 1}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Mobile: full-width swipeable */}
      <div className="md:hidden relative rounded-2xl overflow-hidden aspect-[4/3]">
        <motion.img
          key={activeIndex}
          src={main}
          alt=""
          className="w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {hasMultiple && (
          <>
            <button
              onClick={() => goTo((activeIndex - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-md"
              style={{ backgroundColor: "rgba(255,255,255,0.88)" }}
            >
              <ChevronLeft size={18} style={{ color: "var(--foreground)" }} />
            </button>
            <button
              onClick={() => goTo((activeIndex + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-md"
              style={{ backgroundColor: "rgba(255,255,255,0.88)" }}
            >
              <ChevronRight size={18} style={{ color: "var(--foreground)" }} />
            </button>
            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.slice(0, 8).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor: i === activeIndex ? "#fff" : "rgba(255,255,255,0.45)",
                    transform: i === activeIndex ? "scale(1.3)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </>
        )}
        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white backdrop-blur-md"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <Eye size={13} className="inline mr-1 -mt-0.5" />
          {images.length} photos
        </button>
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
            <div className="absolute inset-0 bg-black/92" onClick={() => setLightboxOpen(false)} />
            <div className="relative z-10 max-w-[90vw] max-h-[90vh]">
              <motion.img
                key={activeIndex}
                src={images[activeIndex]}
                alt=""
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 p-4">
                <button
                  onClick={() => setActiveIndex(i => (i - 1 + images.length) % images.length)}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
                >
                  <ChevronLeft size={20} className="text-white" />
                </button>
                <span className="text-white text-sm font-medium">
                  {activeIndex + 1} / {images.length}
                </span>
                <button
                  onClick={() => setActiveIndex(i => (i + 1) % images.length)}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
                >
                  <ChevronRight size={20} className="text-white" />
                </button>
              </div>
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm font-medium"
              >
                Close (Esc)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CollapsibleSection                                                  */
/* ------------------------------------------------------------------ */

function CollapsibleSection({
  title, icon: Icon, defaultOpen = true, children,
}: {
  title: string;
  icon: React.ComponentType<any>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-5 text-left transition-colors hover:bg-[var(--secondary)]"
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
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DetailRow                                                           */
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
/*  Price Insight Section                                               */
/* ------------------------------------------------------------------ */

function PriceInsightSection({
  property, similarProperties,
}: {
  property: Property;
  similarProperties: Property[];
}) {
  if (!property.price || similarProperties.length === 0) return null;

  const prices = similarProperties
    .filter(p => p.price && p.price > 0)
    .map(p => p.price as number);

  if (!prices.length) return null;
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const diff = property.price - avg;
  const diffPct = Math.round((diff / avg) * 100);
  const isBelow = diff < 0;

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={15} style={{ color: "var(--accent)" }} />
        <h3 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
          Price Insight
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {/* Average */}
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "var(--secondary)" }}>
          <p className="text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
            Area Avg
          </p>
          <p className="text-sm font-display font-bold" style={{ color: "var(--foreground)" }}>
            {formatPrice(avg)}
          </p>
        </div>

        {/* This property */}
        <div
          className="rounded-xl p-3 text-center"
          style={{ backgroundColor: "rgba(0,1,252,0.06)" }}
        >
          <p className="text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
            This Property
          </p>
          <p className="text-sm font-display font-bold" style={{ color: "var(--primary)" }}>
            {formatPrice(property.price)}
          </p>
        </div>

        {/* Difference */}
        <div
          className="rounded-xl p-3 text-center"
          style={{
            backgroundColor: isBelow ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)",
          }}
        >
          <p className="text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
            vs Area
          </p>
          <div className="flex items-center justify-center gap-1">
            {isBelow ? (
              <TrendingDown size={13} style={{ color: "#16a34a" }} />
            ) : (
              <TrendingUp size={13} style={{ color: "#dc2626" }} />
            )}
            <p
              className="text-sm font-display font-bold"
              style={{ color: isBelow ? "#16a34a" : "#dc2626" }}
            >
              {isBelow ? "" : "+"}{diffPct}%
            </p>
          </div>
        </div>
      </div>
      <p className="text-[10px] mt-3" style={{ color: "var(--muted-foreground)" }}>
        Based on {prices.length} comparable {property.category.toLowerCase()} listings in the area
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                            */
/* ------------------------------------------------------------------ */
/*  KeyStatsBar                                                         */
/* ------------------------------------------------------------------ */

function KeyStatsBar({ property }: { property: Property }) {
  const stats: { icon: React.ComponentType<any>; value: string | number; label: string }[] = [];

  if (property.bedrooms != null) {
    stats.push({ icon: BedDouble, value: property.bedrooms, label: "Bedrooms" });
  }
  if (property.bathrooms != null) {
    stats.push({ icon: Bath, value: property.bathrooms, label: "Bathrooms" });
  }
  if (property.toilets != null) {
    stats.push({ icon: Bath, value: property.toilets, label: "Toilets" });
  }
  if (property.landSizeSqm != null && property.landSizeSqm > 0) {
    stats.push({ icon: Maximize2, value: `${formatNumber(Math.round(property.landSizeSqm))} sqm`, label: "Land Size" });
  }
  if (property.buildingSizeSqm != null && property.buildingSizeSqm > 0) {
    stats.push({ icon: Maximize2, value: `${formatNumber(Math.round(property.buildingSizeSqm))} sqm`, label: "Building Size" });
  }
  if (property.parkingSpaces != null && property.parkingSpaces > 0) {
    stats.push({ icon: Car, value: property.parkingSpaces, label: "Parking" });
  }
  if (property.floors != null && property.floors > 0) {
    stats.push({ icon: Layers, value: property.floors, label: "Floors" });
  }

  if (stats.length === 0) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex overflow-x-auto no-scrollbar divide-x divide-[var(--border)]">
        {stats.map(({ icon: Icon, value, label }, i) => (
          <div key={i} className="flex flex-col items-center justify-center px-5 py-4 gap-1 shrink-0 min-w-[100px]">
            <Icon size={18} style={{ color: "var(--primary)" }} strokeWidth={1.8} />
            <span className="font-display font-bold text-base" style={{ color: "var(--foreground)" }}>
              {value}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PropertyDetailSkeleton() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="w-full h-[400px] rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-60 w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: apiProperty, isLoading } = useProperty(id);
  const { data: versionsData } = usePropertyVersions(id);
  const { data: priceHistory } = usePropertyPriceHistory(id);
  const { user } = useAuth();

  const [descExpanded, setDescExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Check admin role — Better Auth puts role in session.user
  const isAdmin = !!(user && (user as any).role === "ADMIN");

  const mockProperty = MOCK_PROPERTIES.find(p => p.id === id);
  const property = apiProperty || mockProperty;

  const { data: similarData } = useProperties({
    category: property ? [property.category] : undefined,
    area: property?.area ? [property.area] : undefined,
    limit: 10,
  });

  if (isLoading) return <PropertyDetailSkeleton />;

  if (!property) {
    return (
      <div className="text-center py-20">
        <Building2 size={48} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
        <p className="text-lg font-display font-semibold" style={{ color: "var(--foreground)" }}>
          Property not found
        </p>
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
  const listingConfig = LISTING_TYPE_CONFIG[property.listingType] || { label: property.listingType, dot: "var(--primary)" };
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

  const similarProperties = (similarData?.data || MOCK_PROPERTIES)
    .filter((p: Property) => p.id !== property.id)
    .slice(0, 8);

  // Build breadcrumb parts
  const crumbs = [
    property.state,
    property.lga,
    property.area,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-7 w-full">

      {/* ─── Breadcrumbs ─── */}
      <div className="flex items-center gap-1.5 text-xs flex-wrap" style={{ color: "var(--muted-foreground)" }}>
        <Link href="/properties" className="hover:underline flex items-center gap-1">
          <ArrowLeft size={11} />
          Properties
        </Link>
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight size={10} />
            <span
              className={i === crumbs.length - 1 ? "font-semibold" : "hover:underline cursor-pointer"}
              style={i === crumbs.length - 1 ? { color: "var(--foreground)" } : {}}
            >
              {crumb}
            </span>
          </span>
        ))}
        {crumbs.length > 0 && (
          <span className="flex items-center gap-1.5">
            <ChevronRight size={10} />
            <span className="truncate max-w-[160px]" style={{ color: "var(--foreground)" }}>
              {property.title}
            </span>
          </span>
        )}
        {crumbs.length === 0 && (
          <span className="flex items-center gap-1.5">
            <ChevronRight size={10} />
            <span style={{ color: "var(--foreground)" }}>{property.title}</span>
          </span>
        )}
      </div>

      {/* ─── Image Gallery ─── */}
      <ImageGallery images={images} />

      {/* ─── Key Stats Bar ─── */}
      <KeyStatsBar property={property} />

      {/* ─── Title + Actions Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">

          {/* Listing type indicator: colored dot + label */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: listingConfig.dot }}
            >
              <span className="w-2 h-2 rounded-full bg-white/70 shrink-0" />
              {listingConfig.label}
            </div>

            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
              style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
            >
              {statusStyle.label}
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

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-display font-bold leading-tight" style={{ color: "var(--foreground)" }}>
            {property.title}
          </h1>

          {/* Location */}
          <div className="flex items-center gap-1.5">
            <MapPin size={14} style={{ color: "var(--muted-foreground)" }} />
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {location || "Location not specified"}
            </span>
          </div>

          {/* Beds • Baths inline */}
          {(property.bedrooms != null || property.bathrooms != null) && (
            <div className="flex items-center gap-3 text-sm font-medium" style={{ color: "var(--foreground)" }}>
              {property.bedrooms != null && (
                <span className="flex items-center gap-1.5">
                  <BedDouble size={15} style={{ color: "var(--primary)" }} />
                  {property.bedrooms} {pluralize(property.bedrooms, "Bedroom")}
                </span>
              )}
              {property.bedrooms != null && property.bathrooms != null && (
                <span style={{ color: "var(--border)" }}>•</span>
              )}
              {property.bathrooms != null && (
                <span className="flex items-center gap-1.5">
                  <Bath size={15} style={{ color: "var(--primary)" }} />
                  {property.bathrooms} {pluralize(property.bathrooms, "Bathroom")}
                </span>
              )}
              {(property.landSizeSqm || property.buildingSizeSqm) && (
                <>
                  <span style={{ color: "var(--border)" }}>•</span>
                  <span className="flex items-center gap-1.5">
                    <Maximize2 size={14} style={{ color: "var(--primary)" }} />
                    {formatNumber(Math.round(property.landSizeSqm || property.buildingSizeSqm || 0))} sqm
                  </span>
                </>
              )}
            </div>
          )}

          {/* Mobile Agent Card — above the fold */}
          <div className="lg:hidden mt-4">
            <AgentCard property={property} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 print:hidden">
          <button
            onClick={() => setBookmarked(b => !b)}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors"
            style={{ backgroundColor: bookmarked ? "var(--primary)" : "var(--secondary)" }}
            title="Bookmark"
          >
            <Bookmark size={16} style={{ color: bookmarked ? "#fff" : "var(--muted-foreground)" }} fill={bookmarked ? "#fff" : "none"} />
          </button>

          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)" }}
            title="Edit Property"
          >
            <Pencil size={14} />
            <span className="hidden sm:inline">Edit</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors"
            style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
            title="Print"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Print</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors"
            style={{ backgroundColor: "var(--secondary)" }}
            title="Copy link"
          >
            {copied ? (
              <Check size={15} style={{ color: "var(--success)" }} />
            ) : (
              <Copy size={15} style={{ color: "var(--muted-foreground)" }} />
            )}
          </button>

          {/* Share Menu */}
          <div className="relative">
            <AnimatePresence>
              {shareMenuOpen ? (
                <motion.div
                  initial={{ opacity: 0, width: 0, x: 20 }}
                  animate={{ opacity: 1, width: "auto", x: 0 }}
                  exit={{ opacity: 0, width: 0, x: 20 }}
                  className="flex items-center gap-2 rounded-full p-1.5 shadow-md"
                  style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}
                >
                  <button
                    onClick={() => setShareMenuOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    <Check size={14} />
                  </button>
                  <div className="flex items-center gap-1 px-1">
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent((property?.title || "") + " " + window.location.href)}`, "_blank")} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors shrink-0" title="WhatsApp" style={{ color: "var(--foreground)" }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    </button>
                    <button onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(property?.title || "")}`, "_blank")} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors shrink-0" title="Telegram" style={{ color: "var(--foreground)" }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                    <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank")} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors shrink-0" title="Facebook" style={{ color: "var(--foreground)" }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                    </button>
                    <button onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`, "_blank")} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors shrink-0" title="LinkedIn" style={{ color: "var(--foreground)" }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => setShareMenuOpen(true)}
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors"
                  style={{ backgroundColor: "var(--secondary)" }}
                  title="Share"
                >
                  <Share2 size={15} style={{ color: "var(--muted-foreground)" }} />
                </button>
              )}
            </AnimatePresence>
          </div>

          {property.listingUrl && (
            <a
              href={property.listingUrl}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">Source</span>
            </a>
          )}
        </div>
      </div>

      {/* ─── Content Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ═══ Left: Main Content ═══ */}
        <div className="lg:col-span-2 space-y-5">

          {/* Huge Price */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <p className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                {property.listingType === "RENT" ? "Monthly Rent" : "Asking Price"}
              </p>
              {/* Listing type badge */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-white"
                style={{ backgroundColor: listingConfig.dot }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 shrink-0" />
                {listingConfig.label}
              </div>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="text-4xl font-display font-black tracking-tight"
                style={{ color: "var(--primary)" }}
              >
                {formatPrice(property.price)}
              </span>
              {property.rentFrequency && (
                <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  per {property.rentFrequency}
                </span>
              )}
              {property.priceNegotiable && (
                <span
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: "rgba(22,163,74,0.10)", color: "#16a34a" }}
                >
                  <Check size={11} /> Negotiable
                </span>
              )}
            </div>
            {/* Price per sqm — computed if not provided */}
            {(() => {
              const sqm = property.buildingSizeSqm || property.landSizeSqm;
              const perSqm = property.pricePerSqm && property.pricePerSqm > 0
                ? property.pricePerSqm
                : (property.price && sqm && sqm > 0 ? Math.round(property.price / sqm) : null);
              if (!perSqm) return null;
              return (
                <p className="text-sm mt-1 font-medium" style={{ color: "var(--muted-foreground)" }}>
                  {formatPriceShort(perSqm)}/sqm
                </p>
              );
            })()}
            {/* Extra financials */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
              {property.serviceCharge != null && property.serviceCharge > 0 && (
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Service charge: {formatPrice(property.serviceCharge)}
                </span>
              )}
              {property.initialDeposit != null && property.initialDeposit > 0 && (
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Deposit: {formatPrice(property.initialDeposit)}
                </span>
              )}
            </div>
          </div>

          {/* About section with left accent border */}
          {desc && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div
                className="flex"
                style={{ borderLeft: "4px solid var(--primary)" }}
              >
                <div className="p-5 flex-1">
                  <h2
                    className="font-display font-bold text-base mb-3"
                    style={{ color: "var(--foreground)" }}
                  >
                    About this property
                  </h2>
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
                      className="flex items-center gap-1 mt-3 text-xs font-semibold"
                      style={{ color: "var(--primary)" }}
                    >
                      {descExpanded ? <>Show less <ChevronUp size={13} /></> : <>Read more <ChevronDown size={13} /></>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Features & Amenities */}
          {allFeatures.length > 0 && (
            <CollapsibleSection title="Features & Amenities" icon={Star}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {allFeatures.map((f) => {
                  const FeatureIcon = getAmenityIcon(f);
                  return (
                    <div
                      key={f}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
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

          {/* Property Details */}
          <CollapsibleSection title="Property Details" icon={Building}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <div>
                <DetailRow label="Property Type" value={property.propertyType} />
                <DetailRow label="Listing Type" value={listingConfig.label} />
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

              {/* Embedded map */}
              {property.latitude && property.longitude && (
                <div className="mt-4 rounded-xl overflow-hidden" style={{ height: "240px" }}>
                  <DynamicPropertyMap
                    properties={[property]}
                    hoveredId={null}
                    onMarkerClick={() => {}}
                  />
                </div>
              )}

              {/* Map links */}
              {property.latitude && property.longitude && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={`https://www.google.com/maps?q=${property.latitude},${property.longitude}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold"
                    style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                  >
                    <MapPin size={12} /> Google Maps
                  </a>
                  <a
                    href={`https://maps.apple.com/?q=${property.latitude},${property.longitude}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold"
                    style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
                  >
                    <MapPin size={12} /> Apple Maps
                  </a>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Price Insight */}
          <PriceInsightSection property={property} similarProperties={similarProperties} />

          {/* Price History */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={14} style={{ color: "var(--accent)" }} />
              <h3 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                Price History
              </h3>
            </div>
            <PriceHistoryChart history={priceHistory || []} currentPrice={property.price} />
          </div>

          {/* Admin-only Intelligence Tab */}
          {isAdmin && (
            <CollapsibleSection title="Intelligence (Admin)" icon={SquareStack} defaultOpen={false}>
              <div className="space-y-4">
                {/* Quality Score */}
                {property.qualityScore != null && (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>Data Quality Score</p>
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "var(--secondary)" }}>
                      <Star size={14} fill="#facc15" stroke="#facc15" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Quality Score</p>
                          <span className="text-xs font-bold" style={{
                            color: property.qualityScore >= 70 ? "var(--success)" : property.qualityScore >= 40 ? "#f59e0b" : "var(--destructive)",
                          }}>
                            {property.qualityScore}/100
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: `${property.qualityScore}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            style={{
                              backgroundColor: property.qualityScore >= 70 ? "var(--success)" : property.qualityScore >= 40 ? "#f59e0b" : "var(--destructive)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Source Intelligence */}
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>Source Intelligence</p>
                  <div className="space-y-0">
                    <DetailRow label="Source Site" value={property.site?.name || property.source} />
                    <DetailRow label="Property ID" value={<span className="font-mono text-[11px]">{property.id.slice(0, 16)}…</span>} />
                    <DetailRow label="Hash" value={<span className="font-mono text-[11px]">{property.hash?.slice(0, 12)}…</span>} />
                    <DetailRow label="Version" value={`v${property.currentVersion}`} />
                    <DetailRow label="Verification" value={
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        backgroundColor: property.verificationStatus === "VERIFIED" ? "rgba(34,197,94,0.12)" : property.verificationStatus === "FLAGGED" ? "rgba(245,158,11,0.12)" : "var(--secondary)",
                        color: property.verificationStatus === "VERIFIED" ? "#16a34a" : property.verificationStatus === "FLAGGED" ? "#f59e0b" : "var(--muted-foreground)",
                      }}>
                        {property.verificationStatus}
                      </span>
                    } />
                    <DetailRow label="Views" value={property.viewCount > 0 ? formatNumber(property.viewCount) : undefined} />
                    <DetailRow label="Inquiries" value={property.inquiryCount > 0 ? formatNumber(property.inquiryCount) : undefined} />
                    <DetailRow label="Days on Market" value={property.daysOnMarket} />
                    {property.scrapeTimestamp && (() => {
                      const scraped = new Date(property.scrapeTimestamp!);
                      const daysSince = Math.floor((Date.now() - scraped.getTime()) / 86400000);
                      const freshness = daysSince <= 7
                        ? { label: "Fresh", color: "#16a34a", bg: "rgba(34,197,94,0.12)" }
                        : daysSince <= 30
                          ? { label: "Recent", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" }
                          : { label: "Stale", color: "#dc2626", bg: "rgba(239,68,68,0.12)" };
                      return (
                        <DetailRow
                          label="Scraped"
                          value={
                            <span className="flex items-center gap-2">
                              {scraped.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: freshness.bg, color: freshness.color }}>
                                {freshness.label}
                              </span>
                            </span>
                          }
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Missing Fields */}
                {(() => {
                  const missing: string[] = [];
                  if (!property.latitude && !property.longitude) missing.push("Coordinates");
                  if (property.bedrooms == null) missing.push("Bedrooms");
                  if (property.bathrooms == null) missing.push("Bathrooms");
                  if (!property.agentPhone) missing.push("Agent Phone");
                  if (!property.agentEmail) missing.push("Agent Email");
                  if (!property.description) missing.push("Description");
                  if (!property.images?.length) missing.push("Images");
                  if (!property.area) missing.push("Area");
                  if (!property.propertyType) missing.push("Property Type");
                  if (missing.length === 0) return (
                    <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--success)" }}>
                      <Check size={13} /> All key fields populated
                    </div>
                  );
                  return (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
                        Missing Fields ({missing.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map(f => (
                          <span key={f} className="text-[10px] font-medium px-2 py-1 rounded-md" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#dc2626" }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Version History */}
              <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>Version History</p>
                <VersionTimeline
                  versions={versions}
                  propertyId={property.id}
                  currentVersion={property.currentVersion}
                />
              </div>
            </CollapsibleSection>
          )}

        </div>

        {/* ═══ Right Sidebar ═══ */}
        <div className="space-y-4">

          {/* ── Sticky Price Card (desktop) ── */}
          <div
            className="hidden lg:block rounded-2xl p-5 sticky top-[72px]"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-medium mb-0.5" style={{ color: "var(--muted-foreground)" }}>
              {property.listingType === "RENT" ? "Monthly Rent" : "Asking Price"}
            </p>
            <p className="text-3xl font-display font-black" style={{ color: "var(--primary)" }}>
              {formatPrice(property.price)}
            </p>
            {property.rentFrequency && (
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                per {property.rentFrequency}
              </span>
            )}
            {property.priceNegotiable && (
              <div className="flex items-center gap-1 mt-1.5 text-xs font-medium" style={{ color: "#16a34a" }}>
                <Check size={11} /> Price negotiable
              </div>
            )}
            <div className="mt-3 space-y-0">
              {property.pricePerSqm != null && property.pricePerSqm > 0 && (
                <DetailRow label="Price / sqm" value={formatPrice(property.pricePerSqm)} />
              )}
              {property.serviceCharge != null && property.serviceCharge > 0 && (
                <DetailRow label={`Service Charge${property.serviceChargeFreq ? ` (${property.serviceChargeFreq})` : ""}`} value={formatPrice(property.serviceCharge)} />
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
            </div>
          </div>

          {/* ── Agent Card (desktop) ── */}
          <div className="hidden lg:block">
            <AgentCard property={property} />
          </div>

          {/* ── Related from same agent ── */}
          {property.agentName && (() => {
            const agentListings = (similarData?.data || [])
              .filter((p: Property) => p.id !== property.id && p.agentName === property.agentName)
              .slice(0, 5);
            if (!agentListings.length) return null;
            return (
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                    More from {property.agentName?.split(" ")[0]}
                  </h3>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
                  >
                    {agentListings.length} listing{agentListings.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-3">
                  {agentListings.map((p: Property) => {
                    const img = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;
                    return (
                      <Link key={p.id} href={`/properties/${p.id}`} className="flex items-center gap-3 group/rel">
                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: "var(--secondary)" }}>
                          {img ? (
                            <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Home size={14} style={{ color: "var(--muted-foreground)" }} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate group-hover/rel:underline" style={{ color: "var(--foreground)" }}>{p.title}</p>
                          <p className="text-xs font-bold" style={{ color: "var(--accent)" }}>{formatPrice(p.price)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Source info (non-admin only sees minimal) */}
          {!isAdmin && property.listingUrl && (
            <div
              className="rounded-2xl p-4"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                Original Source
              </p>
              <a
                href={property.listingUrl}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 text-xs font-semibold hover:underline"
                style={{ color: "var(--primary)" }}
              >
                <ExternalLink size={13} />
                View on {property.site?.name || "Source"}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ─── AI Placeholder Cards ─── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
        <AIPlaceholderCard
          icon={Sparkles}
          title="AI Price Estimate"
          description="Fair market value estimate based on 50+ comparable properties within 2km."
          features={["Comparable analysis", "Confidence score", "Price history"]}
        />
        <AIPlaceholderCard
          icon={Brain}
          title="Investment Analysis"
          description="ROI projection, rental yield estimate, and resale potential for this property."
          features={["Yield estimate", "Growth forecast", "Risk assessment"]}
        />
        <AIPlaceholderCard
          icon={BarChartIcon}
          title="Neighbourhood Profile"
          description="AI-generated area brief covering amenities, transport, schools, and market trends."
          features={["Amenity score", "Transport links", "Price trends"]}
        />
      </div>

      {/* ─── Similar Homes ─── */}
      {similarProperties.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2
                className="font-display font-bold text-lg sm:text-xl"
                style={{ color: "var(--foreground)" }}
              >
                Similar homes you might like
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                {property.category.toLowerCase()} properties near {property.area || property.state || "this area"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => carouselRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: "var(--secondary)" }}
              >
                <ChevronLeft size={16} style={{ color: "var(--foreground)" }} />
              </button>
              <button
                onClick={() => carouselRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompareIds(prev =>
                        prev.includes(p.id)
                          ? prev.filter(cid => cid !== p.id)
                          : prev.length < 3 ? [...prev, p.id] : prev
                      );
                    }}
                    className="absolute top-2 left-2 z-10 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: isSelected ? "var(--primary)" : "rgba(0,0,0,0.48)",
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
                    onClick={(pid) => { window.location.href = `/properties/${pid}`; }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Compare Floating Bar ─── */}
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Compare <ChevronRight size={13} />
            </Link>
            <button
              onClick={() => setCompareIds([])}
              className="text-xs font-medium"
              style={{ color: "var(--muted-foreground)" }}
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Edit Form ─── */}
      <PropertyEditForm
        property={property}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Agent Card — extracted for reuse in mobile/desktop                 */
/* ------------------------------------------------------------------ */

function AgentCard({ property }: { property: Property }) {
  if (!property.agentName && !property.agencyName) return null;

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm" style={{ color: "var(--foreground)" }}>
          Agent Details
        </h3>
        {property.agentVerified && (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "#16a34a" }}
          >
            <ShieldCheck size={10} /> Verified
          </span>
        )}
      </div>

      {/* Avatar + Name */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: "var(--secondary)" }}
        >
          {property.agencyLogo ? (
            <img src={property.agencyLogo} alt="" className="w-full h-full object-cover" />
          ) : (
            <User size={24} style={{ color: "var(--muted-foreground)" }} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: "var(--foreground)" }}>
            {property.agentName || "Unknown Agent"}
          </p>
          {property.agencyName && (
            <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
              {property.agencyName}
            </p>
          )}
          {/* Conditional agent type label — only shown if agentType data exists */}
          {property.agentType && (() => {
            const AGENT_TYPE_DISPLAY: Record<string, string> = {
              OWNERS_AGENT: "Direct to Owner's Agent",
              DEVELOPER:    "Direct to Developer",
              LANDLORD:     "Direct to Landlord",
            };
            const label = AGENT_TYPE_DISPLAY[property.agentType];
            if (!label) return null;
            return (
              <div className="flex items-center gap-1 mt-1">
                <Users size={11} style={{ color: "#16a34a" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#16a34a" }}>
                  {label}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Phone masked + WhatsApp link */}
      {property.agentPhone && (
        <div
          className="flex items-center justify-between p-3 rounded-xl mb-3"
          style={{ backgroundColor: "var(--secondary)" }}
        >
          <div className="flex items-center gap-2">
            <Phone size={14} style={{ color: "var(--muted-foreground)" }} />
            <span className="text-sm font-medium font-mono" style={{ color: "var(--foreground)" }}>
              {maskPhone(property.agentPhone)}
            </span>
          </div>
          <a
            href={whatsappHref(property.agentPhone)}
            target="_blank"
            rel="noopener"
            className="text-xs font-bold flex items-center gap-1"
            style={{ color: "#16a34a" }}
          >
            <MessageCircle size={13} />
            WhatsApp
          </a>
        </div>
      )}

      {/* Circular Phone / WhatsApp CTA buttons */}
      <div className="flex gap-3 mb-3">
        {property.agentPhone && (
          <a
            href={`tel:${property.agentPhone}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.22)" }}
            >
              <Phone size={13} />
            </div>
            Call
          </a>
        )}
        {property.agentPhone && (
          <a
            href={whatsappHref(property.agentPhone)}
            target="_blank"
            rel="noopener"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#25d366" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(255,255,255,0.22)" }}
            >
              <MessageCircle size={13} />
            </div>
            WhatsApp
          </a>
        )}
      </div>

      {property.agentEmail && (
        <a
          href={`mailto:${property.agentEmail}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-colors"
          style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
        >
          <Mail size={13} />
          {property.agentEmail}
        </a>
      )}

      {property.contactInfo && (
        <p
          className="text-xs mt-3 p-3 rounded-xl"
          style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}
        >
          {property.contactInfo}
        </p>
      )}
    </div>
  );
}
