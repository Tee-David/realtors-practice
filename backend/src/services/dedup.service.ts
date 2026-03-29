import crypto from "crypto";
import prisma from "../prismaClient";
import { VersionService } from "./version.service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DuplicateCluster {
  ids: string[];
  properties: DuplicateProperty[];
  similarity: number;
}

export interface DuplicateProperty {
  id: string;
  title: string;
  price: number | null;
  area: string | null;
  state: string | null;
  description: string | null;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
  source: string;
  listingUrl: string | null;
  qualityScore: number | null;
}

export interface MergeInput {
  keepId: string;
  deleteIds: string[];
  fieldOverrides?: Record<string, unknown>;
  mergedBy?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class DedupService {
  static generateHash(data: {
    title: string;
    listingUrl: string;
    source: string;
  }): string {
    const normalized = `${data.title.toLowerCase().trim()}|${data.listingUrl.trim()}|${data.source.toLowerCase().trim()}`;
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  static async findExisting(hash: string) {
    return prisma.property.findUnique({
      where: { hash },
      select: { id: true, hash: true, currentVersion: true },
    });
  }

  static async findFuzzyMatches(data: {
    title: string;
    price?: number | null;
    area?: string | null;
    state?: string | null;
  }) {
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    // Fuzzy: same price + same area
    if (data.price && data.area) {
      const priceTolerance = data.price * 0.05; // 5% tolerance
      where.price = {
        gte: data.price - priceTolerance,
        lte: data.price + priceTolerance,
      };
      where.area = data.area;
    }

    if (!data.price || !data.area) return [];

    const candidates = await prisma.property.findMany({
      where,
      select: { id: true, title: true, price: true, area: true, hash: true },
      take: 10,
    });

    // Simple title similarity check
    return candidates.filter((c) => {
      const similarity = this.titleSimilarity(data.title, c.title);
      return similarity > 0.7;
    });
  }

  /**
   * Find fuzzy duplicate clusters for the given property IDs (or all if none given).
   * Returns clusters of 2–5 similar properties.
   */
  static async findFuzzyMatchesById(
    propertyIds?: string[]
  ): Promise<DuplicateCluster[]> {
    const where: Record<string, unknown> = { deletedAt: null };
    if (propertyIds && propertyIds.length > 0) {
      where.id = { in: propertyIds };
    }

    const props = await prisma.property.findMany({
      where,
      select: {
        id: true,
        title: true,
        price: true,
        area: true,
        state: true,
        description: true,
        images: true,
        createdAt: true,
        updatedAt: true,
        source: true,
        listingUrl: true,
        qualityScore: true,
      },
      take: 500, // cap to avoid huge N² comparisons
    });

    const clustered = new Set<string>();
    const clusters: DuplicateCluster[] = [];

    for (let i = 0; i < props.length; i++) {
      if (clustered.has(props[i].id)) continue;
      const a = props[i];
      const group: typeof props = [a];

      for (let j = i + 1; j < props.length; j++) {
        if (clustered.has(props[j].id)) continue;
        const b = props[j];

        const titleSim = this.titleSimilarity(a.title, b.title);
        if (titleSim < 0.7) continue;

        // Price within 5%
        if (a.price != null && b.price != null) {
          const priceRatio = Math.abs(a.price - b.price) / Math.max(a.price, b.price);
          if (priceRatio > 0.05) continue;
        }

        // Same area or state (at least one must match, or both null)
        const areaMatch =
          (a.area && b.area && a.area.toLowerCase() === b.area.toLowerCase()) ||
          (a.state && b.state && a.state.toLowerCase() === b.state.toLowerCase());
        if (!areaMatch && (a.area || b.area || a.state || b.state)) continue;

        group.push(b);
        if (group.length >= 5) break;
      }

      if (group.length < 2) continue;

      // Mark all as clustered
      for (const p of group) clustered.add(p.id);

      // Average similarity (title sim of first pair as representative)
      const sim = this.titleSimilarity(group[0].title, group[1].title);

      clusters.push({
        ids: group.map((p) => p.id),
        similarity: Math.round(sim * 100) / 100,
        properties: group.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          area: p.area,
          state: p.state,
          description: p.description,
          images: Array.isArray(p.images) ? (p.images as string[]) : [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          source: p.source,
          listingUrl: p.listingUrl,
          qualityScore: p.qualityScore ?? null,
        })),
      });
    }

    return clusters;
  }

  /**
   * Merge duplicates: keep one property, soft-delete others, create version records.
   * Auto-picks best fields if no overrides are given.
   */
  static async mergeProperties(input: MergeInput) {
    const { keepId, deleteIds, fieldOverrides = {}, mergedBy } = input;

    const allIds = [keepId, ...deleteIds];
    const props = await prisma.property.findMany({
      where: { id: { in: allIds }, deletedAt: null },
    });

    const keepProp = props.find((p) => p.id === keepId);
    if (!keepProp) throw new Error(`Keep property ${keepId} not found`);

    // Auto-pick best fields from all duplicates
    const bestDescription = props
      .map((p) => p.description || "")
      .sort((a, b) => b.length - a.length)[0] || null;

    const bestImages = props
      .map((p) => (Array.isArray(p.images) ? (p.images as string[]) : []))
      .sort((a, b) => b.length - a.length)[0] || [];

    const mostRecentPrice = props
      .filter((p) => p.price != null)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0]?.price ?? keepProp.price;

    const mergedData: Record<string, unknown> = {
      description: bestDescription,
      images: bestImages,
      price: mostRecentPrice,
      ...fieldOverrides,
    };

    // Create version record before update
    const previousData: Record<string, unknown> = { ...keepProp } as Record<string, unknown>;
    const newData: Record<string, unknown> = { ...keepProp, ...mergedData } as Record<string, unknown>;

    await VersionService.createVersion({
      propertyId: keepId,
      previousData,
      newData,
      changeSource: "MANUAL_EDIT",
      changedBy: mergedBy,
      changeSummary: `Merged with ${deleteIds.length} duplicate(s): ${deleteIds.join(", ")}`,
    });

    // Update the kept property (version already incremented inside createVersion)
    const updated = await prisma.property.update({
      where: { id: keepId },
      data: mergedData as Record<string, unknown>,
    });

    // Soft-delete the duplicates
    const now = new Date();
    await prisma.property.updateMany({
      where: { id: { in: deleteIds } },
      data: { deletedAt: now },
    });

    return {
      kept: updated,
      deleted: deleteIds.length,
    };
  }

  private static titleSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) intersection++;
    }

    return (2 * intersection) / (wordsA.size + wordsB.size);
  }
}
