import { Request, Response } from "express";
import prisma from "../prismaClient";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { z } from "zod";

const roleSchema = z.object({
  role: z.enum(["ADMIN", "PENDING_ADMIN", "EDITOR", "VIEWER", "API_USER"]),
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

      return sendSuccess(res, updatedUser, "User role updated successfully");
    } catch (error: any) {
      return sendError(res, error.message || "Failed to update user role");
    }
  }
}
