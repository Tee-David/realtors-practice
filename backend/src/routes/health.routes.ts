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

// Temporary diagnostic: test the exact sites query path (no auth needed)
router.get("/sites-check", async (_req: Request, res: Response) => {
  try {
    const [data, total] = await Promise.all([
      prisma.site.findMany({
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        skip: 0,
        take: 20,
        include: { _count: { select: { properties: true, scrapeJobs: true } } },
      }),
      prisma.site.count({ where: { deletedAt: null } }),
    ]);
    res.json({
      success: true,
      total,
      count: data.length,
      sites: data.map(s => ({ id: s.id, name: s.name, key: s.key })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

export default router;
