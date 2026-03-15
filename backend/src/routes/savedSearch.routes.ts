import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { SavedSearchController } from "../controllers/savedSearch.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: SavedSearches
 *   description: User saved search alerts
 */

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /saved-searches:
 *   get:
 *     summary: Get all saved searches for the current user
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved searches
 */
router.get("/", SavedSearchController.getAll);

/**
 * @swagger
 * /saved-searches:
 *   post:
 *     summary: Create a new saved search
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, filters]
 *             properties:
 *               name: { type: string }
 *               filters: { type: object }
 *               notifyEmail: { type: boolean }
 *               notifyInApp: { type: boolean }
 *     responses:
 *       201:
 *         description: Saved search created
 */
router.post("/", SavedSearchController.create);

/**
 * @swagger
 * /saved-searches/{id}:
 *   get:
 *     summary: Get a saved search by ID
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Saved search details
 */
router.get("/:id", SavedSearchController.getById);

/**
 * @swagger
 * /saved-searches/{id}:
 *   put:
 *     summary: Update a saved search
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Saved search updated
 */
router.put("/:id", SavedSearchController.update);

/**
 * @swagger
 * /saved-searches/{id}:
 *   delete:
 *     summary: Delete a saved search
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Saved search deleted
 */
router.delete("/:id", SavedSearchController.delete);

/**
 * @swagger
 * /saved-searches/{id}/matches:
 *   get:
 *     summary: Get matched properties for a saved search
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matched properties
 */
router.get("/:id/matches", SavedSearchController.getMatches);

/**
 * @swagger
 * /saved-searches/{id}/matches/seen:
 *   patch:
 *     summary: Mark all matches as seen
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matches marked as seen
 */
router.patch("/:id/matches/seen", SavedSearchController.markMatchesSeen);

export default router;
