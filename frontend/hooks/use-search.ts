"use client";

import { useQuery } from "@tanstack/react-query";
import { search } from "@/lib/api";

export interface SearchFilters {
  q?: string;
  limit?: number;
  offset?: number;
  facets?: string[];
  filters?: string[];
  sort?: string[];
}

export function useSearch(filters: SearchFilters = {}) {
  return useQuery({
    queryKey: ["search", filters],
    queryFn: async () => {
      try {
        // Remove empty filters
        const cleanFilters = Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
        );
        
        // Handle array formatting if needed (axios might handle this, but adding for safety)
        if (cleanFilters.facets && Array.isArray(cleanFilters.facets)) {
          cleanFilters.facets = cleanFilters.facets.join(",");
        }

        const { data } = await search.search(cleanFilters);
        return data.data; // Assuming your API wraps response in { success: true, data: ... }
      } catch (err) {
        console.error("Search API failed:", err);
        return { hits: [], nbHits: 0, facets: {} };
      }
    },
    // Only search if there's a query or explicit filters
    enabled: !!filters.q || (filters.filters && filters.filters.length > 0)
  });
}

export function useSearchSuggestions(q: string, limit: number = 5) {
  return useQuery({
    queryKey: ["search-suggestions", q, limit],
    queryFn: async () => {
      if (!q) return [];
      try {
        const { data } = await search.suggestions({ q, limit });
        return data.data;
      } catch (err) {
        console.error("Suggestions API failed:", err);
        return [];
      }
    },
    enabled: q.length >= 2, // Start suggesting after 2 characters
  });
}
