import prisma from "../prismaClient";
import { Prisma } from "@prisma/client";
import { CreateSiteInput, UpdateSiteInput } from "../validators/site.validators";

export class SiteService {
  static async list(filters: { page: number; limit: number; enabled?: boolean; search?: string }) {
    const { page, limit, enabled, search } = filters;
    const where: Prisma.SiteWhereInput = { deletedAt: null };

    if (enabled !== undefined) where.enabled = enabled;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { key: { contains: search, mode: "insensitive" } },
        { baseUrl: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.site.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { properties: true, scrapeJobs: true } },
        },
      }),
      prisma.site.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  static async getById(id: string) {
    return prisma.site.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { properties: true, scrapeJobs: true } },
      },
    });
  }

  static async getByKey(key: string) {
    return prisma.site.findFirst({
      where: { key, deletedAt: null },
    });
  }

  static async create(data: CreateSiteInput) {
    return prisma.site.create({ data: data as Prisma.SiteUncheckedCreateInput });
  }

  static async update(id: string, data: UpdateSiteInput) {
    return prisma.site.update({
      where: { id },
      data,
    });
  }

  static async toggleEnabled(id: string) {
    const site = await prisma.site.findUnique({
      where: { id },
      select: { enabled: true },
    });
    if (!site) return null;

    return prisma.site.update({
      where: { id },
      data: { enabled: !site.enabled },
    });
  }

  static async softDelete(id: string) {
    return prisma.site.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  static async updateHealth(id: string, success: boolean, listingsCount?: number) {
    const site = await prisma.site.findUnique({ where: { id } });
    if (!site) return;

    const updates: Prisma.SiteUpdateInput = {
      lastScrapeAt: new Date(),
    };

    if (success) {
      updates.lastSuccessAt = new Date();
      updates.failCount = 0;
      updates.healthScore = 100;
      if (listingsCount !== undefined) updates.avgListings = listingsCount;
    } else {
      updates.failCount = site.failCount + 1;
      updates.healthScore = Math.max(0, site.healthScore - 20);
    }

    await prisma.site.update({ where: { id }, data: updates });
  }
}
