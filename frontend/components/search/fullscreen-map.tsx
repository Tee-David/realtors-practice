"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Map, MapMarker, MarkerContent, MapControls } from "@/components/ui/map";
import { formatPrice, formatPriceShort } from "@/lib/utils";
import { CLUSTER_CONFIG, getClusterDisplayMode, formatClusterLabel } from "@/lib/cluster-config";
import type MapLibreGL from "maplibre-gl";
import type { Property } from "@/types/property";
import Supercluster from "supercluster";

const LISTING_COLORS: Record<string, string> = {
  SALE: "#0001fc",
  RENT: "#d946ef",     // Magenta/pink for rent
  SHORTLET: "#ff6600",
  LEASE: "#8b5cf6",
};

interface FullscreenMapProps {
  properties: Property[];
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  onPropertyClick: (id: string) => void;
  markersReady?: boolean;
  onMapReady?: (map: MapLibreGL.Map) => void;
}

export function FullscreenMap({ properties, hoveredId, setHoveredId, onPropertyClick, markersReady = true, onMapReady }: FullscreenMapProps) {
    const mapRef = useRef<MapLibreGL.Map | null>(null);
    const [zoom, setZoom] = useState(10);
    const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
    const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());
    const [isMobile, setIsMobile] = useState(false);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

    // Build a lookup map for properties by id
    const propertyMap = useMemo(() => {
      const m = new globalThis.Map<string, Property>();
      for (const p of properties) m.set(p.id, p);
      return m;
    }, [properties]);

    const selectedProperty = selectedPropertyId ? propertyMap.get(selectedPropertyId) : null;

    useEffect(() => {
      const check = () => setIsMobile(window.innerWidth < 768);
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }, []);

    // Listen for map viewport changes
    const handleViewportChange = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;
      const b = map.getBounds();
      setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      setZoom(map.getZoom());
    }, []);

    // Set up map event listeners once we have the ref
    const mapRefCallback = useCallback((map: MapLibreGL.Map) => {
      if (!map || mapRef.current === map) return;
      mapRef.current = map;
      map.on("moveend", handleViewportChange);
      map.on("zoomend", handleViewportChange);
      // Initial bounds
      if (map.loaded()) {
        handleViewportChange();
      } else {
        map.once("load", handleViewportChange);
      }
      // Notify parent that map is ready
      onMapReady?.(map);
    }, [handleViewportChange, onMapReady]);

    // Property point type for Supercluster
    type PointProps = { id: string; price: number; listingType: string; title: string };
    type ClusterProps = { minPrice: number; maxPrice: number; price: number };

    // Build Supercluster index
    const { cluster } = useMemo(() => {
      const sc = new Supercluster<PointProps, ClusterProps>({
        radius: CLUSTER_CONFIG.radius,
        maxZoom: CLUSTER_CONFIG.maxZoom,
        minPoints: CLUSTER_CONFIG.minPoints,
        map: (props) => ({
          price: props.price,
          minPrice: props.price,
          maxPrice: props.price,
        }),
        reduce: (accumulated, props) => {
          accumulated.minPrice = Math.min(accumulated.minPrice, props.minPrice);
          accumulated.maxPrice = Math.max(accumulated.maxPrice, props.maxPrice);
        },
      });

      const pts: Supercluster.PointFeature<PointProps>[] = properties.map((p) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [p.longitude!, p.latitude!] as [number, number],
        },
        properties: {
          id: p.id,
          price: p.price || 0,
          listingType: p.listingType || "SALE",
          title: p.title || "",
        },
      }));

      sc.load(pts);
      return { cluster: sc };
    }, [properties]);

    // Get clusters for current viewport
    const clusters = useMemo(() => {
      if (!bounds) return [];
      try {
        return cluster.getClusters(bounds, Math.floor(zoom));
      } catch {
        return [];
      }
    }, [cluster, bounds, zoom]);

    // Stagger marker appearance
    useEffect(() => {
      if (!markersReady) {
        setVisibleIndices(new Set());
        return;
      }

      setVisibleIndices(new Set());
      const maxToStagger = Math.min(clusters.length, CLUSTER_CONFIG.maxStaggeredMarkers);
      const timeouts: ReturnType<typeof setTimeout>[] = [];

      for (let i = 0; i < maxToStagger; i++) {
        timeouts.push(
          setTimeout(() => {
            setVisibleIndices((prev) => new Set([...prev, i]));
          }, CLUSTER_CONFIG.flyToSettleDelay + i * CLUSTER_CONFIG.staggerDelay)
        );
      }

      return () => timeouts.forEach(clearTimeout);
    }, [clusters.length, markersReady]);

    const displayMode = getClusterDisplayMode(zoom);

    return (
      <Map
        ref={mapRefCallback as unknown as React.Ref<MapLibreGL.Map>}
        viewport={{ center: [3.4, 6.5], zoom: 10 }}
        className="w-full h-full"
      >
        <MapControls position="bottom-right" showCompass={false} />
        {clusters.map((feature, idx) => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties as Record<string, unknown>;
          const isCluster = !!props.cluster;
          const isVisible = visibleIndices.has(idx);

          if (!isVisible && markersReady && clusters.length <= CLUSTER_CONFIG.maxStaggeredMarkers) return null;

          if (isCluster) {
            const count = props.point_count as number;
            const minPrice = props.minPrice as number;
            const maxPrice = props.maxPrice as number;
            const label = formatClusterLabel(count, minPrice, maxPrice, displayMode);
            const size = Math.min(60, 30 + Math.sqrt(count) * 4);

            return (
              <MapMarker
                key={`cluster-${feature.id}`}
                latitude={lat}
                longitude={lng}
                onClick={() => {
                  try {
                    const expansionZoom = Math.min(cluster.getClusterExpansionZoom(feature.id as number), 20);
                    mapRef.current?.flyTo({ center: [lng, lat], zoom: expansionZoom, duration: 500 });
                  } catch { /* ignore */ }
                }}
              >
                <MarkerContent>
                  <div
                    className="flex flex-col items-center justify-center rounded-full bg-primary text-white font-bold shadow-lg cursor-pointer transition-transform hover:scale-110"
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
                </MarkerContent>
              </MapMarker>
            );
          }

          // Individual marker — price pill
          const propId = props.id as string;
          const price = props.price as number;
          const listingType = (props.listingType as string) || "SALE";
          const isHighlighted = hoveredId === propId;
          const isSelected = selectedPropertyId === propId;
          const color = LISTING_COLORS[listingType] || LISTING_COLORS.SALE;

          return (
            <MapMarker
              key={propId}
              latitude={lat}
              longitude={lng}
              onClick={() => {
                setSelectedPropertyId(isSelected ? null : propId);
                onPropertyClick(propId);
              }}
            >
              <MarkerContent>
                <div
                  className="flex flex-col items-center cursor-pointer"
                  onMouseEnter={() => setHoveredId(propId)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible
                      ? (isHighlighted || isSelected) ? "scale(1.25) translateY(-4px)" : "scale(1)"
                      : "scale(0.3)",
                    transition: "opacity 0.3s ease-out, transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                    zIndex: (isHighlighted || isSelected) ? 9999 : 1,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      background: (isHighlighted || isSelected) ? color : "#ffffff",
                      color: (isHighlighted || isSelected) ? "#ffffff" : "#1a1a1a",
                      border: `2px solid ${color}`,
                      padding: isMobile ? "2px 6px" : "4px 10px",
                      borderRadius: "20px",
                      fontSize: isMobile ? "11px" : "13px",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      boxShadow: isMobile
                        ? "0 2px 6px -2px rgba(0,0,0,0.2)"
                        : (isHighlighted || isSelected)
                          ? `0 8px 24px -6px ${color}80`
                          : "0 4px 12px -4px rgba(0,0,0,0.3)",
                      fontFamily: "var(--font-display), sans-serif",
                    }}
                  >
                    {formatPriceShort(price, listingType)}
                  </div>
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: `${isMobile ? 4 : 6}px solid transparent`,
                      borderRight: `${isMobile ? 4 : 6}px solid transparent`,
                      borderTop: `${isMobile ? 4 : 6}px solid ${(isHighlighted || isSelected) ? color : "#ffffff"}`,
                      marginTop: "-1px",
                    }}
                  />
                </div>
              </MarkerContent>
            </MapMarker>
          );
        })}

        {/* ── Popup card for selected property ─────────────────────────────── */}
        {selectedProperty && (
          <PropertyPopupCard
            property={selectedProperty}
            onClose={() => setSelectedPropertyId(null)}
            onClick={() => onPropertyClick(selectedProperty.id)}
          />
        )}
      </Map>
    );
}

