"use client";

import { Plus, Minus, Locate, Layers } from "lucide-react";
import type MapLibreGL from "maplibre-gl";

interface MapControlsProps {
  map: MapLibreGL.Map | null;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  showZoom?: boolean;
  showLocate?: boolean;
  showStyleSwitch?: boolean;
}

export function CustomMapControls({
  map,
  position = "bottom-right",
  showZoom = true,
  showLocate = true,
  showStyleSwitch = false,
}: MapControlsProps) {
  const positionClasses: Record<string, string> = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  const handleZoomIn = () => map?.zoomIn({ duration: 300 });
  const handleZoomOut = () => map?.zoomOut({ duration: 300 });

  const handleLocate = () => {
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 14,
          duration: 2000,
        });
      },
      () => {
        // Silently fail — user denied location
      }
    );
  };

  return (
    <div className={`absolute ${positionClasses[position]} z-10 flex flex-col gap-1`}>
      {showZoom && (
        <div className="flex flex-col bg-background rounded-lg shadow-md border overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-secondary transition-colors"
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
          <div className="h-px bg-border" />
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-secondary transition-colors"
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>
        </div>
      )}
      {showLocate && (
        <button
          onClick={handleLocate}
          className="p-2 bg-background rounded-lg shadow-md border hover:bg-secondary transition-colors"
          aria-label="Locate me"
        >
          <Locate size={16} />
        </button>
      )}
      {showStyleSwitch && (
        <button
          className="p-2 bg-background rounded-lg shadow-md border hover:bg-secondary transition-colors"
          aria-label="Switch map style"
        >
          <Layers size={16} />
        </button>
      )}
    </div>
  );
}
