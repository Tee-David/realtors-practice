"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatPrice } from "@/lib/utils";
import type { Property } from "@/types/property";

// Fix default marker icons in webpack/next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function createPriceIcon(price: number | undefined, isHighlighted: boolean) {
  const label = price ? formatPrice(price) : "N/A";
  return L.divIcon({
    className: "custom-price-marker",
    html: `<div style="
      background: ${isHighlighted ? "var(--primary)" : "var(--card)"};
      color: ${isHighlighted ? "#fff" : "var(--foreground)"};
      border: 2px solid ${isHighlighted ? "var(--primary)" : "var(--border)"};
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      font-family: var(--font-space-grotesk), sans-serif;
    ">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [40, 20],
  });
}

function FitBounds({ properties }: { properties: Property[] }) {
  const map = useMap();
  useEffect(() => {
    const coords = properties
      .filter((p) => p.latitude && p.longitude)
      .map((p) => [p.latitude!, p.longitude!] as [number, number]);
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 });
    }
  }, [properties, map]);
  return null;
}

interface PropertyMapProps {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
}

export function OSMMap({ properties, hoveredId, onMarkerClick }: PropertyMapProps) {
  const geoProperties = properties.filter((p) => p.latitude && p.longitude);
  const defaultCenter: [number, number] = [6.5244, 3.3792];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={12}
      className="w-full h-full rounded-xl"
      style={{ minHeight: "400px" }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds properties={geoProperties} />
      {geoProperties.map((property) => (
        <Marker
          key={property.id}
          position={[property.latitude!, property.longitude!]}
          icon={createPriceIcon(property.price, hoveredId === property.id)}
          eventHandlers={{
            click: () => onMarkerClick(property.id),
          }}
        >
          <Popup>
            <div style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
              <p className="font-semibold text-sm">{property.title}</p>
              <p className="text-xs" style={{ color: "var(--accent)" }}>{formatPrice(property.price)}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
