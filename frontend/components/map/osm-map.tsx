"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatPrice, formatPriceShort } from "@/lib/utils";
import type { Property } from "@/types/property";
import Supercluster from "supercluster";

// Fix default marker icons in webpack/next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const LISTING_COLORS: Record<string, string> = {
  SALE: "#0001fc",     // Brand primary blue
  RENT: "#d946ef",     // Magenta/pink for rent
  SHORTLET: "#ff6600", // Brand accent orange
  LEASE: "#8b5cf6",
};

function createPriceIcon(price: number | undefined, isHighlighted: boolean, listingType: string = "SALE") {
  const label = formatPriceShort(price, listingType);
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
    iconAnchor: [40, 36],
  });
}

function createClusterIcon(count: number) {
  const size = Math.min(60, 30 + Math.sqrt(count) * 4);
  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--primary, #0001fc);
      color: #fff;
      font-weight: 700;
      font-size: ${size < 40 ? 11 : 13}px;
      font-family: var(--font-display), sans-serif;
      box-shadow: 0 4px 14px -4px rgba(0,1,252,0.5);
      border: 3px solid rgba(255,255,255,0.9);
      cursor: pointer;
    ">${count}</div>`,
    className: "custom-cluster-marker bg-transparent",
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
}

function buildPopupHtml(property: Property): string {
  const images: string[] = Array.isArray(property.images) ? property.images : [];
  const color = LISTING_COLORS[property.listingType] || LISTING_COLORS.SALE;
  const qualityScore = property.qualityScore;
  const qColor = qualityScore != null
    ? (qualityScore >= 80 ? "#16a34a" : qualityScore >= 50 ? "#ca8a04" : "#dc2626")
    : null;
  const isRent = property.listingType === "RENT" || property.listingType === "SHORTLET";
  const priceStr = property.price ? `₦${new Intl.NumberFormat().format(property.price)}` : "N/A";

  const imgHtml = images[0]
    ? `<img src="${images[0]}" alt="${(property.title || '').replace(/"/g, '&quot;')}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"><path d="M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M10 11h2M10 15h2M14 11h2M14 15h2M18 11h2M18 15h2M9 7V4h6v3" /></svg>
      </div>`;

  const statsItems: string[] = [];
  if (property.bedrooms != null) {
    statsItems.push(`<span style="display:flex;align-items:center;gap:3px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/><path d="M6 4h12a2 2 0 0 1 2 2v2H6V4z"/></svg>
      ${property.bedrooms} bed</span>`);
  }
  if (property.bathrooms != null) {
    statsItems.push(`<span style="display:flex;align-items:center;gap:3px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1zM6 12V5a2 2 0 0 1 2-2h3v2.25"/><path d="M14 5.75V12"/></svg>
      ${property.bathrooms} bath</span>`);
  }
  const sqm = property.buildingSizeSqm || property.landSizeSqm;
  if (sqm) {
    statsItems.push(`<span style="display:flex;align-items:center;gap:3px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
      ${sqm} sqm</span>`);
  }

  const qualityBadge = qualityScore != null
    ? `<div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.65);color:${qColor};font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:flex;align-items:center;gap:3px;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="${qColor}" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        ${qualityScore}
      </div>`
    : "";

  return `
    <div style="font-family:var(--font-outfit),sans-serif;width:260px;margin:-12px -20px;">
      <div style="width:100%;height:120px;position:relative;overflow:hidden;border-radius:8px 8px 0 0;background:#f0f0f0;">
        ${imgHtml}
        <div style="position:absolute;top:6px;left:6px;background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">
          ${property.listingType}
        </div>
        ${qualityBadge}
      </div>
      <div style="padding:10px 12px 12px;">
        <p style="font-size:13px;font-weight:600;line-height:1.3;margin:0 0 4px;color:#1a1a1a;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
          ${property.title || "Untitled Property"}
        </p>
        <p style="font-size:15px;font-weight:800;color:var(--accent,#FF6600);margin:0 0 8px;">
          ${priceStr}${isRent ? '<span style="font-size:11px;font-weight:500;color:#888;">/mo</span>' : ""}
        </p>
        ${statsItems.length > 0 ? `<div style="display:flex;gap:12px;font-size:11px;color:#666;">${statsItems.join("")}</div>` : ""}
      </div>
    </div>
  `;
}

// ─── Supercluster-powered layer ─────────────────────────────────────────────

type PointProps = { index: number; id: string; price: number; listingType: string; title: string };

function ClusteredMarkers({
  properties,
  hoveredId,
  onMarkerClick,
}: {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
}) {
  const map = useMap();
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [zoom, setZoom] = useState(map.getZoom());

  const updateView = useCallback(() => {
    const b = map.getBounds();
    setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    setZoom(map.getZoom());
  }, [map]);

  useMapEvents({
    moveend: updateView,
    zoomend: updateView,
  });

  useEffect(() => {
    updateView();
  }, [updateView]);

  const supercluster = useMemo(() => {
    const sc = new Supercluster<PointProps>({
      radius: 60,
      maxZoom: 16,
      minPoints: 2,
    });
    const pts: Supercluster.PointFeature<PointProps>[] = properties.map((p, i) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.longitude!, p.latitude!] },
      properties: {
        index: i,
        id: p.id,
        price: p.price || 0,
        listingType: p.listingType || "SALE",
        title: p.title || "",
      },
    }));
    sc.load(pts);
    return sc;
  }, [properties]);

  const clusters = useMemo(() => {
    if (!bounds) return [];
    try {
      return supercluster.getClusters(bounds, Math.floor(zoom));
    } catch {
      return [];
    }
  }, [supercluster, bounds, zoom]);

  return (
    <>
      {clusters.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties as Record<string, unknown>;
        const isCluster = !!props.cluster;

        if (isCluster) {
          const count = props.point_count as number;
          const clusterId = feature.id as number;
          return (
            <Marker
              key={`cluster-${clusterId}`}
              position={[lat, lng]}
              icon={createClusterIcon(count)}
              eventHandlers={{
                click: () => {
                  try {
                    const expansionZoom = Math.min(supercluster.getClusterExpansionZoom(clusterId), 20);
                    map.flyTo([lat, lng], expansionZoom, { duration: 0.5 });
                  } catch { /* ignore */ }
                },
              }}
            />
          );
        }

        // Individual property marker
        const propIndex = props.index as number;
        const property = properties[propIndex];
        if (!property) return null;

        return (
          <Marker
            key={property.id}
            position={[lat, lng]}
            icon={createPriceIcon(property.price, hoveredId === property.id, property.listingType)}
            eventHandlers={{
              click: () => onMarkerClick(property.id),
            }}
          >
            <Popup maxWidth={280} minWidth={260} closeButton={true} className="property-rich-popup">
              <div dangerouslySetInnerHTML={{ __html: buildPopupHtml(property) }} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

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
      <ClusteredMarkers
        properties={geoProperties}
        hoveredId={hoveredId}
        onMarkerClick={onMarkerClick}
      />
    </MapContainer>
  );
}
