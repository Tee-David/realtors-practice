import cron from "node-cron";
import { MeiliService } from "./meili.service";
import { Logger } from "../utils/logger.util";

export class CronService {
  /**
   * Initialize all cron jobs for the backend
   */
  static init() {
    Logger.info("Initializing Cron Jobs...");

    // Run weekly on Sunday at 2:00 AM
    cron.schedule("0 2 * * 0", async () => {
      try {
        Logger.info("[CRON] Starting weekly Meilisearch full re-index");
        await MeiliService.fullReindex();
        Logger.info("[CRON] Weekly Meilisearch full re-index completed");
      } catch (error: any) {
        Logger.error(`[CRON] Weekly Meilisearch re-index failed: ${error.message}`);
      }
    }, {
      timezone: "Africa/Lagos"
    });
  }
}
