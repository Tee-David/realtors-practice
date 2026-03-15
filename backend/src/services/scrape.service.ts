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
  broadcastScrapeProperty,
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
    const callbackUrl = config.env === "production"
      ? `${process.env.API_BASE_URL || "https://realtors-practice-new-api.onrender.com/api"}`
      : `http://localhost:${config.port}/api`;

    const scraperPayload = {
      jobId: job.id,
      sites: sites.map((site) => {
        const selectors = (site.selectors || {}) as Record<string, any>;
        const detailSelectors = (site.detailSelectors || selectors) as Record<string, any>;

        // listingSelector is the CSS selector for listing cards/containers on the index page
        // It's separate from the detail page field selectors
        const listingSelector = selectors.listingSelector
          || selectors.listing_container
          || selectors.listing_link
          || "a[href]";

        return {
          id: site.id,
          name: site.name,
          baseUrl: site.baseUrl,
          listPaths: (site as any).listPaths || [],
          listingSelector,
          selectors: detailSelectors,
          paginationType: site.paginationType,
          paginationConfig: selectors.paginationConfig || {},
          requiresJs: site.requiresBrowser,
          maxPages: site.maxPages,
          delayMin: selectors.delayMin || undefined,
          delayMax: selectors.delayMax || undefined,
        };
      }),
      maxListingsPerSite,
      callbackUrl,
      parameters: parameters || {},
    };

    // Map job type to Celery priority (lower = higher priority)
    const priorityMap: Record<string, number> = {
      ACTIVE_INTENT: 1,
      RESCRAPE: 3,
      PASSIVE_BULK: 7,
      SCHEDULED: 7,
    };
    const taskPriority = priorityMap[type] ?? 5;

    // Dispatch to Python scraper — try direct HTTP first (works both locally and
    // in production since the scraper runs jobs in-process). Fall back to
    // Redis/Celery only if direct HTTP fails and a Celery worker is available.
    let dispatched = false;

    // Method 1: Direct HTTP to Python scraper (primary — works everywhere)
    try {
      const response = await fetch(`${config.scraper.url}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": config.scraper.internalKey,
        },
        body: JSON.stringify(scraperPayload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Scraper responded ${response.status}: ${body}`);
      }

      dispatched = true;
      Logger.info(`Scrape job ${job.id} dispatched directly to scraper via HTTP (${sites.length} sites)`);
    } catch (err: any) {
      Logger.warn(`Direct HTTP dispatch failed, trying Redis/Celery: ${err.message}`);
    }

    // Method 2: Redis/Celery queue (fallback — requires a Celery worker)
    if (!dispatched && config.redis.url) {
      try {
        const Redis = require("ioredis");
        const redis = new Redis(config.redis.url, { connectTimeout: 5000, maxRetriesPerRequest: 1 });

        const taskId = `job-${job.id}`;

        // Celery wire protocol v2: body is [args, kwargs, embed]
        const celeryBody = [
          [scraperPayload],  // args
          {},                // kwargs
          { callbacks: null, errbacks: null, chain: null, chord: null },  // embed
        ];

        const payload = {
          body: Buffer.from(JSON.stringify(celeryBody)).toString("base64"),
          "content-encoding": "utf-8",
          "content-type": "application/json",
          headers: {
            lang: "py",
            task: "tasks.process_job",
            id: taskId,
            root_id: taskId,
            parent_id: null,
            group: null,
          },
          properties: {
            correlation_id: taskId,
            reply_to: "",
            delivery_mode: 2,
            delivery_info: { exchange: "", routing_key: "celery" },
            priority: taskPriority,
            body_encoding: "base64",
            delivery_tag: taskId,
          },
        };

        await redis.lpush("celery", JSON.stringify(payload));
        await redis.quit();
        dispatched = true;
        Logger.info(`Scrape job ${job.id} dispatched to Celery Redis queue (${sites.length} sites)`);
      } catch (err: any) {
        Logger.error(`Redis/Celery dispatch also failed: ${err.message}`);
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
      throw new Error("Failed to dispatch scrape job: both Redis and direct HTTP failed");
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

  /**
   * List scrape logs with filtering, pagination, and search.
   */
  static async getLogs(filters: {
    page?: number;
    limit?: number;
    jobId?: string;
    level?: string;
    from?: string;
    to?: string;
    search?: string;
    siteId?: string;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const where: Prisma.ScrapeLogWhereInput = {};

    if (filters.jobId) {
      where.jobId = filters.jobId;
    }

    if (filters.level) {
      where.level = filters.level;
    }

    if (filters.siteId) {
      where.siteId = filters.siteId;
    }

    if (filters.from || filters.to) {
      where.timestamp = {};
      if (filters.from) {
        where.timestamp.gte = new Date(filters.from);
      }
      if (filters.to) {
        where.timestamp.lte = new Date(filters.to);
      }
    }

    if (filters.search) {
      where.message = { contains: filters.search, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      prisma.scrapeLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          job: { select: { id: true, status: true, type: true } },
        },
      }),
      prisma.scrapeLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Get a single scrape log by ID with full details and related job info.
   */
  static async getLog(id: string) {
    return prisma.scrapeLog.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            status: true,
            type: true,
            siteIds: true,
            startedAt: true,
            completedAt: true,
            totalListings: true,
            errors: true,
          },
        },
      },
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
   * Handle a single scraped property — broadcast for live feed.
   */
  static async handleProperty(
    jobId: string,
    property: Record<string, unknown>
  ) {
    broadcastScrapeProperty(jobId, property);
  }

  /**
   * Handle progress update from scraper.
   */
  static async handleProgress(
    jobId: string,
    data: {
      processed: number;
      total: number;
      currentSite?: string;
      message?: string;
      currentPage?: number;
      maxPages?: number;
      pagesFetched?: number;
      propertiesFound?: number;
      duplicates?: number;
      errors?: number;
    }
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
   * Kill stuck scrape jobs that have exceeded the max duration.
   * Called periodically by the cron service.
   */
  static async killStuckJobs() {
    const timeoutMs = config.scraper.jobTimeoutMs ?? 30 * 60 * 1000; // default 30 min
    const cutoff = new Date(Date.now() - timeoutMs);

    const stuckJobs = await prisma.scrapeJob.findMany({
      where: {
        status: { in: ["RUNNING", "PENDING"] },
        startedAt: { lt: cutoff },
      },
    });

    for (const job of stuckJobs) {
      Logger.warn(
        `Killing stuck scrape job ${job.id} — started ${job.startedAt?.toISOString()}, exceeded ${timeoutMs / 60000}m timeout`
      );

      // Try to tell the Python scraper to stop
      try {
        await fetch(`${config.scraper.url}/api/jobs/${job.id}/stop`, {
          method: "POST",
          headers: { "X-Internal-Key": config.scraper.internalKey },
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Scraper may be unreachable, that's fine
      }

      const durationMs = job.startedAt
        ? Date.now() - new Date(job.startedAt).getTime()
        : undefined;

      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          durationMs,
        },
      });

      // Log the timeout
      await prisma.scrapeLog.create({
        data: {
          jobId: job.id,
          level: "ERROR",
          message: `Job killed — exceeded max duration of ${timeoutMs / 60000} minutes`,
        },
      }).catch(() => {});

      broadcastScrapeError(job.id, `Job timed out after ${timeoutMs / 60000} minutes`);

      // Update site health
      for (const siteId of job.siteIds) {
        await SiteService.updateHealth(siteId, false).catch(() => {});
      }
    }

    if (stuckJobs.length > 0) {
      Logger.info(`[TIMEOUT] Killed ${stuckJobs.length} stuck scrape job(s)`);
    }

    return stuckJobs.length;
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
