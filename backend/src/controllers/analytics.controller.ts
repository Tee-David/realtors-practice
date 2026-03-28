import { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service";
import { SiteAnalyticsService } from "../services/siteAnalytics.service";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { Logger } from "../utils/logger.util";

export class AnalyticsController {
  /**
   * GET /api/analytics/kpis
   * Get high-level numbers for the dashboard
   */
  static async getOverviewKPIs(req: Request, res: Response) {
    try {
      const kpis = await AnalyticsService.getOverviewKPIs();
      return sendSuccess(res, kpis, "KPIs retrieved successfully");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getOverviewKPIs error: ${error.message}`);
      return sendError(res, "Failed to retrieve KPIs", 500, error.message);
    }
  }

  /**
   * GET /api/analytics/charts
   * Get aggregated data for the dashboard charts (Donut + Bar)
   */
  static async getCharts(req: Request, res: Response) {
    try {
      const [chartData, byStatus] = await Promise.all([
        AnalyticsService.getChartData(),
        AnalyticsService.getPropertiesByStatus(),
      ]);

      return sendSuccess(res, {
        byCategory: chartData.byCategory,
        byStatus,
        topAreas: chartData.topAreas,
        topSites: chartData.topSites,
        avgPrice: chartData.avgPrice,
        recentProperties: chartData.recentProperties,
      }, "Chart data retrieved successfully");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getCharts error: ${error.message}`);
      return sendError(res, "Failed to retrieve chart data", 500, error.message);
    }
  }

  /**
   * GET /api/analytics/site-quality
   * Get scored ranking of specific sites by freshness and data quality.
   */
  static async getSiteQuality(req: Request, res: Response) {
    try {
      const rankings = await SiteAnalyticsService.getSiteRankings();
      return sendSuccess(res, rankings, "Site quality rankings retrieved");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getSiteQuality error: ${error.message}`);
      return sendError(res, "Failed to retrieve site quality rankings", 500, error.message);
    }
  }

  /**
   * GET /api/analytics/price-trends
   * Average price by month over the last 6 months, grouped by listing type.
   */
  static async getPriceTrends(req: Request, res: Response) {
    try {
      const trends = await AnalyticsService.getPriceTrends();
      return sendSuccess(res, trends, "Price trends retrieved successfully");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getPriceTrends error: ${error.message}`);
      return sendError(res, "Failed to retrieve price trends", 500, error.message);
    }
  }

  /**
   * GET /api/analytics/quality-distribution
   * Distribution of quality scores across properties.
   */
  static async getQualityDistribution(req: Request, res: Response) {
    try {
      const distribution = await AnalyticsService.getQualityDistribution();
      return sendSuccess(res, distribution, "Quality distribution retrieved successfully");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getQualityDistribution error: ${error.message}`);
      return sendError(res, "Failed to retrieve quality distribution", 500, error.message);
    }
  }

  /**
   * GET /api/analytics/listing-velocity
   * New listings per day over the past 30 days.
   */
  static async getListingVelocity(req: Request, res: Response) {
    try {
      const velocity = await AnalyticsService.getListingVelocity();
      return sendSuccess(res, velocity, "Listing velocity retrieved successfully");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getListingVelocity error: ${error.message}`);
      return sendError(res, "Failed to retrieve listing velocity", 500, error.message);
    }
  }

  static async getActivityHeatmap(req: Request, res: Response) {
    try {
      const heatmap = await AnalyticsService.getActivityHeatmap();
      return sendSuccess(res, heatmap, "Activity heatmap retrieved successfully");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getActivityHeatmap error: ${error.message}`);
      return sendError(res, "Failed to retrieve activity heatmap", 500, error.message);
    }
  }

  /**
   * GET /api/analytics/kpi-trends
   * Period-over-period percentage changes for dashboard KPIs
   */
  static async getKPITrends(req: Request, res: Response) {
    try {
      const trends = await AnalyticsService.getKPITrends();
      return sendSuccess(res, trends, "KPI trends retrieved successfully");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getKPITrends error: ${error.message}`);
      return sendError(res, "Failed to retrieve KPI trends", 500, error.message);
    }
  }

  static async getWeeklySparkline(req: Request, res: Response) {
    try {
      const sparkline = await AnalyticsService.getWeeklySparkline();
      return sendSuccess(res, sparkline, "Weekly sparkline retrieved successfully");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getWeeklySparkline error: ${error.message}`);
      return sendError(res, "Failed to retrieve weekly sparkline", 500, error.message);
    }
  }

  static async getCategoryDistribution(req: Request, res: Response) {
    try {
      const data = await AnalyticsService.getCategoryDistribution();
      return sendSuccess(res, data, "Category distribution retrieved");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getCategoryDistribution error: ${error.message}`);
      return sendError(res, "Failed to retrieve category distribution", 500, error.message);
    }
  }

  static async getListingTypeDistribution(req: Request, res: Response) {
    try {
      const data = await AnalyticsService.getListingTypeDistribution();
      return sendSuccess(res, data, "Listing type distribution retrieved");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getListingTypeDistribution error: ${error.message}`);
      return sendError(res, "Failed to retrieve listing type distribution", 500, error.message);
    }
  }

  static async getVerificationTrends(req: Request, res: Response) {
    try {
      const data = await AnalyticsService.getVerificationTrends();
      return sendSuccess(res, data, "Verification trends retrieved");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getVerificationTrends error: ${error.message}`);
      return sendError(res, "Failed to retrieve verification trends", 500, error.message);
    }
  }

  static async getScraperHealth(req: Request, res: Response) {
    try {
      const data = await AnalyticsService.getScraperHealth();
      return sendSuccess(res, data, "Scraper health retrieved");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getScraperHealth error: ${error.message}`);
      return sendError(res, "Failed to retrieve scraper health", 500, error.message);
    }
  }

  static async getPricePerSqm(req: Request, res: Response) {
    try {
      const data = await AnalyticsService.getPricePerSqm();
      return sendSuccess(res, data, "Price per sqm retrieved");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getPricePerSqm error: ${error.message}`);
      return sendError(res, "Failed to retrieve price per sqm", 500, error.message);
    }
  }
}

