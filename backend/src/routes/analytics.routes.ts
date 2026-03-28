import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Dashboard analytics and KPIs
 */

/**
 * @swagger
 * /analytics/kpis:
 *   get:
 *     summary: Get overview KPIs for the dashboard
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Key performance indicators
 */
router.get("/kpis", AnalyticsController.getOverviewKPIs);

/**
 * @swagger
 * /analytics/charts:
 *   get:
 *     summary: Get chart data for the analytics dashboard
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Chart datasets
 */
router.get("/charts", AnalyticsController.getCharts);

/**
 * @swagger
 * /analytics/site-quality:
 *   get:
 *     summary: Get quality metrics per scrape site
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Site quality scores
 */
router.get("/site-quality", AnalyticsController.getSiteQuality);

/**
 * @swagger
 * /analytics/price-trends:
 *   get:
 *     summary: Get price trend data over time
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Price trend series
 */
router.get("/price-trends", authenticate, AnalyticsController.getPriceTrends);

/**
 * @swagger
 * /analytics/quality-distribution:
 *   get:
 *     summary: Get property quality score distribution
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quality score histogram
 */
router.get("/quality-distribution", authenticate, AnalyticsController.getQualityDistribution);

/**
 * @swagger
 * /analytics/listing-velocity:
 *   get:
 *     summary: Get listing creation velocity over time
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listing velocity data
 */
router.get("/listing-velocity", authenticate, AnalyticsController.getListingVelocity);

router.get("/activity-heatmap", authenticate, AnalyticsController.getActivityHeatmap);

router.get("/kpi-trends", AnalyticsController.getKPITrends);

router.get("/weekly-sparkline", AnalyticsController.getWeeklySparkline);

router.get("/category-distribution", authenticate, AnalyticsController.getCategoryDistribution);

router.get("/listing-type-distribution", authenticate, AnalyticsController.getListingTypeDistribution);

router.get("/verification-trends", authenticate, AnalyticsController.getVerificationTrends);

router.get("/scraper-health", authenticate, AnalyticsController.getScraperHealth);

router.get("/price-per-sqm", authenticate, AnalyticsController.getPricePerSqm);

export default router;
