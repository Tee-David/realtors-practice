"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface ScrapeJob {
  id: string;
  type: string;
  siteId?: string;
  siteIds: string[];
  sites?: Array<{ id: string; name: string }>;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  totalListings: number;
  newListings: number;
  updatedListings: number;
  duplicates: number;
  errors: number;
  // Legacy aliases used by UI
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  progressData?: LiveProgress | null;
  parameters?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export function useScrapeJobs(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ["scrape-jobs", limit, offset],
    queryFn: async () => {
      const { data } = await api.get(`/scrape/jobs`, { params: { limit, offset } });
      return data.data as ScrapeJob[];
    },
    // Refresh every 10 seconds to keep UI somewhat up-to-date even without sockets
    refetchInterval: 10000, 
  });
}

export function useScrapeJob(id: string) {
  return useQuery({
    queryKey: ["scrape-job", id],
    queryFn: async () => {
      const { data } = await api.get(`/scrape/jobs/${id}`);
      return data.data as ScrapeJob;
    },
    enabled: !!id,
  });
}

export interface LiveProgress {
  jobId: string;
  processed: number;
  total: number;
  currentSite?: string;
  currentPage?: number;
  maxPages?: number;
  pagesFetched?: number;
  propertiesFound?: number;
  duplicates?: number;
  errors?: number;
  timestamp: string;
}

export interface LiveProperty {
  title?: string;
  price?: number;
  location?: string;
  bedrooms?: number;
  bathrooms?: number;
  image?: string;
  source?: string;
  timestamp: string;
}

export interface StartScrapeParams {
  type: string;
  siteIds?: string[];
  searchQuery?: string;
  maxListingsPerSite?: number;
  parameters?: Record<string, any>;
  fullSync?: boolean; // legacy
  siteId?: string; // legacy
}

export function useStartScrape() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: StartScrapeParams) => {
      const { data } = await api.post("/scrape/start", params);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] });
    },
  });
}

export function useStopScrape() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data } = await api.post(`/scrape/jobs/${jobId}/stop`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] });
    },
  });
}
