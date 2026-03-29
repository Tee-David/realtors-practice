import { PrismaClient } from "@prisma/client";
import { Logger } from "../utils/logger.util";

export const DEFAULT_AI_FLAGS = [
  "ai_master",
  "ai_chat",
  "ai_nl_search",
  "ai_property_scoring",
  "ai_market_reports",
  "ai_enrichment",
  "ai_duplicate_detection",
  "ai_scraper_diagnosis",
  "ai_smart_notifications",
  "ai_investment_analysis",
  "ai_neighborhood_profiles",
  "ai_telegram_bot",
];

/**
 * Upserts all default AI feature flags with enabled: false.
 * Skips flags that already exist (preserves existing state).
 * Non-fatal — a failure here should not crash the server.
 */
export async function seedAiFlags(prisma: PrismaClient): Promise<void> {
  let created = 0;

  for (const featureKey of DEFAULT_AI_FLAGS) {
    const existing = await prisma.aiFeatureFlag.findUnique({
      where: { featureKey },
    });

    if (!existing) {
      await prisma.aiFeatureFlag.create({
        data: { featureKey, enabled: false },
      });
      created++;
    }
  }

  if (created > 0) {
    Logger.info(`AI flags seeded: ${created} new flags created`);
  } else {
    Logger.info("AI flags: all flags already exist, nothing to seed");
  }
}
