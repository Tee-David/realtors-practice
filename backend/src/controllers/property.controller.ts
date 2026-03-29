import { Request, Response } from "express";
import { PropertyService } from "../services/property.service";
import { VersionService } from "../services/version.service";
import { LLMEnrichmentService } from "../services/llmEnrichment.service";
import { DedupService } from "../services/dedup.service";
import { GeocodingService } from "../services/geocoding.service";
import { MeiliService } from "../services/meili.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";
import { logAudit, getClientInfo } from "../middlewares/auditLog.middleware";
import { Logger } from "../utils/logger.util";
import prisma from "../prismaClient";

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
      const result = await PropertyService.create(req.body, "MANUAL_EDIT", req.user?.id, "MANUAL");
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

  /**
   * POST /properties/backfill-geocode — batch geocode all properties with null lat/lng
   * Admin only. Returns { processed, succeeded, failed, skipped }.
   */
  static async backfillGeocode(req: Request, res: Response) {
    try {
      const batchSize = 50;
      let cursor: string | undefined = undefined;
      let totalProcessed = 0;
      let succeeded = 0;
      let failed = 0;
      let skipped = 0;

      Logger.info("[PropertyController] Geocoding backfill requested by admin");

      while (true) {
        const properties: {
          id: string;
          area: string | null;
          locationText: string | null;
          estateName: string | null;
          state: string | null;
        }[] = await prisma.property.findMany({
          take: batchSize,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
          where: {
            deletedAt: null,
            latitude: null,
            longitude: null,
          },
          orderBy: { id: "asc" },
          select: { id: true, area: true, locationText: true, estateName: true, state: true },
        });

        if (properties.length === 0) break;

        for (const prop of properties) {
          const query = prop.area || prop.locationText || prop.estateName;
          if (!query) {
            skipped++;
            continue;
          }

          try {
            const geo = await GeocodingService.geocode(query);
            if (geo) {
              await prisma.property.update({
                where: { id: prop.id },
                data: { latitude: geo.lat, longitude: geo.lng },
              });
              // Fire-and-forget Meili update
              MeiliService.upsertProperty(prop.id).catch(() => {});
              succeeded++;
            } else {
              skipped++;
            }
          } catch (err: any) {
            Logger.debug(`[Geocode backfill] Skip ${prop.id}: ${err.message}`);
            failed++;
          }
        }

        totalProcessed += properties.length;
        cursor = properties[properties.length - 1].id;

        // 1-second delay between batches (Nominatim rate limit)
        if (properties.length === batchSize) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      Logger.info(`[Geocode backfill] Complete: ${totalProcessed} processed, ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);

      return sendSuccess(res, {
        processed: totalProcessed,
        succeeded,
        failed,
        skipped,
      }, `Geocoded ${succeeded} of ${totalProcessed} properties`);
    } catch (err: any) {
      Logger.error(`[Geocode backfill] Error: ${err.message}`);
      return sendError(res, "Geocoding backfill failed");
    }
  }

  /**
   * GET /properties/duplicates — find fuzzy duplicate clusters (no body required)
   * Limit to 50 clusters max.
   */
  static async getDuplicates(req: Request, res: Response) {
    try {
      const clusters = await DedupService.findFuzzyMatchesById();
      const limited = clusters.slice(0, 50);
      return sendSuccess(res, { clusters: limited, total: limited.length }, `Found ${limited.length} duplicate cluster(s)`);
    } catch (err) {
      return sendError(res, "Failed to find duplicates");
    }
  }

  /**
   * POST /properties/find-duplicates — find fuzzy duplicate clusters
   * Body: { propertyIds?: string[] }
   */
  static async findDuplicates(req: Request, res: Response) {
    try {
      const { propertyIds } = req.body as { propertyIds?: string[] };
      const clusters = await DedupService.findFuzzyMatchesById(propertyIds);
      return sendSuccess(res, { clusters, total: clusters.length }, `Found ${clusters.length} duplicate cluster(s)`);
    } catch (err) {
      return sendError(res, "Failed to find duplicates");
    }
  }

  /**
   * POST /properties/merge — merge duplicates
   * Body: { keepId: string, deleteIds: string[], fieldOverrides?: Record<string, unknown> }
   */
  static async mergeProperties(req: Request, res: Response) {
    try {
      const { keepId, deleteIds, fieldOverrides } = req.body as {
        keepId: string;
        deleteIds: string[];
        fieldOverrides?: Record<string, unknown>;
      };
      if (!keepId || !Array.isArray(deleteIds) || deleteIds.length === 0) {
        return sendError(res, "keepId and deleteIds[] are required", 400);
      }
      const result = await DedupService.mergeProperties({
        keepId,
        deleteIds,
        fieldOverrides,
        mergedBy: (req as any).user?.id,
      });
      void logAudit({
        userId: (req as any).user?.id,
        action: "MERGE_DUPLICATES",
        entity: "Property",
        entityId: keepId,
        details: { deletedIds: deleteIds, fieldOverrides },
        ...getClientInfo(req),
      });
      return sendSuccess(res, result, `Merged: kept ${keepId}, deleted ${result.deleted}`);
    } catch (err) {
      return sendError(res, "Failed to merge properties");
    }
  }
}
