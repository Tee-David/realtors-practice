import { Request, Response } from "express";
import { GeoService } from "../services/geo.service";
import { GeocodingService } from "../services/geocoding.service";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { z } from "zod";

const bboxSchema = z.object({
  north: z.coerce.number().min(-90).max(90),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  west: z.coerce.number().min(-180).max(180),
});

const radiusSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(100).default(5),
});

export class GeoController {
  /**
   * @swagger
   * /properties/geo/bbox:
   *   get:
   *     summary: Get properties within a bounding box (map viewport)
   *     tags: [Geo]
   *     parameters:
   *       - in: query
   *         name: north
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: south
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: east
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: west
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: listingType
   *         schema: { type: string }
   *       - in: query
   *         name: category
   *         schema: { type: string }
   *       - in: query
   *         name: minPrice
   *         schema: { type: number }
   *       - in: query
   *         name: maxPrice
   *         schema: { type: number }
   *       - in: query
   *         name: bedrooms
   *         schema: { type: number }
   *     responses:
   *       200:
   *         description: Properties within the bounding box
   */
  public static async findInBoundingBox(req: Request, res: Response) {
    try {
      const bbox = bboxSchema.parse(req.query);
      const { listingType, category, minPrice, maxPrice, bedrooms } = req.query;

      const properties = await GeoService.findInBoundingBox(bbox, {
        listingType,
        category,
        minPrice,
        maxPrice,
        bedrooms,
      });

      return sendSuccess(res, properties, `${properties.length} properties in viewport`);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return sendError(res, "Invalid bounding box parameters", 400);
      }
      return sendError(res, error.message || "Failed to fetch geo properties");
    }
  }

  /**
   * @swagger
   * /properties/geo/radius:
   *   get:
   *     summary: Get properties within a radius of a point
   *     tags: [Geo]
   *     parameters:
   *       - in: query
   *         name: lat
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: lng
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: radiusKm
   *         schema: { type: number }
   *         description: "Default: 5km, Max: 100km"
   *     responses:
   *       200:
   *         description: Properties within the radius, sorted by distance
   */
  public static async findInRadius(req: Request, res: Response) {
    try {
      const search = radiusSchema.parse(req.query);
      const { listingType, category, minPrice, maxPrice, bedrooms } = req.query;

      if (!GeoService.isInNigeria(search.lat, search.lng)) {
        return sendError(res, "Coordinates must be within Nigeria", 400);
      }

      const properties = await GeoService.findInRadius(search, {
        listingType,
        category,
        minPrice,
        maxPrice,
        bedrooms,
      });

      return sendSuccess(res, properties, `${properties.length} properties within ${search.radiusKm}km`);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return sendError(res, "Invalid radius search parameters", 400);
      }
      return sendError(res, error.message || "Failed to fetch nearby properties");
    }
  }

  /**
   * @swagger
   * /properties/geo/geocode:
   *   get:
   *     summary: Geocode a Nigerian area name to coordinates
   *     tags: [Geo]
   *     parameters:
   *       - in: query
   *         name: area
   *         schema: { type: string }
   *         required: true
   *     responses:
   *       200:
   *         description: Coordinates for the area
   *       404:
   *         description: Area not found
   */
  public static async geocodeArea(req: Request, res: Response) {
    try {
      const area = req.query.area as string;
      if (!area) {
        return sendError(res, "Area name is required", 400);
      }

      const coords = GeoService.geocodeArea(area);
      if (!coords) {
        return sendError(res, `Could not geocode area: "${area}"`, 404);
      }

      return sendSuccess(res, { area, ...coords });
    } catch (error: any) {
      return sendError(res, error.message || "Geocoding failed");
    }
  }

  /**
   * @swagger
   * /properties/geo/areas:
   *   get:
   *     summary: List all known area names for autocomplete
   *     tags: [Geo]
   *     responses:
   *       200:
   *         description: List of area names
   */
  public static async listAreas(req: Request, res: Response) {
    const areas = GeoService.getKnownAreas();
    return sendSuccess(res, areas);
  }

  /**
   * @swagger
   * /properties/geo/nearby:
   *   get:
   *     summary: Find nearby properties and amenities around a point
   *     tags: [Geo]
   *     parameters:
   *       - in: query
   *         name: lat
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: lng
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: radiusKm
   *         schema: { type: number }
   *         description: "Default: 2km"
   *     responses:
   *       200:
   *         description: Nearby properties count and amenity data
   */
  public static async findNearby(req: Request, res: Response) {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radiusKm = Number(req.query.radiusKm) || 2;

      if (isNaN(lat) || isNaN(lng)) {
        return sendError(res, "Valid lat and lng are required", 400);
      }

      const result = await GeoService.findNearbyAmenities(lat, lng, radiusKm);
      return sendSuccess(res, result);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to find nearby");
    }
  }

  /**
   * GET /properties/:id/nearby?radiusKm=5
   * Find nearby properties for a specific property by its ID.
   */
  public static async findNearbyByProperty(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const radiusKm = Number(req.query.radiusKm) || 5;
      const { listingType, category } = req.query;

      if (!id) {
        return sendError(res, "Property ID is required", 400);
      }

      const result = await GeoService.findNearbyProperties(id, radiusKm, {
        listingType,
        category,
      });

      return sendSuccess(
        res,
        result,
        `${result.nearby.length} nearby properties found${result.fallback ? ` (${result.fallback})` : ""}`
      );
    } catch (error: any) {
      if (error.message === "Property not found") {
        return sendError(res, "Property not found", 404);
      }
      return sendError(res, error.message || "Failed to find nearby properties");
    }
  }

  /**
   * @swagger
   * /properties/geo/properties:
   *   get:
   *     summary: Get properties within a bounding box (bbox query string format)
   *     tags: [Geo]
   *     parameters:
   *       - in: query
   *         name: bbox
   *         schema: { type: string }
   *         required: true
   *         description: "Bounding box as minLng,minLat,maxLng,maxLat"
   *       - in: query
   *         name: listingType
   *         schema: { type: string }
   *       - in: query
   *         name: category
   *         schema: { type: string }
   *       - in: query
   *         name: minPrice
   *         schema: { type: number }
   *       - in: query
   *         name: maxPrice
   *         schema: { type: number }
   *       - in: query
   *         name: bedrooms
   *         schema: { type: number }
   *     responses:
   *       200:
   *         description: Properties within the bounding box
   */
  public static async findByBbox(req: Request, res: Response) {
    try {
      const bboxStr = req.query.bbox as string;
      if (!bboxStr) {
        return sendError(res, "bbox query parameter is required (format: minLng,minLat,maxLng,maxLat)", 400);
      }

      const box = GeoService.parseBboxString(bboxStr);
      const { listingType, category, minPrice, maxPrice, bedrooms } = req.query;

      const properties = await GeoService.findInBoundingBox(box, {
        listingType,
        category,
        minPrice,
        maxPrice,
        bedrooms,
      });

      return sendSuccess(res, properties, `${properties.length} properties in bounding box`);
    } catch (error: any) {
      if (error.message?.includes("bbox must be")) {
        return sendError(res, error.message, 400);
      }
      return sendError(res, error.message || "Failed to fetch properties by bbox");
    }
  }

  /**
   * @swagger
   * /properties/geo/amenities:
   *   get:
   *     summary: Find nearby amenities (schools, hospitals, markets, etc.) via OpenStreetMap
   *     tags: [Geo]
   *     parameters:
   *       - in: query
   *         name: lat
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: lng
   *         schema: { type: number }
   *         required: true
   *       - in: query
   *         name: radius
   *         schema: { type: number }
   *         description: "Radius in meters (default: 1000, max: 5000)"
   *       - in: query
   *         name: types
   *         schema: { type: string }
   *         description: "Comma-separated amenity types: school,hospital,market,bank,restaurant,worship,fuel,police"
   *     responses:
   *       200:
   *         description: Nearby amenities from OpenStreetMap
   */
  public static async findAmenities(req: Request, res: Response) {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radius = Math.min(Number(req.query.radius) || 1000, 5000); // cap at 5km
      const typesStr = req.query.types as string | undefined;

      if (isNaN(lat) || isNaN(lng)) {
        return sendError(res, "Valid lat and lng are required", 400);
      }

      if (!GeoService.isInNigeria(lat, lng)) {
        return sendError(res, "Coordinates must be within Nigeria", 400);
      }

      const types = typesStr ? typesStr.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
      const result = await GeoService.findNearbyAmenities(lat, lng, radius, types);

      return sendSuccess(
        res,
        result,
        `${result.amenities.length} amenities found within ${radius}m${result.cached ? " (cached)" : ""}`
      );
    } catch (error: any) {
      return sendError(res, error.message || "Failed to find amenities");
    }
  }

  /**
   * @swagger
   * /properties/geo/autocomplete:
   *   get:
   *     summary: Address autocomplete - fuzzy search known Nigerian areas
   *     tags: [Geo]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema: { type: string }
   *         required: true
   *         description: "Partial area name to search"
   *       - in: query
   *         name: limit
   *         schema: { type: number }
   *         description: "Max results (default: 10, max: 25)"
   *     responses:
   *       200:
   *         description: Autocomplete suggestions sorted by relevance
   */
  public static async autocomplete(req: Request, res: Response) {
    try {
      const q = req.query.q as string;
      if (!q || q.trim().length === 0) {
        return sendError(res, "Query parameter 'q' is required", 400);
      }

      const limit = Math.min(Number(req.query.limit) || 10, 25);
      const suggestions = GeocodingService.autocomplete(q, limit);

      return sendSuccess(res, suggestions, `${suggestions.length} suggestions`);
    } catch (error: any) {
      return sendError(res, error.message || "Autocomplete failed");
    }
  }

  /**
   * POST /properties/geo/batch-geocode
   * Batch geocode multiple area names.
   */
  public static async batchGeocode(req: Request, res: Response) {
    try {
      const { areas } = req.body;

      if (!Array.isArray(areas) || areas.length === 0) {
        return sendError(res, "An array of area names is required", 400);
      }

      if (areas.length > 100) {
        return sendError(res, "Maximum 100 areas per batch request", 400);
      }

      const results = await GeocodingService.batchGeocode(areas);

      // Convert Map to plain object for JSON serialization
      const data: Record<string, any> = {};
      for (const [key, value] of results) {
        data[key] = value;
      }

      return sendSuccess(res, data, `Batch geocoded ${areas.length} areas`);
    } catch (error: any) {
      return sendError(res, error.message || "Batch geocoding failed");
    }
  }

  /**
   * GET /properties/geo/reverse-geocode?lat=&lng=
   * Reverse geocode coordinates to the nearest known area.
   */
  public static async reverseGeocode(req: Request, res: Response) {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);

      if (isNaN(lat) || isNaN(lng)) {
        return sendError(res, "Valid lat and lng are required", 400);
      }

      const result = await GeocodingService.reverseGeocode(lat, lng);

      if (!result) {
        return sendError(res, "No known area found near these coordinates", 404);
      }

      return sendSuccess(res, { lat, lng, ...result }, "Reverse geocode successful");
    } catch (error: any) {
      return sendError(res, error.message || "Reverse geocoding failed");
    }
  }
}
