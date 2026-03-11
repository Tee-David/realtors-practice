import { Router, Request, Response } from "express";
import crypto from "crypto";
import { authenticate } from "../middlewares/auth.middleware";
import { authorize } from "../middlewares/role.middleware";
import { supabaseAdmin } from "../utils/supabase";
import prisma from "../prismaClient";
import { sendSuccess, sendError } from "../utils/apiResponse.util";
import { EmailService } from "../services/email.service";
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
          role: finalRole as 'ADMIN' | 'EDITOR' | 'VIEWER' | 'API_USER',
        },
      });

      return sendSuccess(res, user, "User registered successfully", 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  }
);

// ── Invite User (email-based) ────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER", "API_USER"]).optional(),
});

router.post(
  "/invite",
  authenticate,
  authorize("ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const body = inviteSchema.parse(req.body);

      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) {
        return sendError(res, "A user with this email already exists", 400);
      }

      // Invalidate any previous unused invitations for this email
      await prisma.invitation.updateMany({
        where: { email: body.email, usedAt: null },
        data: { expiresAt: new Date() },
      });

      // Generate a 6-character alphanumeric invite code
      const code = crypto.randomBytes(3).toString("hex").toUpperCase(); // e.g. "A3F1B2"
      const finalRole = body.role || "VIEWER";

      const invitation = await prisma.invitation.create({
        data: {
          email: body.email,
          code,
          role: finalRole as 'ADMIN' | 'EDITOR' | 'VIEWER' | 'API_USER',
          firstName: body.firstName,
          lastName: body.lastName,
          invitedById: req.user!.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Get inviter name for the email
      const inviter = await prisma.user.findUnique({ where: { id: req.user!.id } });
      const inviterName = inviter
        ? [inviter.firstName, inviter.lastName].filter(Boolean).join(" ") || inviter.email
        : "An admin";

      // Send invitation email with code via Resend
      await EmailService.sendInviteEmail(body.email, inviterName, finalRole, code);

      return sendSuccess(res, {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      }, "Invitation sent successfully", 201);
    } catch (err: any) {
      return sendError(res, err.message, 400);
    }
  }
);

// ── Validate Invite Code ─────────────────────────────────────────────────────

router.post("/validate-invite", async (req: Request, res: Response) => {
  try {
    const { code } = z.object({ code: z.string().min(1) }).parse(req.body);

    const invitation = await prisma.invitation.findUnique({ where: { code } });

    if (!invitation) {
      return sendError(res, "Invalid invitation code", 400);
    }
    if (invitation.usedAt) {
      return sendError(res, "This invitation code has already been used", 400);
    }
    if (invitation.expiresAt < new Date()) {
      return sendError(res, "This invitation code has expired", 400);
    }

    return sendSuccess(res, {
      email: invitation.email,
      role: invitation.role,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
    });
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

// ── Register with Invite Code ────────────────────────────────────────────────

const registerWithCodeSchema = z.object({
  code: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

router.post("/register-with-code", async (req: Request, res: Response) => {
  try {
    const body = registerWithCodeSchema.parse(req.body);

    // Validate the invitation code
    const invitation = await prisma.invitation.findUnique({ where: { code: body.code } });

    if (!invitation) {
      return sendError(res, "Invalid invitation code", 400);
    }
    if (invitation.usedAt) {
      return sendError(res, "This invitation code has already been used", 400);
    }
    if (invitation.expiresAt < new Date()) {
      return sendError(res, "This invitation code has expired", 400);
    }
    if (invitation.email.toLowerCase() !== body.email.toLowerCase()) {
      return sendError(res, "This invitation code was sent to a different email address", 400);
    }

    // Create Supabase user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      return sendError(res, authError?.message || "Failed to create user", 400);
    }

    // Create Prisma user with the role from the invitation
    const user = await prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        email: body.email,
        firstName: body.firstName || invitation.firstName,
        lastName: body.lastName || invitation.lastName,
        role: invitation.role,
      },
    });

    // Mark invitation as used
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    });

    return sendSuccess(res, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    }, "Account created successfully", 201);
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

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
        phone: true,
        bio: true,
        company: true,
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

// ── Update Profile ──────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  bio: z.string().max(500).optional(),
  company: z.string().max(100).optional(),
});

router.patch("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const body = updateProfileSchema.parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(body.firstName !== undefined && { firstName: body.firstName }),
        ...(body.lastName !== undefined && { lastName: body.lastName }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.bio !== undefined && { bio: body.bio }),
        ...(body.company !== undefined && { company: body.company }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        phone: true,
        bio: true,
        company: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return sendSuccess(res, updated, "Profile updated successfully");
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

export default router;

