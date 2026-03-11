import { Request, Response } from "express";
import { GeoService } from "../services/geo.service";
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
}
