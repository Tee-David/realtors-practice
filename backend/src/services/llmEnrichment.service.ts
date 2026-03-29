import { config } from "../config/env";
import { Logger } from "../utils/logger.util";
import prisma from "../prismaClient";
import { PropertyService } from "./property.service";

/**
 * LLM-based property enrichment service.
 * Uses free-tier AI providers (Groq, Cerebras, SambaNova) to extract
 * structured data from EXISTING property descriptions and titles.
 *
 * CRITICAL: The LLM must ONLY extract information already present in the
 * property data. It must NOT hallucinate or invent details.
 */
export class LLMEnrichmentService {
  /**
   * Provider fallback chain — tries each provider in order until one succeeds.
   */
  private static readonly PROVIDERS = [
    {
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "qwen-qwq-32b",
      getKey: () => config.ai.groqApiKey,
    },
    {
      name: "cerebras",
      url: "https://api.cerebras.ai/v1/chat/completions",
      model: "qwen3-32b",
      getKey: () => config.ai.cerebrasApiKey,
    },
    {
      name: "sambanova",
      url: "https://api.sambanova.ai/v1/chat/completions",
      model: "Qwen3-32B",
      getKey: () => config.ai.sambanovaApiKey,
    },
  ];

  /**
   * Build the extraction prompt. Emphasizes ONLY extracting info from the
   * given text — never inventing data.
   */
  private static buildPrompt(property: Record<string, any>): string {
    const title = property.title || "";
    const description = property.description || "";
    const locationText = property.locationText || "";
    const area = property.area || "";
    const state = property.state || "";
    const features = Array.isArray(property.features) ? property.features.join(", ") : "";

    return `You are a Nigerian real estate data extraction assistant. Your job is to extract structured information from a property listing.

CRITICAL RULES:
1. ONLY extract information that is explicitly stated or clearly implied in the provided text.
2. NEVER invent, guess, or hallucinate any data.
3. If a field cannot be determined from the text, set it to null.
4. For features/amenities, only list those mentioned in the description or title.
5. Be conservative — it is better to return null than to guess.

Here is the property listing data:

TITLE: ${title}
DESCRIPTION: ${description}
LOCATION TEXT: ${locationText}
AREA: ${area}
STATE: ${state}
EXISTING FEATURES: ${features}
CURRENT BEDROOMS: ${property.bedrooms ?? "unknown"}
CURRENT BATHROOMS: ${property.bathrooms ?? "unknown"}
CURRENT PROPERTY TYPE: ${property.propertyType ?? "unknown"}
CURRENT FURNISHING: ${property.furnishing ?? "unknown"}

Extract the following fields. Respond ONLY with a valid JSON object — no markdown, no explanation, no text before or after the JSON.

{
  "propertyType": "string or null — e.g. Flat, Duplex, Detached House, Semi-Detached, Terrace, Bungalow, Penthouse, Maisonette, Mini Flat, Self Contain, Studio, Mansion, Warehouse, Office Space, Shop, Land",
  "propertySubtype": "string or null — more specific type if mentioned",
  "bedrooms": "number or null — only if mentioned in text and currently unknown",
  "bathrooms": "number or null — only if mentioned in text and currently unknown",
  "toilets": "number or null — only if mentioned in text",
  "bq": "number or null — boys quarters count if mentioned",
  "floors": "number or null — number of floors/storeys if mentioned",
  "furnishing": "FURNISHED, SEMI_FURNISHED, UNFURNISHED, or null — only if mentioned",
  "condition": "NEW, RENOVATED, GOOD, FAIR, OLD, or null — only if mentioned",
  "features": ["array of amenities/features mentioned in description — e.g. Swimming Pool, Gym, 24hr Power, Borehole, Security, CCTV, Generator, BQ, etc."],
  "landmarks": ["array of nearby landmarks mentioned — e.g. estate names, roads, shopping centers"],
  "estateName": "string or null — estate or complex name if mentioned",
  "streetName": "string or null — street name if mentioned",
  "area": "string or null — area/neighborhood if determinable and currently missing",
  "lga": "string or null — local government area if mentioned",
  "parkingSpaces": "number or null — if mentioned",
  "yearBuilt": "number or null — if mentioned",
  "searchKeywords": ["array of 3-8 relevant search keywords extracted from the listing"]
}`;
  }

  /**
   * Call an OpenAI-compatible chat completion endpoint.
   */
  private static async callProvider(
    provider: (typeof LLMEnrichmentService.PROVIDERS)[0],
    prompt: string
  ): Promise<Record<string, any> | null> {
    const apiKey = provider.getKey();
    if (!apiKey) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: "You are a data extraction assistant. Respond ONLY with valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        Logger.warn(`LLM provider ${provider.name} returned ${res.status}`);
        return null;
      }

