"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiFeatures } from "@/lib/api";

export interface AIFeatureFlag {
  key: string;
  enabled: boolean;
  config?: Record<string, unknown> | null;
  updatedAt: string;
}

interface UseAIFeaturesResult {
  flags: Record<string, boolean>;
  flagList: AIFeatureFlag[];
  isEnabled: (key: string) => boolean;
  isLoading: boolean;
  isError: boolean;
}

export function useAIFeatures(): UseAIFeaturesResult {
  const { data, isLoading, isError } = useQuery<AIFeatureFlag[]>({
    queryKey: ["ai-features"],
    queryFn: async () => {
      const { data } = await aiFeatures.list();
      return data.data as AIFeatureFlag[];
    },
    staleTime: 60_000, // Flags rarely change — 60s stale time
    retry: 1,
  });

  const flagList = data ?? [];

  // Build a flat key → boolean record for quick lookups
  const flags: Record<string, boolean> = {};
  for (const f of flagList) {
    flags[f.key] = f.enabled;
  }

  const isEnabled = (key: string): boolean => flags[key] ?? false;

  return { flags, flagList, isEnabled, isLoading, isError };
}

export function useToggleAIFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      enabled,
      config,
    }: {
      key: string;
      enabled: boolean;
      config?: Record<string, unknown>;
    }) => aiFeatures.toggle(key, enabled, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-features"] });
    },
  });
}
