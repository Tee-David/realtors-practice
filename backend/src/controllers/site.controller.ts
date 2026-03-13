import { Request, Response } from "express";
import { SiteService } from "../services/site.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";
import prisma from "../prismaClient";

export class SiteController {
  static async list(req: Request, res: Response) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 20));
      const search = req.query.search as string | undefined;
      const enabledParam = req.query.enabled as string | undefined;
      const enabled = enabledParam !== undefined ? enabledParam === "true" : undefined;
      const { data, total } = await SiteService.list({ page, limit, search, enabled });
      return sendPaginated(res, data, total, page, limit);
    } catch (err) {
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
          return sendSuccess(res, restored, "Site restored", 201);
        }
      }
      const site = await SiteService.create(req.body);
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
        return sendSuccess(res, site, `Site ${site.enabled ? "enabled" : "disabled"}`);
      }
      const site = await SiteService.toggleEnabled(req.params.id);
      if (!site) return sendError(res, "Site not found", 404);
      return sendSuccess(res, site, `Site ${site.enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      return sendError(res, "Failed to toggle site");
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await SiteService.softDelete(req.params.id);
      return sendSuccess(res, null, "Site deleted");
    } catch (err) {
      return sendError(res, "Failed to delete site");
    }
  }
}
