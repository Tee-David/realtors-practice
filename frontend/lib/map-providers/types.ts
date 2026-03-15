/**
 * MapProvider interface — the contract that every map provider must implement.
 *
 * Each provider exposes a React component (`MapComponent`) that can render
 * properties on a map and respond to user interactions.
 */

import type { Property } from "@/types/property";

/** Coordinates as [latitude, longitude]. */
export type LatLng = [number, number];

/** Configuration passed to every provider at initialization time. */
export interface MapProviderConfig {
  /** API key (required for Mapbox and Google Maps, unused for OSM). */
  apiKey?: string;
  /** Map style URL (Mapbox) or Map ID (Google). */
  mapStyle?: string;
}

/** Props that every map component receives, mirroring the existing OSMMap signature. */
export interface MapComponentProps {
  properties: Property[];
  hoveredId: string | null;
  onMarkerClick: (id: string) => void;
  /** Optional initial center override. Defaults to Lagos [6.5244, 3.3792]. */
  center?: LatLng;
  /** Optional initial zoom override. Defaults to 12. */
  zoom?: number;
}

/** Imperative handle exposed via ref for programmatic map control. */
export interface MapHandle {
  /** Animate the camera to a position. */
  flyTo: (center: LatLng, zoom?: number) => void;
  /** Fit the map bounds to contain all supplied coordinates. */
  fitBounds: (coords: LatLng[], padding?: number) => void;
  /** Get the current center of the map. */
  getCenter: () => LatLng | null;
  /** Get the current zoom level. */
  getZoom: () => number | null;
}

/** Descriptor returned by a provider factory. */
export interface MapProvider {
  /** Human-readable name shown in UI. */
  name: string;
  /** Unique key matching MapProviderType. */
  key: "osm" | "mapbox" | "google";
  /** Whether the provider requires an API key. */
  requiresApiKey: boolean;
  /** The React component to render the map. */
  MapComponent: React.ComponentType<MapComponentProps>;
}
