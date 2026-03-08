import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";

export class AnalyticsService {
  static async getOverviewKPIs() {
    try {
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

      return {
        totalProperties,
        activeProperties,
        totalSites,
        avgQuality: Math.round(avgQualityResult._avg.qualityScore || 0),
        newToday,
      };
    } catch (error: any) {
      Logger.error(`Error in getOverviewKPIs: ${error.message}`);
      throw error;
    }
  }

  static async getPropertiesByCategory() {
    try {
      const groupings = await prisma.property.groupBy({
        by: ["listingType", "category"],
        where: { deletedAt: null },
        _count: true,
      });

      return groupings.map((g) => ({
        listingType: g.listingType,
        category: g.category,
        count: g._count,
      }));
    } catch (error: any) {
      Logger.error(`Error in getPropertiesByCategory: ${error.message}`);
      throw error;
    }
  }

  static async getPropertiesByStatus() {
    try {
      const groupings = await prisma.property.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: true,
      });

      return groupings.map((g) => ({
        name: g.status,
        value: g._count,
      }));
    } catch (error: any) {
      Logger.error(`Error in getPropertiesByStatus: ${error.message}`);
      throw error;
    }
  }
}
