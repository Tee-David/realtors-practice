"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { properties, sites } from "@/lib/api";
import { MOCK_PROPERTIES } from "@/lib/mock-data";
import type { PropertyFilters } from "@/types/property";

export function useProperties(filters: PropertyFilters = {}) {
  return useQuery({
    queryKey: ["properties", filters],
    queryFn: async () => {
      try {
        const cleanFilters = Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
        );
        const { data } = await properties.list(cleanFilters);
        return data;
      } catch (err) {
        console.warn("Using mock properties due to API fetch failure:", err);
        return {
          data: MOCK_PROPERTIES,
          meta: {
            total: MOCK_PROPERTIES.length,
            page: filters.page || 1,
            limit: filters.limit || 24,
            totalPages: 1,
          },
        };
      }
    },
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      try {
        const { data } = await properties.get(id);
        return data.data;
      } catch (err) {
        console.warn(`Using mock property for ${id} due to API fetch failure:`, err);
        return MOCK_PROPERTIES.find((p) => p.id === id) || null;
      }
    },
    enabled: !!id,
  });
}

export function usePropertyVersions(id: string, page = 1) {
  return useQuery({
    queryKey: ["property-versions", id, page],
    queryFn: async () => {
      const { data } = await properties.versions(id, { page });
      return data;
    },
    enabled: !!id,
  });
}

export function usePropertyPriceHistory(id: string) {
  return useQuery({
    queryKey: ["property-price-history", id],
    queryFn: async () => {
      const { data } = await properties.priceHistory(id);
      return data.data;
    },
    enabled: !!id,
  });
}

export function usePropertyStats() {
  return useQuery({
    queryKey: ["property-stats"],
    queryFn: async () => {
      try {
        const { data } = await properties.stats();
        return data.data;
      } catch (err) {
        console.warn("Using mock property stats due to API fetch failure:", err);
        return {
          total: MOCK_PROPERTIES.length,
          byCategory: [
            { category: "RESIDENTIAL", count: MOCK_PROPERTIES.filter(p => p.category === "RESIDENTIAL").length },
            { category: "COMMERCIAL", count: MOCK_PROPERTIES.filter(p => p.category === "COMMERCIAL").length },
            { category: "LAND", count: MOCK_PROPERTIES.filter(p => p.category === "LAND").length },
          ],
          byStatus: [
            { status: "AVAILABLE", count: MOCK_PROPERTIES.filter(p => p.status === "AVAILABLE").length },
            { status: "SOLD", count: MOCK_PROPERTIES.filter(p => p.status === "SOLD").length },
          ],
          byListingType: [
            { listingType: "SALE", count: MOCK_PROPERTIES.filter(p => p.listingType === "SALE").length },
            { listingType: "RENT", count: MOCK_PROPERTIES.filter(p => p.listingType === "RENT").length },
          ]
        };
      }
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      properties.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property"] });
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => properties.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useBulkAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; action: string }) => properties.bulkAction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useSites(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["sites", params],
    queryFn: async () => {
      const { data } = await sites.list(params);
      return data;
    },
  });
}
