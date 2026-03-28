import { Request, Response } from "express";
import prisma from "../prismaClient";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { z } from "zod";
import { logAudit, getClientInfo } from "../middlewares/auditLog.middleware";

const roleSchema = z.object({
  role: z.enum(["ADMIN", "EDITOR", "VIEWER", "API_USER"]),
});

const profileUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  company: z.string().optional(),
  avatarUrl: z.string().optional(),
});

const notifPrefsSchema = z.object({
  notifEmailMatch: z.boolean().optional(),
  notifEmailPriceDrop: z.boolean().optional(),
  notifEmailScrapeComplete: z.boolean().optional(),
  notifInAppMatch: z.boolean().optional(),
  notifInAppPriceDrop: z.boolean().optional(),
  notifInAppScrapeComplete: z.boolean().optional(),
  notifQuietHoursEnabled: z.boolean().optional(),
  notifQuietStart: z.number().int().min(0).max(23).optional(),
  notifQuietEnd: z.number().int().min(0).max(23).optional(),
  notifDigestFrequency: z.enum(["realtime", "daily", "weekly", "never"]).optional(),
});

export class UserController {
  /**
   * Get all users (Admin only)
   */
  public static async getAllUsers(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          loginCount: true,
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return sendSuccess(res, users);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch users");
    }
  }

  /**
   * Update a user's role (Admin only)
   */
  public static async updateUserRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { role } = roleSchema.parse(req.body);

      // Prevent users from removing the last super admin or modifying the super admin (wedigcreativity) unless they are the super admin themselves.
      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser) {
        return sendError(res, "User not found", 404);
      }

      const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || "wedigcreativity@gmail.com")
        .split(",").map((e: string) => e.trim().toLowerCase());
      if (superAdminEmails.includes(targetUser.email.toLowerCase()) && !superAdminEmails.includes(req.user!.email.toLowerCase())) {
        return sendError(res, "Cannot modify the super admin account", 403);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        }
      });

      void logAudit({
        userId: (req as any).user?.id,
        action: "ROLE_CHANGE",
        entity: "User",
        entityId: id,
        details: { newRole: role, previousRole: targetUser.role },
        ...getClientInfo(req),
      });
      return sendSuccess(res, updatedUser, "User role updated successfully");
    } catch (error: any) {
      return sendError(res, error.message || "Failed to update user role");
    }
  }

  /**
   * Toggle user active status (Admin only)
   */
  public static async toggleActive(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser) {
        return sendError(res, "User not found", 404);
      }

      const superEmails = (process.env.SUPER_ADMIN_EMAILS || "wedigcreativity@gmail.com")
        .split(",").map((e: string) => e.trim().toLowerCase());
      if (superEmails.includes(targetUser.email.toLowerCase())) {
        return sendError(res, "Cannot deactivate the super admin account", 403);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: !targetUser.isActive },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      });

      void logAudit({
        userId: (req as any).user?.id,
        action: "DEACTIVATE_USER",
        entity: "User",
        entityId: id,
        details: { isActive: updatedUser.isActive },
        ...getClientInfo(req),
      });
      return sendSuccess(
        res,
        updatedUser,
        `User ${updatedUser.isActive ? "activated" : "deactivated"} successfully`
      );
    } catch (error: any) {
      return sendError(res, error.message || "Failed to toggle user status");
    }
  }

  /**
   * Update own profile
   */
  public static async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const data = profileUpdateSchema.parse(req.body);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatarUrl: true,
        },
      });

      void logAudit({
        userId: (req as any).user?.id,
        action: "UPDATE_USER",
        entity: "User",
        entityId: userId,
        details: { updatedFields: Object.keys(data) },
        ...getClientInfo(req),
      });
      return sendSuccess(res, updatedUser, "Profile updated successfully");
    } catch (error: any) {
      return sendError(res, error.message || "Failed to update profile");
    }
  }

  /**
   * Get notification preferences for authenticated user
   */
  public static async getNotificationPreferences(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, "Unauthorized", 401);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          notifEmailMatch: true,
          notifEmailPriceDrop: true,
          notifEmailScrapeComplete: true,
          notifInAppMatch: true,
          notifInAppPriceDrop: true,
          notifInAppScrapeComplete: true,
          notifQuietHoursEnabled: true,
          notifQuietStart: true,
          notifQuietEnd: true,
          notifDigestFrequency: true,
        },
      });

      if (!user) return sendError(res, "User not found", 404);
      return sendSuccess(res, user);
    } catch (error: any) {
      return sendError(res, error.message || "Failed to fetch notification preferences");
    }
  }

  /**
   * Update notification preferences for authenticated user
   */
  public static async updateNotificationPreferences(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return sendError(res, "Unauthorized", 401);

      const data = notifPrefsSchema.parse(req.body);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
          notifEmailMatch: true,
          notifEmailPriceDrop: true,
          notifEmailScrapeComplete: true,
          notifInAppMatch: true,
          notifInAppPriceDrop: true,
          notifInAppScrapeComplete: true,
          notifQuietHoursEnabled: true,
          notifQuietStart: true,
          notifQuietEnd: true,
          notifDigestFrequency: true,
        },
      });

      return sendSuccess(res, updatedUser, "Notification preferences updated");
    } catch (error: any) {
      return sendError(res, error.message || "Failed to update notification preferences");
    }
  }

  /**
   * Delete a user (Admin only) — soft delete using deletedAt
   */
  public static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser) return sendError(res, "User not found", 404);

      // Prevent deletion of super admin accounts
      const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || "wedigcreativity@gmail.com")
        .split(",").map((e: string) => e.trim().toLowerCase());
      if (superAdminEmails.includes(targetUser.email.toLowerCase())) {
        return sendError(res, "Cannot delete the super admin account", 403);
      }

      // Prevent self-deletion
      if (req.user?.id === id) {
        return sendError(res, "Cannot delete your own account", 400);
      }

      // Soft delete — set deletedAt and deactivate
      const deletedUser = await prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      void logAudit({
        userId: req.user?.id,
        action: "DELETE_USER",
        entity: "User",
        entityId: id,
        details: { deletedEmail: targetUser.email },
        ...getClientInfo(req),
      });

      return sendSuccess(res, deletedUser, "User deleted successfully");
    } catch (error: any) {
      return sendError(res, error.message || "Failed to delete user");
    }
  }
}
