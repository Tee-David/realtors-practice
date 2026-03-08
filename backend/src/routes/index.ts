import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import propertyRoutes from "./property.routes";
import siteRoutes from "./site.routes";
import scrapeRoutes from "./scrape.routes";
import internalRoutes from "./internal.routes";
import searchRoutes from "./search.routes";
import analyticsRoutes from "./analytics.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/properties", propertyRoutes);
router.use("/sites", siteRoutes);
router.use("/scrape", scrapeRoutes);
router.use("/internal", internalRoutes);
router.use("/search", searchRoutes);
router.use("/analytics", analyticsRoutes);

// Placeholder routes - will be added in later phases
// router.use("/saved-searches", savedSearchRoutes);
// router.use("/notifications", notificationRoutes);
// router.use("/users", userRoutes);
// router.use("/settings", settingsRoutes);
// router.use("/export", exportRoutes);
// router.use("/audit-logs", auditLogRoutes);

export default router;

