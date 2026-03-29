import prisma from "../prismaClient";
import { Prisma } from "@prisma/client";
import { config } from "../config/env";
import { Logger } from "../utils/logger.util";
import { SystemSettingsService } from "./systemSettings.service";

/** Site Intelligence settings stored in the SystemSetting table (category: site_intelligence). */
export interface SISettings {
  si_auto_learn_on_create: boolean;
  si_auto_learn_before_scrape: boolean;
  si_relearn_interval_days: number;
  si_css_confidence_threshold: number;
}

const SI_DEFAULTS: SISettings = {
  si_auto_learn_on_create: true,
  si_auto_learn_before_scrape: true,
  si_relearn_interval_days: 0,
  si_css_confidence_threshold: 50,
};

export class SiteIntelligenceService {
  /**
   * Read the Site Intelligence settings from the database, merged with defaults.
   */
  static async getSettings(): Promise<SISettings> {
    const rows = await SystemSettingsService.getByCategory("site_intelligence");
    const merged = { ...SI_DEFAULTS };
    for (const row of rows) {
      if (row.key in merged) {
        (merged as any)[row.key] = row.value;
      }
    }
    return merged;
  }
  /**
   * Trigger a learn job for a single site.
   * Creates a ScrapeJob with type LEARN_SITE and dispatches to the Python scraper.
   */
  static async learnSite(siteId: string, userId?: string) {
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new Error("Site not found");
    if (site.deletedAt) throw new Error("Site has been deleted");

    // Check relearn interval — skip if recently learned
    const siSettings = await SiteIntelligenceService.getSettings();
    if (
      site.learnStatus === "LEARNED" &&
      site.learnedAt &&
      siSettings.si_relearn_interval_days > 0
    ) {
      const daysSinceLearn =
        (Date.now() - new Date(site.learnedAt).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceLearn < siSettings.si_relearn_interval_days) {
        throw new Error(
          `Site was learned ${Math.round(daysSinceLearn)} day(s) ago. ` +
          `Relearn interval is ${siSettings.si_relearn_interval_days} days. Skipping.`
        );
      }
    }

    // Guard against duplicate learn — if already LEARNING, check if the job is stale
    if (site.learnStatus === "LEARNING" && site.learnJobId) {
      const existingJob = await prisma.scrapeJob.findUnique({
        where: { id: site.learnJobId },
        select: { status: true, startedAt: true },
      });
      const staleThresholdMs = 20 * 60 * 1000; // 20 minutes
      const isStale = existingJob?.startedAt &&
        Date.now() - new Date(existingJob.startedAt).getTime() > staleThresholdMs;

      if (existingJob && existingJob.status === "RUNNING" && !isStale) {
        throw new Error("Site is already being learned. Please wait for the current job to finish.");
      }
      // If stale or not running, allow re-learn — mark old job as failed
      if (existingJob && existingJob.status === "RUNNING") {
        await prisma.scrapeJob.update({
          where: { id: site.learnJobId },
          data: { status: "FAILED", completedAt: new Date() },
        });
      }
    }

    // Create a LEARN_SITE job
    const job = await prisma.scrapeJob.create({
      data: {
        type: "LEARN_SITE",
        status: "PENDING",
        siteIds: [siteId],
        sites: { connect: [{ id: siteId }] },
        createdById: userId || undefined,
        startedAt: new Date(),
      },
    });

    // Mark site as learning
    await prisma.site.update({
      where: { id: siteId },
      data: { learnStatus: "LEARNING", learnJobId: job.id },
    });

    // Build learn payload (siSettings already loaded above for relearn interval check)
    const selectors = (site.selectors || {}) as Record<string, any>;
    const learnPayload = {
      jobId: job.id,
      cssConfidenceThreshold: siSettings.si_css_confidence_threshold,
      site: {
        id: site.id,
        name: site.name,
        baseUrl: site.baseUrl,
        listPaths: site.listPaths || [],
        listingSelector: selectors.listingSelector || selectors.listing_container || "",
        selectors: (site.detailSelectors || selectors) as Record<string, any>,
        paginationType: site.paginationType,
        paginationConfig: selectors.paginationConfig || {},
        requiresJs: site.requiresBrowser,
        maxPages: site.maxPages,
        delayMin: selectors.delayMin || undefined,
        delayMax: selectors.delayMax || undefined,
      },
      callbackUrl:
        config.env === "production"
          ? process.env.API_BASE_URL || "https://realtors-practice-new-api.onrender.com/api"
          : `http://localhost:${config.port}/api`,
    };

    // Dispatch — GitHub Actions first, direct HTTP fallback
    let dispatched = false;

    if (config.github.pat && config.github.repo) {
      try {
        const [owner, repo] = config.github.repo.split("/");
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/dispatches`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.github.pat}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              event_type: "trigger-learn",
              client_payload: {
                jobId: job.id,
                type: "learn",
                learnPayload: JSON.stringify(learnPayload),
              },
            }),
            signal: AbortSignal.timeout(10000),
          }
        );

        if (response.status === 204 || response.ok) {
          dispatched = true;
          Logger.info(`Learn job ${job.id} dispatched to GitHub Actions for site ${site.name}`);
        } else {
          const body = await response.text();
          throw new Error(`GitHub API responded ${response.status}: ${body}`);
        }
      } catch (err: any) {
        Logger.warn(`GitHub Actions learn dispatch failed: ${err.message}`);
      }
    }

    // Fallback: direct HTTP
    if (!dispatched) {
      try {
        const response = await fetch(`${config.scraper.url}/api/learn`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Key": config.scraper.internalKey,
          },
          body: JSON.stringify(learnPayload),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          dispatched = true;
          Logger.info(`Learn job ${job.id} dispatched via HTTP for site ${site.name}`);
        } else {
          const body = await response.text();
          throw new Error(`Scraper responded ${response.status}: ${body}`);
        }
      } catch (err: any) {
        Logger.warn(`Direct HTTP learn dispatch failed: ${err.message}`);
      }
    }

    if (dispatched) {
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: "RUNNING" },
      });
    } else {
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: "FAILED" },
      });
      await prisma.site.update({
        where: { id: siteId },
        data: { learnStatus: "FAILED", learnJobId: null },
      });
      throw new Error("Failed to dispatch learn job");
    }

    return job;
  }

  /**
   * Trigger learn for multiple sites (sequentially dispatched).
   */
  static async bulkLearnSites(siteIds: string[], userId?: string) {
    const results: Array<{ siteId: string; jobId: string; error?: string }> = [];

    for (const siteId of siteIds) {
      try {
        const job = await this.learnSite(siteId, userId);
        results.push({ siteId, jobId: job.id });
      } catch (err: any) {
        results.push({ siteId, jobId: "", error: err.message });
      }
    }

    return results;
  }

  /**
   * Handle learn results from Python scraper.
   */
  static async handleLearnResults(
    jobId: string,
    siteId: string,
    data: {
      siteProfile?: Record<string, any>;
      selectors?: Record<string, any>;
      detailSelectors?: Record<string, any>;
      listPaths?: string[];
    }
  ) {
    // Idempotency: skip if job already completed
    const existingJob = await prisma.scrapeJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (existingJob?.status === "COMPLETED") {
      Logger.info(`Learn results for job ${jobId} already processed, skipping duplicate`);
      return;
    }

    const updateData: Record<string, any> = {
      learnStatus: "LEARNED",
      learnedAt: new Date(),
    };

    if (data.siteProfile) {
      updateData.siteProfile = data.siteProfile as Prisma.InputJsonValue;
    }

    if (data.selectors) {
      updateData.selectors = data.selectors as Prisma.InputJsonValue;
    }

    if (data.detailSelectors) {
      updateData.detailSelectors = data.detailSelectors as Prisma.InputJsonValue;
    }

    if (data.listPaths && data.listPaths.length > 0) {
      // Merge with existing listPaths
      const existing = await prisma.site.findUnique({
        where: { id: siteId },
        select: { listPaths: true },
      });
      const allPaths = new Set([...(existing?.listPaths || []), ...data.listPaths]);
      updateData.listPaths = Array.from(allPaths);
    }

    await prisma.site.update({
      where: { id: siteId },
      data: updateData,
    });

    // Mark job as completed
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        durationMs: data.siteProfile?.learnDurationMs || null,
      },
    });

    Logger.info(`Learn results saved for site ${siteId} (job ${jobId})`);
  }

  /**
   * Get scrape time estimate for selected sites.
   */
  static async estimateScrape(siteIds: string[]) {
    const sites = await prisma.site.findMany({
      where: { id: { in: siteIds }, deletedAt: null },
      select: {
        id: true,
        name: true,
        learnStatus: true,
        siteProfile: true,
        avgListings: true,
        maxPages: true,
      },
    });

    let totalEstimatedMinutes = 0;
    let totalEstimatedListings = 0;
    let unlearnedCount = 0;

    const perSite = sites.map((site) => {
      const profile = site.siteProfile as Record<string, any> | null;

      if (site.learnStatus !== "LEARNED" || !profile?.estimates) {
        unlearnedCount++;
        // Rough estimate for unlearned sites
        const roughMinutes = 8; // ~8 min per unlearned site (LLM navigation + extraction)
        const roughListings = site.avgListings || 30;
        totalEstimatedMinutes += roughMinutes;
        totalEstimatedListings += roughListings;
        return {
          siteId: site.id,
          siteName: site.name,
          learned: false,
          estimatedMinutes: roughMinutes,
          estimatedListings: roughListings,
          confidence: null,
        };
      }

      const estimates = profile.estimates as Record<string, number>;
      const minutes = estimates.scrapeTimeMinutes || 5;
      const listings = estimates.totalListings || site.avgListings || 0;
      const confidence = (profile.validation as Record<string, number>)?.confidence || 0;

      totalEstimatedMinutes += minutes;
      totalEstimatedListings += listings;

      return {
        siteId: site.id,
        siteName: site.name,
        learned: true,
        estimatedMinutes: Math.round(minutes),
        estimatedListings: listings,
        confidence: Math.round(confidence * 100),
      };
    });

    return {
      totalEstimatedMinutes: Math.round(totalEstimatedMinutes),
      totalEstimatedListings,
      perSite,
      unlearnedCount,
    };
  }
}
