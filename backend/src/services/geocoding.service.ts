import { Logger } from "../utils/logger.util";
import { RedisClient } from "../utils/redis.util";

const CACHE_TTL = 86400; // 24 hours for geocoding results
const CACHE_PREFIX = "geocode:";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const NOMINATIM_USER_AGENT = "RealtorsPractice/1.0";
// Rate-limit Nominatim: track last request time (max 1 req/sec per Nominatim policy)
let lastNominatimRequest = 0;

/**
 * Pre-built coordinate database for Nigerian areas.
 * Avoids external API calls; covers major cities and neighborhoods.
 */
const COORDINATES_DB: Record<string, { lat: number; lng: number; state: string }> = {
  // === Lagos ===
  "lekki": { lat: 6.4394, lng: 3.4746, state: "Lagos" },
  "lekki phase 1": { lat: 6.4434, lng: 3.4766, state: "Lagos" },
  "lekki phase 2": { lat: 6.4340, lng: 3.5080, state: "Lagos" },
  "victoria island": { lat: 6.4281, lng: 3.4226, state: "Lagos" },
  "vi": { lat: 6.4281, lng: 3.4226, state: "Lagos" },
  "ikoyi": { lat: 6.4540, lng: 3.4346, state: "Lagos" },
  "ikeja": { lat: 6.5953, lng: 3.3515, state: "Lagos" },
  "ajah": { lat: 6.4676, lng: 3.5852, state: "Lagos" },
  "yaba": { lat: 6.5159, lng: 3.3873, state: "Lagos" },
  "surulere": { lat: 6.4947, lng: 3.3570, state: "Lagos" },
  "maryland": { lat: 6.5675, lng: 3.3628, state: "Lagos" },
  "gbagada": { lat: 6.5544, lng: 3.3868, state: "Lagos" },
  "magodo": { lat: 6.6237, lng: 3.3913, state: "Lagos" },
  "ogba": { lat: 6.6270, lng: 3.3370, state: "Lagos" },
  "mushin": { lat: 6.5316, lng: 3.3558, state: "Lagos" },
  "oshodi": { lat: 6.5505, lng: 3.3390, state: "Lagos" },
  "isolo": { lat: 6.5305, lng: 3.3214, state: "Lagos" },
  "festac": { lat: 6.4646, lng: 3.2861, state: "Lagos" },
  "amuwo odofin": { lat: 6.4525, lng: 3.3069, state: "Lagos" },
  "apapa": { lat: 6.4485, lng: 3.3598, state: "Lagos" },
  "ilupeju": { lat: 6.5530, lng: 3.3654, state: "Lagos" },
  "anthony": { lat: 6.5623, lng: 3.3651, state: "Lagos" },
  "ketu": { lat: 6.5951, lng: 3.3849, state: "Lagos" },
  "ojota": { lat: 6.5832, lng: 3.3810, state: "Lagos" },
  "berger": { lat: 6.6147, lng: 3.3595, state: "Lagos" },
  "agege": { lat: 6.6181, lng: 3.3293, state: "Lagos" },
  "sangotedo": { lat: 6.4538, lng: 3.5521, state: "Lagos" },
  "chevron": { lat: 6.4412, lng: 3.5272, state: "Lagos" },
  "ibeju lekki": { lat: 6.4260, lng: 3.6140, state: "Lagos" },
  "epe": { lat: 6.5817, lng: 3.9792, state: "Lagos" },
  "badagry": { lat: 6.4165, lng: 2.8817, state: "Lagos" },
  "ikorodu": { lat: 6.6153, lng: 3.5069, state: "Lagos" },
  "marina": { lat: 6.4476, lng: 3.4003, state: "Lagos" },
  "lagos island": { lat: 6.4549, lng: 3.3947, state: "Lagos" },
  "banana island": { lat: 6.4591, lng: 3.4297, state: "Lagos" },
  "oniru": { lat: 6.4310, lng: 3.4393, state: "Lagos" },
  "osapa london": { lat: 6.4367, lng: 3.5199, state: "Lagos" },
  "ikate": { lat: 6.4335, lng: 3.4849, state: "Lagos" },
  "lagos": { lat: 6.5244, lng: 3.3792, state: "Lagos" },
  "oregun": { lat: 6.5965, lng: 3.3676, state: "Lagos" },
  "ogudu": { lat: 6.5729, lng: 3.3937, state: "Lagos" },
  "omole": { lat: 6.6347, lng: 3.3645, state: "Lagos" },
  "ojodu": { lat: 6.6388, lng: 3.3579, state: "Lagos" },
  "ojo": { lat: 6.4585, lng: 3.1835, state: "Lagos" },
  "alimosho": { lat: 6.6014, lng: 3.2551, state: "Lagos" },
  "iyana ipaja": { lat: 6.6133, lng: 3.2678, state: "Lagos" },
  "egbeda": { lat: 6.5992, lng: 3.2849, state: "Lagos" },
  // === Abuja ===
  "abuja": { lat: 9.0579, lng: 7.4951, state: "FCT" },
  "maitama": { lat: 9.0873, lng: 7.4921, state: "FCT" },
  "asokoro": { lat: 9.0419, lng: 7.5255, state: "FCT" },
  "wuse": { lat: 9.0752, lng: 7.4699, state: "FCT" },
  "wuse 2": { lat: 9.0762, lng: 7.4626, state: "FCT" },
  "garki": { lat: 9.0347, lng: 7.4867, state: "FCT" },
  "gwarinpa": { lat: 9.1171, lng: 7.3950, state: "FCT" },
  "jahi": { lat: 9.0851, lng: 7.4266, state: "FCT" },
  "utako": { lat: 9.0852, lng: 7.4459, state: "FCT" },
  "katampe": { lat: 9.0994, lng: 7.4578, state: "FCT" },
  "kubwa": { lat: 9.1594, lng: 7.3283, state: "FCT" },
  "lugbe": { lat: 8.9825, lng: 7.3778, state: "FCT" },
  "life camp": { lat: 9.1059, lng: 7.3832, state: "FCT" },
  "central area": { lat: 9.0579, lng: 7.4891, state: "FCT" },
  "gudu": { lat: 9.0167, lng: 7.4728, state: "FCT" },
  "kado": { lat: 9.1024, lng: 7.4352, state: "FCT" },
  "durumi": { lat: 9.0256, lng: 7.4578, state: "FCT" },
  "apo": { lat: 9.0028, lng: 7.5143, state: "FCT" },
  // === Port Harcourt ===
  "port harcourt": { lat: 4.8156, lng: 7.0498, state: "Rivers" },
  "gra": { lat: 4.8024, lng: 7.0108, state: "Rivers" },
  "peter odili": { lat: 4.8324, lng: 7.0325, state: "Rivers" },
  "trans amadi": { lat: 4.8102, lng: 7.0557, state: "Rivers" },
  "rumuibekwe": { lat: 4.8364, lng: 7.0223, state: "Rivers" },
  "eliozu": { lat: 4.8574, lng: 7.0269, state: "Rivers" },
  // === Ibadan ===
  "ibadan": { lat: 7.3775, lng: 3.9470, state: "Oyo" },
  "bodija": { lat: 7.4213, lng: 3.9022, state: "Oyo" },
  "jericho": { lat: 7.3978, lng: 3.8684, state: "Oyo" },
  "ring road": { lat: 7.3842, lng: 3.8910, state: "Oyo" },
  // === Enugu ===
  "enugu": { lat: 6.4584, lng: 7.5464, state: "Enugu" },
  "independence layout": { lat: 6.4697, lng: 7.5212, state: "Enugu" },
  "new haven": { lat: 6.4508, lng: 7.5063, state: "Enugu" },
  // === Kaduna ===
  "kaduna": { lat: 10.5222, lng: 7.4383, state: "Kaduna" },
  // === Kano ===
  "kano": { lat: 12.0022, lng: 8.5920, state: "Kano" },
  // === Benin City ===
  "benin city": { lat: 6.3350, lng: 5.6270, state: "Edo" },
  "gra benin": { lat: 6.3370, lng: 5.6292, state: "Edo" },
  // === Uyo ===
  "uyo": { lat: 5.0377, lng: 7.9128, state: "Akwa Ibom" },
  // === Warri ===
  "warri": { lat: 5.5167, lng: 5.7500, state: "Delta" },
  // === Calabar ===
  "calabar": { lat: 4.9757, lng: 8.3417, state: "Cross River" },
};

