"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { properties } from "@/lib/api";
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
      } catch (err: any) {
        if (process.env.NODE_ENV !== "development") throw err;
        console.warn("Using mock properties due to API fetch failure:", err);
        
        // Client-side filtering of mock data
        let result = [...MOCK_PROPERTIES];
        
        if (filters.category && filters.category.length > 0) {
          result = result.filter(p => filters.category!.includes(p.category));
        }
        
        if (filters.listingType && filters.listingType.length > 0) {
          result = result.filter(p => filters.listingType!.includes(p.listingType));
        }

        if (filters.minPrice) {
          result = result.filter(p => (p.price || 0) >= filters.minPrice!);
        }

        if (filters.maxPrice) {
          result = result.filter(p => (p.price || 0) <= filters.maxPrice!);
        }

        if (filters.search) {
          const s = filters.search.toLowerCase();
          result = result.filter(p => 
            p.title.toLowerCase().includes(s) || 
            (p.description && p.description.toLowerCase().includes(s)) ||
            (p.area && p.area.toLowerCase().includes(s)) ||
            (p.state && p.state.toLowerCase().includes(s)) ||
            (p.locationText && p.locationText.toLowerCase().includes(s))
          );
        }

        // Apply pagination
        const page = filters.page || 1;
        const limit = filters.limit || 24;
        const startIndex = (page - 1) * limit;
        const paginatedData = result.slice(startIndex, startIndex + limit);

        return {
          data: paginatedData,
          meta: {
            total: result.length,
            page,
            limit,
            totalPages: Math.ceil(result.length / limit) || 1,
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
        if (process.env.NODE_ENV !== "development") throw err;
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
        if (process.env.NODE_ENV !== "development") throw err;
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
      queryClient.invalidateQueries({ queryKey: ["property-versions"] });
      queryClient.invalidateQueries({ queryKey: ["property-price-history"] });
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

