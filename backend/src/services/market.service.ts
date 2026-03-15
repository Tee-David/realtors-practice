import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";
import { RedisClient } from "../utils/redis.util";

const CACHE_TTL = 300; // 5 minutes

interface MarketFilters {
  area?: string;
  state?: string;
}

export class MarketService {
  /**
   * Calculate average price-per-sqm grouped by area for a given state/area filter.
   */
  static async getPricePerSqm(filters: MarketFilters) {
    try {
      const cacheKey = `market:price-sqm:${filters.area || "all"}:${filters.state || "all"}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const where: Record<string, unknown> = {
        deletedAt: null,
        price: { not: null, gt: 0 },
        OR: [
          { landSizeSqm: { not: null, gt: 0 } },
          { buildingSizeSqm: { not: null, gt: 0 } },
        ],
      };
      if (filters.area) where.area = { contains: filters.area, mode: "insensitive" };
      if (filters.state) where.state = { contains: filters.state, mode: "insensitive" };

      const properties = await prisma.property.findMany({
        where: where as any,
        select: {
          area: true,
          price: true,
          landSizeSqm: true,
          buildingSizeSqm: true,
        },
      });

      // Group by area and compute average price per sqm
      const areaMap = new Map<string, { totalPrice: number; totalSqm: number; count: number }>();

      for (const p of properties) {
        const areaName = p.area || "Unknown";
        const sqm = p.buildingSizeSqm || p.landSizeSqm || 0;
        if (!sqm || !p.price) continue;

        const existing = areaMap.get(areaName) || { totalPrice: 0, totalSqm: 0, count: 0 };
        existing.totalPrice += p.price;
        existing.totalSqm += sqm;
        existing.count += 1;
        areaMap.set(areaName, existing);
      }

      const result = Array.from(areaMap.entries())
        .map(([area, data]) => ({
          area,
          avgPricePerSqm: Math.round(data.totalPrice / data.totalSqm),
          avgPrice: Math.round(data.totalPrice / data.count),
          avgSqm: Math.round(data.totalSqm / data.count),
          propertyCount: data.count,
        }))
        .sort((a, b) => b.propertyCount - a.propertyCount);

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getPricePerSqm: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rental yield = (annual rent / sale price) * 100 for areas with both sale and rent listings.
   */
  static async getRentalYield(area?: string) {
    try {
      const cacheKey = `market:rental-yield:${area || "all"}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const baseWhere: Record<string, unknown> = {
        deletedAt: null,
        price: { not: null, gt: 0 },
      };
      if (area) baseWhere.area = { contains: area, mode: "insensitive" };

      const [saleProperties, rentProperties] = await Promise.all([
        prisma.property.findMany({
          where: { ...baseWhere, listingType: "SALE" } as any,
          select: { area: true, price: true },
        }),
        prisma.property.findMany({
          where: { ...baseWhere, listingType: "RENT" } as any,
          select: { area: true, price: true, rentFrequency: true },
        }),
      ]);

      // Build avg sale price by area
      const saleByArea = new Map<string, { total: number; count: number }>();
      for (const p of saleProperties) {
        const areaName = p.area || "Unknown";
        const existing = saleByArea.get(areaName) || { total: 0, count: 0 };
        existing.total += p.price!;
        existing.count += 1;
        saleByArea.set(areaName, existing);
      }

      // Build avg annual rent by area
      const rentByArea = new Map<string, { total: number; count: number }>();
      for (const p of rentProperties) {
        const areaName = p.area || "Unknown";
        let annualRent = p.price!;
        // Annualize rent based on frequency
        const freq = (p.rentFrequency || "").toLowerCase();
        if (freq.includes("month")) {
          annualRent = p.price! * 12;
        } else if (freq.includes("week")) {
          annualRent = p.price! * 52;
        } else if (freq.includes("day")) {
          annualRent = p.price! * 365;
        }
        // If no frequency specified, assume annual for Nigerian market
        const existing = rentByArea.get(areaName) || { total: 0, count: 0 };
        existing.total += annualRent;
        existing.count += 1;
        rentByArea.set(areaName, existing);
      }

      // Compute yield for areas with both listings
      const result: Array<{
        area: string;
        avgSalePrice: number;
        avgAnnualRent: number;
        rentalYield: number;
        saleCount: number;
        rentCount: number;
      }> = [];

      for (const [areaName, saleData] of saleByArea) {
        const rentData = rentByArea.get(areaName);
        if (!rentData) continue;

        const avgSale = saleData.total / saleData.count;
        const avgRent = rentData.total / rentData.count;
        const yieldPct = (avgRent / avgSale) * 100;

        result.push({
          area: areaName,
          avgSalePrice: Math.round(avgSale),
          avgAnnualRent: Math.round(avgRent),
          rentalYield: Math.round(yieldPct * 100) / 100,
          saleCount: saleData.count,
          rentCount: rentData.count,
        });
      }

      result.sort((a, b) => b.rentalYield - a.rentalYield);

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getRentalYield: ${error.message}`);
      throw error;
    }
  }

  /**
   * Average days on market grouped by area.
   * Uses daysOnMarket field if available, otherwise calculates from createdAt to now.
   */
  static async getDaysOnMarket(filters?: MarketFilters) {
    try {
      const cacheKey = `market:dom:${filters?.area || "all"}:${filters?.state || "all"}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const where: Record<string, unknown> = { deletedAt: null };
      if (filters?.area) where.area = { contains: filters.area, mode: "insensitive" };
      if (filters?.state) where.state = { contains: filters.state, mode: "insensitive" };

      const properties = await prisma.property.findMany({
        where: where as any,
        select: {
          area: true,
          daysOnMarket: true,
          createdAt: true,
          status: true,
        },
      });

      const now = new Date();
      const areaMap = new Map<string, { totalDays: number; count: number }>();

      for (const p of properties) {
        const areaName = p.area || "Unknown";
        const days =
          p.daysOnMarket ??
          Math.floor((now.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24));

        const existing = areaMap.get(areaName) || { totalDays: 0, count: 0 };
        existing.totalDays += days;
        existing.count += 1;
        areaMap.set(areaName, existing);
      }

      const result = Array.from(areaMap.entries())
        .map(([area, data]) => ({
          area,
          avgDaysOnMarket: Math.round(data.totalDays / data.count),
          propertyCount: data.count,
        }))
        .sort((a, b) => b.propertyCount - a.propertyCount);

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getDaysOnMarket: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find comparable properties: same category, similar bedrooms (+/-1),
   * similar area/location, similar price range (+/-30%).
   * Returns top matches sorted by a composite similarity score (0-100).
   */
  static async getComparableProperties(propertyId: string, limit = 10) {
    try {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: {
          id: true,
          area: true,
          state: true,
          bedrooms: true,
          bathrooms: true,
          price: true,
          category: true,
          listingType: true,
          landSizeSqm: true,
          buildingSizeSqm: true,
        },
      });

      if (!property) {
        throw new Error("Property not found");
      }

      // Broad query: same category and listing type, relaxed price/bedroom range
      const where: Record<string, unknown> = {
        deletedAt: null,
        id: { not: propertyId },
        category: property.category,
        listingType: property.listingType,
      };

      // Relax bedroom filter to +/- 2 for broader candidate pool
      if (property.bedrooms !== null) {
        where.bedrooms = {
          gte: Math.max(0, property.bedrooms - 2),
          lte: property.bedrooms + 2,
        };
      }

      // Relax price to +/- 50% for broader pool, scoring will rank tighter matches higher
      if (property.price !== null && property.price > 0) {
        where.price = {
          gte: property.price * 0.5,
          lte: property.price * 1.5,
        };
      }

      // Prefer same state at minimum
      if (property.state) {
        where.state = property.state;
      }

      const candidates = await prisma.property.findMany({
        where: where as any,
        take: limit * 5, // Fetch more candidates for scoring
        select: {
          id: true,
          title: true,
          price: true,
          bedrooms: true,
          bathrooms: true,
          area: true,
          state: true,
          category: true,
          listingType: true,
          landSizeSqm: true,
          buildingSizeSqm: true,
          images: true,
          listingUrl: true,
          createdAt: true,
        },
      });

      // Score each candidate on similarity
      const scored = candidates.map((candidate) => {
        let score = 0;

        // Area match (30 points): exact area match = 30, same state only = 10
        if (property.area && candidate.area) {
          if (candidate.area.toLowerCase() === property.area.toLowerCase()) {
            score += 30;
          } else if (candidate.area.toLowerCase().includes(property.area.toLowerCase()) ||
                     property.area.toLowerCase().includes(candidate.area.toLowerCase())) {
            score += 20;
          }
        }
        if (property.state && candidate.state &&
            candidate.state.toLowerCase() === property.state.toLowerCase()) {
          score += 10;
        }

        // Price similarity (30 points): closer price = higher score
        if (property.price && candidate.price && property.price > 0) {
          const priceRatio = Math.min(property.price, candidate.price) /
                             Math.max(property.price, candidate.price);
          score += Math.round(priceRatio * 30);
        }

        // Bedroom match (20 points): exact = 20, off by 1 = 10
        if (property.bedrooms !== null && candidate.bedrooms !== null) {
          const diff = Math.abs(property.bedrooms - candidate.bedrooms);
          if (diff === 0) score += 20;
          else if (diff === 1) score += 10;
          else if (diff === 2) score += 3;
        }

        // Size similarity (10 points)
        const subjectSqm = property.buildingSizeSqm || property.landSizeSqm;
        const candSqm = candidate.buildingSizeSqm || candidate.landSizeSqm;
        if (subjectSqm && candSqm && subjectSqm > 0) {
          const sizeRatio = Math.min(subjectSqm, candSqm) / Math.max(subjectSqm, candSqm);
          score += Math.round(sizeRatio * 10);
        }

        return { ...candidate, similarityScore: score };
      });

      // Sort by similarity score descending, take top N
      scored.sort((a, b) => b.similarityScore - a.similarityScore);
      const comparables = scored.slice(0, limit);

      return {
        subject: property,
        comparables,
        count: comparables.length,
      };
    } catch (error: any) {
      Logger.error(`Error in getComparableProperties: ${error.message}`);
      throw error;
    }
  }