interface GeocodeResult {
  lat: number;
  lng: number;
  area: string;
  state: string;
  confidence: "exact" | "partial" | "none";
}

interface ReverseGeocodeResult {
  area: string;
  state: string;
  distance: number; // km from nearest known area
}

export class GeocodingService {
  /**
   * Geocode a single area name to coordinates.
   * Checks Redis cache first, then local DB, with partial matching fallback.
   */
  static async geocode(areaName: string): Promise<GeocodeResult | null> {
    try {
      const normalized = areaName.trim().toLowerCase();
      if (!normalized) return null;

      // Check cache
      const cacheKey = `${CACHE_PREFIX}fwd:${normalized}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      // Exact match
      const exact = COORDINATES_DB[normalized];
      if (exact) {
        const result: GeocodeResult = {
          lat: exact.lat,
          lng: exact.lng,
          area: areaName,
          state: exact.state,
          confidence: "exact",
        };
        await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
        return result;
      }

      // Partial match: check if any key contains or is contained by the query
      for (const [key, coords] of Object.entries(COORDINATES_DB)) {
        if (key.includes(normalized) || normalized.includes(key)) {
          const result: GeocodeResult = {
            lat: coords.lat,
            lng: coords.lng,
            area: key,
            state: coords.state,
            confidence: "partial",
          };
          await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
          return result;
        }
      }

      // Fallback to Nominatim for unknown areas (restricted to Nigeria)
      Logger.info(`Local geocode miss for "${areaName}", trying Nominatim`);
      const nominatimResult = await this.nominatimGeocode(areaName);
      if (nominatimResult) {
        await RedisClient.set(cacheKey, JSON.stringify(nominatimResult), CACHE_TTL);
        return nominatimResult;
      }

      Logger.warn(`Geocode miss for: "${areaName}" (including Nominatim)`);
      return null;
    } catch (error: any) {
      Logger.error(`GeocodingService.geocode error: ${error.message}`);
      return null;
    }
  }

  /**
   * Batch geocode multiple area names in parallel.
   * Returns a map of area name -> GeocodeResult (null if not found).
   */
  static async batchGeocode(areaNames: string[]): Promise<Map<string, GeocodeResult | null>> {
    const results = new Map<string, GeocodeResult | null>();

    // Deduplicate input
    const unique = [...new Set(areaNames.map((a) => a.trim()))].filter(Boolean);

    // Process all in parallel
    const promises = unique.map(async (area) => {
      const result = await this.geocode(area);
      results.set(area, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Reverse geocode: find the nearest known area to a lat/lng point.
   * Uses Haversine distance to the known coordinate DB entries.
   */
  static async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
    try {
      // Check cache
      const cacheKey = `${CACHE_PREFIX}rev:${lat.toFixed(4)}:${lng.toFixed(4)}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      let nearest: ReverseGeocodeResult | null = null;
      let minDist = Infinity;

      for (const [area, coords] of Object.entries(COORDINATES_DB)) {
        const dist = this.haversine(lat, lng, coords.lat, coords.lng);
        if (dist < minDist) {
          minDist = dist;
          nearest = {
            area,
            state: coords.state,
            distance: Math.round(dist * 100) / 100,
          };
        }
      }

      // Return local match if within 50km
      if (nearest && nearest.distance <= 50) {
        await RedisClient.set(cacheKey, JSON.stringify(nearest), CACHE_TTL);
        return nearest;
      }

      // Fallback to Nominatim reverse geocoding
      const nominatimResult = await this.nominatimReverse(lat, lng);
      if (nominatimResult) {
        await RedisClient.set(cacheKey, JSON.stringify(nominatimResult), CACHE_TTL);
        return nominatimResult;
      }

      return null;
    } catch (error: any) {
      Logger.error(`GeocodingService.reverseGeocode error: ${error.message}`);
      return null;
    }
  }

