import cron from "node-cron";
import { MeiliService } from "./meili.service";
import { SavedSearchService } from "./savedSearch.service";
import { NotificationService } from "./notification.service";
import { EmailService } from "./email.service";
import { ScrapeService } from "./scrape.service";
import { Logger } from "../utils/logger.util";
import prisma from "../prismaClient";

export class CronService {
  /**
   * Initialize all cron jobs for the backend
   */
  static init() {
    Logger.info("Initializing Cron Jobs...");

    // Run weekly on Sunday at 2:00 AM — Meilisearch full re-index
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

    // Run daily at 6:00 AM — Check saved search matches
    cron.schedule("0 6 * * *", async () => {
      try {
        Logger.info("[CRON] Starting daily saved search match check");
        const result = await SavedSearchService.checkAllActive();
        Logger.info(
          `[CRON] Saved search check completed: ${result.searched} searches checked, ${result.totalNewMatches} new matches`
        );

        // Send notifications + emails for searches with new matches
        if (result.totalNewMatches > 0) {
          await this.notifyNewMatches();
        }
      } catch (error: any) {
        Logger.error(`[CRON] Saved search check failed: ${error.message}`);
      }
    }, {
      timezone: "Africa/Lagos"
    });

    // Run every 5 minutes — Kill stuck scrape jobs that exceed max duration
    cron.schedule("*/5 * * * *", async () => {
      try {
        const killed = await ScrapeService.killStuckJobs();
        if (killed > 0) {
          Logger.info(`[CRON] Killed ${killed} stuck scrape job(s)`);
        }
      } catch (error: any) {
        Logger.error(`[CRON] Stuck job cleanup failed: ${error.message}`);
      }
    }, {
      timezone: "Africa/Lagos"
    });

    // Run weekly on Monday at 3:00 AM — Cleanup old read notifications
    cron.schedule("0 3 * * 1", async () => {
      try {
        Logger.info("[CRON] Starting notification cleanup");
        const deleted = await NotificationService.cleanupOld(30);
        Logger.info(`[CRON] Cleaned up ${deleted} old notifications`);
      } catch (error: any) {
        Logger.error(`[CRON] Notification cleanup failed: ${error.message}`);
      }
    }, {
      timezone: "Africa/Lagos"
    });

    // Run daily at 3:30 AM — Data retention auto-purge
    cron.schedule("30 3 * * *", async () => {
      try {
        Logger.info("[CRON] Starting data retention auto-purge");
        await this.purgeStaleData();
        Logger.info("[CRON] Data retention auto-purge completed");
      } catch (error: any) {
        Logger.error(`[CRON] Data retention auto-purge failed: ${error.message}`);
      }
    }, {
      timezone: "Africa/Lagos"
    });
  }

  /**
   * Send notifications and emails for saved searches with new matches
   */
  private static async notifyNewMatches() {
    try {
      const searchesWithNewMatches = await prisma.savedSearch.findMany({
        where: {
          isActive: true,
          newSinceCheck: { gt: 0 },
        },
        include: {
          user: { select: { id: true, email: true } },
          matches: {
            where: { seen: false },
            include: {
              property: {
                select: { title: true, price: true, area: true },
              },
            },
            take: 5,
            orderBy: { matchedAt: "desc" },
          },
        },
      });

      for (const search of searchesWithNewMatches) {
        // In-app notification
        if (search.notifyInApp) {
          await NotificationService.create({
            userId: search.user.id,
            type: "NEW_MATCH",
            title: `New matches for "${search.name}"`,
            message: `${search.newSinceCheck} new ${search.newSinceCheck === 1 ? "property" : "properties"} matched your saved search.`,
            data: {
              savedSearchId: search.id,
              matchCount: search.newSinceCheck,
            },
          });
        }

        // Email notification
        if (search.notifyEmail) {
          const matchPreview = search.matches.map((m) => ({
            title: m.property.title,
            price: m.property.price,
            area: m.property.area,
          }));

          await EmailService.sendNewMatchEmail(
            search.user.email,
            search.name,
            search.newSinceCheck,
            matchPreview
          );
        }

        // Reset newSinceCheck counter
        await prisma.savedSearch.update({
          where: { id: search.id },
          data: { newSinceCheck: 0 },
        });
      }

      Logger.info(
        `[CRON] Sent notifications for ${searchesWithNewMatches.length} saved searches`
      );
    } catch (error: any) {
      Logger.error(`[CRON] Failed to send match notifications: ${error.message}`);
    }
  }

  /**
   * Purge stale data according to retention policy:
   *   - Properties with status EXPIRED or SOLD older than 90 days
   *   - Audit logs older than 180 days
   *   - Scrape logs older than 30 days
   */
  private static async purgeStaleData() {
    const now = new Date();

    // 1. Delete EXPIRED / SOLD properties older than 90 days
    const propertyThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deletedProperties = await prisma.property.deleteMany({
      where: {
        status: { in: ["EXPIRED", "SOLD"] },
        updatedAt: { lt: propertyThreshold },
      },
    });
    if (deletedProperties.count > 0) {
      Logger.info(`[PURGE] Deleted ${deletedProperties.count} expired/sold properties older than 90 days`);
    }

    // 2. Delete audit logs older than 180 days
    const auditThreshold = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const deletedAuditLogs = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: auditThreshold },
      },
    });
    if (deletedAuditLogs.count > 0) {
      Logger.info(`[PURGE] Deleted ${deletedAuditLogs.count} audit logs older than 180 days`);
    }

    // 3. Delete scrape logs older than 30 days
    const scrapeLogThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const deletedScrapeLogs = await prisma.scrapeLog.deleteMany({
      where: {
        timestamp: { lt: scrapeLogThreshold },
      },
    });
    if (deletedScrapeLogs.count > 0) {
      Logger.info(`[PURGE] Deleted ${deletedScrapeLogs.count} scrape logs older than 30 days`);
    }

    // Summary
    const total = deletedProperties.count + deletedAuditLogs.count + deletedScrapeLogs.count;
    if (total === 0) {
      Logger.info("[PURGE] No stale data to purge");
    } else {
      Logger.info(
        `[PURGE] Total purged: ${total} records (${deletedProperties.count} properties, ${deletedAuditLogs.count} audit logs, ${deletedScrapeLogs.count} scrape logs)`
      );
    }
  }
}