  /**
   * Combined market report: total listings, avg price, price trends, top areas.
   */
  static async getMarketReport(area?: string, state?: string) {
    try {
      const cacheKey = `market:report:${area || "all"}:${state || "all"}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const where: Record<string, unknown> = { deletedAt: null };
      if (area) where.area = { contains: area, mode: "insensitive" };
      if (state) where.state = { contains: state, mode: "insensitive" };

      const [
        totalListings,
        avgPriceResult,
        byListingType,
        byCategory,
        topAreas,
        priceRangeDistribution,
        recentListings,
      ] = await Promise.all([
        prisma.property.count({ where: where as any }),
        prisma.property.aggregate({
          where: { ...where, price: { not: null, gt: 0 } } as any,
          _avg: { price: true },
          _min: { price: true },
          _max: { price: true },
        }),
        prisma.property.groupBy({
          by: ["listingType"],
          where: where as any,
          _count: true,
          _avg: { price: true },
        }),
        prisma.property.groupBy({
          by: ["category"],
          where: where as any,
          _count: true,
        }),
        prisma.property.groupBy({
          by: ["area"],
          where: { ...where, area: { not: null } } as any,
          _count: true,
          _avg: { price: true },
          orderBy: { _count: { area: "desc" } },
          take: 15,
        }),
        // Price range distribution
        Promise.all([
          prisma.property.count({ where: { ...where, price: { gt: 0, lte: 1_000_000 } } as any }),
          prisma.property.count({ where: { ...where, price: { gt: 1_000_000, lte: 10_000_000 } } as any }),
          prisma.property.count({ where: { ...where, price: { gt: 10_000_000, lte: 50_000_000 } } as any }),
          prisma.property.count({ where: { ...where, price: { gt: 50_000_000, lte: 200_000_000 } } as any }),
          prisma.property.count({ where: { ...where, price: { gt: 200_000_000 } } as any }),
        ]),
        // Recent 30 days count
        prisma.property.count({
          where: {
            ...where,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          } as any,
        }),
      ]);

      const result = {
        totalListings,
        recentListings,
        pricing: {
          avgPrice: Math.round(avgPriceResult._avg.price || 0),
          minPrice: avgPriceResult._min.price || 0,
          maxPrice: avgPriceResult._max.price || 0,
        },
        byListingType: byListingType.map((g) => ({
          listingType: g.listingType,
          count: g._count,
          avgPrice: Math.round(g._avg.price || 0),
        })),
        byCategory: byCategory.map((g) => ({
          category: g.category,
          count: g._count,
        })),
        topAreas: topAreas.map((g) => ({
          area: g.area,
          count: g._count,
          avgPrice: Math.round(g._avg.price || 0),
        })),
        priceRangeDistribution: [
          { range: "0 - 1M", count: priceRangeDistribution[0] },
          { range: "1M - 10M", count: priceRangeDistribution[1] },
          { range: "10M - 50M", count: priceRangeDistribution[2] },
          { range: "50M - 200M", count: priceRangeDistribution[3] },
          { range: "200M+", count: priceRangeDistribution[4] },
        ],
      };

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getMarketReport: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate rental yield for a specific property given its sale price
   * and an estimated monthly rent (or area average rent).
   */
  static async calculatePropertyRentalYield(
    salePrice: number,
    monthlyRent?: number,
    area?: string
  ): Promise<{ annualRent: number; rentalYield: number; source: "provided" | "area_average" }> {
    let annualRent: number;
    let source: "provided" | "area_average" = "provided";

    if (monthlyRent && monthlyRent > 0) {
      annualRent = monthlyRent * 12;
    } else if (area) {
      // Fall back to area average rent
      const rentProperties = await prisma.property.findMany({
        where: {
          deletedAt: null,
          listingType: "RENT",
          area: { contains: area, mode: "insensitive" },
          price: { not: null, gt: 0 },
        } as any,
        select: { price: true, rentFrequency: true },
      });

      if (rentProperties.length === 0) {
        throw new Error(`No rental data available for area: ${area}`);
      }

      let totalAnnual = 0;
      for (const p of rentProperties) {
        const freq = (p.rentFrequency || "").toLowerCase();
        if (freq.includes("month")) {
          totalAnnual += p.price! * 12;
        } else if (freq.includes("week")) {
          totalAnnual += p.price! * 52;
        } else {
          totalAnnual += p.price!; // Assume annual
        }
      }
      annualRent = totalAnnual / rentProperties.length;
      source = "area_average";
    } else {
      throw new Error("Either monthlyRent or area must be provided");
    }

    const rentalYield = (annualRent / salePrice) * 100;

    return {
      annualRent: Math.round(annualRent),
      rentalYield: Math.round(rentalYield * 100) / 100,
      source,
    };
  }

  /**
   * Market trends data suitable for frontend charts:
   * - Price-per-sqm by area (for bar/line charts)
   * - Rental yields by area
   * - Days-on-market by area
   * - Monthly listing volume trends
   */
  static async getMarketTrends(area?: string, state?: string) {
    try {
      const cacheKey = `market:trends:${area || "all"}:${state || "all"}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const [pricePerSqm, rentalYields, daysOnMarket, volumeTrends] = await Promise.all([
        this.getPricePerSqm({ area, state }),
        this.getRentalYield(area),
        this.getDaysOnMarket({ area, state }),
        this.getMonthlyVolumeTrends(area, state),
      ]);

      const result = {
        pricePerSqm,
        rentalYields,
        daysOnMarket,
        volumeTrends,
        generatedAt: new Date().toISOString(),
      };

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getMarketTrends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Monthly listing volume for the last 12 months, grouped by month.
   */
  private static async getMonthlyVolumeTrends(area?: string, state?: string) {
    const where: Record<string, unknown> = {
      deletedAt: null,
      createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
    };
    if (area) where.area = { contains: area, mode: "insensitive" };
    if (state) where.state = { contains: state, mode: "insensitive" };

    const properties = await prisma.property.findMany({
      where: where as any,
      select: {
        createdAt: true,
        listingType: true,
      },
    });

    // Group by YYYY-MM
    const monthMap = new Map<string, { sale: number; rent: number; total: number }>();

    for (const p of properties) {
      const month = p.createdAt.toISOString().slice(0, 7); // YYYY-MM
      const existing = monthMap.get(month) || { sale: 0, rent: 0, total: 0 };
      existing.total += 1;
      if (p.listingType === "SALE") existing.sale += 1;
      else if (p.listingType === "RENT") existing.rent += 1;
      monthMap.set(month, existing);
    }

    return Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Log a search query for analytics (especially zero-result searches for scraper targeting).
   */
  static async logSearchQuery(query: string, userId?: string, resultCount = 0, filters?: object) {
    try {
      await prisma.searchQuery.create({
        data: {
          query,
          userId: userId || null,
          resultCount,
          ...(filters ? { filters: filters as any } : {}),
        },
      });
    } catch (error: any) {
      // Don't throw - logging should not break the search flow
      Logger.error(`Error in logSearchQuery: ${error.message}`);
    }
  }

  /**
   * Get searches that returned 0 results, for scraper targeting.
   */
  static async getZeroResultSearches(limit = 20) {
    try {
      const cacheKey = `market:zero-searches:${limit}`;
      const cached = await RedisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const searches = await prisma.searchQuery.findMany({
        where: { resultCount: 0 },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          query: true,
          userId: true,
          filters: true,
          createdAt: true,
        },
      });

      // Also get frequency counts for zero-result queries
      const frequencyCounts = await prisma.searchQuery.groupBy({
        by: ["query"],
        where: { resultCount: 0 },
        _count: true,
        orderBy: { _count: { query: "desc" } },
        take: limit,
      });

      const result = {
        recentZeroResults: searches,
        topZeroResultQueries: frequencyCounts.map((g: { query: string; _count: number }) => ({
          query: g.query,
          count: g._count,
        })),
      };

      await RedisClient.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    } catch (error: any) {
      Logger.error(`Error in getZeroResultSearches: ${error.message}`);
      throw error;
    }
  }
}
