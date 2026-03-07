import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";

export function internalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = req.headers["x-internal-key"];
  if (key !== config.scraper.internalKey) {
    return res.status(403).json({
      success: false,
      error: "Invalid internal API key",
    });
  }
  next();
}
