"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface Site {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  selectors: Record<string, string>;
  lastScrapedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useSites(limit = 20, offset = 0) {
  return useQuery({
    queryKey: ["sites", limit, offset],
    queryFn: async () => {
      const { data } = await api.get(`/sites`, { params: { limit, offset } });
      return data.data as Site[];
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
