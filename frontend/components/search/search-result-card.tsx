"use client";

import { memo } from "react";
import { MapPin, BedDouble, Bath, Maximize2, Star } from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import type { Property, ListingType } from "@/types/property";

const LISTING_COLORS: Record<ListingType, string> = {
  SALE: "var(--primary)",
  RENT: "#0a6906",
  SHORTLET: "var(--accent)",
  LEASE: "#8b5cf6",
};

const LISTING_LABELS: Record<ListingType, string> = {
  SALE: "Sale",
  RENT: "Rent",
  SHORTLET: "Shortlet",
  LEASE: "Lease",
};

interface SearchResultCardProps {
  property: Property;
  isHovered?: boolean;
  onClick?: (id: string) => void;
  onHover?: (id: string | null) => void;
}

export const SearchResultCard = memo(function SearchResultCard({
  property,
  isHovered = false,
  onClick,
  onHover,
}: SearchResultCardProps) {
  const {
    id,
    title,
    listingType,
    price,
    rentFrequency,
    bedrooms,
    bathrooms,
    area,
    state,
    locationText,
    images,
    qualityScore,
    landSizeSqm,
    buildingSizeSqm,
  } = property;

  const imageUrl =
    Array.isArray(images) && images.length > 0
      ? images[0]
      : "/placeholder-property.jpg";

  const location =
    locationText || [area, state].filter(Boolean).join(", ") || "Lagos, Nigeria";

  const color = LISTING_COLORS[listingType] || LISTING_COLORS.SALE;
  const sqm = Math.round(landSizeSqm || buildingSizeSqm || 0);
  const stars = qualityScore != null ? Math.round(qualityScore / 20) : 0;

  return (
    <div
      className={cn(
        "group flex gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 border",
        isHovered
          ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10 -translate-y-0.5"
          : "border-transparent hover:bg-secondary/50"
      )}
      onClick={() => onClick?.(id)}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Thumbnail */}
      <div className="relative w-[100px] h-[80px] md:w-[120px] md:h-[90px] rounded-lg overflow-hidden shrink-0">
        <img
          src={imageUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Listing type badge */}
        <div
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: color }}
        >
          {LISTING_LABELS[listingType]}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        {/* Title + Quality */}
        <div className="flex items-start justify-between gap-2">
          <h4
            className="font-display font-semibold text-[13px] leading-tight line-clamp-2 transition-colors group-hover:text-[var(--primary)]"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h4>
          {stars > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              {Array.from({ length: stars }, (_, i) => (
                <Star key={i} size={9} fill="#facc15" stroke="#facc15" />
              ))}
            </div>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin size={10} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
          <span
            className="text-[11px] truncate"
            style={{ color: "var(--muted-foreground)" }}
          >
            {location}
          </span>
        </div>

        {/* Price + Details */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-baseline gap-1">
            <span
              className="font-display font-bold text-sm"
              style={{ color: "var(--accent)" }}
            >
              {formatPrice(price)}
            </span>
            {rentFrequency && (
              <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                /{rentFrequency}
              </span>
            )}
          </div>

          <div
            className="flex items-center gap-2 text-[10px]"
            style={{ color: "var(--muted-foreground)" }}
          >
            {bedrooms != null && (
              <span className="flex items-center gap-0.5">
                <BedDouble size={11} strokeWidth={1.5} />
                <span className="font-medium" style={{ color: "var(--foreground)" }}>
                  {bedrooms}
                </span>
              </span>
            )}
            {bathrooms != null && (
              <span className="flex items-center gap-0.5">
                <Bath size={11} strokeWidth={1.5} />
                <span className="font-medium" style={{ color: "var(--foreground)" }}>
                  {bathrooms}
                </span>
              </span>
            )}
            {sqm > 0 && (
              <span className="flex items-center gap-0.5">
                <Maximize2 size={10} strokeWidth={1.5} />
                <span className="font-medium" style={{ color: "var(--foreground)" }}>
                  {sqm}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
