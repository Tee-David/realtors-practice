import { Request, Response } from "express";
import { BackupService } from "../services/backup.service";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { Logger } from "../utils/logger.util";

export class BackupController {
  static async create(req: Request, res: Response) {
    try {
      const metadata = await BackupService.createBackup();
      return sendSuccess(res, metadata, "Backup created successfully", 201);
    } catch (err: any) {
      Logger.error("Failed to create backup", err);
      return sendError(res, err?.message || "Failed to create backup");
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const backups = await BackupService.listBackups();
      return sendSuccess(res, backups);
    } catch (err: any) {
      Logger.error("Failed to list backups", err);
      return sendError(res, err?.message || "Failed to list backups");
    }
  }

  static async download(req: Request, res: Response) {
    try {
      const backup = await BackupService.getBackup(req.params.id);
      if (!backup) return sendError(res, "Backup not found", 404);

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${backup.metadata.filename}"`
      );
      return res.sendFile(backup.filePath);
    } catch (err: any) {
      Logger.error("Failed to download backup", err);
      return sendError(res, err?.message || "Failed to download backup");
    }
  }

  static async restore(req: Request, res: Response) {
    try {
      const { confirm } = req.body;

      if (!confirm) {
        return sendError(
          res,
          "Restore requires explicit confirmation. Send { confirm: true } in the request body.",
          400
        );
      }

      const result = await BackupService.restoreBackup(req.params.id, confirm);
      return sendSuccess(res, result, "Backup restored successfully");
    } catch (err: any) {
      Logger.error("Failed to restore backup", err);
      return sendError(res, err?.message || "Failed to restore backup");
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const deleted = await BackupService.deleteBackup(req.params.id);
      if (!deleted) return sendError(res, "Backup not found", 404);
      return sendSuccess(res, null, "Backup deleted");
    } catch (err: any) {
      Logger.error("Failed to delete backup", err);
      return sendError(res, err?.message || "Failed to delete backup");
    }
  }

  static async getSchedule(req: Request, res: Response) {
    try {
      const schedule = await BackupService.getSchedule();
      return sendSuccess(res, schedule);
    } catch (err: any) {
      Logger.error("Failed to get backup schedule", err);
      return sendError(res, err?.message || "Failed to get backup schedule");
    }
  }

  static async setSchedule(req: Request, res: Response) {
    try {
      const { frequency, retention } = req.body;

      if (!frequency || retention === undefined) {
        return sendError(
          res,
          "Both frequency and retention are required",
          400
        );
      }

      const schedule = await BackupService.setSchedule(frequency, retention);
      return sendSuccess(res, schedule, "Backup schedule updated");
    } catch (err: any) {
      Logger.error("Failed to set backup schedule", err);
      return sendError(res, err?.message || "Failed to set backup schedule");
    }
  }
}
