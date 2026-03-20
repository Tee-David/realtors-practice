import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";

const AI_FEATURES_CATEGORY = "ai_features";
const MASTER_KEY = "ai_master";

export interface AIFeatureFlag {
  key: string;
  enabled: boolean;
  updatedAt: Date;
}

export class AIFeaturesService {
  /**
   * Get all AI feature flags.
   */
  static async getAll(): Promise<AIFeatureFlag[]> {
    const settings = await prisma.systemSetting.findMany({
      where: { category: AI_FEATURES_CATEGORY },
      orderBy: { key: "asc" },
    });

    return settings.map((s) => ({
      key: s.key,
      enabled: (s.value as any)?.enabled ?? false,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * Check if a specific AI feature is enabled.
   * Returns false if the master switch is off, even if the individual feature is on.
   */
  static async isEnabled(featureKey: string): Promise<boolean> {
    if (featureKey !== MASTER_KEY) {
      const master = await prisma.systemSetting.findUnique({
        where: { key: MASTER_KEY },
      });
      if (!(master?.value as any)?.enabled) return false;
    }

    const feature = await prisma.systemSetting.findUnique({
      where: { key: featureKey },
    });
    return (feature?.value as any)?.enabled ?? false;
  }

  /**
   * Toggle a single AI feature flag.
   */
  static async toggle(featureKey: string, enabled: boolean): Promise<AIFeatureFlag> {
    const setting = await prisma.systemSetting.upsert({
      where: { key: featureKey },
      update: { value: { enabled } },
      create: {
        key: featureKey,
        value: { enabled },
        category: AI_FEATURES_CATEGORY,
      },
    });

    Logger.info(`AI feature toggled: ${featureKey} → ${enabled}`);

    // If master is turned off, disable all features
    if (featureKey === MASTER_KEY && !enabled) {
      await prisma.systemSetting.updateMany({
        where: {
          category: AI_FEATURES_CATEGORY,
          key: { not: MASTER_KEY },
        },
        data: { value: { enabled: false } },
      });
      Logger.info("Master AI switch turned off — all features disabled");
    }

    return {
      key: setting.key,
      enabled: (setting.value as any)?.enabled ?? false,
      updatedAt: setting.updatedAt,
    };
  }
}
