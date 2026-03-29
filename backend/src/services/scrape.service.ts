import sanitizeHtml from "sanitize-html";
import prisma from "../prismaClient";
import { ScrapeJobStatus, Prisma } from "@prisma/client";
import { PropertyService } from "./property.service";
import { SiteService } from "./site.service";
import { SiteIntelligenceService } from "./siteIntelligence.service";
import { NotificationService } from "./notification.service";
import { config } from "../config/env";
import { Logger } from "../utils/logger.util";

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

// Fields that exist on the Prisma Property model (whitelist)
const PROPERTY_SCHEMA_FIELDS = new Set([
  "title", "listingUrl", "source", "siteId", "status", "verificationStatus",
  "listingType", "category",
  "propertyType", "propertySubtype", "bedrooms", "bathrooms", "toilets", "bq",
  "landSize", "landSizeSqm", "buildingSize", "buildingSizeSqm", "plotDimensions",
  "yearBuilt", "renovationYear", "furnishing", "condition", "floors",
  "unitsAvailable", "description",
  "price", "priceCurrency", "pricePerSqm", "pricePerBedroom",
  "initialDeposit", "paymentPlan", "serviceCharge", "serviceChargeFreq",
  "legalFees", "agentCommission", "priceNegotiable", "rentFrequency",
  "fullAddress", "locationText", "estateName", "streetName", "area", "lga",
  "state", "country", "latitude", "longitude", "landmarks",
  "features", "security", "utilities", "parkingSpaces",
  "images", "videos", "virtualTourUrl", "floorPlanUrl",
  "agentName", "agentPhone", "agentEmail", "contactInfo", "agencyName",
  "agencyLogo", "agentVerified",
  "scrapeTimestamp", "searchKeywords", "promoTags", "titleTag",
  "isPremium", "isFeatured", "isHotDeal", "qualityScore",
]);

