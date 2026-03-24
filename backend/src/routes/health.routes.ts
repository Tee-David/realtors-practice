import { Router, Request, Response } from "express";
import prisma from "../prismaClient";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      data: {
        status: "OK",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        database: "connected",
      },
    });
  } catch {
    res.status(503).json({
      success: false,
      data: {
        status: "DEGRADED",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        database: "disconnected",
      },
    });
  }
});

export default router;
