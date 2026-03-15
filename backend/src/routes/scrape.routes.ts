import { Router } from "express";
import { ScrapeController } from "../controllers/scrape.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Scrape
 *   description: Web scraping job management
 */

// All scrape routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /scrape/start:
 *   post:
 *     summary: Start a new scrape job
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [siteIds]
 *             properties:
 *               siteIds:
 *                 type: array
 *                 items: { type: string }
 *               type:
 *                 type: string
 *                 enum: [PASSIVE_BULK, ACTIVE_INTENT, RESCRAPE, SCHEDULED]
 *               maxListingsPerSite:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Scrape job created and dispatched
 *       403:
 *         description: Admin or Editor role required
 */
router.post("/start", authorize("ADMIN", "EDITOR"), ScrapeController.startJob);

/**
 * @swagger
 * /scrape/jobs:
 *   get:
 *     summary: List all scrape jobs
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of scrape jobs
 */
router.get("/jobs", ScrapeController.listJobs);

/**
 * @swagger
 * /scrape/jobs/{id}:
 *   get:
 *     summary: Get a specific scrape job with logs
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Scrape job details with logs
 *       404:
 *         description: Job not found
 */
router.get("/jobs/:id", ScrapeController.getJob);

/**
 * @swagger
 * /scrape/logs:
 *   get:
 *     summary: List scrape logs with filtering, pagination, and search
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: jobId
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated list of scrape logs
 */
router.get("/logs", ScrapeController.listLogs);

/**
 * @swagger
 * /scrape/logs/{id}:
 *   get:
 *     summary: Get a single scrape log by ID
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Scrape log details
 */
router.get("/logs/:id", ScrapeController.getLog);

/**
 * @swagger
 * /scrape/jobs/{id}/stop:
 *   post:
 *     summary: Stop a running scrape job
 *     tags: [Scrape]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Job stopped
 *       403:
 *         description: Admin or Editor role required
 */
router.post("/jobs/:id/stop", authorize("ADMIN", "EDITOR"), ScrapeController.stopJob);

export default router;
