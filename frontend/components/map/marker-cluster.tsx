"use client";

import { formatClusterLabel, getClusterDisplayMode } from "@/lib/cluster-config";

interface MarkerClusterProps {
  count: number;
  minPrice?: number;
  maxPrice?: number;
  zoom: number;
  isVisible?: boolean;
  onClick?: () => void;
}

export function MarkerCluster({
  count,
  minPrice,
  maxPrice,
  zoom,
  isVisible = true,
  onClick,
}: MarkerClusterProps) {
  const displayMode = getClusterDisplayMode(zoom);
  const label = formatClusterLabel(count, minPrice, maxPrice, displayMode);
  const size = Math.min(60, 30 + Math.sqrt(count) * 4);

  return (
    <div
      className="flex flex-col items-center justify-center rounded-full bg-primary text-white font-bold shadow-lg cursor-pointer transition-transform hover:scale-110"
      onClick={onClick}
      style={{
        width: size,
        height: size,
        fontSize: size < 40 ? 11 : 13,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "scale(1)" : "scale(0.3)",
        transition: "opacity 0.3s ease-out, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      }}
    >
      <span>{count}</span>
      {displayMode === "price-range" && minPrice != null && maxPrice != null && (
        <span className="text-[9px] opacity-80 leading-tight">{label}</span>
      )}
    </div>
  );
}
