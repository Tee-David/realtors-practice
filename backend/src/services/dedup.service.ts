import crypto from "crypto";
import prisma from "../prismaClient";

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
