"use client";

import { useMapProvider } from "@/hooks/use-map-provider";
import type { Property } from "@/types/property";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import map providers so their heavy chunks don't block the main JS thread
const OpenStreetMap = dynamic(
  () => import("./osm-map").then((mod) => mod.OSMMap),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full min-h-[400px] rounded-xl" />,
  }
);

interface PropertyMapProps {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
}

export function PropertyMap({ properties, hoveredId, onMarkerClick }: PropertyMapProps) {
  const { provider } = useMapProvider();

  // Route rendering based on the active provider
  switch (provider) {
    case "osm":
      return (
        <OpenStreetMap
          properties={properties}
          hoveredId={hoveredId}
          onMarkerClick={onMarkerClick}
        />
      );
    case "mapbox":
      // Feature Flag / Placeholder for future Mapbox integration
      return (
        <div className="w-full h-full min-h-[400px] rounded-xl bg-card border border-border flex flex-col items-center justify-center p-6 text-center">
          <h3 className="font-display font-bold text-lg mb-2">Mapbox Integration Required</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            You've selected Mapbox as your provider, but API keys are required. Please switch to OpenStreetMap in your preferences or configure Mapbox in the `.env` settings.
          </p>
        </div>
      );
    case "google":
      // Feature Flag / Placeholder for future Google Maps integration
      return (
        <div className="w-full h-full min-h-[400px] rounded-xl bg-card border border-border flex flex-col items-center justify-center p-6 text-center">
          <h3 className="font-display font-bold text-lg mb-2">Google Maps Integration Required</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            You've selected Google Maps as your provider, but an API key is required. Please switch to OpenStreetMap in your preferences or configure Google Maps in the `.env` settings.
          </p>
        </div>
      );
    default:
      return null;
  }
}
