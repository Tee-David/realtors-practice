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
    category?: string;
    area?: string;
  };
}

// Common Nigerian property areas for NL detection
const NIGERIAN_AREAS: string[] = [
  "lekki", "ikoyi", "victoria island", "vi", "ajah", "ikeja", "surulere",
  "yaba", "gbagada", "ojodu", "maryland", "festac", "agege", "oshodi",
  "isolo", "apapa", "ebute metta", "magodo", "omole", "shangisha", "ketu",
  "mile 2", "mile 12", "ojota", "berger", "ogba", "pen cinema", "wuse",
  "maitama", "asokoro", "garki", "gwarinpa", "jabi", "life camp", "lugbe",
  "kubwa", "durumi", "apo", "gudu", "lokogoma", "katampe", "banana island",
  "chevron", "jakande", "sangotedo", "abraham adesanya", "orchid", "lafiaji",
  "oniru", "marina", "cms", "obanikoro", "shomolu", "bariga", "mushin",
  "ikotun", "igando", "egbeda", "abule egba", "iyana ipaja", "alimosho",
  "rumuola", "rumuomasi", "rumuola", "eliozu", "woji", "ada george",
  "trans amadi", "obio akpor", "gra port harcourt", "new gra",
  "enugu gra", "independence layout", "trans ekulu", "new haven",
  "kano gra", "nassarawa gra", "ibadan", "bodija", "ui",
];

const NIGERIAN_AREAS_DISPLAY: Record<string, string> = {
  "vi": "Victoria Island",
};

export class SearchService {
  private static readonly INDEX_NAME = "properties";

