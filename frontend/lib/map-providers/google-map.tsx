// @ts-nocheck — Google Maps types are optional (installed only when provider is active)
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  GoogleMap as GMap,
  useJsApiLoader,
  OverlayViewF,
  OverlayView,
  InfoWindowF,
} from "@react-google-maps/api";
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

const containerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "400px",
  borderRadius: "0.75rem",
};

// ─── Price Pill Overlay ─────────────────────────────────────────────────────

function PricePillOverlay({
  property,
  isHighlighted,
  onClick,
}: {
  property: Property;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const color = LISTING_COLORS[property.listingType] || LISTING_COLORS.SALE;
  const label = property.price ? formatPrice(property.price) : "N/A";

  return (
    <OverlayViewF
      position={{ lat: property.latitude!, lng: property.longitude! }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        className="flex flex-col items-center cursor-pointer"
        onClick={onClick}
        style={{
          transform: `translate(-50%, -100%) ${isHighlighted ? "scale(1.2) translateY(-4px)" : "scale(1)"}`,
          transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          zIndex: isHighlighted ? 9999 : 1,
          position: "relative",
        }}
      >
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
    </OverlayViewF>
  );
}

// ─── GoogleMap Component ────────────────────────────────────────────────────

export function GoogleMap({
  properties,
  hoveredId,
  onMarkerClick,
  center,
  zoom,
}: MapComponentProps) {
  // Read the API key from localStorage (set in the settings page)
  const [apiKey, setApiKey] = useState<string>("");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("rp-settings:display-map-key");
      if (stored) setApiKey(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    // Prevent multiple loads — use a stable id
    id: "rp-google-map-script",
  });

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [infoProperty, setInfoProperty] = useState<Property | null>(null);

  const geoProperties = properties.filter((p) => p.latitude && p.longitude);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapInstanceRef.current = map;
      if (geoProperties.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        geoProperties.forEach((p) => {
          bounds.extend({ lat: p.latitude!, lng: p.longitude! });
        });
        map.fitBounds(bounds, 60);
      }
    },
    [geoProperties]
  );

  // Re-fit bounds when properties change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || geoProperties.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    geoProperties.forEach((p) => {
      bounds.extend({ lat: p.latitude!, lng: p.longitude! });
    });
    map.fitBounds(bounds, 60);
  }, [geoProperties]);

  if (!apiKey) {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl bg-card border border-border flex flex-col items-center justify-center p-6 text-center">
        <h3 className="font-display font-bold text-lg mb-2">Google Maps API Key Required</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Please add your Google Maps API key in Settings &rarr; Data &amp; Display &rarr; Map Provider.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl bg-card border border-border flex flex-col items-center justify-center p-6 text-center">
        <h3 className="font-display font-bold text-lg mb-2">Google Maps Error</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Failed to load Google Maps. Check that your API key is valid and the Maps JavaScript API is enabled.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl bg-card border border-border flex items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">Loading Google Maps...</div>
      </div>
    );
  }

  return (
    <GMap
      mapContainerStyle={containerStyle}
      center={{
        lat: center?.[0] ?? DEFAULT_CENTER[0],
        lng: center?.[1] ?? DEFAULT_CENTER[1],
      }}
      zoom={zoom ?? DEFAULT_ZOOM}
      onLoad={onLoad}
      options={{
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          // Subtle styling to match the light theme
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      }}
    >
      {geoProperties.map((property) => (
        <PricePillOverlay
          key={property.id}
          property={property}
          isHighlighted={hoveredId === property.id}
          onClick={() => {
            setInfoProperty(property);
            onMarkerClick(property.id);
          }}
        />
      ))}

      {infoProperty && infoProperty.latitude && infoProperty.longitude && (
        <InfoWindowF
          position={{ lat: infoProperty.latitude, lng: infoProperty.longitude }}
          onCloseClick={() => setInfoProperty(null)}
          options={{ pixelOffset: new google.maps.Size(0, -30) }}
        >
          <div style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
            <p className="font-semibold text-sm">{infoProperty.title}</p>
            <p className="text-xs" style={{ color: "var(--accent)" }}>
              {formatPrice(infoProperty.price)}
            </p>
          </div>
        </InfoWindowF>
      )}
    </GMap>
  );
}
