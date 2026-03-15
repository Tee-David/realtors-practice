import { Router } from "express";
import { SearchController } from "../controllers/search.controller";
import rateLimit from "express-rate-limit";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Full-text property search powered by Meilisearch
 */

// Rate limiting for public search (to prevent scraping our API)
const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 200, // Limit each IP to 200 requests per 5 minutes
  message: "Too many search requests, please try again later.",
});

router.use(searchLimiter);

/**
 * @swagger
 * /search:
 *   get:
 *     summary: Full-text property search
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search query string
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Search results with facets and pagination
 */
router.get("/", SearchController.search);

/**
 * @swagger
 * /search/suggestions:
 *   get:
 *     summary: Get autocomplete suggestions for a search query
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of search suggestions
 */
router.get("/suggestions", SearchController.getSuggestions);

export default router;
