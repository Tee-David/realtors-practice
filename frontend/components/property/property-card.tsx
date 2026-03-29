"use client";

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  MapPin, BedDouble, Bath, ExternalLink,
  Bookmark, Building2, ChevronLeft, ChevronRight,
  Eye, Home, Users, Store, User,
} from "lucide-react";
import { formatPrice, formatPriceShort } from "@/lib/utils";
import type { Property, ListingType, PropertyStatus } from "@/types/property";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const LISTING_LABELS: Record<ListingType, string> = {
  SALE: "For Sale",
  RENT: "For Rent",
  LEASE: "For Lease",
  SHORTLET: "Shortlet",
};

const LISTING_DOT_COLORS: Record<ListingType, string> = {
  SALE: "var(--primary)",
  RENT: "#16a34a",
  LEASE: "#f59e0b",
  SHORTLET: "var(--accent)",
};

const STATUS_BADGE: Record<PropertyStatus, { bg: string; color: string; label: string }> = {
  AVAILABLE:   { bg: "#16a34a",  color: "#fff",     label: "Available" },
  SOLD:        { bg: "#dc2626",  color: "#fff",     label: "Sold" },
  RENTED:      { bg: "#2563eb",  color: "#fff",     label: "Rented" },
  UNDER_OFFER: { bg: "#d97706",  color: "#fff",     label: "Under Offer" },
  WITHDRAWN:   { bg: "#6b7280",  color: "#fff",     label: "Withdrawn" },
  EXPIRED:     { bg: "#9ca3af",  color: "#1a1a1a",  label: "Expired" },
};

