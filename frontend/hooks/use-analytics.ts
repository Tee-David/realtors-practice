// use-analytics.ts
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface KPIData {
  totalProperties: number;
  newPropertiesToday: number;
  averageQualityScore: number;
  activeDataSources: number;
  totalSites?: number;
  forSale?: number;
  forRent?: number;
}

export interface ChartData {
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byListingType?: { listingType: string; count: number }[];
  avgPrice?: number;
  topAreas?: { area: string; count: number }[];
  topSites?: { name: string; count: number }[];
  recentProperties?: Record<string, unknown>[];
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

export function useListingVelocity() {
  return useQuery<{ date: string; count: number }[]>({
    queryKey: ["analytics", "listing-velocity"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/listing-velocity");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useActivityHeatmap() {
  return useQuery<{ day: number; hours: number[] }[]>({
    queryKey: ["analytics", "activity-heatmap"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/activity-heatmap");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface PriceTrendPoint {
  month: string;
  listingType: string;
  avgPrice: number;
  count: number;
}

export function usePriceTrends() {
  return useQuery<PriceTrendPoint[]>({
    queryKey: ["analytics", "price-trends"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/price-trends");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface KPITrends {
  totalProperties: { current: number; previous: number; changePercent: number };
  forSale: { current: number; previous: number; changePercent: number };
  forRent: { current: number; previous: number; changePercent: number };
  avgPrice: { current: number; previous: number; changePercent: number };
}

export function useKPITrends() {
  return useQuery<KPITrends>({
    queryKey: ["analytics", "kpi-trends"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/kpi-trends");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useWeeklySparkline() {
  return useQuery<{ week: string; count: number }[]>({
    queryKey: ["analytics", "weekly-sparkline"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/weekly-sparkline");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
