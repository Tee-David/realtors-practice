import { Request, Response } from "express";
import { SiteService } from "../services/site.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";

export class SiteController {
  static async list(req: Request, res: Response) {
    try {
      const { data, total, page, limit } = await SiteService.list(req.query as any);
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
      const site = await SiteService.create(req.body);
      return sendSuccess(res, site, "Site created", 201);
    } catch (err: any) {
      if (err?.code === "P2002") {
        return sendError(res, "Site key already exists", 409);
      }
      return sendError(res, "Failed to create site");
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
