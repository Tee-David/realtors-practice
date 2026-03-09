import { Router, Request, Response } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { supabaseAdmin } from "../utils/supabase";
import prisma from "../prismaClient";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { z } from "zod";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and User Management
 */

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER", "API_USER"]).optional(),
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user (Admin only)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, EDITOR, VIEWER, API_USER]
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input or user already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin role required)
 */
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

      // Force Super Admin role
      const isSuperAdmin = body.email.toLowerCase() === "wedigcreativity@gmail.com";
      const finalRole = isSuperAdmin ? "ADMIN" : (body.role || "VIEWER");

      const user = await prisma.user.create({
        data: {
          supabaseId: authData.user.id,
          email: body.email,
          firstName: body.firstName,
          lastName: body.lastName,
          role: finalRole as 'ADMIN' | 'PENDING_ADMIN' | 'EDITOR' | 'VIEWER' | 'API_USER',
        },
      });

      return sendSuccess(res, user, "User registered successfully", 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  }
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found in database
 */
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
