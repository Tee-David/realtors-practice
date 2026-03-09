import { Router } from "express";
import { AnalyticsController } from "../controllers/analytics.controller";

const router = Router();

router.get("/kpis", AnalyticsController.getOverviewKPIs);
router.get("/charts", AnalyticsController.getCharts);
router.get("/site-quality", AnalyticsController.getSiteQuality);

export default router;
