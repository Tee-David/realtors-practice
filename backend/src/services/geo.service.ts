import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";

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
   * Get nearby amenities (placeholder — extend with real data source)
   */
  static async findNearbyAmenities(lat: number, lng: number, radiusKm: number = 2) {
    // For now, return static amenity categories with counts from properties nearby
    const nearby = await this.findInRadius({ lat, lng, radiusKm });

    return {
      propertiesNearby: nearby.length,
      radiusKm,
      center: { lat, lng },
      // Future: integrate OSM Overpass API for schools, hospitals, etc.
      amenities: [],
    };
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
