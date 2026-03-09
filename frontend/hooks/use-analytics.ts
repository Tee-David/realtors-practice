// use-analytics.ts
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface KPIData {
  totalProperties: number;
  newPropertiesToday: number;
  averageQualityScore: number;
  activeDataSources: number;
}

export interface ChartData {
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export interface SiteRanking {
  site: {
    id: string;
    name: string;
    url: string;
    logoUrl: string | null;
  };
  score: number;
  metrics: {
    totalProperties: number;
    freshnessPercent: number;
    avgQuality: number;
  };
}

export function useDashboardKPIs() {
  return useQuery<KPIData>({
    queryKey: ["analytics", "kpis"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/kpis");
      return data.data; // Standard api response wrapper
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardCharts() {
  return useQuery<ChartData>({
    queryKey: ["analytics", "charts"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/charts");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSiteQualityRankings() {
  return useQuery<SiteRanking[]>({
    queryKey: ["analytics", "site-quality"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/site-quality");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
