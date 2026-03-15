import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";
import { RedisClient } from "../utils/redis.util";

interface BoundingBox {
  north: number; // max latitude
  south: number; // min latitude
  east: number;  // max longitude
  west: number;  // min longitude
}

interface RadiusSearch {
  lat: number;
  lng: number;
  radiusKm: number;
}

interface GeoSearchResult {
  id: string;
  title: string;
  price: number | null;
  latitude: number;
  longitude: number;
  area: string | null;
  state: string | null;
  listingType: string;
  bedrooms: number | null;
  propertyType: string | null;
  images: any;
  distance?: number;
}

interface Amenity {
  id: number;
  name: string;
  type: string;       // e.g. "school", "hospital", "supermarket"
  category: string;   // OSM category grouping
  lat: number;
  lng: number;
  distance: number;   // km from query point
  tags?: Record<string, string>;
}

interface AmenitySearchResult {
  center: { lat: number; lng: number };
  radiusMeters: number;
  amenities: Amenity[];
  cached: boolean;
}

const AMENITY_CACHE_PREFIX = "amenity:";
const AMENITY_CACHE_TTL = 3600; // 1 hour

/**
 * Overpass API amenity type mappings.
 * Maps human-readable categories to OSM tag filters.
 */
const AMENITY_CATEGORIES: Record<string, string> = {
  school: '["amenity"~"school|university|college|kindergarten"]',
  hospital: '["amenity"~"hospital|clinic|doctors|pharmacy"]',
  market: '["shop"~"supermarket|convenience|mall|marketplace"]',
  bank: '["amenity"~"bank|atm"]',
  restaurant: '["amenity"~"restaurant|fast_food|cafe"]',
  worship: '["amenity"~"place_of_worship"]',
  fuel: '["amenity"="fuel"]',
  police: '["amenity"="police"]',
};

// Nigeria bounding box for validation
const NIGERIA_BOUNDS = {
  north: 13.9,
  south: 4.0,
  east: 14.7,
  west: 2.7,
};

