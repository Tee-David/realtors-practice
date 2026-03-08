import { Request, Response } from "express";
import { ScrapeService } from "../services/scrape.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";

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

  static async stopJob(req: Request, res: Response) {
    try {
      const job = await ScrapeService.stopJob(req.params.id);
      if (!job) return sendError(res, "Job not found", 404);
      return sendSuccess(res, job, "Job stopped");
    } catch (err: any) {
      return sendError(res, err.message || "Failed to stop job");
    }
  }
}
