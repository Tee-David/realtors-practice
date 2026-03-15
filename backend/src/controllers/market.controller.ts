import { Request, Response } from "express";
import { MarketService } from "../services/market.service";
import { TaxonomyService } from "../services/taxonomy.service";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { Logger } from "../utils/logger.util";

export class MarketController {
  /**
   * GET /api/market/price-per-sqm?area=&state=
   */
  static async getPricePerSqm(req: Request, res: Response) {
    try {
      const { area, state } = req.query as { area?: string; state?: string };
      const result = await MarketService.getPricePerSqm({ area, state });
      return sendSuccess(res, result, "Price per sqm data retrieved successfully");
    } catch (error: any) {
      Logger.error(`MarketController.getPricePerSqm error: ${error.message}`);
      return sendError(res, "Failed to retrieve price per sqm data", 500, error.message);
    }
  }

  /**
   * GET /api/market/rental-yield?area=
   */
  static async getRentalYield(req: Request, res: Response) {
    try {
      const { area } = req.query as { area?: string };
      const result = await MarketService.getRentalYield(area);
      return sendSuccess(res, result, "Rental yield data retrieved successfully");
    } catch (error: any) {
      Logger.error(`MarketController.getRentalYield error: ${error.message}`);
      return sendError(res, "Failed to retrieve rental yield data", 500, error.message);
    }
  }

  /**
   * GET /api/market/days-on-market?area=&state=
   */
  static async getDaysOnMarket(req: Request, res: Response) {
    try {
      const { area, state } = req.query as { area?: string; state?: string };
      const result = await MarketService.getDaysOnMarket({ area, state });
      return sendSuccess(res, result, "Days on market data retrieved successfully");
    } catch (error: any) {
      Logger.error(`MarketController.getDaysOnMarket error: ${error.message}`);
      return sendError(res, "Failed to retrieve days on market data", 500, error.message);
    }
  }

  /**
   * GET /api/market/comparables/:propertyId?limit=5
   */
  static async getComparableProperties(req: Request, res: Response) {
    try {
      const { propertyId } = req.params;
      const limit = parseInt(req.query.limit as string) || 5;

      if (!propertyId) {
        return sendError(res, "Property ID is required", 400);
      }

      const result = await MarketService.getComparableProperties(propertyId, limit);
      return sendSuccess(res, result, "Comparable properties retrieved successfully");
    } catch (error: any) {
      Logger.error(`MarketController.getComparableProperties error: ${error.message}`);
      if (error.message === "Property not found") {
        return sendError(res, "Property not found", 404, error.message);
      }
      return sendError(res, "Failed to retrieve comparable properties", 500, error.message);
    }
  }

  /**
   * GET /api/market/report?area=&state=
   */
  static async getMarketReport(req: Request, res: Response) {
    try {
      const { area, state } = req.query as { area?: string; state?: string };
      const result = await MarketService.getMarketReport(area, state);
      return sendSuccess(res, result, "Market report retrieved successfully");
    } catch (error: any) {
      Logger.error(`MarketController.getMarketReport error: ${error.message}`);
      return sendError(res, "Failed to retrieve market report", 500, error.message);
    }
  }

  /**
   * POST /api/market/log-search
   */
  static async logSearchQuery(req: Request, res: Response) {
    try {
      const { query, resultCount, filters } = req.body;

      if (!query || typeof query !== "string") {
        return sendError(res, "Search query is required", 400);
      }

      const userId = req.user?.id;
      await MarketService.logSearchQuery(query, userId, resultCount ?? 0, filters);
      return sendSuccess(res, null, "Search query logged successfully", 201);
    } catch (error: any) {
      Logger.error(`MarketController.logSearchQuery error: ${error.message}`);
      return sendError(res, "Failed to log search query", 500, error.message);
    }
  }

  /**
   * GET /api/market/zero-result-searches?limit=20
   */
  static async getZeroResultSearches(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await MarketService.getZeroResultSearches(limit);
      return sendSuccess(res, result, "Zero-result searches retrieved successfully");
    } catch (error: any) {
      Logger.error(`MarketController.getZeroResultSearches error: ${error.message}`);
      return sendError(res, "Failed to retrieve zero-result searches", 500, error.message);
    }
  }

  /**
   * GET /api/market/taxonomy/normalize?term=
   */
  static async normalizeTerm(req: Request, res: Response) {
    try {
      const { term } = req.query as { term?: string };
      if (!term) {
        return sendError(res, "Term is required", 400);
      }
      const normalized = TaxonomyService.normalize(term);
      const synonyms = TaxonomyService.getSynonyms(term);
      return sendSuccess(res, { original: term, normalized, synonyms }, "Term normalized successfully");
    } catch (error: any) {
      Logger.error(`MarketController.normalizeTerm error: ${error.message}`);
      return sendError(res, "Failed to normalize term", 500, error.message);
    }
  }

  /**
   * GET /api/market/taxonomy/synonyms?term=
   */
  static async getSynonyms(req: Request, res: Response) {
    try {
      const { term } = req.query as { term?: string };
      if (!term) {
        return sendError(res, "Term is required", 400);
      }
      const synonyms = TaxonomyService.getSynonyms(term);
      return sendSuccess(res, { term, synonyms }, "Synonyms retrieved successfully");
    } catch (error: any) {
      Logger.error(`MarketController.getSynonyms error: ${error.message}`);
      return sendError(res, "Failed to retrieve synonyms", 500, error.message);
    }
  }
}
