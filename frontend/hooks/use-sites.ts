"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Site {
  id: string;
  key?: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  selectors: Record<string, string>;
  lastScrapeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SitesResponse {
  sites: Site[];
  total: number;
  page: number;
  limit: number;
}

export function useSites(page = 1, limit = 20, search?: string, enabled?: boolean) {
  const clampedLimit = Math.min(limit, 100); // Backend validator max is 100
  return useQuery({
    queryKey: ["sites", page, clampedLimit, search, enabled],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: clampedLimit };
      if (search) params.search = search;
      if (enabled !== undefined) params.enabled = enabled;
      const { data: response } = await api.get(`/sites`, { params });
      // response is the body from axios, which looks like: { success: true, data: [...], meta: { total, page, limit } }
      const sitesArray = Array.isArray(response.data) ? response.data : [];
      
      return {
        sites: sitesArray,
        total: response.meta?.total || sitesArray.length,
        page: response.meta?.page || page,
        limit: response.meta?.limit || limit
      } as SitesResponse;
    },
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: ["site", id],
    queryFn: async () => {
      const { data } = await api.get(`/sites/${id}`);
      return data.data as Site;
    },
    enabled: !!id,
  });
}

export function useToggleSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/sites/${id}/toggle`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    },
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/sites/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    },
  });
}

export function useAddSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Site>) => {
      const response = await api.post(`/sites`, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    },
  });
}

export function useBulkToggleSites() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, enable }: { ids: string[], enable: boolean }) => {
      const promises = ids.map(id => api.patch(`/sites/${id}/toggle`, { enabled: enable }));
      await Promise.all(promises);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    },
  });
}

export function useBulkDeleteSites() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const promises = ids.map(id => api.delete(`/sites/${id}`));
      await Promise.all(promises);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites"] });
    },
  });
}
