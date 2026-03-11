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

router.get("/bbox", GeoController.findInBoundingBox);
router.get("/radius", GeoController.findInRadius);
router.get("/geocode", GeoController.geocodeArea);
router.get("/areas", GeoController.listAreas);
router.get("/nearby", GeoController.findNearby);

export default router;
