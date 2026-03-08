"use client";

import { Star, MapPin, BedDouble, Bath, Maximize2, Heart, ExternalLink, Tag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Property, PropertyCategory, ListingType } from "@/types/property";

const CATEGORY_GRADIENTS: Record<PropertyCategory, string> = {
  RESIDENTIAL: "from-blue-900/70 via-blue-800/30 to-transparent",
  LAND: "from-emerald-900/70 via-emerald-800/30 to-transparent",
  SHORTLET: "from-orange-900/70 via-orange-800/30 to-transparent",
  COMMERCIAL: "from-violet-900/70 via-violet-800/30 to-transparent",
  INDUSTRIAL: "from-slate-900/70 via-slate-800/30 to-transparent",
};

const CATEGORY_ACCENT: Record<PropertyCategory, string> = {
  RESIDENTIAL: "#3b82f6",
  LAND: "#10b981",
  SHORTLET: "#f97316",
  COMMERCIAL: "#8b5cf6",
  INDUSTRIAL: "#64748b",
};

const LISTING_LABELS: Record<ListingType, string> = {
  SALE: "For Sale",
  RENT: "For Rent",
  LEASE: "Lease",
  SHORTLET: "Shortlet",
};

function StarRating({ score }: { score: number }) {
  const stars = Math.round(score / 20);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={11}
          fill={i < stars ? "#facc15" : "transparent"}
          stroke={i < stars ? "#facc15" : "rgba(255,255,255,0.4)"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

interface PropertyCardProps {
  property: Property;
  isActive?: boolean;
  onFavorite?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
}

export function PropertyCard({ property, isActive, onFavorite, onHover, onClick }: PropertyCardProps) {
  const {
    id, title, category, listingType, price, rentFrequency,
    bedrooms, bathrooms, area, state, locationText,
    images, qualityScore, isPremium, isHotDeal, promoTags = [],
  } = property;

  const imageUrl = Array.isArray(images) && images.length > 0
    ? images[0]
    : "/placeholder-property.jpg";

  const imageCount = Array.isArray(images) ? images.length : 0;
  const location = locationText || [area, state].filter(Boolean).join(", ") || "Lagos, Nigeria";
  const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.RESIDENTIAL;
  const accentColor = CATEGORY_ACCENT[category] || CATEGORY_ACCENT.RESIDENTIAL;

  return (
    <div
      className="group block cursor-pointer"
      onClick={() => onClick?.(id)}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div
        className="relative rounded-2xl overflow-hidden transition-all duration-300 group-hover:-translate-y-1"
        style={{
          backgroundColor: "var(--card)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)",
          border: isActive ? "2px solid var(--primary)" : "none",
        }}
      >
        {/* Image Section */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {/* Property Image */}
          <img
            src={imageUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          {/* Category gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t ${gradient}`} />

          {/* Top row: Quality stars (left) + Listing badge (right) */}
          <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between">
            {/* Star rating pill */}
            {qualityScore != null && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md"
                style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
              >
                <StarRating score={qualityScore} />
              </div>
            )}

            {/* Listing type badge */}
            <div
              className="px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase"
              style={{
                backgroundColor: accentColor,
                color: "#fff",
                letterSpacing: "0.04em",
              }}
            >
              {LISTING_LABELS[listingType]}
            </div>
          </div>

          {/* Promo tags row */}
          {(isPremium || isHotDeal || (promoTags && promoTags.length > 0)) && (
            <div className="absolute top-12 left-3 flex flex-wrap gap-1.5">
              {isPremium && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: "#facc15", color: "#1a1a1a" }}
                >
                  Premium
                </span>
              )}
              {isHotDeal && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: "#ef4444", color: "#fff" }}
                >
                  Hot Deal
                </span>
              )}
              {(promoTags || []).slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-md"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
                >
                  <Tag size={8} />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Bottom: location overlay + image count */}
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
            <div className="flex items-center gap-1.5 text-white/90 text-xs font-medium max-w-[70%]">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{location}</span>
            </div>
            {imageCount > 1 && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-md"
                style={{ backgroundColor: "rgba(0,0,0,0.45)", color: "#fff" }}
              >
                {imageCount} photos
              </div>
            )}
          </div>

          {/* Favorite button */}
          {onFavorite && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFavorite(id);
              }}
              className="absolute top-3 right-14 p-1.5 rounded-full backdrop-blur-md transition-colors hover:bg-white/30"
              style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
            >
              <Heart size={14} className="text-white" />
            </button>
          )}
        </div>

        {/* Content Section */}
        <div className="p-4 space-y-2.5">
          {/* Title */}
          <h3
            className="font-display font-semibold text-sm leading-snug line-clamp-2 transition-colors group-hover:text-[var(--primary)]"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h3>

          {/* Price */}
          <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5">
            <span
              className="font-display font-bold text-base sm:text-lg"
              style={{ color: "var(--accent)" }}
            >
              {formatPrice(price)}
            </span>
            {rentFrequency && (
              <span
                className="text-[10px] sm:text-xs font-medium"
                style={{ color: "var(--muted-foreground)" }}
              >
                /{rentFrequency}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-px" style={{ backgroundColor: "var(--border)" }} />

          {/* Details footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs" style={{ color: "var(--muted-foreground)" }}>
              {bedrooms != null && (
                <span className="flex items-center gap-1">
                  <BedDouble size={14} strokeWidth={1.5} className="shrink-0" />
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>{bedrooms}</span>
                  <span className="hidden xs:inline">Beds</span>
                </span>
              )}
              {bathrooms != null && (
                <span className="flex items-center gap-1">
                  <Bath size={14} strokeWidth={1.5} className="shrink-0" />
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>{bathrooms}</span>
                  <span className="hidden xs:inline">Baths</span>
                </span>
              )}
              {(property.landSizeSqm || property.buildingSizeSqm) && (
                <span className="flex items-center gap-1">
                  <Maximize2 size={13} strokeWidth={1.5} className="shrink-0" />
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>
                    {Math.round(property.landSizeSqm || property.buildingSizeSqm || 0)}
                  </span>
                  <span className="hidden xs:inline">sqm</span>
                </span>
              )}
            </div>

            <ExternalLink
              size={14}
              className="opacity-0 group-hover:opacity-60 transition-opacity"
              style={{ color: "var(--muted-foreground)" }}
            />
          </div>
        </div>

        {/* Category accent bar at bottom */}
        <div
          className="h-[3px] w-full transition-all duration-300 group-hover:h-[4px]"
          style={{ backgroundColor: accentColor }}
        />
      </div>
    </div>
  );
}
