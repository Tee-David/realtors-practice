import { Request, Response, NextFunction } from "express";
import { AIFeaturesService } from "../services/aiFeatures.service";

/**
 * Express middleware factory that checks if an AI feature (and the master switch)
 * is enabled before processing the request.
 *
 * Returns 503 Service Unavailable if the feature or master switch is disabled,
 * matching the AI Foundation spec.
 */
export function requireAIFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const enabled = await AIFeaturesService.isEnabled(featureKey);
      if (!enabled) {
        return res.status(503).json({
          success: false,
          error: "AI feature not enabled",
          feature: featureKey,
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
