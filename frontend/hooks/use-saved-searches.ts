"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { savedSearches } from "@/lib/api";
import { toast } from "sonner";

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
      toast.success("Saved search created");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to create saved search";
      toast.error(msg);
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
      toast.success("Saved search updated");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to update saved search";
      toast.error(msg);
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
      toast.success("Saved search deleted");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to delete saved search";
      toast.error(msg);
    },
  });
}
