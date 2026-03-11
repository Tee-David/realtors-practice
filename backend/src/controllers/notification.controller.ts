import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";

export class NotificationController {
  static async list(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const read = req.query.read !== undefined ? req.query.read === "true" : undefined;

      const result = await NotificationService.list(req.user!.id, { read, limit, offset });
      return sendPaginated(res, {
        notifications: result.notifications,
        unreadCount: result.unreadCount,
      }, result.total, Math.floor(offset / limit) + 1, limit);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to fetch notifications");
    }
  }

  static async getUnreadCount(req: Request, res: Response) {
    try {
      const count = await NotificationService.getUnreadCount(req.user!.id);
      return sendSuccess(res, { count });
    } catch (err: any) {
      return sendError(res, err.message || "Failed to get unread count");
    }
  }

  static async markRead(req: Request, res: Response) {
    try {
      const result = await NotificationService.markRead(req.params.id, req.user!.id);
      if (!result) return sendError(res, "Notification not found", 404);
      return sendSuccess(res, result, "Notification marked as read");
    } catch (err: any) {
      return sendError(res, err.message || "Failed to mark notification as read");
    }
  }

  static async markAllRead(req: Request, res: Response) {
    try {
      await NotificationService.markAllRead(req.user!.id);
      return sendSuccess(res, null, "All notifications marked as read");
    } catch (err: any) {
      return sendError(res, err.message || "Failed to mark all as read");
    }
  }
}
