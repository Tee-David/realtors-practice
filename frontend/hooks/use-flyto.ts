"use client";

import { useCallback, useRef } from "react";
import { extractAreaFromQuery, getZoomForArea } from "@/lib/lagos-coordinates";
import type MapLibreGL from "maplibre-gl";

interface FlyToOptions {
  duration?: number;
  zoom?: number;
}

/**
 * Hook for flying the map to a location based on a search query.
 * Uses the pre-built Nigerian coordinate lookup table.
 * Works with MapLibre GL maps (used by the search page).
 */
export function useFlyTo() {
  const mapRef = useRef<MapLibreGL.Map | null>(null);
  const lastFlyRef = useRef<string>("");

  const setMap = useCallback((map: MapLibreGL.Map | null) => {
    mapRef.current = map;
  }, []);

  const flyToQuery = useCallback((query: string, options?: FlyToOptions) => {
    if (!mapRef.current || !query) return false;

    const result = extractAreaFromQuery(query);
    if (!result) return false;

    // Don't re-fly to the same area
    if (lastFlyRef.current === result.area) return true;
    lastFlyRef.current = result.area;

    const [lng, lat] = result.coords;
    const zoom = options?.zoom || getZoomForArea(result.area);
    const duration = options?.duration || 2000;

    mapRef.current.flyTo({
      center: [lng, lat],
      zoom,
      duration,
      essential: true,
    });

    return true;
  }, []);

  const flyToCoords = useCallback((lat: number, lng: number, zoom = 14) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom,
      duration: 2000,
      essential: true,
    });
  }, []);

  const resetFlyState = useCallback(() => {
    lastFlyRef.current = "";
  }, []);

  return {
    setMap,
    flyToQuery,
    flyToCoords,
    resetFlyState,
    mapRef,
  };
}
