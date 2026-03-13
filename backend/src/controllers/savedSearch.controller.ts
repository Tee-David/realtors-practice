import { Request, Response } from "express";
import { SavedSearchService } from "../services/savedSearch.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  filters: z.object({
    listingType: z.union([z.string(), z.array(z.string())]).optional(),
    category: z.union([z.string(), z.array(z.string())]).optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    bedrooms: z.number().optional(),
    bathrooms: z.number().optional(),
    state: z.string().optional(),
    area: z.string().optional(),
    features: z.array(z.string()).optional(),
    propertyType: z.union([z.string(), z.array(z.string())]).optional(),
    furnishing: z.string().optional(),
    parking: z.number().optional(),
    serviced: z.boolean().optional(),
  }),
  naturalQuery: z.string().optional(),
  notifyEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export class SavedSearchController {
  static async getAll(req: Request, res: Response) {
    try {
      const searches = await SavedSearchService.getAllByUser(req.user!.id);
      return sendSuccess(res, searches);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to fetch saved searches");
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const search = await SavedSearchService.getById(req.params.id, req.user!.id);
      if (!search) return sendError(res, "Saved search not found", 404);
      return sendSuccess(res, search);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to fetch saved search");
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const data = createSchema.parse(req.body);
      const search = await SavedSearchService.create({
        userId: req.user!.id,
        ...data,
      });
      return sendSuccess(res, search, "Saved search created", 201);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return sendError(res, "Invalid input", 400);
      }
      return sendError(res, err.message || "Failed to create saved search");
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const data = updateSchema.parse(req.body);
      const search = await SavedSearchService.update(req.params.id, req.user!.id, data);
      if (!search) return sendError(res, "Saved search not found", 404);
      return sendSuccess(res, search, "Saved search updated");
    } catch (err: any) {
      if (err.name === "ZodError") {
        return sendError(res, "Invalid input", 400);
      }
      return sendError(res, err.message || "Failed to update saved search");
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const result = await SavedSearchService.delete(req.params.id, req.user!.id);
      if (!result) return sendError(res, "Saved search not found", 404);
      return sendSuccess(res, null, "Saved search deleted");
    } catch (err: any) {
      return sendError(res, err.message || "Failed to delete saved search");
    }
  }

  static async getMatches(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const unseenOnly = req.query.unseenOnly === "true";

      const result = await SavedSearchService.getMatches(
        req.params.id,
        req.user!.id,
        { limit, offset, unseenOnly }
      );

      if (!result) return sendError(res, "Saved search not found", 404);
      return sendPaginated(res, result.matches, result.total, Math.floor(offset / limit) + 1, limit);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to fetch matches");
    }
  }

  static async markMatchesSeen(req: Request, res: Response) {
    try {
      const result = await SavedSearchService.markMatchesSeen(req.params.id, req.user!.id);
      if (!result) return sendError(res, "Saved search not found", 404);
      return sendSuccess(res, null, "Matches marked as seen");
    } catch (err: any) {
      return sendError(res, err.message || "Failed to mark matches as seen");
    }
  }
}
