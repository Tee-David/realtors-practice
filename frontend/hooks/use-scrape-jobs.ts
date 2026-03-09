"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface ScrapeJob {
  id: string;
  siteId?: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  startTime: string | null;
  endTime: string | null;
  errorMessage: string | null;
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

export function useStartScrape() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { siteId?: string; fullSync?: boolean }) => {
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
      const { data } = await api.post("/scrape/stop", { jobId });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] });
    },
  });
}
