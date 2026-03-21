"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sites } from "@/lib/api";

export interface SiteProfile {
  entryPoints?: Array<{
    url: string;
    path: string;
    category: string;
    listingType: string;
    propertyType: string;
    estimatedListings: number;
    estimatedPages: number;
    avgListingsPerPage: number;
    validated: boolean;
  }>;
  pagination?: {
    type: string;
    urlPattern?: string;
    maxPagesDetected: number;
  };
  fetching?: {
    antiBot: string;
    requiresJs: boolean;
    recommendedDelay: number;
    strategy: string;
  };
  apis?: Array<{ url: string; method: string; description: string }>;
  priceFormats?: string[];
  validation?: {
    samplesExtracted: number;
    samplesValid: number;
    confidence: number;
    sampleTitles: string[];
  };
  cssSelectors?: {
    hasListingSelectors: boolean;
    confidence: number;
    fieldCount: number;
  };
  estimates?: {
    totalListings: number;
    totalPages: number;
    scrapeTimeMinutes: number;
    llmCallsNeeded: number;
  };
  version?: number;
  learnDurationMs?: number;
  llmCallsUsed?: number;
}

export interface ScrapeEstimate {
  totalEstimatedMinutes: number;
  totalEstimatedListings: number;
  perSite: Array<{
    siteId: string;
    siteName: string;
    learned: boolean;
    estimatedMinutes: number;
    estimatedListings: number;
    confidence: number | null;
  }>;
  unlearnedCount: number;
}

export function useLearnSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (siteId: string) => {
      const { data } = await sites.learn(siteId);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    },
  });
}

export function useBulkLearnSites() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (siteIds: string[]) => {
      const { data } = await sites.learnBulk(siteIds);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    },
  });
}

export function useSiteProfile(siteId: string) {
  return useQuery({
    queryKey: ["site-profile", siteId],
    queryFn: async () => {
      const { data } = await sites.profile(siteId);
      return data.data as {
        id: string;
        name: string;
        baseUrl: string;
        learnStatus: string;
        learnedAt: string | null;
        siteProfile: SiteProfile | null;
        selectors: Record<string, unknown> | null;
        detailSelectors: Record<string, unknown> | null;
        listPaths: string[];
        avgListings: number;
        healthScore: number;
        lastScrapeAt: string | null;
      };
    },
    enabled: !!siteId,
  });
}

export function useScrapeEstimate() {
  return useMutation({
    mutationFn: async (siteIds: string[]) => {
      const { data } = await sites.estimate(siteIds);
      return data.data as ScrapeEstimate;
    },
  });
}
