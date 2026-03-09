import { Router } from "express";
import { PropertyController } from "../controllers/property.controller";
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

// Get property price history (all roles)
router.get("/:id/price-history", PropertyController.getPriceHistory);

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

// Enrich property (admin, editor)
router.patch("/:id/enrich", authorize("ADMIN", "EDITOR"), PropertyController.enrich);

// Bulk action (admin only)
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
