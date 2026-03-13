"use client";

import { useQuery } from "@tanstack/react-query";

export interface GeocodeSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
    suburb?: string;
    neighbourhood?: string;
  };
}

async function fetchNominatim(query: string): Promise<GeocodeSuggestion[]> {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "5",
    countrycodes: "ng", // Nigeria only
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) return [];
  return res.json();
}

/**
 * Geocoding autocomplete using OSM Nominatim.
 * Debounced — only fires when query is >= 2 chars and stable for 400ms.
 */
export function useGeocode(query: string) {
  return useQuery<GeocodeSuggestion[]>({
    queryKey: ["geocode", query],
    queryFn: () => fetchNominatim(query),
    enabled: query.length >= 2,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
