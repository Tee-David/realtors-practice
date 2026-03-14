import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";
import { RedisClient } from "../utils/redis.util";

const CACHE_TTL = 300; // 5 minutes in seconds

export class AnalyticsService {
  static async getOverviewKPIs() {
    try {
      const cacheKey = "analytics:overview";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const [
        totalProperties,
        activeProperties,
        totalSites,
        avgQualityResult,
        newToday,
        forSale,
        forRent,
        avgPriceResult,
      ] = await Promise.all([
        prisma.property.count({ where: { deletedAt: null } }),
        prisma.property.count({ where: { deletedAt: null, status: "AVAILABLE" } }),
        prisma.site.count({ where: { deletedAt: null } }),
        prisma.property.aggregate({
          where: { deletedAt: null, qualityScore: { not: null } },
          _avg: { qualityScore: true },
        }),
        prisma.property.count({
          where: {
            deletedAt: null,
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
        prisma.property.count({ where: { deletedAt: null, listingType: "SALE" } }),
        prisma.property.count({ where: { deletedAt: null, listingType: "RENT" } }),
        prisma.property.aggregate({
          where: { deletedAt: null, price: { not: null, gt: 0 } },
          _avg: { price: true },
        }),
      ]);

      const result = {
        totalProperties,
        activeProperties,
        totalSites,
        avgQuality: Math.round(avgQualityResult._avg.qualityScore || 0),
        newToday,
        forSale,
        forRent,
        avgPrice: Math.round(avgPriceResult._avg.price || 0),
      };

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getOverviewKPIs: ${error.message}`);
      throw error;
    }
  }

  static async getPropertiesByCategory() {
    try {
      const cacheKey = "analytics:category_groups";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const groupings = await prisma.property.groupBy({
        by: ["listingType", "category"],
        where: { deletedAt: null },
        _count: true,
      });

      const result = groupings.map((g) => ({
        listingType: g.listingType,
        category: g.category,
        count: g._count,
      }));

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getPropertiesByCategory: ${error.message}`);
      throw error;
    }
  }

  static async getChartData() {
    try {
      const cacheKey = "analytics:charts";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const [byCategory, topAreasRaw, topSitesRaw, avgPriceResult, recentProperties] = await Promise.all([
        prisma.property.groupBy({
          by: ["category"],
          where: { deletedAt: null },
          _count: true,
          orderBy: { _count: { category: "desc" } },
        }),
        prisma.property.groupBy({
          by: ["area"],
          where: { deletedAt: null, area: { not: null } },
          _count: true,
          orderBy: { _count: { area: "desc" } },
          take: 10,
        }),
        prisma.property.groupBy({
          by: ["source"],
          where: { deletedAt: null, source: { not: "" } },
          _count: true,
          orderBy: { _count: { source: "desc" } },
          take: 10,
        }),
        prisma.property.aggregate({
          where: { deletedAt: null, price: { not: null, gt: 0 } },
          _avg: { price: true },
        }),
        prisma.property.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            title: true,
            listingType: true,
            category: true,
            price: true,
            area: true,
            state: true,
            status: true,
            qualityScore: true,
            createdAt: true,
          },
        }),
      ]);

      const result = {
        byCategory: byCategory.map((g) => ({ name: g.category, count: g._count })),
        topAreas: topAreasRaw.map((g) => ({ name: g.area, count: g._count })),
        topSites: topSitesRaw.map((g) => ({ name: g.source, count: g._count })),
        avgPrice: Math.round(avgPriceResult._avg.price || 0),
        recentProperties,
      };

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getChartData: ${error.message}`);
      throw error;
    }
  }

  static async getPropertiesByStatus() {
    try {
      const cacheKey = "analytics:status_groups";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const groupings = await prisma.property.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: true,
      });

      const result = groupings.map((g) => ({
        name: g.status,
        value: g._count,
      }));

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getPropertiesByStatus: ${error.message}`);
      throw error;
    }
  }
}
