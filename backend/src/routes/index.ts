import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import propertyRoutes from "./property.routes";
import siteRoutes from "./site.routes";
import scrapeRoutes from "./scrape.routes";
import internalRoutes from "./internal.routes";
import searchRoutes from "./search.routes";
import analyticsRoutes from "./analytics.routes";
import userRoutes from "./user.routes";
import savedSearchRoutes from "./savedSearch.routes";
import notificationRoutes from "./notification.routes";
import exportRoutes from "./export.routes";
import auditLogRoutes from "./auditLog.routes";
import geoRoutes from "./geo.routes";
import backupRoutes from "./backup.routes";
import systemSettingsRoutes from "./systemSettings.routes";
import marketRoutes from "./market.routes";
import aiRoutes from "./ai.routes";
import aiChatRoutes from "./ai-chat.routes";
import aiFeaturesRoutes from "./aiFeatures.routes";
import emailTemplateRoutes from "./emailTemplate.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
// NOTE: /properties/geo MUST be registered before /properties to avoid
// the /:id wildcard in property.routes.ts shadowing geo sub-routes.
router.use("/properties/geo", geoRoutes);
router.use("/properties", propertyRoutes);
router.use("/sites", siteRoutes);
router.use("/scrape", scrapeRoutes);
router.use("/internal", internalRoutes);
router.use("/search", searchRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/users", userRoutes);
router.use("/saved-searches", savedSearchRoutes);
router.use("/notifications", notificationRoutes);
router.use("/export", exportRoutes);
router.use("/audit-logs", auditLogRoutes);
router.use("/backups", backupRoutes);
router.use("/settings/ai-features", aiFeaturesRoutes);
router.use("/settings", systemSettingsRoutes);
router.use("/market", marketRoutes);
router.use("/ai", aiRoutes);
router.use("/ai", aiChatRoutes);
router.use("/email-templates", emailTemplateRoutes);

export default router;
