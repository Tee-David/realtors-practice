import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);

// Placeholder routes - will be added in later phases
// router.use("/properties", propertyRoutes);
// router.use("/search", searchRoutes);
// router.use("/scrape", scrapeRoutes);
// router.use("/sites", siteRoutes);
// router.use("/analytics", analyticsRoutes);
// router.use("/saved-searches", savedSearchRoutes);
// router.use("/notifications", notificationRoutes);
// router.use("/users", userRoutes);
// router.use("/settings", settingsRoutes);
// router.use("/export", exportRoutes);
// router.use("/audit-logs", auditLogRoutes);
// router.use("/internal", internalRoutes);

export default router;
