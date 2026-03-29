import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import prisma from "../prismaClient";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return res.status(401).json({
        success: false,
        error: "Missing or invalid session",
      });
    }

    const email = session.user.email;

    // Force Super Admin role
    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || "wedigcreativity@gmail.com")
      .split(",")
      .map((e) => e.trim().toLowerCase());
    const isSuperAdmin = superAdminEmails.includes(email.toLowerCase());

    // Find user in our database by email
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      // Auto-create user record on first login via Better Auth
      user = await prisma.user.create({
        data: {
          email,
          firstName: session.user.name?.split(" ")[0] || undefined,
          lastName: session.user.name?.split(" ").slice(1).join(" ") || undefined,
          role: isSuperAdmin ? "ADMIN" : "VIEWER",
        },
        select: { id: true, email: true, role: true },
      });
    } else if (isSuperAdmin && user.role !== "ADMIN") {
      // Ensure super admin always has ADMIN role
      user = await prisma.user.update({
        where: { email },
        data: { role: "ADMIN" },
        select: { id: true, email: true, role: true },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
}