// ─── Popup card component shown on marker click ──────────────────────────────

function PropertyPopupCard({
  property,
  onClose,
  onClick,
}: {
  property: Property;
  onClose: () => void;
  onClick: () => void;
}) {
  const images: string[] = Array.isArray(property.images) ? property.images : [];
  const color = LISTING_COLORS[property.listingType] || LISTING_COLORS.SALE;
  const qualityScore = property.qualityScore;
  const qColor = qualityScore != null
    ? (qualityScore >= 80 ? "#16a34a" : qualityScore >= 50 ? "#ca8a04" : "#dc2626")
    : null;
  const isRent = property.listingType === "RENT" || property.listingType === "SHORTLET";

  return (
    <div
      className="absolute z-[100] bottom-4 left-1/2 -translate-x-1/2 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border shadow-2xl overflow-hidden"
      style={{
        backgroundColor: "var(--card, #ffffff)",
        borderColor: "var(--border, #e5e5e5)",
      }}
    >
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "#fff" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>

      <div className="cursor-pointer" onClick={onClick}>
        {/* Thumbnail */}
        <div
          className="w-full h-[140px] relative overflow-hidden"
          style={{ backgroundColor: "var(--secondary, #f0f0f0)" }}
        >
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[0]} alt={property.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M10 11h2M10 15h2M14 11h2M14 15h2M18 11h2M18 15h2M9 7V4h6v3" /></svg>
            </div>
          )}
          {/* Listing type badge */}
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ backgroundColor: color, color: "#fff" }}
          >
            {property.listingType}
          </div>
          {/* Quality badge */}
          {qualityScore != null && qColor && (
            <div
              className="absolute top-2 right-8 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: "rgba(0,0,0,0.65)", color: qColor }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill={qColor} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              {qualityScore}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <p
            className="text-sm font-semibold leading-snug line-clamp-2 mb-1"
            style={{ color: "var(--foreground, #1a1a1a)" }}
          >
            {property.title || "Untitled Property"}
          </p>
          <p className="text-base font-extrabold mb-2" style={{ color: "var(--accent, #FF6600)" }}>
            {formatPrice(property.price)}
            {isRent && (
              <span className="text-xs font-normal ml-0.5" style={{ color: "var(--muted-foreground, #888)" }}>/mo</span>
            )}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted-foreground, #666)" }}>
            {property.bedrooms != null && (
              <span className="flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" /><path d="M6 4h12a2 2 0 0 1 2 2v2H6V4z" /></svg>
                {property.bedrooms} bed
              </span>
            )}
            {property.bathrooms != null && (
              <span className="flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1zM6 12V5a2 2 0 0 1 2-2h3v2.25" /><path d="M14 5.75V12" /></svg>
                {property.bathrooms} bath
              </span>
            )}
            {(property.buildingSizeSqm || property.landSizeSqm) && (
              <span className="flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                {property.buildingSizeSqm || property.landSizeSqm} sqm
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
