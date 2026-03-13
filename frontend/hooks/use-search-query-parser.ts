"use client";

import { useMemo } from "react";

interface ParsedSearchQuery {
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  listingType?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  features?: string[];
  rawQuery: string;
}

const PROPERTY_TYPES = [
  "flat", "apartment", "duplex", "bungalow", "penthouse", "studio",
  "terrace", "detached", "semi-detached", "maisonette", "mansion",
  "house", "villa", "cottage", "land", "commercial", "office",
  "shop", "warehouse", "factory",
];

const LISTING_TYPES: Record<string, string> = {
  "for sale": "SALE",
  "to buy": "SALE",
  "buy": "SALE",
  "sale": "SALE",
  "for rent": "RENT",
  "to rent": "RENT",
  "rent": "RENT",
  "rental": "RENT",
  "shortlet": "SHORTLET",
  "short let": "SHORTLET",
  "short-let": "SHORTLET",
  "lease": "LEASE",
};

const FEATURES = [
  "pool", "swimming pool", "gym", "garden", "parking",
  "balcony", "terrace", "furnished", "serviced", "generator",
  "borehole", "security", "elevator", "lift", "waterfront",
];

/**
 * Client-side NLP-lite query parser for search queries.
 * Extracts structured information from natural language search queries.
 */
export function useSearchQueryParser(query: string): ParsedSearchQuery {
  return useMemo(() => {
    const normalized = query.toLowerCase().trim();
    const result: ParsedSearchQuery = { rawQuery: query };

    // Extract bedrooms
    const bedroomMatch = normalized.match(/(\d+)\s*(?:bed(?:room)?s?|br)/);
    if (bedroomMatch) {
      result.bedrooms = parseInt(bedroomMatch[1], 10);
    }

    // Extract bathrooms
    const bathroomMatch = normalized.match(/(\d+)\s*(?:bath(?:room)?s?)/);
    if (bathroomMatch) {
      result.bathrooms = parseInt(bathroomMatch[1], 10);
    }

    // Extract property type
    for (const type of PROPERTY_TYPES) {
      if (normalized.includes(type)) {
        result.propertyType = type;
        break;
      }
    }

    // Extract listing type
    for (const [pattern, listingType] of Object.entries(LISTING_TYPES)) {
      if (normalized.includes(pattern)) {
        result.listingType = listingType;
        break;
      }
    }

    // Extract price constraints
    const pricePatterns = [
      /under\s+(?:₦)?(\d+(?:\.\d+)?)\s*(?:m(?:illion)?|k)?/i,
      /below\s+(?:₦)?(\d+(?:\.\d+)?)\s*(?:m(?:illion)?|k)?/i,
      /less\s+than\s+(?:₦)?(\d+(?:\.\d+)?)\s*(?:m(?:illion)?|k)?/i,
      /(?:₦)?(\d+(?:\.\d+)?)\s*(?:m(?:illion)?|k)?\s*(?:to|-)\s*(?:₦)?(\d+(?:\.\d+)?)\s*(?:m(?:illion)?|k)?/i,
    ];

    for (const pattern of pricePatterns) {
      const match = normalized.match(pattern);
      if (match) {
        const parseNum = (s: string, suffix?: string) => {
          let num = parseFloat(s);
          const fullStr = normalized.substring(normalized.indexOf(s));
          if (suffix?.includes("m") || fullStr.match(new RegExp(`${s}\\s*m`))) num *= 1_000_000;
          else if (suffix?.includes("k") || fullStr.match(new RegExp(`${s}\\s*k`))) num *= 1_000;
          else if (num < 1000) num *= 1_000_000; // assume millions for small numbers
          return num;
        };
        if (match[2]) {
          result.minPrice = parseNum(match[1]);
          result.maxPrice = parseNum(match[2]);
        } else {
          result.maxPrice = parseNum(match[1]);
        }
        break;
      }
    }

    // Extract features
    const matchedFeatures: string[] = [];
    for (const feature of FEATURES) {
      if (normalized.includes(feature)) {
        matchedFeatures.push(feature);
      }
    }
    if (matchedFeatures.length > 0) {
      result.features = matchedFeatures;
    }

    // Extract location (everything after "in" that isn't a known keyword)
    const locationMatch = normalized.match(/\bin\s+([a-z\s]+?)(?:\s+(?:under|below|less|for|with|above|\d).*)?$/);
    if (locationMatch) {
      result.location = locationMatch[1].trim();
    }

    return result;
  }, [query]);
}