      const data = await res.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        Logger.warn(`LLM provider ${provider.name} returned non-JSON response`);
        return null;
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err: any) {
      clearTimeout(timeout);
      Logger.warn(`LLM provider ${provider.name} failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Clean and validate the LLM response — remove null/undefined fields,
   * skip fields that already have values in the property, and ensure
   * types are correct.
   */
  private static cleanEnrichmentData(
    extracted: Record<string, any>,
    existing: Record<string, any>
  ): Record<string, any> {
    const enriched: Record<string, any> = {};

    // String fields — only set if extracted is non-null and existing is empty
    const stringFields = [
      "propertyType", "propertySubtype", "estateName", "streetName", "area", "lga",
    ];
    for (const field of stringFields) {
      if (extracted[field] && typeof extracted[field] === "string" && !existing[field]) {
        enriched[field] = extracted[field];
      }
    }

    // Integer fields — only set if extracted is a valid number and existing is null
    const intFields = ["bedrooms", "bathrooms", "toilets", "bq", "floors", "parkingSpaces", "yearBuilt"];
    for (const field of intFields) {
      const val = extracted[field];
      if (val != null && !isNaN(Number(val)) && existing[field] == null) {
        enriched[field] = Math.round(Number(val));
      }
    }

    // Enum fields with validation
    if (extracted.furnishing && !existing.furnishing || existing.furnishing === "UNKNOWN") {
      const validFurnishing = ["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"];
      if (validFurnishing.includes(extracted.furnishing)) {
        enriched.furnishing = extracted.furnishing;
      }
    }

    if (extracted.condition && (!existing.condition || existing.condition === "UNKNOWN")) {
      const validCondition = ["NEW", "RENOVATED", "GOOD", "FAIR", "OLD"];
      if (validCondition.includes(extracted.condition)) {
        enriched.condition = extracted.condition;
      }
    }

    // Array fields — merge with existing
    if (Array.isArray(extracted.features) && extracted.features.length > 0) {
      const existingFeatures = Array.isArray(existing.features) ? existing.features : [];
      const merged = [...new Set([...existingFeatures, ...extracted.features.filter((f: any) => typeof f === "string")])];
      if (merged.length > existingFeatures.length) {
        enriched.features = merged;
      }
    }

    if (Array.isArray(extracted.landmarks) && extracted.landmarks.length > 0) {
      const existingLandmarks = Array.isArray(existing.landmarks) ? existing.landmarks : [];
      const merged = [...new Set([...existingLandmarks, ...extracted.landmarks.filter((l: any) => typeof l === "string")])];
      if (merged.length > existingLandmarks.length) {
        enriched.landmarks = merged;
      }
    }

    if (Array.isArray(extracted.searchKeywords) && extracted.searchKeywords.length > 0) {
      const existingKw = Array.isArray(existing.searchKeywords) ? existing.searchKeywords : [];
      const merged = [...new Set([...existingKw, ...extracted.searchKeywords.filter((k: any) => typeof k === "string")])];
      if (merged.length > existingKw.length) {
        enriched.searchKeywords = merged;
      }
    }

    return enriched;
  }

  /**
   * Enrich a single property by ID using LLM extraction.
   * Returns the enriched fields or null if enrichment failed/yielded nothing.
   */
  static async enrichProperty(propertyId: string): Promise<{
    success: boolean;
    enrichedFields: string[];
    provider?: string;
    error?: string;
  }> {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });

    if (!property) {
      return { success: false, enrichedFields: [], error: "Property not found" };
    }

    // Skip if there's no text content to extract from
    if (!property.title && !property.description) {
      return { success: false, enrichedFields: [], error: "No title or description to extract from" };
    }

    const prompt = this.buildPrompt(property as Record<string, any>);

    // Try providers in order
    let extracted: Record<string, any> | null = null;
    let usedProvider = "";

    for (const provider of this.PROVIDERS) {
      extracted = await this.callProvider(provider, prompt);
      if (extracted) {
        usedProvider = provider.name;
        break;
      }
    }

    if (!extracted) {
      return { success: false, enrichedFields: [], error: "All LLM providers failed" };
    }

    // Clean and validate
    const enriched = this.cleanEnrichmentData(extracted, property as Record<string, any>);
    const enrichedFields = Object.keys(enriched);

    if (enrichedFields.length === 0) {
      return { success: true, enrichedFields: [], provider: usedProvider };
    }

    // Apply enrichment via PropertyService.enrich (creates version history)
    await PropertyService.enrich(propertyId, enriched);

    Logger.info(`LLM enriched property ${propertyId}: ${enrichedFields.join(", ")} (via ${usedProvider})`);
    return { success: true, enrichedFields, provider: usedProvider };
  }

  /**
   * Enrich all properties belonging to a specific site.
   * Returns a summary of results.
   */
  static async enrichBySite(siteId: string): Promise<{
    total: number;
    enriched: number;
    skipped: number;
    failed: number;
    details: Array<{ propertyId: string; status: string; fields?: string[] }>;
  }> {
    const properties = await prisma.property.findMany({
      where: { siteId, deletedAt: null },
      select: { id: true, title: true, description: true },
    });

    const result = {
      total: properties.length,
      enriched: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<{ propertyId: string; status: string; fields?: string[] }>,
    };

    // Process sequentially to respect rate limits
    for (const prop of properties) {
      // Skip properties with no description
      if (!prop.title && !prop.description) {
        result.skipped++;
        result.details.push({ propertyId: prop.id, status: "skipped" });
        continue;
      }

      try {
        const enrichResult = await this.enrichProperty(prop.id);
        if (enrichResult.success && enrichResult.enrichedFields.length > 0) {
          result.enriched++;
          result.details.push({ propertyId: prop.id, status: "enriched", fields: enrichResult.enrichedFields });
        } else if (enrichResult.success) {
          result.skipped++;
          result.details.push({ propertyId: prop.id, status: "no_new_data" });
        } else {
          result.failed++;
          result.details.push({ propertyId: prop.id, status: "failed" });
        }
      } catch (err: any) {
        result.failed++;
        result.details.push({ propertyId: prop.id, status: "error" });
        Logger.error(`LLM enrichment error for ${prop.id}: ${err.message}`);
      }

      // Small delay between calls to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    Logger.info(`LLM batch enrichment for site ${siteId}: ${result.enriched}/${result.total} enriched`);
    return result;
  }

  /**
   * Get count of properties for a given site (for confirmation dialog).
   */
  static async getCountBySite(siteId: string): Promise<number> {
    return prisma.property.count({
      where: { siteId, deletedAt: null },
    });
  }
}
