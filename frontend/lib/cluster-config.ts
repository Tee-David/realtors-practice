/**
 * Supercluster configuration for property marker clustering.
 * Used to aggregate properties at low zoom levels and show individual
 * price pill markers at high zoom.
 */

export const CLUSTER_CONFIG = {
  /** Cluster radius in pixels */
  radius: 60,
  /** Maximum zoom level at which clusters are generated */
  maxZoom: 16,
  /** Minimum zoom for showing individual markers instead of clusters */
  individualMarkerZoom: 14,
  /** Min points to form a cluster */
  minPoints: 2,
  /** Maximum markers to show staggered animation for */
  maxStaggeredMarkers: 150,
  /** Stagger delay between each marker pop-in (ms) */
  staggerDelay: 80,
  /** Delay after flyTo before markers start appearing (ms) */
  flyToSettleDelay: 300,
};

/**
 * Get cluster display info based on zoom level.
 */
export function getClusterDisplayMode(zoom: number): "cluster" | "price-range" | "individual" {
  if (zoom <= 10) return "cluster";
  if (zoom <= 13) return "price-range";
  return "individual";
}

/**
 * Format a cluster label based on display mode.
 */
export function formatClusterLabel(
  count: number,
  minPrice?: number,
  maxPrice?: number,
  mode: "cluster" | "price-range" | "individual" = "cluster"
): string {
  if (mode === "price-range" && minPrice != null && maxPrice != null) {
    const formatP = (n: number) => {
      if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
      if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
      return `₦${n}`;
    };
    return `${formatP(minPrice)}–${formatP(maxPrice)}`;
  }
  return `${count} properties`;
}
