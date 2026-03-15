import { Router, Request, Response } from "express";
import { internalAuth } from "../middlewares/internal.middleware";
import { ScrapeService } from "../services/scrape.service";
import { Logger } from "../utils/logger.util";
import { withCallbackRetry } from "../utils/callbackRetry.util";
import prisma from "../prismaClient";

const router = Router();

// All internal routes require X-Internal-Key
router.use(internalAuth);

/**
 * POST /internal/scrape-results
 * Receive final scraped properties from Python scraper.
 */
router.post("/scrape-results", async (req: Request, res: Response) => {
  try {
    const { jobId, properties, stats } = req.body;
    if (!jobId || !properties) {
      return res.status(400).json({ error: "jobId and properties required" });
    }

    // Process async with retry — respond immediately
    withCallbackRetry({
      jobId,
      endpoint: "/internal/scrape-results",
      payload: { jobId, propertyCount: properties.length, stats },
      handler: () => ScrapeService.handleResults(jobId, properties, stats || {}),
    }).catch((err) =>
      Logger.error(`Error processing results for ${jobId}: ${err.message}`)
    );

    return res.json({ success: true, message: "Results received" });
  } catch (err: any) {
    Logger.error(`Internal scrape-results error: ${err.message}`);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /internal/scrape-progress
 * Receive progress updates from Python scraper.
 */
router.post("/scrape-progress", async (req: Request, res: Response) => {
  try {
    const { jobId, processed, total, currentSite, message, currentPage, maxPages, pagesFetched, propertiesFound, duplicates, errors } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: "jobId required" });
    }

    await ScrapeService.handleProgress(jobId, {
      processed, total, currentSite, message,
      currentPage, maxPages, pagesFetched, propertiesFound, duplicates, errors,
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /internal/scrape-property
 * Receive a single scraped property for live feed display.
 */
router.post("/scrape-property", async (req: Request, res: Response) => {
  try {
    const { jobId, property } = req.body;
    if (!jobId || !property) {
      return res.status(400).json({ error: "jobId and property required" });
    }

    await ScrapeService.handleProperty(jobId, property);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /internal/scrape-error
 * Receive error report from Python scraper.
 */
router.post("/scrape-error", async (req: Request, res: Response) => {
  try {
    const { jobId, error, details } = req.body;
    if (!jobId || !error) {
      return res.status(400).json({ error: "jobId and error required" });
    }

    await withCallbackRetry({
      jobId,
      endpoint: "/internal/scrape-error",
      payload: { jobId, error, details },
      handler: () => ScrapeService.handleError(jobId, error, details),
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /internal/scrape-log
 * Receive log entries from Python scraper (for live streaming).
 */
router.post("/scrape-log", async (req: Request, res: Response) => {
  try {
    const { jobId, level, message, details } = req.body;
    if (!jobId || !message) {
      return res.status(400).json({ error: "jobId and message required" });
    }

    await ScrapeService.handleLog(jobId, level || "INFO", message, details);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /internal/scrape/scheduled
 * Triggered by GitHub Actions cron — starts a SCHEDULED scrape across all enabled sites.
 * Uses X-Internal-Key auth (no Supabase JWT required).
 */
router.post("/scrape/scheduled", async (req: Request, res: Response) => {
  try {
    const sites = await prisma.site.findMany({
      where: { enabled: true, deletedAt: null },
      select: { id: true },
    });

    if (sites.length === 0) {
      return res.status(200).json({ success: true, message: "No enabled sites — nothing to scrape" });
    }

    const siteIds = sites.map((s) => s.id);
    const job = await ScrapeService.startJob({ siteIds, type: "SCHEDULED" });

    Logger.info(`Scheduled scrape triggered via GitHub Actions: job ${job.id}, ${siteIds.length} sites`);
    return res.json({ success: true, jobId: job.id, sites: siteIds.length });
  } catch (err: any) {
    Logger.error(`Scheduled scrape trigger failed: ${err.message}`);
    return res.status(500).json({ error: err.message || "Failed to start scheduled scrape" });
  }
});

export default router;
