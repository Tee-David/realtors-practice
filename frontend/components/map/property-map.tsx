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

const MapboxMap = dynamic(
  () => import("@/lib/map-providers/mapbox-map").then((mod) => mod.MapboxMap),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full min-h-[400px] rounded-xl" />,
  }
);

const GoogleMapsMap = dynamic(
  () => import("@/lib/map-providers/google-map").then((mod) => mod.GoogleMap),
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
      return (
        <MapboxMap
          properties={properties}
          hoveredId={hoveredId}
          onMarkerClick={onMarkerClick}
        />
      );
    case "google":
      return (
        <GoogleMapsMap
          properties={properties}
          hoveredId={hoveredId}
          onMarkerClick={onMarkerClick}
        />
      );
    default:
      return null;
  }
}
