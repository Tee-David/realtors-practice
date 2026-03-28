"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { users } from "@/lib/api";
import { useRef, useCallback } from "react";

export interface NotificationPreferences {
  notifEmailMatch: boolean;
  notifEmailPriceDrop: boolean;
  notifEmailScrapeComplete: boolean;
  notifInAppMatch: boolean;
  notifInAppPriceDrop: boolean;
  notifInAppScrapeComplete: boolean;
  notifQuietHoursEnabled: boolean;
  notifQuietStart: number;
  notifQuietEnd: number;
  notifDigestFrequency: string;
}

const DEFAULTS: NotificationPreferences = {
  notifEmailMatch: true,
  notifEmailPriceDrop: true,
  notifEmailScrapeComplete: true,
  notifInAppMatch: true,
  notifInAppPriceDrop: true,
  notifInAppScrapeComplete: true,
  notifQuietHoursEnabled: false,
  notifQuietStart: 23,
  notifQuietEnd: 7,
  notifDigestFrequency: "realtime",
};

export function useNotificationPreferences() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const res = await users.getNotificationPreferences();
      return res.data.data as NotificationPreferences;
    },
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) =>
      users.updateNotificationPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  /**
   * Debounced update — optimistically updates local cache,
   * then PATCHes backend after 500ms of inactivity.
   */
  const updatePref = useCallback(
    (key: keyof NotificationPreferences, value: boolean | number | string) => {
      // Optimistic update in cache
      queryClient.setQueryData(
        ["notification-preferences"],
        (old: NotificationPreferences | undefined) => ({
          ...(old || DEFAULTS),
          [key]: value,
        })
      );

      // Debounce the actual API call
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        mutation.mutate({ [key]: value });
      }, 500);
    },
    [queryClient, mutation]
  );

  return {
    prefs: prefs || DEFAULTS,
    isLoading,
    updatePref,
    isSaving: mutation.isPending,
  };
}
