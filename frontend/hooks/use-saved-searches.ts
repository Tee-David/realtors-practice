"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { savedSearches } from "@/lib/api";

export function useSavedSearches() {
  return useQuery({
    queryKey: ["saved-searches"],
    queryFn: async () => {
      const res = await savedSearches.list();
      return res.data.data;
    },
  });
}

export function useSavedSearch(id: string) {
  return useQuery({
    queryKey: ["saved-searches", id],
    queryFn: async () => {
      const res = await savedSearches.get(id);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useSavedSearchMatches(id: string, params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["saved-search-matches", id, params],
    queryFn: async () => {
      const res = await savedSearches.getMatches(id, params);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await savedSearches.create(data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });
}

export function useUpdateSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await savedSearches.update(id, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await savedSearches.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
  });
}
