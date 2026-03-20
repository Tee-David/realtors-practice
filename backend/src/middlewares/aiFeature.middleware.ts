import { Request, Response, NextFunction } from "express";
import { AIFeaturesService } from "../services/aiFeatures.service";

/**
 * Express middleware that checks if an AI feature is enabled before processing.
 * Checks both the master switch and the specific feature.
 * Returns 403 if the feature is disabled.
 */
export function requireAIFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enabled = await AIFeaturesService.isEnabled(featureKey);
      if (!enabled) {
        return res.status(403).json({
          success: false,
          error: `AI feature '${featureKey}' is not enabled`,
        });
      }
      next();
    } catch {
      return res.status(500).json({
        success: false,
        error: "Failed to check AI feature status",
      });
    }
  };
}
