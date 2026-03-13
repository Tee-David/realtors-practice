"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Map, MapMarker, MarkerContent, MapControls } from "@/components/ui/map";
import { formatPrice } from "@/lib/utils";
import { CLUSTER_CONFIG, getClusterDisplayMode, formatClusterLabel } from "@/lib/cluster-config";
import type MapLibreGL from "maplibre-gl";
import type { Property } from "@/types/property";
import Supercluster from "supercluster";

const LISTING_COLORS: Record<string, string> = {
  SALE: "#0001fc",
  RENT: "#0a6906",
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
          const color = LISTING_COLORS[listingType] || LISTING_COLORS.SALE;

          return (
            <MapMarker
              key={propId}
              latitude={lat}
              longitude={lng}
              onClick={() => onPropertyClick(propId)}
            >
              <MarkerContent>
                <div
                  className="flex flex-col items-center cursor-pointer"
                  onMouseEnter={() => setHoveredId(propId)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible
                      ? isHighlighted ? "scale(1.25) translateY(-4px)" : "scale(1)"
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
                      padding: isMobile ? "2px 6px" : "4px 10px",
                      borderRadius: "20px",
                      fontSize: isMobile ? "11px" : "13px",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      boxShadow: isMobile
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
                      borderLeft: `${isMobile ? 4 : 6}px solid transparent`,
                      borderRight: `${isMobile ? 4 : 6}px solid transparent`,
                      borderTop: `${isMobile ? 4 : 6}px solid ${isHighlighted ? color : "#ffffff"}`,
                      marginTop: "-1px",
                    }}
                  />
                </div>
              </MarkerContent>
            </MapMarker>
          );
        })}
      </Map>
    );
}
