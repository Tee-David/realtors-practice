/**
 * Mapbox GL JS provider — uses react-map-gl (v8) on top of mapbox-gl.
 *
 * Required packages (already in package.json):
 *   - react-map-gl ^8.1.0
 *   - mapbox-gl ^3.19.1
 *   - @types/mapbox-gl ^3.4.1
 */

export { MapboxMap } from "./mapbox-map";

export const mapboxProvider = {
  name: "Mapbox GL",
  key: "mapbox" as const,
  requiresApiKey: true,
};