// Pre-built Lagos area coordinates (no API call needed)
const AREA_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Lagos
  "lekki": { lat: 6.4394, lng: 3.4746 },
  "lekki phase 1": { lat: 6.4434, lng: 3.4766 },
  "lekki phase 2": { lat: 6.4340, lng: 3.5080 },
  "victoria island": { lat: 6.4281, lng: 3.4226 },
  "vi": { lat: 6.4281, lng: 3.4226 },
  "ikoyi": { lat: 6.4540, lng: 3.4346 },
  "ikeja": { lat: 6.5953, lng: 3.3515 },
  "ajah": { lat: 6.4676, lng: 3.5852 },
  "yaba": { lat: 6.5159, lng: 3.3873 },
  "surulere": { lat: 6.4947, lng: 3.3570 },
  "maryland": { lat: 6.5675, lng: 3.3628 },
  "gbagada": { lat: 6.5544, lng: 3.3868 },
  "magodo": { lat: 6.6237, lng: 3.3913 },
  "ogba": { lat: 6.6270, lng: 3.3370 },
  "mushin": { lat: 6.5316, lng: 3.3558 },
  "oshodi": { lat: 6.5505, lng: 3.3390 },
  "isolo": { lat: 6.5305, lng: 3.3214 },
  "festac": { lat: 6.4646, lng: 3.2861 },
  "amuwo odofin": { lat: 6.4525, lng: 3.3069 },
  "apapa": { lat: 6.4485, lng: 3.3598 },
  "ilupeju": { lat: 6.5530, lng: 3.3654 },
  "anthony": { lat: 6.5623, lng: 3.3651 },
  "ketu": { lat: 6.5951, lng: 3.3849 },
  "ojota": { lat: 6.5832, lng: 3.3810 },
  "berger": { lat: 6.6147, lng: 3.3595 },
  "agege": { lat: 6.6181, lng: 3.3293 },
  "sangotedo": { lat: 6.4538, lng: 3.5521 },
  "chevron": { lat: 6.4412, lng: 3.5272 },
  "ibeju lekki": { lat: 6.4260, lng: 3.6140 },
  "epe": { lat: 6.5817, lng: 3.9792 },
  "badagry": { lat: 6.4165, lng: 2.8817 },
  "ikorodu": { lat: 6.6153, lng: 3.5069 },
  "marina": { lat: 6.4476, lng: 3.4003 },
  "lagos island": { lat: 6.4549, lng: 3.3947 },
  "banana island": { lat: 6.4591, lng: 3.4297 },
  "oniru": { lat: 6.4310, lng: 3.4393 },
  "osapa london": { lat: 6.4367, lng: 3.5199 },
  "ikate": { lat: 6.4335, lng: 3.4849 },
  // Abuja
  "abuja": { lat: 9.0579, lng: 7.4951 },
  "maitama": { lat: 9.0873, lng: 7.4921 },
  "asokoro": { lat: 9.0419, lng: 7.5255 },
  "wuse": { lat: 9.0752, lng: 7.4699 },
  "wuse 2": { lat: 9.0762, lng: 7.4626 },
  "garki": { lat: 9.0347, lng: 7.4867 },
  "gwarinpa": { lat: 9.1171, lng: 7.3950 },
  "jahi": { lat: 9.0851, lng: 7.4266 },
  "utako": { lat: 9.0852, lng: 7.4459 },
  "katampe": { lat: 9.0994, lng: 7.4578 },
  "kubwa": { lat: 9.1594, lng: 7.3283 },
  "lugbe": { lat: 8.9825, lng: 7.3778 },
  "life camp": { lat: 9.1059, lng: 7.3832 },
  // Port Harcourt
  "port harcourt": { lat: 4.8156, lng: 7.0498 },
  "gra": { lat: 4.8024, lng: 7.0108 },
  "peter odili": { lat: 4.8324, lng: 7.0325 },
  "trans amadi": { lat: 4.8102, lng: 7.0557 },
  // Ibadan
  "ibadan": { lat: 7.3775, lng: 3.9470 },
  "bodija": { lat: 7.4213, lng: 3.9022 },
  // Enugu
  "enugu": { lat: 6.4584, lng: 7.5464 },
  "independence layout": { lat: 6.4697, lng: 7.5212 },
  // General
  "lagos": { lat: 6.5244, lng: 3.3792 },
};

export class GeoService {
  /**
   * Parse a bbox query string in the format "minLng,minLat,maxLng,maxLat"
   * (standard OGC/GeoJSON bbox convention) into a BoundingBox.
   */
  static parseBboxString(bbox: string): BoundingBox {
    const parts = bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      throw new Error("bbox must be 4 comma-separated numbers: minLng,minLat,maxLng,maxLat");
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    return {
      west: minLng,
      south: minLat,
      east: maxLng,
      north: maxLat,
    };
  }

  /**
   * Find properties within a bounding box (map viewport)
   */
  static async findInBoundingBox(box: BoundingBox, filters?: Record<string, unknown>) {
    const { north, south, east, west } = box;

    const where: any = {
      deletedAt: null,
      latitude: { not: null, gte: south, lte: north },
      longitude: { not: null, gte: west, lte: east },
    };

    // Optional additional filters
    if (filters?.listingType) where.listingType = filters.listingType;
    if (filters?.category) where.category = filters.category;
    if (filters?.minPrice || filters?.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = Number(filters.minPrice);
      if (filters.maxPrice) where.price.lte = Number(filters.maxPrice);
    }
    if (filters?.bedrooms) where.bedrooms = { gte: Number(filters.bedrooms) };

    const properties = await prisma.property.findMany({
      where,
      select: {
        id: true,
        title: true,
        price: true,
        latitude: true,
        longitude: true,
        area: true,
        state: true,
        listingType: true,
        bedrooms: true,
        propertyType: true,
        images: true,
      },
      take: 500, // Cap to prevent overwhelming the map
      orderBy: { qualityScore: "desc" },
    });

    return properties as GeoSearchResult[];
  }

