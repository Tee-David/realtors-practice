import { Router } from "express";
import { PropertyController } from "../controllers/property.controller";
import { GeoController } from "../controllers/geo.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  listPropertiesSchema,
  createPropertySchema,
  updatePropertySchema,
  bulkActionSchema,
} from "../validators/property.validators";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Real estate property management
 */

// All property routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /properties:
 *   get:
 *     summary: List properties with pagination and filtering
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A paginated list of properties
 *       400:
 *         description: Validation error
 */
router.get("/", validate(listPropertiesSchema, "query"), PropertyController.list);

/**
 * @swagger
 * /properties/stats:
 *   get:
 *     summary: Get property portfolio aggregate statistics
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Property statistics and categorizations
 */
router.get("/stats", PropertyController.getStats);

/**
 * @swagger
 * /properties/stats/most-viewed:
 *   get:
 *     summary: Get the most viewed properties
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Most viewed properties
 */
router.get("/stats/most-viewed", PropertyController.getMostViewed);

/**
 * @swagger
 * /properties/llm-enrich-count/{siteId}:
 *   get:
 *     summary: Get count of properties for a site (for confirmation dialog)
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: siteId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Count of properties in the site
 */
router.get("/llm-enrich-count/:siteId", authorize("ADMIN", "EDITOR"), PropertyController.llmEnrichCount);

/**
 * @swagger
 * /properties/{id}:
 *   get:
 *     summary: Get a single property by ID
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property details
 *       404:
 *         description: Property not found
 */
router.get("/:id", PropertyController.getById);

/**
 * @swagger
 * /properties/{id}/versions:
 *   get:
 *     summary: Retrieve the version history of a property
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of historical versions
 */
router.get("/:id/versions", PropertyController.getVersions);

/**
 * @swagger
 * /properties/{id}/price-history:
 *   get:
 *     summary: Get price history for a property
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Price history entries
 */
router.get("/:id/price-history", PropertyController.getPriceHistory);

/**
 * @swagger
 * /properties/{id}/nearby:
 *   get:
 *     summary: Find nearby properties
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Nearby properties
 */
router.get("/:id/nearby", GeoController.findNearbyByProperty);

/**
 * @swagger
 * /properties/{id}/view:
 *   post:
 *     summary: Increment the view count for a property
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: View count incremented
 */
router.post("/:id/view", PropertyController.incrementViewCount);

/**
 * @swagger
 * /properties:
 *   post:
 *     summary: Create a new property
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - price
 *               - listingType
 *               - status
 *     responses:
 *       201:
 *         description: Property created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden (Admin or Editor role required)
 */
router.post("/", authorize("ADMIN", "EDITOR"), validate(createPropertySchema), PropertyController.create);

/**
 * @swagger
 * /properties/{id}:
 *   put:
 *     summary: Fully update a property
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 */
router.put("/:id", authorize("ADMIN", "EDITOR"), validate(updatePropertySchema), PropertyController.update);

/**
 * @swagger
 * /properties/{id}/enrich:
 *   patch:
 *     summary: Enrich a property with additional data
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Property enriched
 *       403:
 *         description: Admin or Editor role required
 */
router.patch("/:id/enrich", authorize("ADMIN", "EDITOR"), PropertyController.enrich);

/**
 * @swagger
 * /properties/{id}/llm-enrich:
 *   post:
 *     summary: Enrich a single property using LLM extraction from its description
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Enrichment result with extracted fields
 */
router.post("/:id/llm-enrich", authorize("ADMIN", "EDITOR"), PropertyController.llmEnrich);

/**
 * @swagger
 * /properties/llm-enrich-by-site:
 *   post:
 *     summary: Enrich all properties from a specific site using LLM
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [siteId]
 *             properties:
 *               siteId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Batch enrichment summary
 */
router.post("/llm-enrich-by-site", authorize("ADMIN", "EDITOR"), PropertyController.llmEnrichBySite);

/**
 * @swagger
 * /properties/bulk-action:
 *   post:
 *     summary: Perform a bulk action on multiple properties
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids, action]
 *             properties:
 *               ids:
 *                 type: array
 *                 items: { type: string }
 *               action:
 *                 type: string
 *                 enum: [verify, reject, flag, delete, restore]
 *     responses:
 *       200:
 *         description: Bulk action completed
 *       403:
 *         description: Admin role required
 */
router.post("/bulk-action", authorize("ADMIN"), validate(bulkActionSchema), PropertyController.bulkAction);

/**
 * @swagger
 * /properties/{id}:
 *   delete:
 *     summary: Delete a property
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property deleted successfully
 *       403:
 *         description: Forbidden (Admin role required)
 */
router.delete("/:id", authorize("ADMIN"), PropertyController.delete);

export default router;
