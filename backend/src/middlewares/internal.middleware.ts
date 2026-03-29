import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "../config/env";

export function internalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.headers["x-internal-key"];
  const expectedKey = config.scraper.internalKey;
  if (
    typeof key !== "string" ||
    key.length !== expectedKey.length ||
    !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(expectedKey))
  ) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }
  next();
}
