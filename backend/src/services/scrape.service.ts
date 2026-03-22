import sanitizeHtml from "sanitize-html";
import prisma from "../prismaClient";
import { ScrapeJobStatus, Prisma } from "@prisma/client";
import { PropertyService } from "./property.service";
import { SiteService } from "./site.service";
import { config } from "../config/env";
import { Logger } from "../utils/logger.util";

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

function sanitizeScrapedProperty(prop: Record<string, unknown>): Record<string, unknown> {
  const textFields = [
    "title", "description", "locationText", "fullAddress",
    "agentName", "agentPhone", "agentEmail", "agencyName",
    "propertyType", "propertySubtype", "estateName", "streetName",
    "area", "lga", "state", "country",
  ];
  const sanitized = { ...prop };
  for (const field of textFields) {
    const val = sanitized[field];
    if (typeof val === "string") {
      sanitized[field] = sanitizeHtml(val, SANITIZE_OPTS).trim();
    }
  }
  return sanitized;
}
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

    // Dispatch scraper — GitHub Actions first (runs Playwright on GH runners),
    // then direct HTTP to Render scraper as fallback.
    let dispatched = false;

    Logger.info(`Scrape dispatch: GITHUB_PAT=${config.github.pat ? "set" : "MISSING"}, GITHUB_REPO=${config.github.repo}`);

    // Method 1: GitHub Actions (primary — full Playwright + Chromium environment)
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
              event_type: "trigger-scrape",
              client_payload: {
                jobId: job.id,
                scraperPayload: JSON.stringify(scraperPayload),
              },
            }),
            signal: AbortSignal.timeout(10000),
          }
        );

        if (response.status === 204 || response.ok) {
          dispatched = true;
          Logger.info(`Scrape job ${job.id} dispatched to GitHub Actions (${sites.length} sites)`);
        } else {
          const body = await response.text();
          throw new Error(`GitHub API responded ${response.status}: ${body}`);
        }
      } catch (err: any) {
        Logger.warn(`GitHub Actions dispatch failed: ${err.message}`);
      }
    }

    // Method 2: Direct HTTP to Python scraper (fallback — Render or local)
    if (!dispatched) {
      Logger.warn(`GitHub Actions dispatch skipped/failed, falling back to direct HTTP (scraper URL: ${config.scraper.url})`);

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
        Logger.warn(`Direct HTTP dispatch also failed: ${err.message}`);
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
      throw new Error("Failed to dispatch scrape job: GitHub Actions and direct HTTP both failed");
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

    // Cancel the GitHub Actions workflow run if one is active
    if (config.github.pat && config.github.repo) {
      try {
        const [owner, repo] = config.github.repo.split("/");
        // Find the running workflow run for this job
        const runsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/runs?status=in_progress&per_page=5`,
          {
            headers: {
              Authorization: `Bearer ${config.github.pat}`,
              Accept: "application/vnd.github.v3+json",
            },
            signal: AbortSignal.timeout(10000),
          }
        );
        if (runsRes.ok) {
          const runsData = await runsRes.json() as { workflow_runs: Array<{ id: number; name: string }> };
          for (const run of runsData.workflow_runs || []) {
            if (run.name === "Scrape Properties" || run.name === "Run Scraper") {
              await fetch(
                `https://api.github.com/repos/${owner}/${repo}/actions/runs/${run.id}/cancel`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${config.github.pat}`,
                    Accept: "application/vnd.github.v3+json",
                  },
                }
              );
              Logger.info(`Cancelled GitHub Actions run ${run.id} for job ${id}`);
              break;
            }
          }
        }
      } catch (err: any) {
        Logger.warn(`Could not cancel GitHub Actions run: ${err.message}`);
      }
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

    const isIncremental = (stats as any).incremental === true;

    let newCount = 0;
    let dupCount = 0;

    for (const rawProp of properties) {
      try {
        const prop = sanitizeScrapedProperty(rawProp as Record<string, unknown>);
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

    if (isIncremental) {
      // Incremental batch — update running totals but don't complete the job
      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: {
          totalListings: { increment: properties.length },
          newListings: { increment: newCount },
          duplicates: { increment: dupCount },
        },
      });
      Logger.info(
        `Job ${jobId} incremental: +${newCount} new, +${dupCount} dups (batch of ${properties.length})`
      );
    } else {
      // Final batch — mark job as completed
      const durationMs = job.startedAt
        ? Date.now() - new Date(job.startedAt).getTime()
        : undefined;

      // Get current totals (from incremental batches) and add final batch
      const currentJob = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
      const prevNew = currentJob?.newListings ?? 0;
      const prevDups = currentJob?.duplicates ?? 0;
      const prevTotal = currentJob?.totalListings ?? 0;

      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          totalListings: prevTotal + properties.length,
          newListings: prevNew + newCount,
          duplicates: prevDups + dupCount,
          errors: (stats.totalErrors as number) || 0,
          durationMs,
        },
      });

      // Update site health for each site
      for (const siteId of job.siteIds) {
        await SiteService.updateHealth(siteId, true, prevNew + newCount);
      }

      // Broadcast completion
      broadcastScrapeComplete(jobId, {
        totalListings: prevTotal + properties.length,
        newListings: prevNew + newCount,
        duplicates: prevDups + dupCount,
        errors: stats.totalErrors || 0,
      });

      Logger.info(
        `Job ${jobId} completed: ${prevNew + newCount} new, ${prevDups + dupCount} dups, ${(stats.totalErrors as number) || 0} errors`
      );
    }
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

    // Persist progress so it survives page navigation
    try {
      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: {
          progressData: data as any,
          totalListings: data.propertiesFound ?? undefined,
          duplicates: data.duplicates ?? undefined,
          errors: data.errors ?? undefined,
        },
      });
    } catch {
      // Non-critical — don't block socket broadcast
    }
  }

  /**
   * Handle error report from scraper.
   */
  static async handleError(jobId: string, error: string, details?: any) {
    // Check if this is a cancellation (from GH Actions workflow cancel)
    const isCancelled = typeof details === "object" && details?.status === "CANCELLED";
    const finalStatus = isCancelled ? "CANCELLED" : "FAILED";

    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: { status: finalStatus, completedAt: new Date() },
    });

    if (!isCancelled) {
      // Update site health only for real failures, not cancellations
      const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
      if (job) {
        for (const siteId of job.siteIds) {
          await SiteService.updateHealth(siteId, false);
        }
      }
    }

    broadcastScrapeError(jobId, error);
    Logger.error(`Job ${jobId} ${finalStatus}: ${error}`);
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
