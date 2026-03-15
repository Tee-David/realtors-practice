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

  /**
   * Price trends over recent months — average price grouped by month.
   */
  static async getPriceTrends() {
    try {
      const cacheKey = "analytics:price_trends";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const properties = await prisma.property.findMany({
        where: {
          deletedAt: null,
          price: { not: null, gt: 0 },
          createdAt: { gte: sixMonthsAgo },
        },
        select: {
          price: true,
          listingType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by year-month and listing type
      const monthlyMap = new Map<string, { total: number; count: number }>();
      for (const p of properties) {
        const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}:${p.listingType}`;
        const existing = monthlyMap.get(key) || { total: 0, count: 0 };
        existing.total += p.price!;
        existing.count += 1;
        monthlyMap.set(key, existing);
      }

      const result = Array.from(monthlyMap.entries()).map(([key, data]) => {
        const [month, listingType] = key.split(":");
        return {
          month,
          listingType,
          avgPrice: Math.round(data.total / data.count),
          count: data.count,
        };
      });

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getPriceTrends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Distribution of quality scores across all properties.
   */
  static async getQualityDistribution() {
    try {
      const cacheKey = "analytics:quality_dist";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const [excellent, good, fair, poor, unscored] = await Promise.all([
        prisma.property.count({ where: { deletedAt: null, qualityScore: { gte: 80 } } }),
        prisma.property.count({ where: { deletedAt: null, qualityScore: { gte: 60, lt: 80 } } }),
        prisma.property.count({ where: { deletedAt: null, qualityScore: { gte: 40, lt: 60 } } }),
        prisma.property.count({ where: { deletedAt: null, qualityScore: { gte: 0, lt: 40 } } }),
        prisma.property.count({ where: { deletedAt: null, qualityScore: null } }),
      ]);

      const result = [
        { range: "Excellent (80-100)", count: excellent },
        { range: "Good (60-79)", count: good },
        { range: "Fair (40-59)", count: fair },
        { range: "Poor (0-39)", count: poor },
        { range: "Unscored", count: unscored },
      ];

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getQualityDistribution: ${error.message}`);
      throw error;
    }
  }

  /**
   * Listing velocity — new listings per day over the past 30 days.
   */
  static async getListingVelocity() {
    try {
      const cacheKey = "analytics:listing_velocity";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const properties = await prisma.property.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const dailyMap = new Map<string, number>();
      for (const p of properties) {
        const day = p.createdAt.toISOString().split("T")[0];
        dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
      }

      const result = Array.from(dailyMap.entries()).map(([date, count]) => ({
        date,
        count,
      }));

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getListingVelocity: ${error.message}`);
      throw error;
    }
  }
}
