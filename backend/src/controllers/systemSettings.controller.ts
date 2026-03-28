import { Request, Response } from "express";
import { SystemSettingsService } from "../services/systemSettings.service";
import { CronService } from "../services/cron.service";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { Logger } from "../utils/logger.util";

export class SystemSettingsController {
  static async list(req: Request, res: Response) {
    try {
      const settings = await SystemSettingsService.getAll();
      return sendSuccess(res, settings);
    } catch (err: any) {
      Logger.error("Failed to list settings", err);
      return sendError(res, err?.message || "Failed to list settings");
    }
  }

  static async getDefaults(req: Request, res: Response) {
    try {
      const defaults = await SystemSettingsService.getDefaults();
      return sendSuccess(res, defaults);
    } catch (err: any) {
      Logger.error("Failed to get defaults", err);
      return sendError(res, err?.message || "Failed to get setting defaults");
    }
  }

  static async getByCategory(req: Request, res: Response) {
    try {
      const settings = await SystemSettingsService.getByCategory(
        req.params.category
      );
      return sendSuccess(res, settings);
    } catch (err: any) {
      Logger.error("Failed to get settings by category", err);
      return sendError(
        res,
        err?.message || "Failed to get settings by category"
      );
    }
  }

  static async bulkUpdate(req: Request, res: Response) {
    try {
      const { settings } = req.body;

      if (!Array.isArray(settings) || settings.length === 0) {
        return sendError(
          res,
          "Request body must contain a non-empty settings array",
          400
        );
      }

      for (const s of settings) {
        if (!s.key || s.value === undefined) {
          return sendError(
            res,
            "Each setting must have a key and value",
            400
          );
        }
      }

      const results = await SystemSettingsService.bulkUpdate(settings);

      // If any scraper settings were updated, reschedule the cron job
      const hasScraperSettings = settings.some(
        (s: any) => s.category === "scraper" || s.key?.startsWith("scrape_schedule")
      );
      if (hasScraperSettings) {
        CronService.rescheduleScrapeCron().catch((err: any) => {
          Logger.warn(`Failed to reschedule scrape cron: ${err.message}`);
        });
      }

      return sendSuccess(res, results, "Settings updated");
    } catch (err: any) {
      Logger.error("Failed to bulk update settings", err);
      return sendError(res, err?.message || "Failed to bulk update settings");
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const { value, category } = req.body;

      if (value === undefined) {
        return sendError(res, "Value is required", 400);
      }

      const setting = await SystemSettingsService.set(key, value, category);
      return sendSuccess(res, setting, "Setting updated");
    } catch (err: any) {
      Logger.error("Failed to update setting", err);
      return sendError(res, err?.message || "Failed to update setting");
    }
  }
}
