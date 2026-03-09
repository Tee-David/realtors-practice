import prisma from "../utils/prisma.util";

export class SiteAnalyticsService {
  /**
   * Calculates a quality ranking score out of 100 for all sites.
   * Based on:
   * 1. Freshness (properties updated < 7 days ago)
   * 2. Completeness (average property quality score)
   * 3. Volume (number of listings / reasonable max to boost score slightly)
   */
  public static async getSiteRankings() {
    // 1. Fetch all active sites
    const sites = await prisma.site.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        url: true,
        logoUrl: true,
        scrapeInterval: true,
      },
    });

    if (!sites.length) return [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Prepare results
    const rankings = await Promise.all(
      sites.map(async (site) => {
        // Stats: Total Properties for this site
        const totalProperties = await prisma.property.count({
          where: { siteId: site.id },
        });

        // Stats: Fresh Properties (< 7 days)
        const freshProperties = await prisma.property.count({
          where: {
            siteId: site.id,
            updatedAt: { gte: sevenDaysAgo },
          },
        });

        // Stats: Average Quality Score
        const aggregations = await prisma.property.aggregate({
          where: { siteId: site.id },
          _avg: { qualityScore: true },
        });

        const avgQuality = aggregations._avg.qualityScore || 0;

        // Formula Calculation
        if (totalProperties === 0) {
          return {
            site,
            score: 0,
            metrics: {
              totalProperties: 0,
              freshnessPercent: 0,
              avgQuality: 0,
            },
          };
        }

        const freshnessPercent = (freshProperties / totalProperties) * 100;
        
        // Final Score (Weight: 60% Quality, 40% Freshness) - we can adjust this
        const qualityWeight = 0.6;
        const freshnessWeight = 0.4;
        
        const finalScore = Math.round((avgQuality * qualityWeight) + (freshnessPercent * freshnessWeight));

        return {
          site,
          score: Math.min(100, Math.max(0, finalScore)), // Clamp to 0-100
          metrics: {
            totalProperties,
            freshnessPercent: Math.round(freshnessPercent),
            avgQuality: Math.round(avgQuality),
          },
        };
      })
    );

    // Sort by descending score
    return rankings.sort((a, b) => b.score - a.score);
  }
}
