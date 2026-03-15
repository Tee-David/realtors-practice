"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MapProviderType = "osm" | "mapbox" | "google";

interface MapProviderState {
  provider: MapProviderType;
  setProvider: (provider: MapProviderType) => void;
  /** Mapbox access token (set in Settings). */
  mapboxApiKey: string;
  setMapboxApiKey: (key: string) => void;
  /** Google Maps API key (set in Settings). */
  googleApiKey: string;
  setGoogleApiKey: (key: string) => void;
}

export const useMapProvider = create<MapProviderState>()(
  persist(
    (set) => ({
      provider: "osm", // Default to OpenStreetMap
      setProvider: (provider) => set({ provider }),
      mapboxApiKey: "",
      setMapboxApiKey: (mapboxApiKey) => set({ mapboxApiKey }),
      googleApiKey: "",
      setGoogleApiKey: (googleApiKey) => set({ googleApiKey }),
    }),
    {
      name: "map-provider-storage",
    }
  )
);