function sanitizeScrapedProperty(prop: Record<string, unknown>): Record<string, unknown> {
  const textFields = [
    "title", "description", "locationText", "fullAddress",
    "agentName", "agentPhone", "agentEmail", "agencyName",
    "propertyType", "propertySubtype", "estateName", "streetName",
    "area", "lga", "state", "country",
  ];

  // Strip fields that aren't in the Prisma schema (e.g. priceText, features_text, location_text)
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(prop)) {
    if (PROPERTY_SCHEMA_FIELDS.has(key)) {
      sanitized[key] = val;
    }
  }

  // HTML-sanitize text fields
  for (const field of textFields) {
    const val = sanitized[field];
    if (typeof val === "string") {
      sanitized[field] = sanitizeHtml(val, SANITIZE_OPTS).trim();
    }
  }

  // Ensure required string fields are not empty
  if (!sanitized["listingUrl"]) {
    sanitized["listingUrl"] = sanitized["source"]
      ? `https://unknown.source/${crypto.randomUUID()}`
      : `https://unknown/${crypto.randomUUID()}`;
  }

  // Validate enum fields — Prisma rejects unknown enum values
  const LISTING_TYPES = new Set(["SALE", "RENT", "LEASE", "SHORTLET"]);
  if (sanitized["listingType"] && !LISTING_TYPES.has(sanitized["listingType"] as string)) {
    // Try to map common variants
    const lt = String(sanitized["listingType"]).toUpperCase().replace(/[^A-Z]/g, "");
    sanitized["listingType"] = LISTING_TYPES.has(lt) ? lt : "SALE";
  }
  if (!sanitized["listingType"]) {
    sanitized["listingType"] = "SALE";
  }

  const CATEGORIES = new Set(["RESIDENTIAL", "COMMERCIAL", "LAND", "SHORTLET", "INDUSTRIAL"]);
  if (sanitized["category"] && !CATEGORIES.has(sanitized["category"] as string)) {
    sanitized["category"] = "RESIDENTIAL";
  }

  const FURNISHINGS = new Set(["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED", "UNKNOWN"]);
  if (sanitized["furnishing"]) {
    const f = String(sanitized["furnishing"]).toUpperCase().replace(/[\s-]+/g, "_");
    sanitized["furnishing"] = FURNISHINGS.has(f) ? f : undefined;
  }

  const CONDITIONS = new Set(["NEW", "GOOD", "FAIR", "NEEDS_RENOVATION", "UNKNOWN"]);
  if (sanitized["condition"]) {
    const c = String(sanitized["condition"]).toUpperCase().replace(/[\s-]+/g, "_");
    sanitized["condition"] = CONDITIONS.has(c) ? c : undefined;
  }

  const STATUSES = new Set(["AVAILABLE", "SOLD", "RENTED", "UNDER_OFFER", "WITHDRAWN", "EXPIRED"]);
  if (sanitized["status"] && !STATUSES.has(sanitized["status"] as string)) {
    sanitized["status"] = "AVAILABLE";
  }

  const V_STATUSES = new Set(["UNVERIFIED", "VERIFIED", "FLAGGED", "REJECTED"]);
  if (sanitized["verificationStatus"] && !V_STATUSES.has(sanitized["verificationStatus"] as string)) {
    sanitized["verificationStatus"] = "UNVERIFIED";
  }

  // Remove undefined values — let Prisma use defaults
  for (const key of Object.keys(sanitized)) {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key];
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
  // Batch size — 5 sites per GH Actions runner (proven reliable, avoids timeouts)
  static readonly BATCH_SIZE = 5;

  /**
   * Start a new scrape job — creates a DB record and dispatches to the Python scraper.
   * When there are many sites, splits into batches dispatched as parallel GH Actions runs.
   */
  static async startJob(input: StartJobInput, userId?: string) {
    const { siteIds, type = "PASSIVE_BULK", maxListingsPerSite = 100, parameters, searchQuery } = input;

    // Guard: prevent concurrent scrape jobs
    const existingJob = await prisma.scrapeJob.findFirst({
      where: {
        status: { in: ["RUNNING", "PENDING"] },
        type: { not: "LEARN_SITE" },
      },
      select: { id: true, status: true, startedAt: true },
    });

    if (existingJob) {
      throw new Error(
        "A scrape job is already running. Please wait for it to complete or cancel it first."
      );
    }

    // Fetch site configs
    const sites = await prisma.site.findMany({
      where: { id: { in: siteIds }, enabled: true, deletedAt: null },
    });

    if (sites.length === 0) {
      throw new Error("No valid enabled sites found for the given IDs");
    }

    // Check for unlearned sites — skip them instead of blocking the scrape with synchronous learning
    const unlearnedSites = sites.filter(s => s.learnStatus !== "LEARNED");
    if (unlearnedSites.length > 0) {
      Logger.warn(
        `Skipping ${unlearnedSites.length} unlearned site(s) from scrape: ` +
        unlearnedSites.map(s => s.name).join(", ") +
        `. Use learnAndScrape() or learn them first via Site Intelligence.`
      );
      // Remove unlearned sites from this scrape run
      const unlearnedIds = new Set(unlearnedSites.map(s => s.id));
      const learnedSites = sites.filter(s => !unlearnedIds.has(s.id));
      if (learnedSites.length === 0) {
        throw new Error(
          "All selected sites are unlearned. Please learn them first via Site Intelligence before scraping."
        );
      }
      // Replace `sites` with only learned ones for the rest of the method
      sites.length = 0;
      sites.push(...learnedSites);
    }

    // Split sites into batches
    const totalBatches = Math.ceil(sites.length / ScrapeService.BATCH_SIZE);

    // Create ScrapeJob record — store batch tracking info in parameters
    const jobParams = {
      ...(parameters || {}),
      ...(totalBatches > 1 ? { totalBatches, completedBatches: 0 } : {}),
    };

    const job = await prisma.scrapeJob.create({
      data: {
        type,
        status: "PENDING",
        siteIds,
        sites: { connect: sites.map((s) => ({ id: s.id })) },
        createdById: userId || undefined,
        parameters: jobParams as Prisma.InputJsonValue,
        searchQuery,
        startedAt: new Date(),
      },
      include: {
        sites: { select: { id: true, name: true, baseUrl: true } },
      },
    });

    const callbackUrl = config.env === "production"
      ? `${process.env.API_BASE_URL || "https://realtors-practice-new-api.onrender.com/api"}`
      : `http://localhost:${config.port}/api`;

    // Read SI settings for CSS confidence threshold
    let cssConfidenceThreshold = 50;
    try {
      const siSettings = await SiteIntelligenceService.getSettings();
      cssConfidenceThreshold = siSettings.si_css_confidence_threshold;
    } catch (err: any) {
      Logger.warn(`Failed to read SI settings for scrape, using default: ${err.message}`);
    }

    // Build site payload configs
    const sitePayloads = sites.map((site) => {
      const selectors = (site.selectors || {}) as Record<string, any>;
      const detailSelectors = (site.detailSelectors || selectors) as Record<string, any>;
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
    });

    // Create batch payloads
    const batches: Array<{ sites: typeof sitePayloads; batchIndex: number }> = [];
    for (let i = 0; i < sitePayloads.length; i += ScrapeService.BATCH_SIZE) {
      batches.push({
        sites: sitePayloads.slice(i, i + ScrapeService.BATCH_SIZE),
        batchIndex: batches.length,
      });
    }

    Logger.info(
      `Scrape dispatch: ${sites.length} sites → ${batches.length} batch(es) of ≤${ScrapeService.BATCH_SIZE}. ` +
      `GITHUB_PAT=${config.github.pat ? "set" : "MISSING"}, GITHUB_REPO=${config.github.repo}`
    );

    let dispatchedCount = 0;

    // Method 1: GitHub Actions (primary — full Playwright + Chromium environment)
    if (config.github.pat && config.github.repo) {
      const [owner, repo] = config.github.repo.split("/");

      for (const batch of batches) {
        const scraperPayload = {
          jobId: job.id,
          sites: batch.sites,
          maxListingsPerSite,
          cssConfidenceThreshold,
          callbackUrl,
          parameters: {
            ...(parameters || {}),
            batchIndex: batch.batchIndex,
            totalBatches,
          },
        };

        try {
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
                  scraperPayload: scraperPayload,
                },
              }),
              signal: AbortSignal.timeout(10000),
            }
          );

          if (response.status === 204 || response.ok) {
            dispatchedCount++;
            const siteNames = batch.sites.map((s) => s.name).join(", ");
            Logger.info(
              `Batch ${batch.batchIndex + 1}/${totalBatches} dispatched to GH Actions: ${siteNames}`
            );
          } else {
            const body = await response.text();
            Logger.warn(
              `Batch ${batch.batchIndex + 1}/${totalBatches} GH dispatch failed: ${response.status} — ${body}`
            );
          }
        } catch (err: any) {
          Logger.warn(`Batch ${batch.batchIndex + 1}/${totalBatches} GH dispatch error: ${err.message}`);
        }

        // Brief delay between dispatches to avoid GitHub API rate limits
        if (batches.length > 1 && batch.batchIndex < batches.length - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    // Method 2: Direct HTTP fallback — send ALL sites as a single payload (no batching needed
    // since the scraper handles them sequentially anyway and there's no GH Actions timeout)
    if (dispatchedCount === 0) {
      Logger.warn(`GitHub Actions dispatch skipped/failed, falling back to direct HTTP (scraper URL: ${config.scraper.url})`);

      const scraperPayload = {
        jobId: job.id,
        sites: sitePayloads,
        maxListingsPerSite,
        cssConfidenceThreshold,
        callbackUrl,
        parameters: parameters || {},
      };

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

        dispatchedCount = 1;
        Logger.info(`Scrape job ${job.id} dispatched directly to scraper via HTTP (${sites.length} sites)`);
      } catch (err: any) {
        Logger.warn(`Direct HTTP dispatch also failed: ${err.message}`);
      }
    }

    if (dispatchedCount > 0) {
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: { status: "RUNNING" },
      });
      Logger.info(
        `Job ${job.id} RUNNING: ${dispatchedCount}/${batches.length} batches dispatched (${sites.length} sites total)`
      );
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
   * Learn unlearned sites first, then start a scrape job.
   * Unlike startJob() which skips unlearned sites, this method dispatches
   * learn jobs for them and then starts the scrape (with only already-learned sites).
   */
  static async learnAndScrape(input: StartJobInput, userId?: string) {
    const sites = await prisma.site.findMany({
      where: { id: { in: input.siteIds }, enabled: true, deletedAt: null },
      select: { id: true, name: true, learnStatus: true },
    });

    const unlearnedSites = sites.filter(s => s.learnStatus !== "LEARNED");

    // Dispatch learn jobs for unlearned sites (non-blocking)
    if (unlearnedSites.length > 0) {
      Logger.info(
        `learnAndScrape: dispatching learn for ${unlearnedSites.length} unlearned site(s): ` +
        unlearnedSites.map(s => s.name).join(", ")
      );
      for (const site of unlearnedSites) {
        try {
          await SiteIntelligenceService.learnSite(site.id, userId);
          Logger.info(`Learn dispatched for ${site.name} (${site.id})`);
        } catch (err: any) {
          Logger.warn(`Learn dispatch failed for ${site.name}: ${err.message}`);
        }
      }
    }

    // Start scrape with whatever sites are already learned
    // startJob() will filter out unlearned ones automatically
    return this.startJob(input, userId);
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
    let errCount = 0;

    for (const rawProp of properties) {
      try {
        const prop = sanitizeScrapedProperty(rawProp as Record<string, unknown>);
        const result = await PropertyService.create(
          prop as any,
          "SCRAPER",
          undefined,
          "SCRAPED"
        );
        if (result.duplicate) {
          dupCount++;
        } else {
          newCount++;
          // Broadcast live feed for each new property
          broadcastScrapeProperty(jobId, prop);
        }
      } catch (err: any) {
        errCount++;
        Logger.error(`Failed to upsert property (title="${(rawProp as any).title}", listingUrl="${(rawProp as any).listingUrl}"): ${err.message}`);
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
          errors: { increment: errCount },
        },
      });
      Logger.info(
        `Job ${jobId} incremental: +${newCount} new, +${dupCount} dups, +${errCount} errs (batch of ${properties.length})`
      );
    } else {
      // A batch has finished — check if this is a multi-batch job
      const jobParams = (job.parameters || {}) as Record<string, any>;
      const totalBatches = jobParams.totalBatches as number || 1;

      // Get current totals (from incremental batches) and add final batch
      const currentJob = await prisma.scrapeJob.findUnique({ where: { id: jobId } });
      const prevNew = currentJob?.newListings ?? 0;
      const prevDups = currentJob?.duplicates ?? 0;
      const prevTotal = currentJob?.totalListings ?? 0;

      if (totalBatches > 1) {
        // Multi-batch job: increment completedBatches, only finish when all done
        const completedBatches = (jobParams.completedBatches as number || 0) + 1;
        const updatedParams = { ...jobParams, completedBatches };

        // Warn if completedBatches exceeds totalBatches (shouldn't happen)
        if (completedBatches > totalBatches) {
          Logger.warn(
            `Job ${jobId} batch mismatch: completedBatches (${completedBatches}) > totalBatches (${totalBatches}). ` +
            `Possible duplicate callback — completing job anyway.`
          );
        }

        const allDone = completedBatches >= totalBatches;
        const batchErrors = errCount + ((stats.totalErrors as number) || 0);
        const durationMs = allDone && job.startedAt
          ? Date.now() - new Date(job.startedAt).getTime()
          : undefined;

        await prisma.scrapeJob.update({
          where: { id: jobId },
          data: {
            parameters: updatedParams as Prisma.InputJsonValue,
            totalListings: prevTotal + properties.length,
            newListings: prevNew + newCount,
            duplicates: prevDups + dupCount,
            errors: { increment: batchErrors },
            ...(allDone ? {
              status: "COMPLETED",
              completedAt: new Date(),
              durationMs,
            } : {}),
          },
        });

        const totalErrors = (currentJob?.errors ?? 0) + batchErrors;

        Logger.info(
          `Job ${jobId} batch ${completedBatches}/${totalBatches} done: ` +
          `+${newCount} new, +${dupCount} dups, +${batchErrors} errs` +
          (allDone ? " — ALL BATCHES COMPLETE" : "")
        );

        if (allDone) {
          const finalNew = prevNew + newCount;
          const finalDups = prevDups + dupCount;
          const finalTotal = prevTotal + properties.length;

          for (const siteId of job.siteIds) {
            await SiteService.updateHealth(siteId, true, finalNew);
          }

          // Log a final summary for easy debugging
          Logger.info(
            `[SCRAPE SUMMARY] Job ${jobId}: ${finalNew} new, ${finalDups} duplicates, ` +
            `${totalErrors} errors, ${finalTotal} total processed, ` +
            `duration ${durationMs ? Math.round(durationMs / 1000) + "s" : "unknown"}`
          );

          broadcastScrapeComplete(jobId, {
            totalListings: finalTotal,
            newListings: finalNew,
            duplicates: finalDups,
            errors: totalErrors,
            durationMs,
          });

          // Create notification for job creator
          if (job.createdById) {
            try {
              await NotificationService.create({
                userId: job.createdById,
                type: "SCRAPE_COMPLETE",
                title: "Scrape completed",
                message: `Found ${finalNew} new ${finalNew === 1 ? "property" : "properties"}, ${finalDups} duplicates, ${totalErrors} errors. Total processed: ${finalTotal}.`,
                data: { jobId, totalListings: finalTotal, newListings: finalNew, duplicates: finalDups, errors: totalErrors, durationMs },
              });
            } catch (err: any) {
              Logger.warn(`Failed to create scrape-complete notification: ${err.message}`);
            }
          }
        }
      } else {
        // Single-batch job — original behavior
        const durationMs = job.startedAt
          ? Date.now() - new Date(job.startedAt).getTime()
          : undefined;

        const totalErrors = errCount + ((stats.totalErrors as number) || 0);
        const finalNew = prevNew + newCount;
        const finalDups = prevDups + dupCount;
        const finalTotal = prevTotal + properties.length;

        await prisma.scrapeJob.update({
          where: { id: jobId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            totalListings: finalTotal,
            newListings: finalNew,
            duplicates: finalDups,
            errors: totalErrors,
            durationMs,
          },
        });

        for (const siteId of job.siteIds) {
          await SiteService.updateHealth(siteId, true, finalNew);
        }

        // Log a final summary for easy debugging
        Logger.info(
          `[SCRAPE SUMMARY] Job ${jobId}: ${finalNew} new, ${finalDups} duplicates, ` +
          `${totalErrors} errors, ${finalTotal} total processed, ` +
          `duration ${durationMs ? Math.round(durationMs / 1000) + "s" : "unknown"}`
        );

        broadcastScrapeComplete(jobId, {
          totalListings: finalTotal,
          newListings: finalNew,
          duplicates: finalDups,
          errors: totalErrors,
          durationMs,
        });

        // Create notification for job creator
        if (job.createdById) {
          try {
            await NotificationService.create({
              userId: job.createdById,
              type: "SCRAPE_COMPLETE",
              title: "Scrape completed",
              message: `Found ${finalNew} new ${finalNew === 1 ? "property" : "properties"}, ${finalDups} duplicates, ${totalErrors} errors. Total processed: ${finalTotal}.`,
              data: { jobId, totalListings: finalTotal, newListings: finalNew, duplicates: finalDups, errors: totalErrors, durationMs },
            });
          } catch (err: any) {
            Logger.warn(`Failed to create scrape-complete notification: ${err.message}`);
          }
        }
      }
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
   * For multi-batch jobs, a single batch failure doesn't fail the whole job —
   * it counts as a completed batch. Only if ALL batches fail does the job fail.
   */
  static async handleError(jobId: string, error: string, details?: any) {
    const isCancelled = typeof details === "object" && details?.status === "CANCELLED";
    const job = await prisma.scrapeJob.findUnique({ where: { id: jobId } });

    if (!job) {
      Logger.warn(`handleError: job ${jobId} not found`);
      return;
    }

    const jobParams = (job.parameters || {}) as Record<string, any>;
    const totalBatches = jobParams.totalBatches as number || 1;

    if (totalBatches > 1 && !isCancelled) {
      // Multi-batch: treat this batch as done (with errors), don't fail the whole job yet
      const completedBatches = (jobParams.completedBatches as number || 0) + 1;
      const failedBatches = (jobParams.failedBatches as number || 0) + 1;
      const updatedParams = { ...jobParams, completedBatches, failedBatches };
      const allDone = completedBatches >= totalBatches;

      const updateData: any = {
        parameters: updatedParams as Prisma.InputJsonValue,
      };

      if (allDone) {
        // All batches finished — if ALL failed, mark job as FAILED; otherwise COMPLETED
        const allFailed = failedBatches >= totalBatches;
        updateData.status = allFailed ? "FAILED" : "COMPLETED";
        updateData.completedAt = new Date();
        if (job.startedAt) {
          updateData.durationMs = Date.now() - new Date(job.startedAt).getTime();
        }
      }

      await prisma.scrapeJob.update({ where: { id: jobId }, data: updateData });

      Logger.warn(
        `Job ${jobId} batch error (${completedBatches}/${totalBatches} done, ${failedBatches} failed): ${error}`
      );

      if (allDone) {
        if (failedBatches >= totalBatches) {
          for (const siteId of job.siteIds) {
            await SiteService.updateHealth(siteId, false);
          }
          broadcastScrapeError(jobId, `All ${totalBatches} batches failed. Last error: ${error}`);

          // Create SCRAPE_FAILED notification for job creator
          if (job.createdById) {
            try {
              await NotificationService.create({
                userId: job.createdById,
                type: "SCRAPE_FAILED",
                title: "Scrape failed",
                message: `All ${totalBatches} batches failed. Last error: ${error.slice(0, 200)}`,
                data: { jobId, error, totalBatches, failedBatches },
              });
            } catch (err: any) {
              Logger.warn(`Failed to create scrape-failed notification: ${err.message}`);
            }
          }
        } else {
          broadcastScrapeComplete(jobId, {
            totalListings: job.totalListings,
            newListings: job.newListings,
            duplicates: job.duplicates,
            errors: job.errors,
          });
        }
      }
    } else {
      // Single-batch job or cancellation — original behavior
      const finalStatus = isCancelled ? "CANCELLED" : "FAILED";
      const durationMs = job.startedAt
        ? Date.now() - new Date(job.startedAt).getTime()
        : undefined;

      await prisma.scrapeJob.update({
        where: { id: jobId },
        data: { status: finalStatus, completedAt: new Date(), durationMs },
      });

      if (!isCancelled) {
        for (const siteId of job.siteIds) {
          await SiteService.updateHealth(siteId, false);
        }
      }

      broadcastScrapeError(jobId, error);
      Logger.error(`Job ${jobId} ${finalStatus}: ${error}`);

      // Create SCRAPE_FAILED notification for job creator
      if (!isCancelled && job.createdById) {
        try {
          await NotificationService.create({
            userId: job.createdById,
            type: "SCRAPE_FAILED",
            title: "Scrape failed",
            message: `Job failed: ${error.slice(0, 200)}`,
            data: { jobId, error },
          });
        } catch (err: any) {
          Logger.warn(`Failed to create scrape-failed notification: ${err.message}`);
        }
      }
    }
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
