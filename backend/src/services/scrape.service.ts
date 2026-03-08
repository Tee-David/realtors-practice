import prisma from "../prismaClient";
import { ScrapeJobStatus, Prisma } from "@prisma/client";
import { PropertyService } from "./property.service";
import { SiteService } from "./site.service";
import { config } from "../config/env";
import { Logger } from "../utils/logger.util";
import {
  broadcastScrapeLog,
  broadcastScrapeProgress,
  broadcastScrapeComplete,
  broadcastScrapeError,
} from "../socketServer";

interface StartJobInput {
  siteIds: string[];
  type?: "PASSIVE_BULK" | "ACTIVE_INTENT" | "RESCRAPE" | "SCHEDULED";
  maxListingsPerSite?: number;
  parameters?: Record<string, unknown>;
  searchQuery?: string;
}

export class ScrapeService {
  /**
   * Start a new scrape job — creates a DB record and dispatches to the Python scraper.
   */
  static async startJob(input: StartJobInput, userId?: string) {
    const { siteIds, type = "PASSIVE_BULK", maxListingsPerSite = 100, parameters, searchQuery } = input;

    // Fetch site configs
    const sites = await prisma.site.findMany({
      where: { id: { in: siteIds }, enabled: true, deletedAt: null },
    });

    if (sites.length === 0) {
      throw new Error("No valid enabled sites found for the given IDs");
    }

    // Create ScrapeJob record
    const job = await prisma.scrapeJob.create({
      data: {
        type,
        status: "PENDING",
        siteIds,
        sites: { connect: sites.map((s) => ({ id: s.id })) },
        createdById: userId || undefined,
        parameters: parameters as Prisma.InputJsonValue || undefined,
        searchQuery,
        startedAt: new Date(),
      },
      include: {
        sites: { select: { id: true, name: true, baseUrl: true } },
      },
    });

    // Build payload for the Python scraper
    const scraperPayload = {
      jobId: job.id,
      sites: sites.map((site) => ({
        id: site.id,
        name: site.name,
        baseUrl: site.baseUrl,
        listingSelector: (site.selectors as any)?.listing_link || "a.property-link",
        selectors: site.selectors || {},
        paginationType: site.paginationType,
        paginationConfig: {},
        requiresJs: site.requiresBrowser,
        maxPages: site.maxPages,
      })),
      maxListingsPerSite,
      callbackUrl: `${config.cors.origin}/api/internal`,
      parameters: parameters || {},
    };

    // Dispatch to Python scraper (fire and forget)
    try {
      const response = await fetch(`${config.scraper.url}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": config.scraper.internalKey,
        },
        body: JSON.stringify(scraperPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(`Scraper dispatch failed: ${response.status} ${errorText}`);
        await prisma.scrapeJob.update({
          where: { id: job.id },
          data: { status: "FAILED" },
        });
        throw new Error(`Scraper returned ${response.status}`);
      }

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: "RUNNING" },
      });

      Logger.info(`Scrape job ${job.id} dispatched to scraper (${sites.length} sites)`);
    } catch (err: any) {
      if (err.message?.includes("Scraper returned")) throw err;
      Logger.error(`Failed to reach scraper service: ${err.message}`);
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: "FAILED" },
      });
      throw new Error("Scraper service is unreachable");
    }

    return job;
  }

  /**
   * List scrape jobs with pagination.
   */
  static async getJobs(filters: { page?: number; limit?: number; status?: string }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: Prisma.ScrapeJobWhereInput = {};

    if (filters.status) {
      where.status = filters.status as ScrapeJobStatus;
    }

    const [data, total] = await Promise.all([
      prisma.scrapeJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sites: { select: { id: true, name: true } },
          createdBy: { select: { id: true, email: true, firstName: true } },
          _count: { select: { logs: true } },
        },
      }),
      prisma.scrapeJob.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get a single job with its logs.
   */
  static async getJob(id: string) {
    return prisma.scrapeJob.findUnique({
      where: { id },
      include: {
        sites: { select: { id: true, name: true, baseUrl: true } },
        createdBy: { select: { id: true, email: true, firstName: true } },
        logs: { orderBy: { timestamp: "desc" }, take: 100 },
      },
    });
  }

  /**
   * Stop a running job.
   */
  static async stopJob(id: string) {
    const job = await prisma.scrapeJob.findUnique({ where: { id } });
    if (!job) return null;
    if (job.status !== "RUNNING" && job.status !== "PENDING") {
      throw new Error(`Cannot stop a job with status ${job.status}`);
    }

    // Tell the Python scraper to stop
    try {
      await fetch(`${config.scraper.url}/api/jobs/${id}/stop`, {
        method: "POST",
        headers: { "X-Internal-Key": config.scraper.internalKey },
      });
    } catch (err) {
      Logger.warn(`Could not reach scraper to stop job ${id}`);
    }

    return prisma.scrapeJob.update({
      where: { id },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
  }

  // --- Internal callback handlers (called by Python scraper) ---

  /**
   * Handle final scrape results — upsert properties into DB.
   */
  static async handleResults(
    jobId: string,
    properties: Record<string, unknown>[],
    stats: Record<string, unknown>
  ) {
    const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
    if (!job) {
      Logger.warn(`handleResults: job ${jobId} not found`);
      return;
    }

    let newCount = 0;
    let updatedCount = 0;
    let dupCount = 0;

    for (const prop of properties) {
      try {
        const result = await PropertyService.create(
          prop as any,
          "SCRAPER"
        );
        if (result.duplicate) {
          dupCount++;
        } else {
          newCount++;
        }
      } catch (err: any) {
        Logger.error(`Failed to upsert property: ${err.message}`);
      }
    }

    // Update job stats
    const durationMs = job.startedAt
      ? Date.now() - new Date(job.startedAt).getTime()
      : undefined;

    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalListings: properties.length,
        newListings: newCount,
        duplicates: dupCount,
        errors: (stats.totalErrors as number) || 0,
        durationMs,
      },
    });

    // Update site health for each site
    for (const siteId of job.siteIds) {
      await SiteService.updateHealth(siteId, true, newCount);
    }

    // Broadcast completion
    broadcastScrapeComplete(jobId, {
      totalListings: properties.length,
      newListings: newCount,
      duplicates: dupCount,
      errors: stats.totalErrors || 0,
    });

    Logger.info(
      `Job ${jobId} completed: ${newCount} new, ${dupCount} dups, ${(stats.totalErrors as number) || 0} errors`
    );
  }

  /**
   * Handle progress update from scraper.
   */
  static async handleProgress(
    jobId: string,
    data: { processed: number; total: number; currentSite?: string; message?: string }
  ) {
    broadcastScrapeProgress(jobId, data);
  }

  /**
   * Handle error report from scraper.
   */
  static async handleError(jobId: string, error: string, details?: string) {
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: "FAILED", completedAt: new Date() },
    });

    // Update site health
    const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
    if (job) {
      for (const siteId of job.siteIds) {
        await SiteService.updateHealth(siteId, false);
      }
    }

    broadcastScrapeError(jobId, error);
    Logger.error(`Job ${jobId} failed: ${error}`);
  }

  /**
   * Handle log entry from scraper — persist + broadcast.
   */
  static async handleLog(
    jobId: string,
    level: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    // Persist to DB
    try {
      await prisma.scrapeLog.create({
        data: { jobId, level, message, details: details as Prisma.InputJsonValue || undefined },
      });
    } catch {
      // Job might not exist yet or might be cleaned up
    }

    // Broadcast via Socket.io
    broadcastScrapeLog(jobId, level, message, details);
  }
}
