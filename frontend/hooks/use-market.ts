import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface PricePerSqmData {
  area: string;
  avgPricePerSqm: number;
  count: number;
  avgPrice: number;
  avgArea: number;
}

export interface RentalYieldData {
  area: string;
  avgSalePrice: number;
  avgMonthlyRent: number;
  annualYield: number;
  count: number;
}

export interface DaysOnMarketData {
  area: string;
  avgDays: number;
  medianDays: number;
  count: number;
}

export interface ComparableProperty {
  id: string;
  title: string;
  price: number;
  bedrooms: number;
  location: string;
  category: string;
  similarityScore: number;
  imageUrl?: string;
}

export interface MarketReport {
  pricePerSqm: PricePerSqmData[];
  rentalYield: RentalYieldData[];
  daysOnMarket: DaysOnMarketData[];
  mostViewed: { id: string; title: string; price: number; views: number; location: string }[];
}

export function usePricePerSqm() {
  return useQuery<PricePerSqmData[]>({
    queryKey: ["market", "price-per-sqm"],
    queryFn: async () => {
      const { data } = await api.get("/market/price-per-sqm");
      return data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useRentalYield() {
  return useQuery<RentalYieldData[]>({
    queryKey: ["market", "rental-yield"],
    queryFn: async () => {
      const { data } = await api.get("/market/rental-yield");
      return data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useDaysOnMarket() {
  return useQuery<DaysOnMarketData[]>({
    queryKey: ["market", "days-on-market"],
    queryFn: async () => {
      const { data } = await api.get("/market/days-on-market");
      return data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useComparableProperties(propertyId: string | null) {
  return useQuery<ComparableProperty[]>({
    queryKey: ["market", "comparables", propertyId],
    queryFn: async () => {
      const { data } = await api.get(`/market/comparables/${propertyId}`);
      return data.data;
    },
    enabled: !!propertyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMarketReport() {
  return useQuery<MarketReport>({
    queryKey: ["market", "report"],
    queryFn: async () => {
      const { data } = await api.get("/market/report");
      return data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useMostViewed() {
  return useQuery<{ id: string; title: string; price: number; views: number; location: string }[]>({
    queryKey: ["market", "most-viewed"],
    queryFn: async () => {
      const { data } = await api.get("/market/most-viewed");
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
