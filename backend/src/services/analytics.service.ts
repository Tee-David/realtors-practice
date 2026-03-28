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
   * Scraping activity heatmap — property counts by day-of-week × hour.
   * Returns a 7×24 grid for the last 90 days.
   */
  static async getActivityHeatmap() {
    try {
      const cacheKey = "analytics:activity_heatmap";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const properties = await prisma.property.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: ninetyDaysAgo },
        },
        select: { createdAt: true },
      });

      // Build 7×24 grid (day 0=Sunday, hour 0-23)
      const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      for (const p of properties) {
        const d = p.createdAt;
        grid[d.getUTCDay()][d.getUTCHours()]++;
      }

      const result = grid.map((hours, day) => ({
        day,
        hours,
      }));

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getActivityHeatmap: ${error.message}`);
      throw error;
    }
  }

  /**
   * Weekly sparkline — property counts per week over the past 12 weeks.
   * Used for dashboard KPI sparklines.
   */
  static async getWeeklySparkline() {
    try {
      const cacheKey = "analytics:weekly_sparkline";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);

      const properties = await prisma.property.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: twelveWeeksAgo },
        },
        select: { createdAt: true },
      });

      // Group by ISO week number
      const weekMap = new Map<string, number>();
      for (const p of properties) {
        const d = p.createdAt;
        const weekStart = new Date(d);
        weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
        const key = weekStart.toISOString().split("T")[0];
        weekMap.set(key, (weekMap.get(key) || 0) + 1);
      }

      // Sort by date and return array of counts
      const sorted = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, count]) => ({ week, count }));

      await RedisClient.set(cacheKey, JSON.stringify(sorted), CACHE_TTL);
      return sorted;
    } catch (error: any) {
      Logger.error(`Error in getWeeklySparkline: ${error.message}`);
      throw error;
    }
  }

  /**
   * KPI trends — period-over-period percentage changes.
   * Compares the last 30 days with the prior 30 days for each KPI.
   */
  static async getKPITrends() {
    try {
      const cacheKey = "analytics:kpi_trends";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const currentPeriod = { createdAt: { gte: thirtyDaysAgo }, deletedAt: null };
      const previousPeriod = { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, deletedAt: null };

      const [
        currentTotal, previousTotal,
        currentForSale, previousForSale,
        currentForRent, previousForRent,
        currentAvgPrice, previousAvgPrice,
      ] = await Promise.all([
        prisma.property.count({ where: currentPeriod as any }),
        prisma.property.count({ where: previousPeriod as any }),
        prisma.property.count({ where: { ...currentPeriod, listingType: "SALE" } as any }),
        prisma.property.count({ where: { ...previousPeriod, listingType: "SALE" } as any }),
        prisma.property.count({ where: { ...currentPeriod, listingType: "RENT" } as any }),
        prisma.property.count({ where: { ...previousPeriod, listingType: "RENT" } as any }),
        prisma.property.aggregate({ where: { ...currentPeriod, price: { not: null, gt: 0 } } as any, _avg: { price: true } }),
        prisma.property.aggregate({ where: { ...previousPeriod, price: { not: null, gt: 0 } } as any, _avg: { price: true } }),
      ]);

      function calcChange(current: number, previous: number): number {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      }

      const currentAvg = Math.round(currentAvgPrice._avg.price || 0);
      const previousAvg = Math.round(previousAvgPrice._avg.price || 0);

      const result = {
        totalProperties: {
          current: currentTotal,
          previous: previousTotal,
          changePercent: calcChange(currentTotal, previousTotal),
        },
        forSale: {
          current: currentForSale,
          previous: previousForSale,
          changePercent: calcChange(currentForSale, previousForSale),
        },
        forRent: {
          current: currentForRent,
          previous: previousForRent,
          changePercent: calcChange(currentForRent, previousForRent),
        },
        avgPrice: {
          current: currentAvg,
          previous: previousAvg,
          changePercent: calcChange(currentAvg, previousAvg),
        },
      };

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getKPITrends: ${error.message}`);
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

  /**
   * Category distribution over time — property counts grouped by category and month (last 6 months).
   * Returns rows shaped as: { month: "2025-10", category: "RESIDENTIAL", count: 42 }
   */
  static async getCategoryDistribution() {
    try {
      const cacheKey = "analytics:category_distribution";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const properties = await prisma.property.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: sixMonthsAgo },
        },
        select: {
          category: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by month+category
      const mapKey = (cat: string, year: number, month: number) =>
        `${year}-${String(month + 1).padStart(2, "0")}::${cat}`;

      const buckets = new Map<string, number>();
      for (const p of properties) {
        const d = p.createdAt;
        const key = mapKey(p.category, d.getFullYear(), d.getMonth());
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      const result = Array.from(buckets.entries()).map(([key, count]) => {
        const [month, category] = key.split("::");
        return { month, category, count };
      });

      // Sort by month asc
      result.sort((a, b) => a.month.localeCompare(b.month));

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getCategoryDistribution: ${error.message}`);
      throw error;
    }
  }

  /**
   * Listing type distribution — current counts by listing type.
   * Returns: [{ listingType: "SALE", count: 120 }, ...]
   */
  static async getListingTypeDistribution() {
    try {
      const cacheKey = "analytics:listing_type_dist";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const groups = await prisma.property.groupBy({
        by: ["listingType"],
        where: { deletedAt: null },
        _count: true,
      });

      const result = groups.map((g) => ({
        listingType: g.listingType,
        count: g._count,
      }));

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getListingTypeDistribution: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verification trends — property counts by verificationStatus grouped by week (last 12 weeks).
   * Returns: [{ week: "2025-10-07", status: "VERIFIED", count: 5 }, ...]
   */
  static async getVerificationTrends() {
    try {
      const cacheKey = "analytics:verification_trends";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);

      const properties = await prisma.property.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: twelveWeeksAgo },
        },
        select: {
          verificationStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Group by week start + verification status
      const buckets = new Map<string, number>();
      for (const p of properties) {
        const d = new Date(p.createdAt);
        // Get ISO week start (Monday)
        const day = d.getUTCDay(); // 0=Sun
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(d);
        weekStart.setUTCDate(diff);
        const weekKey = weekStart.toISOString().split("T")[0];
        const key = `${weekKey}::${p.verificationStatus}`;
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }

      const result = Array.from(buckets.entries()).map(([key, count]) => {
        const [week, status] = key.split("::");
        return { week, status, count };
      });

      result.sort((a, b) => a.week.localeCompare(b.week));

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getVerificationTrends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scraper health — per-site metrics based on the last 5 scrape jobs.
   * Returns for each site: name, lastScrapeDate, successRate, avgPropertiesFound, totalRuns
   */
  static async getScraperHealth() {
    try {
      const cacheKey = "analytics:scraper_health";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      // Get all sites with their recent scrape jobs (via the many-to-many relation)
      const sites = await prisma.site.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          baseUrl: true,
          scrapeJobs: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              status: true,
              newListings: true,
              totalListings: true,
              startedAt: true,
              completedAt: true,
              createdAt: true,
            },
          },
        },
      });

      const result = sites.map((site) => {
        const jobs = site.scrapeJobs;
        const totalRuns = jobs.length;

        if (totalRuns === 0) {
          return {
            siteId: site.id,
            siteName: site.name,
            siteUrl: site.baseUrl,
            lastScrapeDate: null,
            successRate: 0,
            avgPropertiesFound: 0,
            totalRuns: 0,
          };
        }

        const succeeded = jobs.filter((j: { status: string }) => j.status === "COMPLETED").length;
        const successRate = Math.round((succeeded / totalRuns) * 100);
        const avgPropertiesFound = Math.round(
          jobs.reduce((sum: number, j: { newListings: number | null }) => sum + (j.newListings || 0), 0) / totalRuns
        );
        const lastScrapeDate = jobs[0].completedAt || jobs[0].createdAt;

        return {
          siteId: site.id,
          siteName: site.name,
          siteUrl: site.baseUrl,
          lastScrapeDate,
          successRate,
          avgPropertiesFound,
          totalRuns,
        };
      });

      // Sort: sites with runs first, by lastScrapeDate desc
      result.sort((a, b) => {
        if (!a.lastScrapeDate && !b.lastScrapeDate) return 0;
        if (!a.lastScrapeDate) return 1;
        if (!b.lastScrapeDate) return -1;
        return new Date(b.lastScrapeDate).getTime() - new Date(a.lastScrapeDate).getTime();
      });

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getScraperHealth: ${error.message}`);
      throw error;
    }
  }

  /**
   * Price per sqm by area — top 10 areas ranked by avg price per sqm.
   * Only uses properties where buildingSizeSqm or landSizeSqm is available.
   */
  static async getPricePerSqm() {
    try {
      const cacheKey = "analytics:price_per_sqm";
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const properties = await prisma.property.findMany({
        where: {
          deletedAt: null,
          area: { not: null },
          price: { not: null, gt: 0 },
          OR: [
            { buildingSizeSqm: { not: null, gt: 0 } },
            { landSizeSqm: { not: null, gt: 0 } },
          ],
        },
        select: {
          area: true,
          price: true,
          buildingSizeSqm: true,
          landSizeSqm: true,
        },
      });

      // Group by area, compute avg price per sqm
      const areaMap = new Map<string, { totalPricePerSqm: number; count: number }>();
      for (const p of properties) {
        const area = p.area!;
        const sizeSqm = p.buildingSizeSqm || p.landSizeSqm;
        if (!sizeSqm || sizeSqm <= 0) continue;
        const pricePerSqm = p.price! / sizeSqm;
        const existing = areaMap.get(area) || { totalPricePerSqm: 0, count: 0 };
        existing.totalPricePerSqm += pricePerSqm;
        existing.count += 1;
        areaMap.set(area, existing);
      }

      const result = Array.from(areaMap.entries())
        .filter(([, data]) => data.count >= 1)
        .map(([area, data]) => ({
          area,
          avgPricePerSqm: Math.round(data.totalPricePerSqm / data.count),
          sampleCount: data.count,
        }))
        .sort((a, b) => b.avgPricePerSqm - a.avgPricePerSqm)
        .slice(0, 10);

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getPricePerSqm: ${error.message}`);
      throw error;
    }
  }
}
