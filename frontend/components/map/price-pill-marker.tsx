"use client";

import { formatPrice } from "@/lib/utils";

const LISTING_COLORS: Record<string, string> = {
  SALE: "#0001fc",
  RENT: "#0a6906",
  SHORTLET: "#ff6600",
  LEASE: "#8b5cf6",
};

interface PricePillMarkerProps {
  price: number;
  listingType?: string;
  isHighlighted?: boolean;
  isVisible?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
  mobile?: boolean;
}

export function PricePillMarker({
  price,
  listingType = "SALE",
  isHighlighted = false,
  isVisible = true,
  onMouseEnter,
  onMouseLeave,
  onClick,
  mobile = false,
}: PricePillMarkerProps) {
  const color = LISTING_COLORS[listingType] || LISTING_COLORS.SALE;

  return (
    <div
      className="flex flex-col items-center cursor-pointer"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? isHighlighted
            ? "scale(1.25) translateY(-4px)"
            : "scale(1)"
          : "scale(0.3)",
        transition: "opacity 0.3s ease-out, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        zIndex: isHighlighted ? 9999 : 1,
        position: "relative",
      }}
    >
      <div
        style={{
          background: isHighlighted ? color : "#ffffff",
          color: isHighlighted ? "#ffffff" : "#1a1a1a",
          border: `2px solid ${color}`,
          padding: mobile ? "2px 6px" : "4px 10px",
          borderRadius: "20px",
          fontSize: mobile ? "11px" : "13px",
          fontWeight: 800,
          whiteSpace: "nowrap",
          boxShadow: mobile
            ? "0 2px 6px -2px rgba(0,0,0,0.2)"
            : isHighlighted
              ? `0 8px 24px -6px ${color}80`
              : "0 4px 12px -4px rgba(0,0,0,0.3)",
          fontFamily: "var(--font-display), sans-serif",
        }}
      >
        {formatPrice(price)}
      </div>
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${mobile ? 4 : 6}px solid transparent`,
          borderRight: `${mobile ? 4 : 6}px solid transparent`,
          borderTop: `${mobile ? 4 : 6}px solid ${isHighlighted ? color : "#ffffff"}`,
          marginTop: "-1px",
        }}
      />
    </div>
  );
}
