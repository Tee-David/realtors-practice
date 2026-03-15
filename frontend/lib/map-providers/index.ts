/**
 * Map providers barrel — re-exports the interface, types, and all provider descriptors.
 */

export type {
  MapProvider,
  MapProviderConfig,
  MapComponentProps,
  MapHandle,
  LatLng,
} from "./types";

export { mapboxProvider } from "./mapbox.provider";
export { googleProvider } from "./google.provider";
