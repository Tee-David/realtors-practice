"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { systemSettings } from "@/lib/api";
import { toast } from "sonner";

interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  category: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch all settings for a given category, returned as a key-value map.
 */
export function useSettingsByCategory(category: string) {
  return useQuery({
    queryKey: ["system-settings", category],
    queryFn: async () => {
      const { data } = await systemSettings.getByCategory(category);
      const settings: SystemSetting[] = data.data || [];
      const map: Record<string, unknown> = {};
      for (const s of settings) {
        map[s.key] = s.value;
      }
      return map;
    },
    staleTime: 30_000,
  });
}

/**
 * Bulk-update settings for a category. Invalidates the category query on success.
 */
export function useUpdateSettings(category: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      const payload = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        category,
      }));
      const { data } = await systemSettings.bulkUpdate(payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings", category] });
      toast.success("Settings saved");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save settings");
    },
  });
}
