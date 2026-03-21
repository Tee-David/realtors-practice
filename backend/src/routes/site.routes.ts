import { Router, Request, Response } from "express";
import { SiteController } from "../controllers/site.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { SiteIntelligenceService } from "../services/siteIntelligence.service";
import { Logger } from "../utils/logger.util";

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

// ─── Site Intelligence ─────────────────────────────────

/**
 * POST /sites/:id/learn
 * Trigger a learn job for a single site (explores structure, builds profile).
 */
router.post("/:id/learn", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const job = await SiteIntelligenceService.learnSite(req.params.id, userId);
    return res.json({ success: true, jobId: job.id });
  } catch (err: any) {
    Logger.error(`Learn site error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /sites/learn-bulk
 * Trigger learn jobs for multiple sites.
 */
router.post("/learn-bulk", async (req: Request, res: Response) => {
  try {
    const { siteIds } = req.body;
    if (!Array.isArray(siteIds) || siteIds.length === 0) {
      return res.status(400).json({ error: "siteIds array required" });
    }
    const userId = (req as any).user?.id;
    const results = await SiteIntelligenceService.bulkLearnSites(siteIds, userId);
    return res.json({ success: true, results });
  } catch (err: any) {
    Logger.error(`Bulk learn error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /sites/:id/profile
 * Get the site intelligence profile.
 */
router.get("/:id/profile", async (req: Request, res: Response) => {
  try {
    const site = await import("../prismaClient").then(m => m.default.site.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, baseUrl: true, learnStatus: true, learnedAt: true,
        siteProfile: true, selectors: true, detailSelectors: true, listPaths: true,
        avgListings: true, healthScore: true, lastScrapeAt: true,
      },
    }));
    if (!site) return res.status(404).json({ error: "Site not found" });
    return res.json({ success: true, data: site });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /scrape/estimate — also mounted here for convenience
 * Get scrape time estimate for selected site IDs.
 */
router.post("/estimate", async (req: Request, res: Response) => {
  try {
    const { siteIds } = req.body;
    if (!Array.isArray(siteIds) || siteIds.length === 0) {
      return res.status(400).json({ error: "siteIds array required" });
    }
    const estimate = await SiteIntelligenceService.estimateScrape(siteIds);
    return res.json({ success: true, data: estimate });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