  /**
   * Find properties within a radius of a point (Haversine formula via SQL)
   */
  static async findInRadius(search: RadiusSearch, filters?: Record<string, unknown>) {
    const { lat, lng, radiusKm } = search;

    // Use rough bounding box first for DB index, then refine with Haversine
    const latDelta = radiusKm / 111; // ~111km per degree of latitude
    const lngDelta = radiusKm / (111 * Math.cos(lat * (Math.PI / 180)));

    const bbox: BoundingBox = {
      north: lat + latDelta,
      south: lat - latDelta,
      east: lng + lngDelta,
      west: lng - lngDelta,
    };

    // Get candidates from bounding box
    const candidates = await this.findInBoundingBox(bbox, filters);

    // Refine with exact Haversine distance
    return candidates
      .map((p) => ({
        ...p,
        distance: this.haversine(lat, lng, p.latitude, p.longitude),
      }))
      .filter((p) => p.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Geocode an area name to coordinates using lookup table
   */
  static geocodeArea(areaName: string): { lat: number; lng: number } | null {
    const normalized = areaName.trim().toLowerCase();

    // Direct match
    if (AREA_COORDINATES[normalized]) {
      return AREA_COORDINATES[normalized];
    }

    // Partial match (e.g., "lekki phase" matches "lekki phase 1")
    const partialMatch = Object.entries(AREA_COORDINATES).find(([key]) =>
      key.includes(normalized) || normalized.includes(key)
    );

    if (partialMatch) {
      return partialMatch[1];
    }

    Logger.warn(`Geocode miss for: "${areaName}"`);
    return null;
  }

  /**
   * Find nearby amenities (schools, hospitals, markets, etc.) using the
   * OpenStreetMap Overpass API. Results are cached in Redis for 1 hour.
   *
   * @param lat      Latitude of the center point
   * @param lng      Longitude of the center point
   * @param radiusM  Radius in meters (default 1000)
   * @param types    Optional array of amenity categories to filter
   *                 (e.g. ["school","hospital"]). Defaults to all categories.
   */
  static async findNearbyAmenities(
    lat: number,
    lng: number,
    radiusM: number = 1000,
    types?: string[]
  ): Promise<AmenitySearchResult> {
    // Round coordinates for cache key stability (4 decimal places ~ 11m)
    const cacheKey = `${AMENITY_CACHE_PREFIX}${lat.toFixed(4)}:${lng.toFixed(4)}:${radiusM}:${(types || ["all"]).sort().join(",")}`;

    // Check cache first
    const cached = await RedisClient.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AmenitySearchResult;
        return { ...parsed, cached: true };
      } catch {
        // Corrupted cache entry, continue to fetch
      }
    }

    // Build Overpass query for requested amenity types
    const categoriesToQuery = types && types.length > 0
      ? types.filter((t) => AMENITY_CATEGORIES[t])
      : Object.keys(AMENITY_CATEGORIES);

    if (categoriesToQuery.length === 0) {
      return { center: { lat, lng }, radiusMeters: radiusM, amenities: [], cached: false };
    }

    // Build Overpass QL body: query nodes for each category within radius
    const queryParts = categoriesToQuery.map((cat) => {
      const filter = AMENITY_CATEGORIES[cat];
      return `node${filter}(around:${radiusM},${lat},${lng});`;
    });

    const overpassQuery = `
      [out:json][timeout:10];
      (
        ${queryParts.join("\n        ")}
      );
      out body;
    `.trim();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        Logger.warn(`Overpass API returned ${response.status}: ${response.statusText}`);
        return { center: { lat, lng }, radiusMeters: radiusM, amenities: [], cached: false };
      }

      const data = await response.json() as { elements?: Array<{
        id: number;
        lat: number;
        lon: number;
        tags?: Record<string, string>;
      }> };

      const amenities: Amenity[] = (data.elements || []).map((el) => {
        const tags = el.tags || {};
        const name = tags.name || tags["name:en"] || "Unnamed";
        const type = this.classifyAmenityType(tags);
        const category = this.classifyAmenityCategory(tags);
        const distance = this.haversine(lat, lng, el.lat, el.lon);

        return {
          id: el.id,
          name,
          type,
          category,
          lat: el.lat,
          lng: el.lon,
          distance: Math.round(distance * 1000) / 1000, // km, 3 decimal places
          tags,
        };
      }).sort((a, b) => a.distance - b.distance);

