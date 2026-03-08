import { Router, Request, Response } from "express";
import { internalAuth } from "../middlewares/internal.middleware";
import { ScrapeService } from "../services/scrape.service";
import { Logger } from "../utils/logger.util";

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

    // Process async — respond immediately
    ScrapeService.handleResults(jobId, properties, stats || {}).catch((err) =>
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
    const { jobId, processed, total, currentSite, message } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: "jobId required" });
    }

    await ScrapeService.handleProgress(jobId, { processed, total, currentSite, message });
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

    await ScrapeService.handleError(jobId, error, details);
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

export default router;