  /**
   * Get all known area names (for autocomplete).
   */
  static getKnownAreas(): Array<{ area: string; state: string; lat: number; lng: number }> {
    return Object.entries(COORDINATES_DB)
      .map(([area, coords]) => ({
        area,
        state: coords.state,
        lat: coords.lat,
        lng: coords.lng,
      }))
      .sort((a, b) => a.area.localeCompare(b.area));
  }

  /**
   * Address autocomplete: fuzzy-match a partial query against known areas.
   * Returns ranked suggestions sorted by relevance.
   */
  static autocomplete(
    query: string,
    limit: number = 10
  ): Array<{ area: string; state: string; lat: number; lng: number; score: number }> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const scored: Array<{ area: string; state: string; lat: number; lng: number; score: number }> = [];

    for (const [area, coords] of Object.entries(COORDINATES_DB)) {
      let score = 0;

      // Exact match
      if (area === normalized) {
        score = 100;
      }
      // Starts with query
      else if (area.startsWith(normalized)) {
        score = 80 + (normalized.length / area.length) * 15;
      }
      // Contains query
      else if (area.includes(normalized)) {
        score = 50 + (normalized.length / area.length) * 20;
      }
      // Query contains area name (e.g. "lekki phase 1 lagos" contains "lekki phase 1")
      else if (normalized.includes(area)) {
        score = 40 + (area.length / normalized.length) * 20;
      }
      // Word-level fuzzy match: check if all query words appear in the area name
      else {
        const queryWords = normalized.split(/\s+/);
        const areaWords = area.split(/\s+/);
        const matchedWords = queryWords.filter((qw) =>
          areaWords.some((aw) => aw.startsWith(qw) || qw.startsWith(aw))
        );
        if (matchedWords.length > 0) {
          score = 20 + (matchedWords.length / queryWords.length) * 30;
        }
      }

      if (score > 0) {
        scored.push({
          area,
          state: coords.state,
          lat: coords.lat,
          lng: coords.lng,
          score: Math.round(score * 10) / 10,
        });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Forward geocode using Nominatim (OpenStreetMap).
   * Restricted to Nigeria results. Respects 1 req/sec rate limit.
   */
  static async nominatimGeocode(query: string): Promise<GeocodeResult | null> {
    try {
      await this.throttleNominatim();

      const params = new URLSearchParams({
        q: query,
        countrycodes: "ng",
        format: "json",
        limit: "1",
        addressdetails: "1",
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
        headers: { "User-Agent": NOMINATIM_USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        Logger.warn(`Nominatim search returned ${response.status}`);
        return null;
      }

      const results = await response.json() as Array<{
        lat: string;
        lon: string;
        display_name: string;
        address?: {
          suburb?: string;
          city?: string;
          town?: string;
          village?: string;
          state?: string;
          county?: string;
        };
      }>;

      if (!results.length) return null;

      const top = results[0];
      const addr = top.address || {};
      const area = addr.suburb || addr.town || addr.village || addr.city || query;
      const state = addr.state || "Unknown";

      return {
        lat: parseFloat(top.lat),
        lng: parseFloat(top.lon),
        area,
        state,
        confidence: "partial" as const, // Nominatim results are external
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        Logger.warn("Nominatim geocode request timed out");
      } else {
        Logger.error(`Nominatim geocode error: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Reverse geocode using Nominatim (OpenStreetMap).
   * Falls back to this when local DB has no match within 50km.
   */
  static async nominatimReverse(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
    try {
      await this.throttleNominatim();

      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: "json",
        addressdetails: "1",
        zoom: "16", // Neighbourhood level
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
        headers: { "User-Agent": NOMINATIM_USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        Logger.warn(`Nominatim reverse returned ${response.status}`);
        return null;
      }

      const data = await response.json() as {
        address?: {
          suburb?: string;
          city?: string;
          town?: string;
          village?: string;
          state?: string;
          county?: string;
          country_code?: string;
        };
        error?: string;
      };

      if (data.error || !data.address) return null;

      // Only accept Nigerian results
      if (data.address.country_code && data.address.country_code !== "ng") return null;

      const addr = data.address;
      const area = addr.suburb || addr.town || addr.village || addr.city || "Unknown";
      const state = addr.state || "Unknown";

      return {
        area,
        state,
        distance: 0, // Nominatim gives the actual location name, distance is conceptually 0
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        Logger.warn("Nominatim reverse request timed out");
      } else {
        Logger.error(`Nominatim reverse error: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Clear geocoding cache (admin use).
   */
  static async clearCache(): Promise<void> {
    Logger.info("Geocoding cache clear requested (manual cache keys must be deleted individually)");
  }

  /**
   * Enforce Nominatim's 1 request/second rate limit.
   */
  private static async throttleNominatim(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastNominatimRequest;
    if (elapsed < 1100) {
      await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
    }
    lastNominatimRequest = Date.now();
  }

  /**
   * Haversine formula for distance between two points in km.
   */
  private static haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
