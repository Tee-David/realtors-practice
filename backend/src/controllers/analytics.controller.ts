import { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service";
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
      const [byCategory, byStatus] = await Promise.all([
        AnalyticsService.getPropertiesByCategory(),
        AnalyticsService.getPropertiesByStatus(),
      ]);

      return sendSuccess(res, {
        byCategory,
        byStatus,
      }, "Chart data retrieved successfully");
    } catch (error: any) {
      Logger.error(`AnalyticsController.getCharts error: ${error.message}`);
      return sendError(res, "Failed to retrieve chart data", 500, error.message);
    }
  }
}