/** Returns "X days ago" or "Today" or "X months ago" */
function daysAgoLabel(dateStr?: string): string | null {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "1 day ago";
  if (diff < 30) return `${diff} days ago`;
  const months = Math.floor(diff / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/* ------------------------------------------------------------------ */
/*  AgentType label helper                                              */
/* ------------------------------------------------------------------ */

type AgentType = "OWNERS_AGENT" | "DEVELOPER" | "LANDLORD";

const AGENT_TYPE_LABELS: Record<AgentType, { label: string; Icon: LucideIcon }> = {
  OWNERS_AGENT: { label: "Direct to Owner's Agent", Icon: Users },
  DEVELOPER:    { label: "Direct to Developer",      Icon: Store },
  LANDLORD:     { label: "Direct to Landlord",       Icon: User },
};

function AgentTypeLabel({ agentType }: { agentType?: AgentType | null }) {
  if (!agentType) return null;
  const config = AGENT_TYPE_LABELS[agentType];
  if (!config) return null;
  const { label, Icon } = config;
  return (
    <div className="flex items-center gap-1 mt-1.5">
      <Icon size={11} style={{ color: "#16a34a" }} />
      <span className="text-[11px] font-semibold" style={{ color: "#16a34a" }}>
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

interface PropertyCardProps {
  property: Property;
  isActive?: boolean;
  onFavorite?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  PropertyCard                                                        */
/* ------------------------------------------------------------------ */

export function PropertyCard({
  property,
  isActive,
  onFavorite,
  onHover,
  onClick,
}: PropertyCardProps) {
  const {
    id, title, listingType, price, rentFrequency,
    bedrooms, bathrooms, state, locationText, area,
    images, qualityScore, createdAt, scrapeTimestamp,
    propertyType, status, listingUrl,
  } = property;
  const agentType = property.agentType;

  const allImages = Array.isArray(images) && images.length > 0 ? images : [];
  const imageCount = allImages.length;

  const [currentImg, setCurrentImg] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  const imageUrl = imageCount > 0 ? allImages[currentImg] : null;
  const location = locationText || [area, state].filter(Boolean).join(", ") || "Lagos, Nigeria";
  const listingDotColor = LISTING_DOT_COLORS[listingType] ?? "var(--primary)";
  const listedAgo = daysAgoLabel(scrapeTimestamp || createdAt);
  const statusBadge = STATUS_BADGE[status] ?? STATUS_BADGE.AVAILABLE;

  const qualityColor =
    qualityScore == null ? "#9ca3af"
    : qualityScore >= 70 ? "#16a34a"
    : qualityScore >= 40 ? "#f59e0b"
    : "#dc2626";

  const prevImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImg(i => (i - 1 + imageCount) % imageCount);
  };

  const nextImg = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImg(i => (i + 1) % imageCount);
  };

  return (
    <div
      className="group block cursor-pointer h-full"
      onClick={() => onClick?.(id)}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div
        className="relative flex flex-col h-full rounded-xl overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5"
        style={{
          backgroundColor: "var(--card)",
          boxShadow: isActive
            ? "0 0 0 2px var(--primary), 0 8px 24px rgba(0,0,1,0.14)"
            : "0 1px 3px rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.04)",
          border: isActive
            ? "2px solid var(--primary)"
            : "1px solid var(--border)",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--primary)";
            (e.currentTarget as HTMLDivElement).style.boxShadow =
              "0 4px 8px rgba(0,0,0,0.06), 0 16px 32px rgba(0,1,252,0.10)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLDivElement).style.boxShadow =
              "0 1px 3px rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.04)";
          }
        }}
      >
        {/* ─── Image Section ─── */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden"
          style={{ backgroundColor: "var(--secondary)" }}>

          {/* Main image or placeholder */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, var(--secondary) 0%, color-mix(in srgb, var(--secondary) 70%, var(--border)) 100%)",
              }}
            >
              <Building2 size={36} style={{ color: "var(--muted-foreground)" }} strokeWidth={1.5} />
              <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>No photo</span>
            </div>
          )}

          {/* Subtle bottom scrim for image overlay elements */}
          {imageUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          )}

          {/* ── Top-left stacked: "Listed X ago" pill + Status badge ── */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {listedAgo && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: "rgba(0,0,0,0.52)", backdropFilter: "blur(6px)" }}
              >
                Listed {listedAgo}
              </span>
            )}
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}
            >
              {statusBadge.label}
            </span>
          </div>

          {/* ── Top-right: Bookmark button ── */}
          <button
            onClick={(e) => { e.stopPropagation(); setBookmarked(b => !b); onFavorite?.(id); }}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{
              backgroundColor: bookmarked ? "var(--primary)" : "rgba(0,0,0,0.46)",
              backdropFilter: "blur(6px)",
            }}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark property"}
            title={bookmarked ? "Saved" : "Save"}
          >
            <Bookmark
              size={13}
              style={{ color: "#fff" }}
              fill={bookmarked ? "#fff" : "none"}
              strokeWidth={bookmarked ? 2 : 1.75}
            />
          </button>

          {/* ── Listing-type badge — bottom-left ── */}
          <div
            className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: listingDotColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
            {LISTING_LABELS[listingType]}
          </div>

          {/* ── Bottom-right of image: map pin circle button ── */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Optionally: navigate to map centered on property
            }}
            className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100"
            style={{ backgroundColor: "rgba(0,0,0,0.52)", backdropFilter: "blur(6px)" }}
            aria-label="View on map"
            title="View on map"
          >
            <MapPin size={12} style={{ color: "#fff" }} />
          </button>

          {/* ── Carousel arrows (show on hover when multiple images) ── */}
          {imageCount > 1 && (
            <>
              <button
                onClick={prevImg}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                style={{ backgroundColor: "rgba(255,255,255,0.90)" }}
                aria-label="Previous image"
              >
                <ChevronLeft size={16} style={{ color: "var(--foreground)" }} />
              </button>
              <button
                onClick={nextImg}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                style={{ backgroundColor: "rgba(255,255,255,0.90)" }}
                aria-label="Next image"
              >
                <ChevronRight size={16} style={{ color: "var(--foreground)" }} />
              </button>
            </>
          )}

          {/* ── Carousel dots (bottom-center, when multiple images) ── */}
          {imageCount > 1 && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-none">
              {allImages.slice(0, 5).map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === currentImg ? "14px" : "5px",
                    height: "5px",
                    backgroundColor: i === currentImg ? "#fff" : "rgba(255,255,255,0.50)",
                  }}
                />
              ))}
              {imageCount > 5 && (
                <span className="text-white/55 text-[9px] ml-0.5">+{imageCount - 5}</span>
              )}
            </div>
          )}
        </div>

        {/* ─── Card Body ─── */}
        <div className="p-4 flex-1 flex flex-col gap-2">

          {/* Price — dominant, primary color */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span
              className="font-display font-black text-xl tracking-tight"
              style={{ color: "var(--primary)" }}
            >
              {formatPriceShort(price, listingType)}
            </span>
            {price != null && (
              <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                {formatPrice(price)}
              </span>
            )}
            {rentFrequency && (
              <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                /{rentFrequency}
              </span>
            )}
          </div>

          {/* Title — 2-line clamp */}
          <h3
            className="font-display font-semibold text-sm leading-snug line-clamp-2 transition-colors group-hover:text-[var(--primary)]"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h3>

          {/* Location row */}
          <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{location}</span>
          </div>

          {/* Stats row: beds / baths / type pills */}
          <div className="flex flex-wrap gap-1.5">
            {bedrooms != null && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
              >
                <BedDouble size={11} strokeWidth={2} />
                {bedrooms} {bedrooms === 1 ? "Bed" : "Beds"}
              </span>
            )}
            {bathrooms != null && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
              >
                <Bath size={11} strokeWidth={2} />
                {bathrooms} {bathrooms === 1 ? "Bath" : "Baths"}
              </span>
            )}
            {propertyType && !bedrooms && !bathrooms && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)" }}
              >
                <Home size={11} strokeWidth={2} />
                {propertyType}
              </span>
            )}
          </div>

          {/* Agent type label — only if agentType field exists and matches */}
          <AgentTypeLabel agentType={agentType} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Hover action row */}
          <div
            className="flex items-center gap-1 pt-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ borderTop: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onClick?.(id); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors hover:bg-[var(--secondary)]"
              style={{ color: "var(--primary)" }}
              title="View details"
            >
              <Eye size={12} />
              View
            </button>
            {listingUrl && (
              <a
                href={listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors hover:bg-[var(--secondary)]"
                style={{ color: "var(--muted-foreground)" }}
                title="Open source listing"
              >
                <ExternalLink size={12} />
                Source
              </a>
            )}
          </div>
        </div>

        {/* ─── Quality bar — thin line at very bottom ─── */}
        {qualityScore != null && (
          <div className="h-[3px] w-full" style={{ backgroundColor: "var(--secondary)" }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${qualityScore}%`,
                backgroundColor: qualityColor,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
