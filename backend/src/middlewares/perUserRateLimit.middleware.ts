import rateLimit from "express-rate-limit";
import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../utils/supabase";
import { config } from "../config/env";

/**
 * Lightweight middleware that attempts to extract the authenticated user's ID
 * from the Authorization header without blocking unauthenticated requests.
 * This populates req._rateLimitUserId for the per-user rate limiter.
 */
declare global {
  namespace Express {
    interface Request {
      _rateLimitUserId?: string;
    }
  }
}

export async function extractUserIdForRateLimit(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        req._rateLimitUserId = user.id;
      }
    }
  } catch {
    // Silently ignore — fall back to IP-based limiting
  }
  next();
}

/**
 * Per-user rate limiter.
 * Uses the authenticated user's Supabase ID as the key, falling back to IP.
 * More generous than the global IP-based limiter (200 req / 15 min).
 */
export const perUserRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.env === "production" ? 200 : 2000,
  message: "Too many requests for this user, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req._rateLimitUserId || req.ip || "anonymous";
  },
  skip: (req) => req.path === "/health" || req.path === "/api/health",
});
