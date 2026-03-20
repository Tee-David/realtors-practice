"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiFeatures } from "@/lib/api";

interface AIFeature {
  key: string;
  value: { enabled: boolean };
}

export function useAIFeatures() {
  return useQuery({
    queryKey: ["ai-features"],
    queryFn: async () => {
      const { data } = await aiFeatures.list();
      return data.data as AIFeature[];
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export function useToggleAIFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      aiFeatures.toggle(key, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-features"] });
    },
  });
}
