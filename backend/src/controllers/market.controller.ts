import { Request, Response } from "express";
import { MarketService } from "../services/market.service";
import { TaxonomyService } from "../services/taxonomy.service";
import { PropertyService } from "../services/property.service";
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
   * GET /api/market/trends?area=&state=
   * Serves chart-ready market trend data for the frontend.
   */
  static async getMarketTrends(req: Request, res: Response) {
    try {
      const { area, state } = req.query as { area?: string; state?: string };
      const result = await MarketService.getMarketTrends(area, state);
      return sendSuccess(res, result, "Market trends retrieved successfully");
    } catch (error: any) {
      Logger.error(`MarketController.getMarketTrends error: ${error.message}`);
      return sendError(res, "Failed to retrieve market trends", 500, error.message);
    }
  }

  /**
   * GET /api/market/rental-yield/calculate?salePrice=&monthlyRent=&area=
   * Calculate rental yield for a specific property or hypothetical scenario.
   */
  static async calculateRentalYield(req: Request, res: Response) {
    try {
      const salePrice = parseFloat(req.query.salePrice as string);
      const monthlyRent = req.query.monthlyRent ? parseFloat(req.query.monthlyRent as string) : undefined;
      const area = req.query.area as string | undefined;

      if (!salePrice || salePrice <= 0) {
        return sendError(res, "Valid salePrice is required", 400);
      }

      if (!monthlyRent && !area) {
        return sendError(res, "Either monthlyRent or area must be provided", 400);
      }

      const result = await MarketService.calculatePropertyRentalYield(salePrice, monthlyRent, area);
      return sendSuccess(res, { salePrice, monthlyRent, area, ...result }, "Rental yield calculated");
    } catch (error: any) {
      Logger.error(`MarketController.calculateRentalYield error: ${error.message}`);
      return sendError(res, "Failed to calculate rental yield", 500, error.message);
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

  /**
   * GET /api/market/taxonomy/map - Get the full synonym map
   */
  static async getSynonymMap(_req: Request, res: Response) {
    try {
      const map = TaxonomyService.getSynonymMap();
      return sendSuccess(res, map, "Synonym map retrieved successfully");
    } catch (error: any) {
      Logger.error(`MarketController.getSynonymMap error: ${error.message}`);
      return sendError(res, "Failed to retrieve synonym map", 500, error.message);
    }
  }

  /**
   * GET /api/market/taxonomy/bathrooms?text=2.5 baths
   * Normalize Nigerian bathroom count text to an integer.
   */
  static async normalizeBathrooms(req: Request, res: Response) {
    try {
      const { text } = req.query as { text?: string };
      if (!text) {
        return sendError(res, "text parameter is required", 400);
      }
      const normalized = TaxonomyService.normalizeBathrooms(text);
      return sendSuccess(res, { original: text, normalized }, "Bathroom count normalized");
    } catch (error: any) {
      Logger.error(`MarketController.normalizeBathrooms error: ${error.message}`);
      return sendError(res, "Failed to normalize bathroom count", 500, error.message);
    }
  }

  /**
   * GET /api/market/most-viewed?limit=20
   */
  static async getMostViewed(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const properties = await PropertyService.getMostViewed(limit);
      return sendSuccess(res, properties, `${properties.length} most viewed properties`);
    } catch (error: any) {
      Logger.error(`MarketController.getMostViewed error: ${error.message}`);
      return sendError(res, "Failed to retrieve most viewed properties", 500, error.message);
    }
  }
}