      const result: AmenitySearchResult = {
        center: { lat, lng },
        radiusMeters: radiusM,
        amenities,
        cached: false,
      };

      // Cache the result
      await RedisClient.set(cacheKey, JSON.stringify(result), AMENITY_CACHE_TTL);

      return result;
    } catch (error: any) {
      if (error.name === "AbortError") {
        Logger.warn("Overpass API request timed out");
      } else {
        Logger.error(`Overpass API error: ${error.message}`);
      }
      // Return empty on failure rather than crashing
      return { center: { lat, lng }, radiusMeters: radiusM, amenities: [], cached: false };
    }
  }

  /**
   * Classify an OSM element's tags into a human-readable type string.
   */
  private static classifyAmenityType(tags: Record<string, string>): string {
    if (tags.amenity) return tags.amenity;
    if (tags.shop) return tags.shop;
    if (tags.leisure) return tags.leisure;
    if (tags.tourism) return tags.tourism;
    return "other";
  }

  /**
   * Classify an OSM element into one of our amenity categories.
   */
  private static classifyAmenityCategory(tags: Record<string, string>): string {
    const amenity = tags.amenity || "";
    const shop = tags.shop || "";

    if (/school|university|college|kindergarten/i.test(amenity)) return "school";
    if (/hospital|clinic|doctors|pharmacy/i.test(amenity)) return "hospital";
    if (/supermarket|convenience|mall|marketplace/i.test(shop)) return "market";
    if (/bank|atm/i.test(amenity)) return "bank";
    if (/restaurant|fast_food|cafe/i.test(amenity)) return "restaurant";
    if (/place_of_worship/i.test(amenity)) return "worship";
    if (amenity === "fuel") return "fuel";
    if (amenity === "police") return "police";
    return "other";
  }

  /**
   * Find nearby properties for a specific property by ID.
   * Looks up the property's lat/lng, then searches within the given radius.
   */
  static async findNearbyProperties(
    propertyId: string,
    radiusKm: number = 5,
    filters?: Record<string, unknown>
  ) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: { id: true, latitude: true, longitude: true, area: true, state: true },
    });

    if (!property) {
      throw new Error("Property not found");
    }

    if (property.latitude === null || property.longitude === null) {
      // Fall back to area-based search if no coordinates
      if (!property.area) {
        return { property, nearby: [], fallback: "no_coordinates" };
      }

      const areaProperties = await prisma.property.findMany({
        where: {
          deletedAt: null,
          id: { not: propertyId },
          area: property.area,
          ...(filters?.listingType ? { listingType: filters.listingType as any } : {}),
          ...(filters?.category ? { category: filters.category as any } : {}),
        },
        select: {
          id: true,
          title: true,
          price: true,
          latitude: true,
          longitude: true,
          area: true,
          state: true,
          listingType: true,
          bedrooms: true,
          propertyType: true,
          images: true,
        },
        take: 20,
        orderBy: { qualityScore: "desc" },
      });

      return { property, nearby: areaProperties, fallback: "area_match" };
    }

    const nearby = await this.findInRadius(
      { lat: property.latitude, lng: property.longitude, radiusKm },
      filters
    );

    // Exclude the subject property from results
    const filtered = nearby.filter((p) => p.id !== propertyId);

    return { property, nearby: filtered, fallback: null };
  }

  /**
   * Haversine formula for distance between two points in km
   */
  private static haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Validate coordinates are within Nigeria
   */
  static isInNigeria(lat: number, lng: number): boolean {
    return (
      lat >= NIGERIA_BOUNDS.south &&
      lat <= NIGERIA_BOUNDS.north &&
      lng >= NIGERIA_BOUNDS.west &&
      lng <= NIGERIA_BOUNDS.east
    );
  }

  /**
   * Get all known area names (for autocomplete)
   */
  static getKnownAreas(): string[] {
    return Object.keys(AREA_COORDINATES).sort();
  }
}
