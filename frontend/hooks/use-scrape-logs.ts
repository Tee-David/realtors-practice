"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface ScrapeLog {
  id: string;
  jobId: string;
  siteId: string | null;
  level: string;
  message: string;
  details: Record<string, unknown> | null;
  timestamp: string;
  job?: {
    id: string;
    type: string;
    status: string;
    sites?: { id: string; name: string }[];
    createdBy?: { id: string; email: string; firstName: string };
  };
}

export interface ScrapeLogsFilters {
  page?: number;
  limit?: number;
  jobId?: string;
  level?: string;
  from?: string;
  to?: string;
  search?: string;
  siteId?: string;
}

export interface ScrapeLogsResponse {
  data: ScrapeLog[];
  total: number;
  page: number;
  limit: number;
}

export function useScrapeLogs(filters: ScrapeLogsFilters = {}) {
  const { page = 1, limit = 25, jobId, level, from, to, search, siteId } = filters;

  return useQuery({
    queryKey: ["scrape-logs", page, limit, jobId, level, from, to, search, siteId],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit };
      if (jobId) params.jobId = jobId;
      if (level) params.level = level;
      if (from) params.from = from;
      if (to) params.to = to;
      if (search) params.search = search;
      if (siteId) params.siteId = siteId;

      const { data } = await api.get("/scrape/logs", { params });
      return data as { success: boolean; data: ScrapeLog[]; pagination: { total: number; page: number; limit: number; pages: number } };
    },
    refetchInterval: 15000,
  });
}

export function useScrapeLogDetail(id: string) {
  return useQuery({
    queryKey: ["scrape-log", id],
    queryFn: async () => {
      const { data } = await api.get(`/scrape/logs/${id}`);
      return data.data as ScrapeLog;
    },
    enabled: !!id,
  });
}
