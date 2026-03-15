import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../utils/supabase";
import prisma from "../prismaClient";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        supabaseId: string;
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
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.split(" ")[1];

    const {
      data: { user: supabaseUser },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !supabaseUser) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }

    // Find or create user in our database
    const email = supabaseUser.email!;
    const isSuperAdmin = email.toLowerCase() === "wedigcreativity@gmail.com";

    let user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      select: { id: true, supabaseId: true, email: true, role: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email,
          role: isSuperAdmin ? "ADMIN" : "VIEWER",
        },
        select: { id: true, supabaseId: true, email: true, role: true },
      });
    } else if (isSuperAdmin && user.role !== "ADMIN") {
      // Ensure super admin always has ADMIN role
      user = await prisma.user.update({
        where: { supabaseId: supabaseUser.id },
        data: { role: "ADMIN" },
        select: { id: true, supabaseId: true, email: true, role: true },
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
