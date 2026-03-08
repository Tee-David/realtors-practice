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
      {/* Image — wider, with overlay badges */}
      <div className="relative w-[220px] sm:w-[260px] shrink-0 aspect-[4/3]">
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
          className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: "var(--primary)" }}
        >
          {LISTING_LABELS[listingType] || listingType}
        </span>

        {/* Quality rating */}
        {stars > 0 && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-lg backdrop-blur-sm"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <Star size={10} fill="#facc15" stroke="#facc15" />
            <span className="text-[10px] font-bold text-white">{(qualityScore! / 20).toFixed(1)}</span>
          </div>
        )}

        {/* Image count */}
        {imageCount > 1 && (
          <div
            className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", color: "#fff" }}
          >
            {imageCount} photos
          </div>
        )}

        {/* Location overlay on image */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white/90 text-[11px] max-w-[60%]">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{location}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
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
        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {bedrooms != null && (
            <span className="flex items-center gap-1">
              <BedDouble size={14} strokeWidth={1.5} />
              <span className="font-medium" style={{ color: "var(--foreground)" }}>{bedrooms}</span>
              Bed{bedrooms !== 1 ? "s" : ""}
            </span>
          )}
          {bathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath size={14} strokeWidth={1.5} />
              <span className="font-medium" style={{ color: "var(--foreground)" }}>{bathrooms}</span>
              Bath
            </span>
          )}
          {(property.landSizeSqm || property.buildingSizeSqm) && (
            <span className="flex items-center gap-1">
              <Maximize2 size={13} strokeWidth={1.5} />
              <span className="font-medium" style={{ color: "var(--foreground)" }}>
                {Math.round(property.landSizeSqm || property.buildingSizeSqm || 0)}
              </span>
              sqm
            </span>
          )}
        </div>

        {/* Price + actions row */}
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div>
            <span className="font-display font-bold text-lg" style={{ color: "var(--accent)" }}>
              {formatPrice(price)}
            </span>
            {rentFrequency && (
              <span className="text-xs font-normal ml-1" style={{ color: "var(--muted-foreground)" }}>
                /{rentFrequency}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-2 rounded-full transition-colors hover:bg-[var(--secondary)]"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Heart size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
