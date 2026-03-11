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

const LISTING_COLORS: Record<string, string> = {
  SALE: "#0001fc", // Brand primary
  RENT: "#0a6906", // Brand success green
  SHORTLET: "#ff6600", // Brand accent orange
  LEASE: "#8b5cf6",
};

function createPriceIcon(price: number | undefined, isHighlighted: boolean, listingType: string = "SALE") {
  const label = price ? formatPrice(price) : "N/A";
  const color = LISTING_COLORS[listingType] || LISTING_COLORS.SALE;
  
  return L.divIcon({
    className: "custom-price-marker border-0 bg-transparent flex flex-col items-center justify-center",
    html: `
      <div style="
        background: ${isHighlighted ? color : "#ffffff"};
        color: ${isHighlighted ? "#ffffff" : "#1a1a1a"};
        border: 2px solid ${color};
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
        box-shadow: ${isHighlighted ? `0 8px 24px -6px ${color}80` : '0 4px 12px -4px rgba(0,0,0,0.3)'};
        font-family: var(--font-display), sans-serif;
        transform: ${isHighlighted ? "scale(1.2) translateY(-4px)" : "scale(1)"};
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        position: relative;
        z-index: ${isHighlighted ? 9999 : 1};
      ">
        ${label}
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid ${isHighlighted ? color : "#ffffff"};
        margin-top: -1px;
        filter: ${isHighlighted ? "none" : "drop-shadow(0px 3px 2px rgba(0,0,0,0.15))"};
        transform: ${isHighlighted ? "scale(1.2) translateY(-4px)" : "scale(1)"};
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        z-index: ${isHighlighted ? 9999 : 1};
      "></div>
    `,
    iconSize: [0, 0],
    iconAnchor: [40, 36], // Bottom-center of the pip
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
          icon={createPriceIcon(property.price, hoveredId === property.id, property.listingType)}
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
