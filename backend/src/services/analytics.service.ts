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
      ]);

      const result = {
        totalProperties,
        activeProperties,
        totalSites,
        avgQuality: Math.round(avgQualityResult._avg.qualityScore || 0),
        newToday,
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
