import { Router } from "express";
import { SiteController } from "../controllers/site.controller";
import { authenticate } from "../middlewares/auth.middleware";

import { validate } from "../middlewares/validation.middleware";
import { createSiteSchema, updateSiteSchema, listSitesSchema } from "../validators/site.validators";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Sites
 *   description: Scrape source site management
 */

router.use(authenticate);

/**
 * @swagger
 * /sites:
 *   get:
 *     summary: List all configured scrape sites
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: enabled
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of sites
 */
router.get("/", validate(listSitesSchema, "query"), SiteController.list);

/**
 * @swagger
 * /sites/{id}:
 *   get:
 *     summary: Get a site by ID
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Site details
 *       404:
 *         description: Site not found
 */
router.get("/:id", SiteController.getById);

/**
 * @swagger
 * /sites:
 *   post:
 *     summary: Create a new scrape site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, name, baseUrl]
 *             properties:
 *               key: { type: string }
 *               name: { type: string }
 *               baseUrl: { type: string }
 *               enabled: { type: boolean }
 *     responses:
 *       201:
 *         description: Site created
 */
router.post("/", validate(createSiteSchema), SiteController.create);

/**
 * @swagger
 * /sites/{id}:
 *   put:
 *     summary: Update a site configuration
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Site updated
 */
router.put("/:id", validate(updateSiteSchema), SiteController.update);

/**
 * @swagger
 * /sites/{id}/toggle:
 *   patch:
 *     summary: Toggle a site's enabled/disabled status
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Site toggled
 */
router.patch("/:id/toggle", SiteController.toggleEnabled);

/**
 * @swagger
 * /sites/{id}:
 *   delete:
 *     summary: Soft-delete a site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Site deleted
 */
router.delete("/:id", SiteController.delete);

export default router;
