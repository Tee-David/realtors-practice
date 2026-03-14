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

export class UserController {
  /**
   * Get all users (Admin only)
   */
  public static async getAllUsers(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatarUrl: true,
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

      if (targetUser.email.toLowerCase() === "wedigcreativity@gmail.com" && req.user!.email.toLowerCase() !== "wedigcreativity@gmail.com") {
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

      if (targetUser.email.toLowerCase() === "wedigcreativity@gmail.com") {
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
}
