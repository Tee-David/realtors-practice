"use client";

import { useState, useEffect, type ComponentType } from "react";
import { useMapProvider } from "@/hooks/use-map-provider";
import type { Property } from "@/types/property";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// OSM is always available (react-leaflet is a core dependency)
const OpenStreetMap = dynamic(
  () => import("./osm-map").then((mod) => mod.OSMMap),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-full min-h-[400px] rounded-xl" />,
  }
);

function MapProviderMissing({ name, pkg }: { name: string; pkg: string }) {
  return (
    <div className="w-full h-full min-h-[400px] rounded-xl bg-card border border-border flex flex-col items-center justify-center p-6 text-center">
      <h3 className="font-display font-bold text-lg mb-2">{name} Not Available</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Install the required package to use {name}:{" "}
        <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">npm install {pkg}</code>
      </p>
      <p className="text-xs text-muted-foreground mt-2">Falling back to OpenStreetMap.</p>
    </div>
  );
}

interface PropertyMapProps {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
}

export function PropertyMap({ properties, hoveredId, onMarkerClick }: PropertyMapProps) {
  const { provider } = useMapProvider();

  // Always use OSM — Mapbox and Google Maps require their packages to be installed
  // and are loaded only at runtime to avoid build failures
  if (provider === "osm" || provider === "mapbox" || provider === "google") {
    return (
      <OpenStreetMap
        properties={properties}
        hoveredId={hoveredId}
        onMarkerClick={onMarkerClick}
      />
    );
  }

  return null;
}
