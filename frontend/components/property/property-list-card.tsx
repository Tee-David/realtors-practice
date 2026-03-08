"use client";

import { MapPin, BedDouble, Bath, Maximize2, Heart, Star } from "lucide-react";
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
    qualityScore, category,
  } = property;

  const imageUrl = Array.isArray(images) && images.length > 0 ? images[0] : "/placeholder-property.jpg";
  const imageCount = Array.isArray(images) ? images.length : 0;
  const location = locationText || [area, state].filter(Boolean).join(", ") || "Lagos, Nigeria";
  const stars = qualityScore != null ? Math.round(qualityScore / 20) : 0;

  return (
    <div
      className="flex rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md group"
      style={{
        backgroundColor: "var(--card)",
        border: isActive ? "2px solid var(--primary)" : "1px solid var(--border)",
      }}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(id)}
    >
      {/* Image — more compact on mobile */}
      <div className="relative w-[130px] sm:w-[260px] shrink-0 aspect-[4/3] sm:aspect-auto sm:h-auto">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Listing type badge */}
        <span
          className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] sm:px-2.5 sm:py-1 sm:rounded-lg font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: "var(--primary)" }}
        >
          {LISTING_LABELS[listingType] || listingType}
        </span>

        {/* Quality rating */}
        {stars > 0 && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md backdrop-blur-sm sm:px-2 sm:rounded-lg"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <Star size={8} fill="#facc15" stroke="#facc15" className="sm:size-2.5" />
            <span className="text-[9px] sm:text-[10px] font-bold text-white">{(qualityScore! / 20).toFixed(1)}</span>
          </div>
        )}

        {/* Location overlay on image */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white/90 text-[9px] sm:text-[11px] max-w-[85%] sm:max-w-[60%]">
          <MapPin size={10} className="shrink-0 sm:size-[11px]" />
          <span className="truncate">{location}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
        <div>
          {/* Category tag */}
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--muted-foreground)" }}
          >
            {category}
          </span>

          <h3
            className="font-display font-semibold text-sm leading-snug line-clamp-2 mt-1 transition-colors group-hover:text-[var(--primary)]"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h3>
        </div>

        {/* Details row */}
        <div className="flex items-center gap-2 sm:gap-4 mt-2 sm:mt-3 text-[11px] sm:text-xs" style={{ color: "var(--muted-foreground)" }}>
          {bedrooms != null && (
            <span className="flex items-center gap-1">
              <BedDouble size={12} className="sm:size-[14px]" strokeWidth={1.5} />
              <span className="font-medium" style={{ color: "var(--foreground)" }}>{bedrooms}</span>
              <span className="hidden xs:inline">Bed{bedrooms !== 1 ? "s" : ""}</span>
              <span className="inline xs:hidden">br</span>
            </span>
          )}
          {bathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath size={12} className="sm:size-[14px]" strokeWidth={1.5} />
              <span className="font-medium" style={{ color: "var(--foreground)" }}>{bathrooms}</span>
              <span className="hidden xs:inline">Bath</span>
              <span className="inline xs:hidden">ba</span>
            </span>
          )}
          {(property.landSizeSqm || property.buildingSizeSqm) && (
            <span className="flex items-center gap-1">
              <Maximize2 size={11} className="sm:size-[13px]" strokeWidth={1.5} />
              <span className="font-medium" style={{ color: "var(--foreground)" }}>
                {Math.round(property.landSizeSqm || property.buildingSizeSqm || 0)}
              </span>
              sqm
            </span>
          )}
        </div>

        {/* Price + actions row */}
        <div className="flex items-center justify-between mt-2 sm:mt-3 pt-2 sm:pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <span className="font-display font-bold text-base sm:text-lg truncate block" style={{ color: "var(--accent)" }}>
              {formatPrice(price)}
            </span>
            {rentFrequency && (
              <span className="text-[10px] sm:text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>
                /{rentFrequency}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-1.5 sm:p-2 rounded-full transition-colors hover:bg-[var(--secondary)] shrink-0"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Heart size={14} className="sm:size-[16px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
