import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "../config/env";

export function internalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.headers["x-internal-key"];
  if (
    typeof key !== "string" ||
    key.length !== config.scraper.internalKey.length ||
    !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(config.scraper.internalKey))
  ) {
    return res.status(403).json({
      success: false,
      error: "Invalid internal API key",
    });
  }
  next();
}
