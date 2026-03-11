import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";

const CSV_FIELDS = [
  "id", "title", "listingType", "category", "propertyType", "status",
  "price", "priceCurrency", "bedrooms", "bathrooms", "toilets",
  "landSizeSqm", "buildingSizeSqm", "furnishing", "condition",
  "fullAddress", "area", "lga", "state", "latitude", "longitude",
  "features", "agentName", "agentPhone", "agencyName",
  "qualityScore", "source", "listingUrl", "createdAt", "updatedAt"
];

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class ExportService {
  /**
   * Export properties to CSV format
   */
  static async exportCSV(propertyIds?: string[]): Promise<string> {
    const where: any = { deletedAt: null };
    if (propertyIds && propertyIds.length > 0) {
      where.id = { in: propertyIds };
    }

    const properties = await prisma.property.findMany({
      where,
      take: 10000, // safety cap
      orderBy: { createdAt: "desc" },
    });

    // Build CSV header
    const header = CSV_FIELDS.join(",");

    // Build CSV rows
    const rows = properties.map((prop: any) => {
      return CSV_FIELDS.map((field) => {
        let value = prop[field];

        // Handle arrays
        if (Array.isArray(value)) {
          value = value.join("; ");
        }

        // Handle dates
        if (value instanceof Date) {
          value = value.toISOString();
        }

        return escapeCsvValue(value);
      }).join(",");
    });

    Logger.info(`[Export] Generated CSV with ${properties.length} properties`);
    return [header, ...rows].join("\n");
  }

  /**
   * Export filtered properties to CSV
   */
  static async exportFilteredCSV(filters: {
    listingType?: string;
    category?: string;
    state?: string;
    area?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    verificationStatus?: string;
  }): Promise<string> {
    const where: any = { deletedAt: null };

    if (filters.listingType) where.listingType = filters.listingType;
    if (filters.category) where.category = filters.category;
    if (filters.state) where.state = filters.state;
    if (filters.area) where.area = { contains: filters.area, mode: "insensitive" };
    if (filters.status) where.status = filters.status;
    if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    const ids = (
      await prisma.property.findMany({
        where,
        select: { id: true },
        take: 10000,
      })
    ).map((p) => p.id);

    return this.exportCSV(ids);
  }
}
