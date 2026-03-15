import { Router } from "express";
import { MarketController } from "../controllers/market.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Market
 *   description: Market intelligence, analytics, and taxonomy
 */

// All market routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /market/price-per-sqm:
 *   get:
 *     summary: Get average price per square meter by area
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: area
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Price per sqm statistics
 */
router.get("/price-per-sqm", MarketController.getPricePerSqm);

/**
 * @swagger
 * /market/rental-yield:
 *   get:
 *     summary: Calculate rental yield estimates for an area
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rental yield data
 */
router.get("/rental-yield", MarketController.getRentalYield);

/**
 * @swagger
 * /market/rental-yield/calculate:
 *   get:
 *     summary: Calculate rental yield for a specific sale price and rent
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: salePrice
 *         required: true
 *         schema: { type: number }
 *       - in: query
 *         name: monthlyRent
 *         schema: { type: number }
 *       - in: query
 *         name: area
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Calculated rental yield
 */
router.get("/rental-yield/calculate", MarketController.calculateRentalYield);

/**
 * @swagger
 * /market/days-on-market:
 *   get:
 *     summary: Get average days on market by area
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Days on market statistics
 */
router.get("/days-on-market", MarketController.getDaysOnMarket);

/**
 * @swagger
 * /market/comparables/{propertyId}:
 *   get:
 *     summary: Find comparable properties for valuation
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of comparable properties
 */
router.get("/comparables/:propertyId", MarketController.getComparableProperties);

/**
 * @swagger
 * /market/report:
 *   get:
 *     summary: Generate a full market report for an area
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: area
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Comprehensive market report
 */
router.get("/report", MarketController.getMarketReport);

/**
 * @swagger
 * /market/trends:
 *   get:
 *     summary: Get market trends data for frontend charts
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: area
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Market trends with price-per-sqm, rental yields, DOM, and volume
 */
router.get("/trends", MarketController.getMarketTrends);

/**
 * @swagger
 * /market/most-viewed:
 *   get:
 *     summary: Get most viewed properties
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Most viewed properties list
 */
router.get("/most-viewed", MarketController.getMostViewed);

/**
 * @swagger
 * /market/zero-result-searches:
 *   get:
 *     summary: Get searches that returned zero results
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Zero-result search queries
 */
router.get("/zero-result-searches", MarketController.getZeroResultSearches);

/**
 * @swagger
 * /market/log-search:
 *   post:
 *     summary: Log a search query for analytics
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query, resultCount]
 *             properties:
 *               query: { type: string }
 *               resultCount: { type: integer }
 *               filters: { type: object }
 *     responses:
 *       200:
 *         description: Search query logged
 */
router.post("/log-search", MarketController.logSearchQuery);

/**
 * @swagger
 * /market/taxonomy/normalize:
 *   get:
 *     summary: Normalize a property taxonomy term
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: term
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Normalized term
 */
router.get("/taxonomy/normalize", MarketController.normalizeTerm);

/**
 * @swagger
 * /market/taxonomy/synonyms:
 *   get:
 *     summary: Get synonyms for a property term
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: term
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of synonyms
 */
router.get("/taxonomy/synonyms", MarketController.getSynonyms);

/**
 * @swagger
 * /market/taxonomy/map:
 *   get:
 *     summary: Get the full synonym map
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complete synonym mapping
 */
router.get("/taxonomy/map", MarketController.getSynonymMap);

/**
 * @swagger
 * /market/taxonomy/bathrooms:
 *   get:
 *     summary: Normalize Nigerian bathroom count text (e.g. "2.5 baths" -> 3)
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: text
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Normalized bathroom count
 */
router.get("/taxonomy/bathrooms", MarketController.normalizeBathrooms);

export default router;
