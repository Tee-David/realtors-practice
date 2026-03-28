import { Request, Response } from "express";
import { SiteService } from "../services/site.service";
import { SiteIntelligenceService } from "../services/siteIntelligence.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";
import prisma from "../prismaClient";
import { logAudit, getClientInfo } from "../middlewares/auditLog.middleware";
import { Logger } from "../utils/logger.util";

export class SiteController {
  static async list(req: Request, res: Response) {
    try {
      // req.query is already validated and coerced by Zod middleware
      const { page, limit, search, enabled } = req.query as unknown as {
        page: number; limit: number; search?: string; enabled?: boolean;
      };
      const { data, total } = await SiteService.list({ page, limit, search, enabled });
      return sendPaginated(res, data, total, page, limit);
    } catch (err: any) {
      console.error("[SiteController.list]", err?.message);
      return sendError(res, "Failed to fetch sites");
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const site = await SiteService.getById(req.params.id);
      if (!site) return sendError(res, "Site not found", 404);
      return sendSuccess(res, site);
    } catch (err) {
      return sendError(res, "Failed to fetch site");
    }
  }

  static async create(req: Request, res: Response) {
    try {
      // Check if a soft-deleted site with same key exists — restore it
      if (req.body.key) {
        const existing = await prisma.site.findFirst({
          where: { key: req.body.key, deletedAt: { not: null } },
        });
        if (existing) {
          const restored = await prisma.site.update({
            where: { id: existing.id },
            data: {
              ...req.body,
              deletedAt: null,
              enabled: req.body.enabled ?? true,
            },
          });
          void logAudit({
            userId: (req as any).user?.id,
            action: "CREATE_SITE",
            entity: "Site",
            entityId: restored.id,
            details: { restored: true },
            ...getClientInfo(req),
          });
          return sendSuccess(res, restored, "Site restored", 201);
        }
      }
      const site = await SiteService.create(req.body);
      void logAudit({
        userId: (req as any).user?.id,
        action: "CREATE_SITE",
        entity: "Site",
        entityId: site.id,
        details: { name: site.name },
        ...getClientInfo(req),
      });

      // Auto-learn on creation if setting is enabled (fire-and-forget)
      void (async () => {
        try {
          const siSettings = await SiteIntelligenceService.getSettings();
          if (siSettings.si_auto_learn_on_create) {
            Logger.info(`Auto-learn on creation triggered for site ${site.name} (${site.id})`);
            await SiteIntelligenceService.learnSite(site.id, (req as any).user?.id);
          }
        } catch (err: any) {
          Logger.warn(`Auto-learn on creation failed for site ${site.id}: ${err.message}`);
        }
      })();

      return sendSuccess(res, site, "Site created", 201);
    } catch (err: any) {
      if (err?.code === "P2002") {
        return sendError(res, "A site with this domain already exists. Check if it was previously deleted.", 409);
      }
      const message = err?.message || "Failed to create site";
      return sendError(res, message);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const site = await SiteService.update(req.params.id, req.body);
      void logAudit({
        userId: (req as any).user?.id,
        action: "UPDATE_SITE",
        entity: "Site",
        entityId: req.params.id,
        details: { updatedFields: Object.keys(req.body) },
        ...getClientInfo(req),
      });
      return sendSuccess(res, site, "Site updated");
    } catch (err) {
      return sendError(res, "Failed to update site");
    }
  }

  static async toggleEnabled(req: Request, res: Response) {
    try {
      // If body contains explicit `enabled` value, set it directly instead of toggling
      if (req.body && typeof req.body.enabled === "boolean") {
        const site = await SiteService.setEnabled(req.params.id, req.body.enabled);
        if (!site) return sendError(res, "Site not found", 404);
        void logAudit({
          userId: (req as any).user?.id,
          action: "TOGGLE_SITE",
          entity: "Site",
          entityId: req.params.id,
          details: { enabled: site.enabled },
          ...getClientInfo(req),
        });
        return sendSuccess(res, site, `Site ${site.enabled ? "enabled" : "disabled"}`);
      }
      const site = await SiteService.toggleEnabled(req.params.id);
      if (!site) return sendError(res, "Site not found", 404);
      void logAudit({
        userId: (req as any).user?.id,
        action: "TOGGLE_SITE",
        entity: "Site",
        entityId: req.params.id,
        details: { enabled: site.enabled },
        ...getClientInfo(req),
      });
      return sendSuccess(res, site, `Site ${site.enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      return sendError(res, "Failed to toggle site");
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await SiteService.softDelete(req.params.id);
      void logAudit({
        userId: (req as any).user?.id,
        action: "DELETE_SITE",
        entity: "Site",
        entityId: req.params.id,
        ...getClientInfo(req),
      });
      return sendSuccess(res, null, "Site deleted");
    } catch (err) {
      return sendError(res, "Failed to delete site");
    }
  }
}
