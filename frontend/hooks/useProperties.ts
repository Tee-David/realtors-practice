"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { properties, sites } from "@/lib/api";
import type { PropertyFilters } from "@/types/property";

export function useProperties(filters: PropertyFilters = {}) {
  return useQuery({
    queryKey: ["properties", filters],
    queryFn: async () => {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
      );
      const { data } = await properties.list(cleanFilters);
      return data;
    },
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data } = await properties.get(id);
      return data.data;
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
      const { data } = await properties.stats();
      return data.data;
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
