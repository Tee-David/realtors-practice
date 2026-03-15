"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Polygon, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Pencil, Trash2, Search, X } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type LatLng = [number, number];

export interface DrawToSearchProps {
  /** Called when the user finishes drawing and clicks "Search this area". */
  onSearch: (polygon: LatLng[]) => void;
  /** Optional callback when the polygon is cleared. */
  onClear?: () => void;
  /** Optional initial center. Defaults to Lagos. */
  center?: LatLng;
  /** Optional initial zoom. Defaults to 12. */
  zoom?: number;
  /** Optional className for the container. */
  className?: string;
}

// ─── Drawing Layer (uses map events, no external dependencies) ──────────────

function DrawingLayer({
  isDrawing,
  polygon,
  setPolygon,
  onPointAdded,
}: {
  isDrawing: boolean;
  polygon: LatLng[];
  setPolygon: React.Dispatch<React.SetStateAction<LatLng[]>>;
  onPointAdded: () => void;
}) {
  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      setPolygon((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      onPointAdded();
    },
  });

  if (polygon.length < 2) return null;

  return (
    <Polygon
      positions={polygon}
      pathOptions={{
        color: "var(--primary, #0001fc)",
        weight: 2,
        fillColor: "rgba(0, 1, 252, 0.1)",
        fillOpacity: 0.15,
        dashArray: "6, 6",
      }}
    />
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DrawToSearch({
  onSearch,
  onClear,
  center = [6.5244, 3.3792],
  zoom = 12,
  className = "",
}: DrawToSearchProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [polygon, setPolygon] = useState<LatLng[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // Disable map dragging while drawing
  useEffect(() => {
    if (!mapRef.current) return;
    if (isDrawing) {
      mapRef.current.dragging.disable();
      mapRef.current.getContainer().style.cursor = "crosshair";
    } else {
      mapRef.current.dragging.enable();
      mapRef.current.getContainer().style.cursor = "";
    }
  }, [isDrawing]);

  const handleStartDrawing = useCallback(() => {
    setPolygon([]);
    setIsDrawing(true);
    setHasSearched(false);
  }, []);

  const handleFinishDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleSearch = useCallback(() => {
    if (polygon.length < 3) return;
    setHasSearched(true);
    onSearch(polygon);
  }, [polygon, onSearch]);

  const handleClear = useCallback(() => {
    setPolygon([]);
    setIsDrawing(false);
    setHasSearched(false);
    onClear?.();
  }, [onClear]);

  const canSearch = polygon.length >= 3 && !isDrawing;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full rounded-xl"
        style={{ minHeight: "400px" }}
        ref={mapRef}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DrawingLayer
          isDrawing={isDrawing}
          polygon={polygon}
          setPolygon={setPolygon}
          onPointAdded={() => {}}
        />
        {/* Show the completed polygon even when not drawing */}
        {!isDrawing && polygon.length >= 3 && (
          <Polygon
            positions={polygon}
            pathOptions={{
              color: hasSearched ? "#16a34a" : "#0001fc",
              weight: 2,
              fillColor: hasSearched ? "rgba(22, 163, 74, 0.12)" : "rgba(0, 1, 252, 0.08)",
              fillOpacity: 0.2,
            }}
          />
        )}
      </MapContainer>

      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2">
        {!isDrawing && polygon.length === 0 && (
          <button
            onClick={handleStartDrawing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold shadow-md border transition-colors"
            style={{
              backgroundColor: "var(--background)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <Pencil size={14} />
            Draw to search
          </button>
        )}

        {isDrawing && (
          <>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold shadow-md"
              style={{
                backgroundColor: "var(--primary)",
                color: "#ffffff",
              }}
            >
              <Pencil size={14} />
              Click to add points ({polygon.length} placed)
            </div>
            {polygon.length >= 3 && (
              <button
                onClick={handleFinishDrawing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold shadow-md border transition-colors"
                style={{
                  backgroundColor: "var(--background)",
                  borderColor: "var(--primary)",
                  color: "var(--primary)",
                }}
              >
                Done
              </button>
            )}
            <button
              onClick={handleClear}
              className="p-2 rounded-lg shadow-md border transition-colors"
              style={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--muted-foreground)",
              }}
              aria-label="Cancel drawing"
            >
              <X size={14} />
            </button>
          </>
        )}

        {canSearch && (
          <>
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold shadow-md transition-colors"
              style={{
                backgroundColor: "var(--primary)",
                color: "#ffffff",
              }}
            >
              <Search size={14} />
              Search this area
            </button>
            <button
              onClick={handleStartDrawing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold shadow-md border transition-colors"
              style={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              <Pencil size={14} />
              Redraw
            </button>
            <button
              onClick={handleClear}
              className="p-2 rounded-lg shadow-md border transition-colors"
              style={{
                backgroundColor: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--destructive, #dc2626)",
              }}
              aria-label="Clear polygon"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {/* Instructions overlay when drawing just started */}
      {isDrawing && polygon.length === 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
          <div
            className="px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
            style={{
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            Click on the map to place polygon vertices. Minimum 3 points required.
          </div>
        </div>
      )}
    </div>
  );
}
