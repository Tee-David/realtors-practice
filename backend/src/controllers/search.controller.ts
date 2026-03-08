import { Request, Response } from "express";
import { SearchService } from "../services/search.service";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { Logger } from "../utils/logger.util";

export class SearchController {
  
  /**
   * GET /api/search
   * Faceted search (standard filtering + natural language fallback)
   */
  static async search(req: Request, res: Response) {
    try {
      const q = req.query.q as string || "";
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const facetsParam = req.query.facets as string;
      const facets = facetsParam ? facetsParam.split(",") : ["categoryName", "listingType", "bedrooms", "state"];

      const filtersParam = req.query.filters as string;
      const filters = filtersParam ? [filtersParam] : [];

      const sortParam = req.query.sort as string;
      const sort = sortParam ? [sortParam] : ["createdAt:desc"];

      const result = await SearchService.search({
        q,
        limit,
        offset,
        facets,
        filters,
        sort,
      });

      return sendSuccess(res, result, "Search successful");
    } catch (error: any) {
      Logger.error(`SearchController.search error: ${error.message}`);
      
      // Graceful fallback if Meilisearch is down
      if (error.message && error.message.includes("failed")) {
        return sendSuccess(res, { hits: [], nbHits: 0, facets: {} }, "Search unavailable (Meilisearch down)");
      }
      
      return sendError(res, "Search failed", 500, error.message);
    }
  }

  /**
   * GET /api/search/suggestions
   * Typeahead autocomplete
   */
  static async getSuggestions(req: Request, res: Response) {
    try {
      const q = req.query.q as string || "";
      const limit = parseInt(req.query.limit as string) || 5;

      const suggestions = await SearchService.getSuggestions(q, limit);
      return sendSuccess(res, suggestions, "Suggestions fetched");
    } catch (error: any) {
      Logger.error(`SearchController.getSuggestions error: ${error.message}`);
      
      // Graceful fallback if Meilisearch is down
      if (error.message && error.message.includes("failed")) {
        return sendSuccess(res, [], "Suggestions unavailable (Meilisearch down)");
      }
      
      return sendError(res, "Suggestions failed", 500, error.message);
    }
  }
}
