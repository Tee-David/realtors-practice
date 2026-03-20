// @ts-nocheck — Mapbox types are optional (installed only when provider is active)
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { formatPrice } from "@/lib/utils";
import type { Property } from "@/types/property";
import type { MapComponentProps, LatLng } from "./types";

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_CENTER: LatLng = [6.5244, 3.3792]; // Lagos
const DEFAULT_ZOOM = 12;

const LISTING_COLORS: Record<string, string> = {
  SALE: "#0001fc",
  RENT: "#0a6906",
  SHORTLET: "#ff6600",
  LEASE: "#8b5cf6",
};

// ─── Price Pill (inline for Mapbox markers) ─────────────────────────────────

function PricePill({
  price,
  listingType = "SALE",
  isHighlighted,
}: {
  price?: number;
  listingType?: string;
  isHighlighted: boolean;
}) {
  const color = LISTING_COLORS[listingType] || LISTING_COLORS.SALE;
  const label = price ? formatPrice(price) : "N/A";

  return (
    <div className="flex flex-col items-center" style={{ zIndex: isHighlighted ? 9999 : 1 }}>
      <div
        style={{
          background: isHighlighted ? color : "#ffffff",
          color: isHighlighted ? "#ffffff" : "#1a1a1a",
          border: `2px solid ${color}`,
          padding: "4px 10px",
          borderRadius: "20px",
          fontSize: "13px",
          fontWeight: 800,
          whiteSpace: "nowrap",
          boxShadow: isHighlighted
            ? `0 8px 24px -6px ${color}80`
            : "0 4px 12px -4px rgba(0,0,0,0.3)",
          fontFamily: "var(--font-display), sans-serif",
          transform: isHighlighted ? "scale(1.2) translateY(-4px)" : "scale(1)",
          transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: `6px solid ${isHighlighted ? color : "#ffffff"}`,
          marginTop: "-1px",
        }}
      />
    </div>
  );
}

// ─── MapboxMap Component ────────────────────────────────────────────────────

export function MapboxMap({
  properties,
  hoveredId,
  onMarkerClick,
  center,
  zoom,
}: MapComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const [popupProperty, setPopupProperty] = useState<Property | null>(null);

  // Read the API key from localStorage (set in the settings page)
  const [accessToken, setAccessToken] = useState<string>("");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("rp-settings:display-map-key");
      if (stored) setAccessToken(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const geoProperties = properties.filter((p) => p.latitude && p.longitude);

  // Fit bounds when properties change
  const fitBounds = useCallback(() => {
    if (!mapRef.current || geoProperties.length === 0) return;
    const lngs = geoProperties.map((p) => p.longitude!);
    const lats = geoProperties.map((p) => p.latitude!);
    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, maxZoom: 14, duration: 1200 }
    );
  }, [geoProperties]);

  useEffect(() => {
    // Small delay to let the map initialize
    const timer = setTimeout(fitBounds, 300);
    return () => clearTimeout(timer);
  }, [fitBounds]);

  if (!accessToken) {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl bg-card border border-border flex flex-col items-center justify-center p-6 text-center">
        <h3 className="font-display font-bold text-lg mb-2">Mapbox API Key Required</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Please add your Mapbox access token in Settings &rarr; Data &amp; Display &rarr; Map Provider.
        </p>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={accessToken}
      initialViewState={{
        longitude: center?.[1] ?? DEFAULT_CENTER[1],
        latitude: center?.[0] ?? DEFAULT_CENTER[0],
        zoom: zoom ?? DEFAULT_ZOOM,
      }}
      style={{ width: "100%", height: "100%", minHeight: "400px", borderRadius: "0.75rem" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      attributionControl={true}
    >
      <NavigationControl position="bottom-right" />
      <GeolocateControl position="bottom-right" trackUserLocation />

      {geoProperties.map((property) => (
        <Marker
          key={property.id}
          longitude={property.longitude!}
          latitude={property.latitude!}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setPopupProperty(property);
            onMarkerClick(property.id);
          }}
        >
          <PricePill
            price={property.price}
            listingType={property.listingType}
            isHighlighted={hoveredId === property.id}
          />
        </Marker>
      ))}

      {popupProperty && popupProperty.latitude && popupProperty.longitude && (
        <Popup
          longitude={popupProperty.longitude}
          latitude={popupProperty.latitude}
          anchor="top"
          closeOnClick={false}
          onClose={() => setPopupProperty(null)}
          offset={20}
        >
          <div style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
            <p className="font-semibold text-sm">{popupProperty.title}</p>
            <p className="text-xs" style={{ color: "var(--accent)" }}>
              {formatPrice(popupProperty.price)}
            </p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
