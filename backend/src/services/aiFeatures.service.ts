import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";

const MASTER_KEY = "ai_master";

export interface AIFeatureFlag {
  key: string;
  enabled: boolean;
  config?: Record<string, unknown> | null;
  updatedAt: Date;
}

export class AIFeaturesService {
  /**
   * Get all AI feature flags from the dedicated AiFeatureFlag table.
   */
  static async getAll(): Promise<AIFeatureFlag[]> {
    const flags = await prisma.aiFeatureFlag.findMany({
      orderBy: { featureKey: "asc" },
    });

    return flags.map((f) => ({
      key: f.featureKey,
      enabled: f.enabled,
      config: f.config as Record<string, unknown> | null,
      updatedAt: f.updatedAt,
    }));
  }

  /**
   * Check if a specific AI feature is enabled.
   * Returns false if the master switch is off, even if the individual feature is on.
   */
  static async isEnabled(featureKey: string): Promise<boolean> {
    if (featureKey !== MASTER_KEY) {
      const master = await prisma.aiFeatureFlag.findUnique({
        where: { featureKey: MASTER_KEY },
      });
      if (!master?.enabled) return false;
    }

    const feature = await prisma.aiFeatureFlag.findUnique({
      where: { featureKey },
    });
    return feature?.enabled ?? false;
  }

  /**
   * Toggle a single AI feature flag.
   * Accepts optional config payload for feature-specific settings.
   */
  static async toggle(
    featureKey: string,
    enabled: boolean,
    config?: Record<string, unknown>
  ): Promise<AIFeatureFlag> {
    const flag = await prisma.aiFeatureFlag.upsert({
      where: { featureKey },
      update: {
        enabled,
        ...(config !== undefined && { config }),
      },
      create: {
        featureKey,
        enabled,
        config: config ?? null,
      },
    });

    Logger.info(`AI feature toggled: ${featureKey} → ${enabled}`);

    // If master is turned off, disable all features
    if (featureKey === MASTER_KEY && !enabled) {
      await prisma.aiFeatureFlag.updateMany({
        where: { featureKey: { not: MASTER_KEY } },
        data: { enabled: false },
      });
      Logger.info("Master AI switch turned off — all features disabled");
    }

    return {
      key: flag.featureKey,
      enabled: flag.enabled,
      config: flag.config as Record<string, unknown> | null,
      updatedAt: flag.updatedAt,
    };
  }
}
