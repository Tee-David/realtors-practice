import prisma from "../prismaClient";
import { ChangeSource, Prisma } from "@prisma/client";
import { ListPropertiesInput, CreatePropertyInput, UpdatePropertyInput } from "../validators/property.validators";
import { VersionService } from "./version.service";
import { QualityService } from "./quality.service";
import { DedupService } from "./dedup.service";
import { MeiliService } from "./meili.service";
import { Logger } from "../utils/logger.util";

export class PropertyService {
  static async list(filters: ListPropertiesInput) {
    const {
      page, limit, sortBy, sortOrder,
      listingType, category, status, verificationStatus,
      minPrice, maxPrice, minBedrooms, maxBedrooms, minBathrooms,
      state, area, lga, siteId, propertyType, furnishing,
      search, isPremium, isFeatured, minQualityScore,
    } = filters;

    const where: Prisma.PropertyWhereInput = { deletedAt: null };

    if (listingType) where.listingType = listingType;
    if (category) where.category = category;
    if (status) where.status = status;
    if (verificationStatus) where.verificationStatus = verificationStatus;
    if (state) where.state = state;
    if (area) where.area = { contains: area, mode: "insensitive" };
    if (lga) where.lga = { contains: lga, mode: "insensitive" };
    if (siteId) where.siteId = siteId;
    if (propertyType) where.propertyType = { contains: propertyType, mode: "insensitive" };
    if (furnishing) where.furnishing = furnishing;
    if (isPremium !== undefined) where.isPremium = isPremium;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) (where.price as Prisma.FloatNullableFilter).gte = minPrice;
      if (maxPrice !== undefined) (where.price as Prisma.FloatNullableFilter).lte = maxPrice;
    }

    if (minBedrooms !== undefined || maxBedrooms !== undefined) {
      where.bedrooms = {};
      if (minBedrooms !== undefined) (where.bedrooms as Prisma.IntNullableFilter).gte = minBedrooms;
      if (maxBedrooms !== undefined) (where.bedrooms as Prisma.IntNullableFilter).lte = maxBedrooms;
    }

    if (minBathrooms !== undefined) {
      where.bathrooms = { gte: minBathrooms };
    }

    if (minQualityScore !== undefined) {
      where.qualityScore = { gte: minQualityScore };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { locationText: { contains: search, mode: "insensitive" } },
        { area: { contains: search, mode: "insensitive" } },
        { agentName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          site: { select: { id: true, name: true, key: true } },
        },
      }),
      prisma.property.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  static async getById(id: string) {
    const property = await prisma.property.findFirst({
      where: { id, deletedAt: null },
      include: {
        site: { select: { id: true, name: true, key: true, baseUrl: true } },
        _count: { select: { versions: true, priceHistory: true } },
      },
    });

    return property;
  }

  static async create(data: CreatePropertyInput, changeSource: ChangeSource = "MANUAL_EDIT", changedBy?: string) {
    const hash = DedupService.generateHash({
      title: data.title,
      listingUrl: data.listingUrl,
      source: data.source,
    });

    // Check for exact duplicate
    const existing = await DedupService.findExisting(hash);
    if (existing) {
      return { property: null, duplicate: true, existingId: existing.id };
    }

    // Compute quality score
    const { total: qualityScore } = QualityService.score(data);

    const property = await prisma.property.create({
      data: {
        ...data,
        hash,
        qualityScore,
        scrapeTimestamp: data.scrapeTimestamp ? new Date(data.scrapeTimestamp) : undefined,
      },
      include: {
        site: { select: { id: true, name: true, key: true } },
      },
    });

    // Create initial price history if price exists
    if (data.price) {
      await prisma.priceHistory.create({
        data: {
          propertyId: property.id,
          price: data.price,
          source: changeSource,
        },
      });
    }

    // Sync to Meilisearch
    MeiliService.upsertProperty(property.id);

    Logger.info(`Property created: ${property.id} (quality: ${qualityScore})`);
    return { property, duplicate: false };
  }

  static async update(id: string, data: UpdatePropertyInput, changeSource: ChangeSource = "MANUAL_EDIT", changedBy?: string) {
    const current = await prisma.property.findFirst({
      where: { id, deletedAt: null },
    });

    if (!current) return null;

    // Recompute quality score with merged data
    const merged = { ...current, ...data };
    const { total: qualityScore } = QualityService.score(merged);

    // Create version diff
    const currentData = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
    const newData = { ...currentData, ...data, qualityScore };

    await VersionService.createVersion({
      propertyId: id,
      previousData: currentData,
      newData,
      changeSource,
      changedBy,
    });

    const updated = await prisma.property.update({
      where: { id },
      data: {
        ...data,
        qualityScore,
      },
      include: {
        site: { select: { id: true, name: true, key: true } },
      },
    });

    // Sync to Meilisearch
    MeiliService.upsertProperty(updated.id);

    Logger.info(`Property updated: ${id} (version ${updated.currentVersion})`);
    return updated;
  }

  static async softDelete(id: string) {
    const property = await prisma.property.findFirst({
      where: { id, deletedAt: null },
    });

    if (!property) return null;

    const result = await prisma.property.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Remove from Meilisearch
    MeiliService.deleteProperty(id);

    return result;
  }

  static async restore(id: string) {
    const result = await prisma.property.update({
      where: { id },
      data: { deletedAt: null },
    });

    // Restore to Meilisearch
    MeiliService.upsertProperty(id);

    return result;
  }

  static async bulkAction(ids: string[], action: string, changedBy?: string) {
    const statusMap: Record<string, Record<string, unknown>> = {
      verify: { verificationStatus: "VERIFIED" },
      reject: { verificationStatus: "REJECTED" },
      flag: { verificationStatus: "FLAGGED" },
      delete: { deletedAt: new Date() },
      restore: { deletedAt: null },
    };

    const updateData = statusMap[action];
    if (!updateData) throw new Error(`Unknown action: ${action}`);

    const result = await prisma.property.updateMany({
      where: { id: { in: ids }, deletedAt: action === "restore" ? { not: null } : null },
      data: updateData,
    });

    // Sync changes to Meilisearch
    for (const id of ids) {
      if (action === "delete") {
        MeiliService.deleteProperty(id);
      } else {
        MeiliService.upsertProperty(id);
      }
    }

    Logger.info(`Bulk ${action}: ${result.count} properties affected`);
    return result;
  }

  static async getStats() {
    const [total, byCategory, byListingType, byStatus, avgQuality, newToday] = await Promise.all([
      prisma.property.count({ where: { deletedAt: null } }),
      prisma.property.groupBy({
        by: ["category"],
        where: { deletedAt: null },
        _count: true,
      }),
      prisma.property.groupBy({
        by: ["listingType"],
        where: { deletedAt: null },
        _count: true,
      }),
      prisma.property.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: true,
      }),
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
      total,
      newToday,
      avgQualityScore: Math.round(avgQuality._avg.qualityScore || 0),
      byCategory: byCategory.map((g) => ({ category: g.category, count: g._count })),
      byListingType: byListingType.map((g) => ({ listingType: g.listingType, count: g._count })),
      byStatus: byStatus.map((g) => ({ status: g.status, count: g._count })),
    };
  }

  static async enrich(id: string, enrichmentData: Record<string, unknown>) {
    return this.update(id, enrichmentData as UpdatePropertyInput, "ENRICHMENT");
  }
}
