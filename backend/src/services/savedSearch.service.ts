import prisma from "../prismaClient";
import { Logger } from "../utils/logger.util";

interface SavedSearchFilters {
  listingType?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  state?: string;
  area?: string;
  features?: string[];
  propertyType?: string;
}

export class SavedSearchService {
  /**
   * Create a new saved search
   */
  static async create(data: {
    userId: string;
    name: string;
    description?: string;
    filters: SavedSearchFilters;
    naturalQuery?: string;
    notifyEmail?: boolean;
    notifyInApp?: boolean;
  }) {
    return prisma.savedSearch.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description,
        filters: data.filters as any,
        naturalQuery: data.naturalQuery,
        notifyEmail: data.notifyEmail ?? false,
        notifyInApp: data.notifyInApp ?? true,
      },
    });
  }

  /**
   * Get all saved searches for a user
   */
  static async getAllByUser(userId: string) {
    return prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { matches: true },
        },
      },
    });
  }

  /**
   * Get a single saved search by ID (must belong to user)
   */
  static async getById(id: string, userId: string) {
    return prisma.savedSearch.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { matches: true },
        },
      },
    });
  }

  /**
   * Update a saved search
   */
  static async update(
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      filters?: SavedSearchFilters;
      naturalQuery?: string;
      isActive?: boolean;
      notifyEmail?: boolean;
      notifyInApp?: boolean;
    }
  ) {
    // Verify ownership
    const existing = await prisma.savedSearch.findFirst({ where: { id, userId } });
    if (!existing) return null;

    return prisma.savedSearch.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.filters !== undefined && { filters: data.filters as any }),
        ...(data.naturalQuery !== undefined && { naturalQuery: data.naturalQuery }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.notifyEmail !== undefined && { notifyEmail: data.notifyEmail }),
        ...(data.notifyInApp !== undefined && { notifyInApp: data.notifyInApp }),
      },
    });
  }

  /**
   * Delete a saved search
   */
  static async delete(id: string, userId: string) {
    const existing = await prisma.savedSearch.findFirst({ where: { id, userId } });
    if (!existing) return null;

    await prisma.savedSearchMatch.deleteMany({ where: { savedSearchId: id } });
    return prisma.savedSearch.delete({ where: { id } });
  }

  /**
   * Get matches for a saved search
   */
  static async getMatches(
    savedSearchId: string,
    userId: string,
    options: { limit?: number; offset?: number; unseenOnly?: boolean } = {}
  ) {
    const { limit = 20, offset = 0, unseenOnly = false } = options;

    // Verify ownership
    const search = await prisma.savedSearch.findFirst({
      where: { id: savedSearchId, userId },
    });
    if (!search) return null;

    const where: any = { savedSearchId };
    if (unseenOnly) where.seen = false;

    const [matches, total] = await Promise.all([
      prisma.savedSearchMatch.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              title: true,
              price: true,
              listingType: true,
              category: true,
              area: true,
              state: true,
              bedrooms: true,
              bathrooms: true,
              images: true,
              qualityScore: true,
              createdAt: true,
            },
          },
        },
        orderBy: { matchedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.savedSearchMatch.count({ where }),
    ]);

    return { matches, total };
  }

  /**
   * Mark matches as seen
   */
  static async markMatchesSeen(savedSearchId: string, userId: string) {
    const search = await prisma.savedSearch.findFirst({
      where: { id: savedSearchId, userId },
    });
    if (!search) return null;

    return prisma.savedSearchMatch.updateMany({
      where: { savedSearchId, seen: false },
      data: { seen: true },
    });
  }

  /**
   * Check a single saved search for new matches
   */
  static async checkMatches(savedSearchId: string): Promise<number> {
    const search = await prisma.savedSearch.findUnique({
      where: { id: savedSearchId },
    });
    if (!search || !search.isActive) return 0;

    const filters = search.filters as unknown as SavedSearchFilters;
    const where: any = { deletedAt: null };

    if (filters.listingType) where.listingType = filters.listingType;
    if (filters.category) where.category = filters.category;
    if (filters.state) where.state = filters.state;
    if (filters.area) where.area = { contains: filters.area, mode: "insensitive" };
    if (filters.bedrooms) where.bedrooms = filters.bedrooms;
    if (filters.propertyType) where.propertyType = { contains: filters.propertyType, mode: "insensitive" };
    if (filters.minPrice || filters.maxPrice) {
      where.price = {};
      if (filters.minPrice) where.price.gte = filters.minPrice;
      if (filters.maxPrice) where.price.lte = filters.maxPrice;
    }

    // Only find properties created/updated since last check
    if (search.lastCheckedAt) {
      where.updatedAt = { gte: search.lastCheckedAt };
    }

    const matchingProperties = await prisma.property.findMany({
      where,
      select: { id: true },
      take: 100, // cap to avoid runaway queries
    });

    if (matchingProperties.length === 0) {
      await prisma.savedSearch.update({
        where: { id: savedSearchId },
        data: { lastCheckedAt: new Date() },
      });
      return 0;
    }

    // Create matches (skip duplicates)
    let newMatches = 0;
    for (const prop of matchingProperties) {
      try {
        await prisma.savedSearchMatch.create({
          data: {
            savedSearchId,
            propertyId: prop.id,
          },
        });
        newMatches++;
      } catch {
        // Unique constraint violation = already matched, skip
      }
    }

    // Update search metadata
    await prisma.savedSearch.update({
      where: { id: savedSearchId },
      data: {
        lastCheckedAt: new Date(),
        matchCount: { increment: newMatches },
        newSinceCheck: newMatches,
      },
    });

    return newMatches;
  }

  /**
   * Check ALL active saved searches for new matches
   * Called by cron job
   */
  static async checkAllActive(): Promise<{ searched: number; totalNewMatches: number }> {
    const activeSearches = await prisma.savedSearch.findMany({
      where: { isActive: true },
      select: { id: true, userId: true, name: true, notifyEmail: true, notifyInApp: true },
    });

    let totalNewMatches = 0;

    for (const search of activeSearches) {
      try {
        const newMatches = await this.checkMatches(search.id);
        totalNewMatches += newMatches;

        if (newMatches > 0) {
          Logger.info(
            `[SavedSearch] "${search.name}" (${search.id}): ${newMatches} new matches`
          );
        }
      } catch (err: any) {
        Logger.error(
          `[SavedSearch] Error checking "${search.name}" (${search.id}): ${err.message}`
        );
      }
    }

    return { searched: activeSearches.length, totalNewMatches };
  }
}
