import { Request, Response } from "express";
import { PropertyService } from "../services/property.service";
import { VersionService } from "../services/version.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";

export class PropertyController {
  static async list(req: Request, res: Response) {
    try {
      const { data, total, page, limit } = await PropertyService.list(req.query as any);
      return sendPaginated(res, data, total, page, limit);
    } catch (err) {
      return sendError(res, "Failed to fetch properties");
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const property = await PropertyService.getById(req.params.id);
      if (!property) return sendError(res, "Property not found", 404);
      return sendSuccess(res, property);
    } catch (err) {
      return sendError(res, "Failed to fetch property");
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const result = await PropertyService.create(req.body, "MANUAL_EDIT", req.user?.id);
      if (result.duplicate) {
        return sendError(res, "Duplicate property", 409, `Existing property: ${result.existingId}`);
      }
      return sendSuccess(res, result.property, "Property created", 201);
    } catch (err) {
      return sendError(res, "Failed to create property");
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const property = await PropertyService.update(req.params.id, req.body, "MANUAL_EDIT", req.user?.id);
      if (!property) return sendError(res, "Property not found", 404);
      return sendSuccess(res, property, "Property updated");
    } catch (err) {
      return sendError(res, "Failed to update property");
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const property = await PropertyService.softDelete(req.params.id);
      if (!property) return sendError(res, "Property not found", 404);
      return sendSuccess(res, null, "Property deleted");
    } catch (err) {
      return sendError(res, "Failed to delete property");
    }
  }

  static async getVersions(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const { versions, total } = await VersionService.getVersions(req.params.id, page, limit);
      return sendPaginated(res, versions, total, page, limit);
    } catch (err) {
      return sendError(res, "Failed to fetch versions");
    }
  }

  static async getPriceHistory(req: Request, res: Response) {
    try {
      const history = await VersionService.getPriceHistory(req.params.id);
      return sendSuccess(res, history);
    } catch (err) {
      return sendError(res, "Failed to fetch price history");
    }
  }

  static async enrich(req: Request, res: Response) {
    try {
      const property = await PropertyService.enrich(req.params.id, req.body);
      if (!property) return sendError(res, "Property not found", 404);
      return sendSuccess(res, property, "Property enriched");
    } catch (err) {
      return sendError(res, "Failed to enrich property");
    }
  }

  static async bulkAction(req: Request, res: Response) {
    try {
      const { ids, action } = req.body;
      const result = await PropertyService.bulkAction(ids, action, req.user?.id);
      return sendSuccess(res, { affected: result.count }, `Bulk ${action} completed`);
    } catch (err) {
      return sendError(res, "Failed to perform bulk action");
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const stats = await PropertyService.getStats();
      return sendSuccess(res, stats);
    } catch (err) {
      return sendError(res, "Failed to fetch stats");
    }
  }
}
