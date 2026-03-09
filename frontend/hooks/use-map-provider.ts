"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MapProviderType = "osm" | "mapbox" | "google";

interface MapProviderState {
  provider: MapProviderType;
  setProvider: (provider: MapProviderType) => void;
  // Future: store API keys here or in secure config
}

export const useMapProvider = create<MapProviderState>()(
  persist(
    (set) => ({
      provider: "osm", // Default to OpenStreetMap
      setProvider: (provider) => set({ provider }),
    }),
    {
      name: "map-provider-storage",
    }
  )
);
