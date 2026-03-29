import { Request, Response } from "express";
import { PropertyService } from "../services/property.service";
import { VersionService } from "../services/version.service";
import { LLMEnrichmentService } from "../services/llmEnrichment.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";
import { logAudit, getClientInfo } from "../middlewares/auditLog.middleware";

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
      void logAudit({
        userId: (req as any).user?.id,
        action: "CREATE_PROPERTY",
        entity: "Property",
        entityId: result.property?.id,
        details: { source: "MANUAL_EDIT" },
        ...getClientInfo(req),
      });
      return sendSuccess(res, result.property, "Property created", 201);
    } catch (err) {
      return sendError(res, "Failed to create property");
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const property = await PropertyService.update(req.params.id, req.body, "MANUAL_EDIT", req.user?.id);
      if (!property) return sendError(res, "Property not found", 404);
      void logAudit({
        userId: (req as any).user?.id,
        action: "UPDATE_PROPERTY",
        entity: "Property",
        entityId: req.params.id,
        details: { updatedFields: Object.keys(req.body) },
        ...getClientInfo(req),
      });
      return sendSuccess(res, property, "Property updated");
    } catch (err) {
      return sendError(res, "Failed to update property");
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const property = await PropertyService.softDelete(req.params.id);
      if (!property) return sendError(res, "Property not found", 404);
      void logAudit({
        userId: (req as any).user?.id,
        action: "DELETE_PROPERTY",
        entity: "Property",
        entityId: req.params.id,
        ...getClientInfo(req),
      });
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

  /**
   * POST /properties/:id/llm-enrich - Enrich a single property using LLM extraction
   */
  static async llmEnrich(req: Request, res: Response) {
    try {
      const result = await LLMEnrichmentService.enrichProperty(req.params.id);
      if (!result.success && result.error === "Property not found") {
        return sendError(res, "Property not found", 404);
      }
      void logAudit({
        userId: (req as any).user?.id,
        action: "LLM_ENRICH_PROPERTY",
        entity: "Property",
        entityId: req.params.id,
        details: { enrichedFields: result.enrichedFields, provider: result.provider },
        ...getClientInfo(req),
      });
      return sendSuccess(res, result, result.success ? "Property enriched via LLM" : "No new data extracted");
    } catch (err) {
      return sendError(res, "Failed to LLM-enrich property");
    }
  }

  /**
   * POST /properties/llm-enrich-by-site - Enrich all properties from a site using LLM
   */
  static async llmEnrichBySite(req: Request, res: Response) {
    try {
      const { siteId } = req.body;
      if (!siteId) return sendError(res, "siteId is required", 400);
      const result = await LLMEnrichmentService.enrichBySite(siteId);
      void logAudit({
        userId: (req as any).user?.id,
        action: "LLM_ENRICH_BY_SITE",
        entity: "Site",
        entityId: siteId,
        details: { total: result.total, enriched: result.enriched, failed: result.failed },
        ...getClientInfo(req),
      });
      return sendSuccess(res, result, `Enriched ${result.enriched}/${result.total} properties`);
    } catch (err) {
      return sendError(res, "Failed to enrich properties by site");
    }
  }

  /**
   * GET /properties/llm-enrich-count/:siteId - Get count of properties for a site (for confirmation)
   */
  static async llmEnrichCount(req: Request, res: Response) {
    try {
      const count = await LLMEnrichmentService.getCountBySite(req.params.siteId);
      return sendSuccess(res, { count }, `${count} properties in this site`);
    } catch (err) {
      return sendError(res, "Failed to get count");
    }
  }

  static async bulkAction(req: Request, res: Response) {
    try {
      const { ids, action } = req.body;
      const result = await PropertyService.bulkAction(ids, action, req.user?.id);
      void logAudit({
        userId: (req as any).user?.id,
        action: "BULK_ACTION",
        entity: "Property",
        details: { bulkAction: action, ids, affected: result.count },
        ...getClientInfo(req),
      });
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

  /**
   * POST /properties/:id/view - Increment property view count
   */
  static async incrementViewCount(req: Request, res: Response) {
    try {
      const result = await PropertyService.incrementViewCount(req.params.id);
      if (!result) return sendError(res, "Property not found", 404);
      return sendSuccess(res, result, "View count incremented");
    } catch (err) {
      return sendError(res, "Failed to increment view count");
    }
  }

  /**
   * GET /properties/stats/most-viewed?limit=20 - Get most viewed properties
   */
  static async getMostViewed(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const properties = await PropertyService.getMostViewed(limit);
      return sendSuccess(res, properties, `${properties.length} most viewed properties`);
    } catch (err) {
      return sendError(res, "Failed to fetch most viewed properties");
    }
  }
}
