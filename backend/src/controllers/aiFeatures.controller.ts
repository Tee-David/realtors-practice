import { Request, Response } from "express";
import { AIFeaturesService } from "../services/aiFeatures.service";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { Logger } from "../utils/logger.util";

export class AIFeaturesController {
  static async list(req: Request, res: Response) {
    try {
      const flags = await AIFeaturesService.getAll();
      return sendSuccess(res, flags);
    } catch (err: any) {
      Logger.error("Failed to list AI features", err);
      return sendError(res, err?.message || "Failed to list AI features");
    }
  }

  static async toggle(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const { enabled, config } = req.body;

      if (typeof enabled !== "boolean") {
        return sendError(res, "enabled must be a boolean", 400);
      }

      const flag = await AIFeaturesService.toggle(key, enabled, config);
      return sendSuccess(res, flag, `${key} ${enabled ? "enabled" : "disabled"}`);
    } catch (err: any) {
      Logger.error("Failed to toggle AI feature", err);
      return sendError(res, err?.message || "Failed to toggle AI feature");
    }
  }
}
