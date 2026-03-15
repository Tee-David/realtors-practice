/**
 * Google Maps provider — uses @react-google-maps/api.
 *
 * Required packages (NOT yet in package.json):
 *   - @react-google-maps/api
 *
 * Install with:  npm install @react-google-maps/api
 */

export { GoogleMap as GoogleMapsComponent } from "./google-map";

export const googleProvider = {
  name: "Google Maps",
  key: "google" as const,
  requiresApiKey: true,
};
