import { Request, Response } from "express";
import { ScrapeService } from "../services/scrape.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";
import { logAudit, getClientInfo } from "../middlewares/auditLog.middleware";

export class ScrapeController {
  static async startJob(req: Request, res: Response) {
    try {
      const { siteIds, type, maxListingsPerSite, parameters, searchQuery } = req.body;

      if (!siteIds || !Array.isArray(siteIds) || siteIds.length === 0) {
        return sendError(res, "siteIds must be a non-empty array", 400);
      }

      const job = await ScrapeService.startJob(
        { siteIds, type, maxListingsPerSite, parameters, searchQuery },
        req.user?.id
      );

      void logAudit({
        userId: (req as any).user?.id,
        action: "START_SCRAPE",
        entity: "ScrapeJob",
        entityId: job.id,
        details: { siteIds, type, maxListingsPerSite },
        ...getClientInfo(req),
      });
      return sendSuccess(res, job, "Scrape job started", 201);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to start scrape job", 500);
    }
  }

  static async listJobs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      const { data, total } = await ScrapeService.getJobs({ page, limit, status });
      return sendPaginated(res, data, total, page, limit);
    } catch (err) {
      return sendError(res, "Failed to fetch scrape jobs");
    }
  }

  static async getJob(req: Request, res: Response) {
    try {
      const job = await ScrapeService.getJob(req.params.id);
      if (!job) return sendError(res, "Job not found", 404);
      return sendSuccess(res, job);
    } catch (err) {
      return sendError(res, "Failed to fetch scrape job");
    }
  }

  static async listLogs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const jobId = req.query.jobId as string | undefined;
      const level = req.query.level as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const search = req.query.search as string | undefined;
      const siteId = req.query.siteId as string | undefined;

      const { data, total } = await ScrapeService.getLogs({
        page, limit, jobId, level, from, to, search, siteId,
      });
      return sendPaginated(res, data, total, page, limit);
    } catch (err) {
      return sendError(res, "Failed to fetch scrape logs");
    }
  }

  static async getLog(req: Request, res: Response) {
    try {
      const log = await ScrapeService.getLog(req.params.id);
      if (!log) return sendError(res, "Log not found", 404);
      return sendSuccess(res, log);
    } catch (err) {
      return sendError(res, "Failed to fetch scrape log");
    }
  }

  static async stopJob(req: Request, res: Response) {
    try {
      const job = await ScrapeService.stopJob(req.params.id);
      if (!job) return sendError(res, "Job not found", 404);
      void logAudit({
        userId: (req as any).user?.id,
        action: "STOP_SCRAPE",
        entity: "ScrapeJob",
        entityId: req.params.id,
        ...getClientInfo(req),
      });
      return sendSuccess(res, job, "Job stopped");
    } catch (err: any) {
      return sendError(res, err.message || "Failed to stop job");
    }
  }
}
