import { Router } from "express";
import { GeoController } from "../controllers/geo.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Geo
 *   description: Geospatial property search endpoints
 */

// All geo routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /properties/geo/bbox:
 *   get:
 *     summary: Find properties within a bounding box
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: north
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: south
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: east
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: west
 *         required: true
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Properties within the bounding box
 */
router.get("/bbox", GeoController.findInBoundingBox);

/**
 * @swagger
 * /properties/geo/radius:
 *   get:
 *     summary: Find properties within a radius of a point
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: radiusKm
 *         schema: { type: number, default: 5 }
 *     responses:
 *       200:
 *         description: Properties within radius
 */
router.get("/radius", GeoController.findInRadius);

/**
 * @swagger
 * /properties/geo/geocode:
 *   get:
 *     summary: Geocode an area name to coordinates
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: area
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Geocoded coordinates for the area
 */
router.get("/geocode", GeoController.geocodeArea);

/**
 * @swagger
 * /properties/geo/reverse-geocode:
 *   get:
 *     summary: Reverse geocode coordinates to an address
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Address information for the coordinates
 */
router.get("/reverse-geocode", GeoController.reverseGeocode);

/**
 * @swagger
 * /properties/geo/batch-geocode:
 *   post:
 *     summary: Batch geocode multiple properties
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               propertyIds:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Batch geocoding results
 */
router.post("/batch-geocode", GeoController.batchGeocode);

/**
 * @swagger
 * /properties/geo/areas:
 *   get:
 *     summary: List all known areas with property counts
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of areas
 */
router.get("/areas", GeoController.listAreas);

/**
 * @swagger
 * /properties/geo/nearby:
 *   get:
 *     summary: Find nearby properties by coordinates
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Nearby properties
 */
router.get("/nearby", GeoController.findNearby);

/**
 * @swagger
 * /properties/geo/properties:
 *   get:
 *     summary: Find properties within a bbox (OGC format query string)
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bbox
 *         required: true
 *         schema: { type: string }
 *         description: "minLng,minLat,maxLng,maxLat"
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
router.get("/properties", GeoController.findByBbox);

/**
 * @swagger
 * /properties/geo/amenities:
 *   get:
 *     summary: Find nearby amenities (schools, hospitals, markets) via OpenStreetMap
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: radius
 *         schema: { type: number, default: 1000 }
 *         description: "Radius in meters (max 5000)"
 *       - in: query
 *         name: types
 *         schema: { type: string }
 *         description: "Comma-separated: school,hospital,market,bank,restaurant,worship,fuel,police"
 *     responses:
 *       200:
 *         description: Nearby amenities from OpenStreetMap Overpass API
 */
router.get("/amenities", GeoController.findAmenities);

/**
 * @swagger
 * /properties/geo/autocomplete:
 *   get:
 *     summary: Address autocomplete - fuzzy search known Nigerian areas
 *     tags: [Geo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: "Partial area name"
 *       - in: query
 *         name: limit
 *         schema: { type: number, default: 10 }
 *         description: "Max results (max 25)"
 *     responses:
 *       200:
 *         description: Autocomplete suggestions sorted by relevance
 */
router.get("/autocomplete", GeoController.autocomplete);

export default router;
