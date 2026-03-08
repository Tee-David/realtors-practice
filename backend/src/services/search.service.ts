import { meiliClient } from "../utils/meili.util";
import { Logger } from "../utils/logger.util";

interface ParsedQuery {
  naturalQuery: string;
  cleanQuery: string; // The query without the extracted filters
  filters: string[]; // Meilisearch filter strings
  extracted: {
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    listingType?: string;
    propertyType?: string;
  };
}

export class SearchService {
  private static readonly INDEX_NAME = "properties";

  /**
   * Extremely simple NLP parser via Regex
   * Understands: "under 5m", "3 bed", "flat", "rent", "in lekki"
   */
  static parseNaturalLanguage(query: string): ParsedQuery {
    const extracted: ParsedQuery["extracted"] = {};
    const filters: string[] = [];
    let cleanQuery = query.toLowerCase();

    // 1. Extract Price (under Xm, less than Xm, up to Xm)
    const priceMatch = cleanQuery.match(/(?:under|less than|up to|<) ?(\d+(?:\.\d+)?)[ ]?(m|million|k|thousand)/);
    if (priceMatch) {
      const amount = parseFloat(priceMatch[1]);
      const multiplier = priceMatch[2].startsWith("m") ? 1000000 : 1000;
      extracted.maxPrice = amount * multiplier;
      filters.push(`price <= ${extracted.maxPrice}`);
      cleanQuery = cleanQuery.replace(priceMatch[0], "");
    }

    // Over Xm
    const textOverMatch = cleanQuery.match(/(?:over|more than|above|>) ?(\d+(?:\.\d+)?)[ ]?(m|million|k|thousand)/);
    if (textOverMatch) {
      const amount = parseFloat(textOverMatch[1]);
      const multiplier = textOverMatch[2].startsWith("m") ? 1000000 : 1000;
      extracted.minPrice = amount * multiplier;
      filters.push(`price >= ${extracted.minPrice}`);
      cleanQuery = cleanQuery.replace(textOverMatch[0], "");
    }

    // 2. Extract Bedrooms (3 bed, 4bhk, 2 bedroom)
    const bedMatch = cleanQuery.match(/(\d+) ?(bed|bedroom|beds|bhk)/);
    if (bedMatch) {
      extracted.bedrooms = parseInt(bedMatch[1], 10);
      filters.push(`bedrooms = ${extracted.bedrooms}`);
      cleanQuery = cleanQuery.replace(bedMatch[0], "");
    }

    // 3. Extract Listing Type (rent, sale, shortlet, lease)
    if (cleanQuery.includes("rent") || cleanQuery.includes("letting")) {
      extracted.listingType = "RENT";
      filters.push(`listingType = RENT`);
      cleanQuery = cleanQuery.replace(/(?:for )?rent|letting/g, "");
    } else if (cleanQuery.includes("sale") || cleanQuery.includes("buy")) {
      extracted.listingType = "SALE";
      filters.push(`listingType = SALE`);
      cleanQuery = cleanQuery.replace(/(?:for )?sale|buy/g, "");
    } else if (cleanQuery.includes("shortlet") || cleanQuery.includes("short let")) {
      extracted.listingType = "SHORTLET";
      filters.push(`listingType = SHORTLET`);
      cleanQuery = cleanQuery.replace(/short[ -]?let/g, "");
    }

    // Clean up remaining query strictly for text search (remove stopwords like "in", "for", "a")
    cleanQuery = cleanQuery
      .replace(/\b(?:in|for|a|an|the|with)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return {
      naturalQuery: query,
      cleanQuery,
      filters,
      extracted,
    };
  }

  /**
   * Execute a search against Meilisearch
   */
  static async search(params: {
    q: string;
    limit?: number;
    offset?: number;
    facets?: string[];
    filters?: string[]; // Hard filters passed by UI
    sort?: string[];
  }) {
    if (!meiliClient) {
      throw new Error("Meilisearch is not configured");
    }

    const { q, limit = 20, offset = 0, facets = [], filters = [], sort } = params;

    try {
      // Clean up the query
      const parsed = this.parseNaturalLanguage(q);

      // Combine explicitly passed UI filters with NLP extracted filters
      const combinedFilters = [...filters, ...parsed.filters];
      const filterString = combinedFilters.length > 0 ? combinedFilters.join(" AND ") : undefined;

      const result = await meiliClient.index(this.INDEX_NAME).search(parsed.cleanQuery, {
        limit,
        offset,
        filter: filterString,
        facets,
        sort,
      });

      return {
        hits: result.hits,
        query: parsed.cleanQuery,
        extracted: parsed.extracted,
        estimatedTotalHits: result.estimatedTotalHits,
        facetDistribution: result.facetDistribution,
        processingTimeMs: result.processingTimeMs,
      };
    } catch (err: any) {
      Logger.error(`Search failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get search suggestions as the user types (minimal hits, just titles/locations)
   */
  static async getSuggestions(q: string, limit = 5) {
    if (!meiliClient || !q || q.length < 2) return [];

    try {
      // Don't NLP parse for suggestions since it's just typeahead
      const result = await meiliClient.index(this.INDEX_NAME).search(q, {
        limit,
        attributesToRetrieve: ["title", "location", "categoryName", "listingType", "price"],
      });
      return result.hits;
    } catch (err: any) {
      Logger.error(`Suggestion fetch failed: ${err.message}`);
      return [];
    }
  }
}
