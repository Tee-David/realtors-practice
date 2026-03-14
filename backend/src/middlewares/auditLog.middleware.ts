import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";

export interface AuditLogParams {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params });
  } catch (err) {
    Logger.error("[AuditLog] Failed to write audit log", err);
  }
}

export function getClientInfo(req: any): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
  };
}
