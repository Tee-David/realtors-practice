"use client";

import { useCallback, useRef } from "react";
import { extractAreaFromQuery, getZoomForArea } from "@/lib/lagos-coordinates";

interface FlyToOptions {
  duration?: number;
  zoom?: number;
}

/**
 * Hook for flying the map to a location based on a search query.
 * Uses the pre-built Nigerian coordinate lookup table.
 * Works with Leaflet maps (our current OSM provider).
 */
export function useFlyTo() {
  const mapRef = useRef<L.Map | null>(null);
  const lastFlyRef = useRef<string>("");

  const setMap = useCallback((map: L.Map | null) => {
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
    const duration = options?.duration || 2;

    mapRef.current.flyTo([lat, lng], zoom, {
      duration,
      easeLinearity: 0.25,
    });

    return true;
  }, []);

  const flyToCoords = useCallback((lat: number, lng: number, zoom = 14) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([lat, lng], zoom, {
      duration: 2,
      easeLinearity: 0.25,
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
