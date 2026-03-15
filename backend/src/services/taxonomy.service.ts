import { Logger } from "../utils/logger.util";

/**
 * Synonym map for common Nigerian property terminology.
 * Keys are lowercase normalized terms, values are arrays of synonyms.
 */
export const SYNONYM_MAP: Record<string, string[]> = {
  // Abbreviations
  "bq": ["boys quarters", "boys quarter", "bq", "b.q", "b.q."],
  "self con": ["self contained", "self-contained", "studio", "self con", "selfcon"],
  "s/c": ["self contained", "self-contained", "studio", "s/c"],
  "selfcon": ["self contained", "self-contained", "studio", "selfcon", "self con"],
  "studio": ["studio", "self contained", "self-contained", "self con", "selfcon"],
  "ensuite": ["en-suite", "ensuite", "en suite"],
  "sqm": ["square meters", "square metres", "sq.m", "sqm", "m2", "m\u00B2"],
  "sqft": ["square feet", "sq.ft", "sqft", "ft2", "ft\u00B2"],

  // Property types
  "flat": ["flat", "apartment", "block of flats"],
  "apartment": ["apartment", "flat", "block of flats"],
  "detached": ["detached duplex", "detached house", "fully detached"],
  "semi-detached": ["semi detached", "semi-detached", "semi detached duplex"],
  "terrace": ["terrace", "terraced", "terraced duplex", "terrace duplex"],
  "duplex": ["duplex", "detached duplex", "semi-detached duplex", "terraced duplex"],
  "bungalow": ["bungalow", "detached bungalow", "semi-detached bungalow"],
  "penthouse": ["penthouse", "pent house", "pent-house"],
  "maisonette": ["maisonette", "maisonnet"],
  "mini flat": ["mini flat", "miniflat", "mini-flat", "room and parlour", "room & parlour"],
  "room and parlour": ["room and parlour", "room & parlour", "mini flat"],

  // Nigerian-specific terms
  "boys quarters": ["boys quarters", "boys quarter", "bq", "b.q", "b.q."],
  "shortlet": ["short let", "shortlet", "short-let", "short stay"],
  "jv": ["joint venture", "jv", "j.v", "j/v"],
  "c of o": ["certificate of occupancy", "c of o", "c-of-o", "cofo"],
  "r of o": ["right of occupancy", "r of o", "r-of-o"],
  "governor consent": ["governor's consent", "governor consent", "gov consent"],
  "survey": ["survey plan", "surveyor's plan", "registered survey"],
  "deed": ["deed of assignment", "deed of conveyance"],
  "excision": ["excision", "gazette", "gazetted"],

  // Location abbreviations (Lagos)
  "vi": ["victoria island", "vi", "v.i", "v/i"],
  "vgc": ["victoria garden city", "vgc", "v.g.c"],
  "ajah": ["ajah", "aja"],
  "lekki": ["lekki", "lekki phase 1", "lekki phase 2"],
  "ikoyi": ["ikoyi", "old ikoyi", "banana island"],

  // Condition/Status
  "newly built": ["newly built", "new build", "brand new", "new construction"],
  "off plan": ["off plan", "off-plan", "under construction", "pre-construction"],
  "serviced": ["serviced", "fully serviced", "well serviced"],
  "furnished": ["furnished", "fully furnished", "part furnished", "semi furnished"],
  "unfurnished": ["unfurnished", "not furnished", "bare"],

  // Amenities
  "gen": ["generator", "gen", "standby generator", "power backup"],
  "ac": ["air conditioning", "air conditioner", "a/c", "ac"],
  "pop": ["plaster of paris", "pop", "p.o.p", "pop ceiling"],
  "cctv": ["cctv", "security camera", "surveillance camera"],
  "swimming pool": ["swimming pool", "pool"],
  "gym": ["gymnasium", "gym", "fitness center", "fitness centre"],
};

/**
 * Reverse lookup map: maps each synonym variation back to the canonical term.
 */
const REVERSE_MAP: Map<string, string> = new Map();

for (const [canonical, synonyms] of Object.entries(SYNONYM_MAP)) {
  for (const syn of synonyms) {
    REVERSE_MAP.set(syn.toLowerCase(), canonical);
  }
  REVERSE_MAP.set(canonical.toLowerCase(), canonical);
}

export class TaxonomyService {
  /**
   * Normalize a property term using the synonym map.
   * Returns the canonical form if found, otherwise returns the original term.
   */
  static normalize(term: string): string {
    try {
      const lower = term.toLowerCase().trim();

      // Direct match
      if (SYNONYM_MAP[lower]) {
        return SYNONYM_MAP[lower][0]; // Return the first (canonical) synonym
      }

      // Reverse lookup
      const canonical = REVERSE_MAP.get(lower);
      if (canonical && SYNONYM_MAP[canonical]) {
        return SYNONYM_MAP[canonical][0];
      }

      // Partial match: check if term contains any key
      for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
        if (lower.includes(key) || synonyms.some((s) => lower.includes(s.toLowerCase()))) {
          return synonyms[0];
        }
      }

      return term;
    } catch (error: any) {
      Logger.error(`Error in TaxonomyService.normalize: ${error.message}`);
      return term;
    }
  }

  /**
   * Get all synonyms for a given term.
   * Returns an empty array if no synonyms are found.
   */
  static getSynonyms(term: string): string[] {
    try {
      const lower = term.toLowerCase().trim();

      // Direct match
      if (SYNONYM_MAP[lower]) {
        return SYNONYM_MAP[lower];
      }

      // Reverse lookup
      const canonical = REVERSE_MAP.get(lower);
      if (canonical && SYNONYM_MAP[canonical]) {
        return SYNONYM_MAP[canonical];
      }

      return [];
    } catch (error: any) {
      Logger.error(`Error in TaxonomyService.getSynonyms: ${error.message}`);
      return [];
    }
  }

  /**
   * Get the full synonym map (useful for admin/debugging).
   */
  static getSynonymMap(): Record<string, string[]> {
    return { ...SYNONYM_MAP };
  }

  /**
   * Normalize bathroom counts from Nigerian listing text.
   * "2.5 baths" -> 3, "1.5 bathrooms" -> 2, "half bath" -> 1
   * Rounds up fractional values (a half-bath still counts as a bathroom).
   */
  static normalizeBathrooms(text: string): number | null {
    try {
      const lower = text.toLowerCase().trim();

      // Match patterns like "2.5 baths", "3 bathrooms", "1.5 bath"
      const bathMatch = lower.match(/([\d.]+)\s*(?:bath(?:room)?s?|baths?)/);
      if (bathMatch) {
        return Math.ceil(parseFloat(bathMatch[1]));
      }

      // Match "half bath" -> 1
      if (/half\s*bath/.test(lower)) {
        return 1;
      }

      // Plain number
      const numMatch = lower.match(/^(\d+(?:\.\d+)?)$/);
      if (numMatch) {
        return Math.ceil(parseFloat(numMatch[1]));
      }

      return null;
    } catch (error: any) {
      Logger.error(`Error in TaxonomyService.normalizeBathrooms: ${error.message}`);
      return null;
    }
  }
}

/**
 * Convenience function: normalize a full text block by replacing all known
 * synonyms with their canonical forms. Useful for search indexing and scraper output.
 */
export function normalizeTaxonomy(text: string): string {
  return TaxonomyService.normalize(text);
}
