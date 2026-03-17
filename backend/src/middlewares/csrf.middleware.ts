import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "../config/env";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF protection via Origin/Referer header validation.
 *
 * For token-based APIs (Authorization header with JWT), traditional CSRF tokens
 * are unnecessary. Instead we validate that mutating requests come from known
 * origins, which prevents cross-site form submissions and malicious fetches.
 *
 * Requests are allowed when any of these conditions are met:
 *   1. The HTTP method is safe (GET, HEAD, OPTIONS).
 *   2. The request carries a valid X-Internal-Key header (server-to-server).
 *   3. No Origin AND no Referer header is present (server-to-server / CLI).
 *   4. The Origin (or Referer-derived origin) matches an allowed origin.
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 1. Safe methods – nothing to check
  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  // 2. Internal API calls bypass CSRF (timing-safe comparison)
  const internalKey = req.headers["x-internal-key"];
  if (
    typeof internalKey === "string" &&
    internalKey.length === config.scraper.internalKey.length &&
    crypto.timingSafeEqual(Buffer.from(internalKey), Buffer.from(config.scraper.internalKey))
  ) {
    return next();
  }

  // Build the allowed-origins set from env / defaults
  const allowedOrigins = buildAllowedOrigins();

  // Determine the request origin from the Origin header, falling back to Referer
  const origin = req.headers["origin"] as string | undefined;
  const referer = req.headers["referer"] as string | undefined;

  const requestOrigin = origin || extractOrigin(referer);

  // 3. No origin information at all – allow (server-to-server, curl, etc.)
  if (!requestOrigin) {
    return next();
  }

  // 4. Check against allowed origins
  if (allowedOrigins.has(requestOrigin)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: "Forbidden – origin not allowed",
  });
}

/**
 * Build the set of allowed origins once per call (cheap, and respects env
 * changes without caching stale values during tests).
 */
function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Hardcoded defaults
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  origins.add("https://realtors-practice-new.vercel.app");

  // From env / config
  if (config.cors.origin) {
    origins.add(config.cors.origin);
  }

  const extra = process.env.ALLOWED_ORIGINS;
  if (extra) {
    extra.split(",").forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) origins.add(trimmed);
    });
  }

  return origins;
}

/**
 * Extract the origin (scheme + host + port) from a full URL string.
 * Returns undefined when the input is falsy or unparseable.
 */
function extractOrigin(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return undefined;
  }
}
