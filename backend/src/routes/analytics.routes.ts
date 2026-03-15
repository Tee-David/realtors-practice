import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/kpis", AnalyticsController.getOverviewKPIs);
router.get("/charts", AnalyticsController.getCharts);
router.get("/site-quality", AnalyticsController.getSiteQuality);

// Extended analytics (Phase 8) — require authentication
router.get("/price-trends", authenticate, AnalyticsController.getPriceTrends);
router.get("/quality-distribution", authenticate, AnalyticsController.getQualityDistribution);
router.get("/listing-velocity", authenticate, AnalyticsController.getListingVelocity);

export default router;
