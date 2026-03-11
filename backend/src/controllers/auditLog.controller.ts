import { Request, Response } from "express";
import prisma from "../prismaClient";
import { sendSuccess, sendError, sendPaginated } from "../utils/apiResponse.util";

export class AuditLogController {
  /**
   * List audit logs with filters (Admin only)
   */
  static async list(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const { action, entity, userId, startDate, endDate } = req.query;

      const where: any = {};
      if (action) where.action = action as string;
      if (entity) where.entity = entity as string;
      if (userId) where.userId = userId as string;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return sendPaginated(res, logs, total, Math.floor(offset / limit) + 1, limit);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to fetch audit logs");
    }
  }

  /**
   * Get a single audit log entry (Admin only)
   */
  static async getById(req: Request, res: Response) {
    try {
      const log = await prisma.auditLog.findUnique({
        where: { id: req.params.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!log) return sendError(res, "Audit log entry not found", 404);
      return sendSuccess(res, log);
    } catch (err: any) {
      return sendError(res, err.message || "Failed to fetch audit log entry");
    }
  }
}
