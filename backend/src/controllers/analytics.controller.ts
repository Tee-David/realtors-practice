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
}

