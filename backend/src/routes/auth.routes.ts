import { Router, Request, Response } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { supabaseAdmin } from "../utils/supabase";
import prisma from "../prismaClient";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { z } from "zod";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER", "API_USER"]).optional(),
});

// POST /api/auth/register (admin only)
router.post(
  "/register",
  authenticate,
  authorize("ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const body = registerSchema.parse(req.body);

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
        });

      if (authError || !authData.user) {
        return sendError(res, authError?.message || "Failed to create user", 400);
      }

      const user = await prisma.user.create({
        data: {
          supabaseId: authData.user.id,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          role: body.role || "VIEWER",
        },
      });

      return sendSuccess(res, user, "User registered successfully", 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  }
);

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return sendError(res, "User not found", 404);
    }

    // Update last login
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    return sendSuccess(res, user);
  } catch (err: any) {
    return sendError(res, err.message);
  }
});

export default router;