  /**
   * Parse natural language property queries using regex.
   * Understands: prices ("under 5M", "above 2M", "30k"),
   * bedrooms ("3 bed", "3br", "3 bedroom"), areas (Lagos neighbourhoods),
   * listing types ("for rent", "to let", "for sale"), and property types.
   */
  static parseNaturalLanguage(query: string): ParsedQuery {
    const extracted: ParsedQuery["extracted"] = {};
    const filters: string[] = [];
    let cleanQuery = query.toLowerCase();

    // ── Helper: parse Nigerian price notation
    // Handles: "5M", "5 million", "200k", "200 thousand", "30k", bare numbers
    function parseNigerianPrice(raw: string): number {
      const val = parseFloat(raw.replace(/,/g, ""));
      return val; // multiplier applied at call site
    }

    // 1. Max price: "under 5M", "less than 2M", "up to 200k", "max 5m", "< 5m"
    const maxPriceMatch = cleanQuery.match(
      /(?:under|less than|up to|max|<)\s*(\d+(?:[.,]\d+)?)\s*(m(?:illion)?|k(?:thousand)?|billion|bn)?/
    );
    if (maxPriceMatch) {
      const amount = parseNigerianPrice(maxPriceMatch[1]);
      const suffix = (maxPriceMatch[2] || "").toLowerCase();
      const multiplier = suffix.startsWith("b") ? 1_000_000_000
        : suffix.startsWith("m") ? 1_000_000
        : suffix.startsWith("k") ? 1_000
        : 1;
      extracted.maxPrice = amount * multiplier;
      filters.push(`price <= ${extracted.maxPrice}`);
      cleanQuery = cleanQuery.replace(maxPriceMatch[0], "");
    }

    // 2. Min price: "above 2M", "over 2M", "more than 200k", "> 5m"
    const minPriceMatch = cleanQuery.match(
      /(?:above|over|more than|min|>)\s*(\d+(?:[.,]\d+)?)\s*(m(?:illion)?|k(?:thousand)?|billion|bn)?/
    );
    if (minPriceMatch) {
      const amount = parseNigerianPrice(minPriceMatch[1]);
      const suffix = (minPriceMatch[2] || "").toLowerCase();
      const multiplier = suffix.startsWith("b") ? 1_000_000_000
        : suffix.startsWith("m") ? 1_000_000
        : suffix.startsWith("k") ? 1_000
        : 1;
      extracted.minPrice = amount * multiplier;
      filters.push(`price >= ${extracted.minPrice}`);
      cleanQuery = cleanQuery.replace(minPriceMatch[0], "");
    }

    // 3. Bedrooms: "3 bed", "3 beds", "3 bedroom", "3 bedrooms", "3br", "3bhk"
    const bedMatch = cleanQuery.match(/(\d+)\s*(?:bed(?:room)?s?|br|bhk)\b/);
    if (bedMatch) {
      extracted.bedrooms = parseInt(bedMatch[1], 10);
      filters.push(`bedrooms = ${extracted.bedrooms}`);
      cleanQuery = cleanQuery.replace(bedMatch[0], "");
    }

    // 4. Listing type: "for rent", "to let", "to lease" → RENT
    //                  "for sale", "to buy", "to purchase" → SALE
    //                  "shortlet", "short let", "short-let" → SHORTLET
    //                  "for lease" → LEASE
    if (/\b(?:for\s+rent|to\s+let|for\s+letting|to\s+lease(?!\s+hold))\b/.test(cleanQuery)) {
      extracted.listingType = "RENT";
      filters.push(`listingType = RENT`);
      cleanQuery = cleanQuery.replace(/\b(?:for\s+rent|to\s+let|for\s+letting|to\s+lease)\b/g, "");
    } else if (/\b(?:for\s+sale|to\s+buy|to\s+purchase)\b/.test(cleanQuery)) {
      extracted.listingType = "SALE";
      filters.push(`listingType = SALE`);
      cleanQuery = cleanQuery.replace(/\b(?:for\s+sale|to\s+buy|to\s+purchase)\b/g, "");
    } else if (/\b(?:short[\s-]?let|shortlet)\b/.test(cleanQuery)) {
      extracted.listingType = "SHORTLET";
      filters.push(`listingType = SHORTLET`);
      cleanQuery = cleanQuery.replace(/\b(?:short[\s-]?let|shortlet)\b/g, "");
    } else if (/\b(?:for\s+lease|leasehold)\b/.test(cleanQuery)) {
      extracted.listingType = "LEASE";
      filters.push(`listingType = LEASE`);
      cleanQuery = cleanQuery.replace(/\b(?:for\s+lease|leasehold)\b/g, "");
    } else if (/\brent\b/.test(cleanQuery)) {
      extracted.listingType = "RENT";
      filters.push(`listingType = RENT`);
      cleanQuery = cleanQuery.replace(/\brent\b/g, "");
    } else if (/\b(?:sale|buy)\b/.test(cleanQuery)) {
      extracted.listingType = "SALE";
      filters.push(`listingType = SALE`);
      cleanQuery = cleanQuery.replace(/\b(?:sale|buy)\b/g, "");
    }

    // 5. Property type → category mapping
    const typeMap: Record<string, { propertyType: string; category: string }> = {
      "flat": { propertyType: "Flat", category: "RESIDENTIAL" },
      "apartment": { propertyType: "Flat", category: "RESIDENTIAL" },
      "mini flat": { propertyType: "Mini Flat", category: "RESIDENTIAL" },
      "self contain": { propertyType: "Self Contain", category: "RESIDENTIAL" },
      "selfcon": { propertyType: "Self Contain", category: "RESIDENTIAL" },
      "studio": { propertyType: "Studio", category: "RESIDENTIAL" },
      "duplex": { propertyType: "Duplex", category: "RESIDENTIAL" },
      "bungalow": { propertyType: "Bungalow", category: "RESIDENTIAL" },
      "terrace": { propertyType: "Terrace", category: "RESIDENTIAL" },
      "semi-detached": { propertyType: "Semi-Detached", category: "RESIDENTIAL" },
      "semi detached": { propertyType: "Semi-Detached", category: "RESIDENTIAL" },
      "detached": { propertyType: "Detached House", category: "RESIDENTIAL" },
      "mansion": { propertyType: "Mansion", category: "RESIDENTIAL" },
      "penthouse": { propertyType: "Penthouse", category: "RESIDENTIAL" },
      "maisonette": { propertyType: "Maisonette", category: "RESIDENTIAL" },
      "house": { propertyType: "Detached House", category: "RESIDENTIAL" },
      "land": { propertyType: "Land", category: "LAND" },
      "plot": { propertyType: "Land", category: "LAND" },
      "commercial land": { propertyType: "Commercial Land", category: "LAND" },
      "office": { propertyType: "Office Space", category: "COMMERCIAL" },
      "office space": { propertyType: "Office Space", category: "COMMERCIAL" },
      "shop": { propertyType: "Shop", category: "COMMERCIAL" },
      "warehouse": { propertyType: "Warehouse", category: "COMMERCIAL" },
      "showroom": { propertyType: "Showroom", category: "COMMERCIAL" },
      "factory": { propertyType: "Factory", category: "INDUSTRIAL" },
    };

    for (const [keyword, mapping] of Object.entries(typeMap)) {
      const escapedKeyword = keyword.replace(/[-]/g, "\\s*");
      const regex = new RegExp(`\\b${escapedKeyword}\\b`);
      if (regex.test(cleanQuery)) {
        extracted.propertyType = mapping.propertyType;
        extracted.category = mapping.category;
        // Don't remove from cleanQuery — it helps text search relevance
        break;
      }
    }

    // 6. Area detection — Lagos / Abuja / PH neighbourhoods
    for (const area of NIGERIAN_AREAS) {
      // Match "in lekki", "lekki", "at vi", etc.
      const areaRegex = new RegExp(`\\b(?:in|at|around|near)?\\s*${area.replace(/\s+/g, "\\s+")}\\b`);
      if (areaRegex.test(cleanQuery)) {
        // Store display name (expand abbreviation if known)
        extracted.area = NIGERIAN_AREAS_DISPLAY[area] || area.replace(/\b\w/g, (c) => c.toUpperCase());
        // Don't filter on area at Meilisearch level since area is a text field
        // (exact match filter would be too strict for partial location text)
        // Instead we keep it in the clean query for text search
        break;
      }
    }

    // Clean up remaining query: remove stopwords
    cleanQuery = cleanQuery
      .replace(/\b(?:in|for|a|an|the|with|at|near|around)\b/g, "")
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

      // Active Scrape Trigger on zero results
      if (result.hits.length === 0 && q && q.length > 2) {
        this.triggerActiveScrape(parsed.cleanQuery, parsed.extracted);
      }

      return {
        hits: result.hits,
        query: parsed.cleanQuery,
        extracted: parsed.extracted,
        // parsedQuery is the same as extracted — exposed so the frontend can display
        // a human-readable "AI interpreted" summary of the NL filters applied
        parsedQuery: Object.keys(parsed.extracted).length > 0 ? parsed.extracted : null,
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
   * Automatically trigger a scrape if no results were found for a specific query.
   */
  private static async triggerActiveScrape(q: string, extractedParams: ParsedQuery["extracted"]) {
    try {
      const scraperUrl = process.env.SCRAPER_URL || "http://localhost:8000";
      const internalApiKey = process.env.INTERNAL_API_KEY || "internal_secret_key";

      // Basic parameter mapping
      const params = [];
      if (q) params.push(q);
      if (extractedParams.listingType) params.push(extractedParams.listingType.toLowerCase());
      if (extractedParams.bedrooms) params.push(`${extractedParams.bedrooms} bedroom`);
      
      const combinedSearchString = params.join(" ");

      if (!combinedSearchString) return;

      Logger.info(`Triggering active scrape for 0-result query: "${combinedSearchString}"`);

      // We don't await this, let it run in the background
      fetch(`${scraperUrl}/api/scrape/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": internalApiKey,
        },
        body: JSON.stringify({
          sites: ["propertypro", "nigeriapropertycentre"],
          parameters: {
            keyword: combinedSearchString
          }
        }),
      }).catch((e: any) => {
        Logger.error(`Failed to trigger active scrape: ${e.message}`);
      });
    } catch (error: any) {
      Logger.error(`Error initiating active scrape: ${error.message}`);
    }
  }

  /**
   * Get search suggestions as the user types (minimal hits, just titles/locations)
   */
  static async getSuggestions(q: string, limit = 5) {
    if (!meiliClient || !q || q.length < 2) return [];

    try {
      // Parse query to handle complex strings like "3 bed flat in magodo under 5m"
      const parsed = this.parseNaturalLanguage(q);
      const filterString = parsed.filters.length > 0 ? parsed.filters.join(" AND ") : undefined;

      const result = await meiliClient.index(this.INDEX_NAME).search(parsed.cleanQuery, {
        limit,
        filter: filterString,
        attributesToRetrieve: ["title", "location", "categoryName", "listingType", "price"],
      });
      return result.hits;
    } catch (err: any) {
      Logger.error(`Suggestion fetch failed: ${err.message}`);
      return [];
    }
  }
}
