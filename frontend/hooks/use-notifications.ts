"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@/lib/api";
import { useEffect, useCallback } from "react";
import { useSocket } from "./use-socket";

export function useNotifications(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: async () => {
      const res = await notifications.list(params);
      return res.data;
    },
  });
}

export function useUnreadCount() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const res = await notifications.unreadCount();
      return res.data.data.count as number;
    },
    refetchInterval: 30000, // Poll every 30s as fallback
  });

  // Real-time updates via Socket.io
  const { socket } = useSocket({ namespace: "/notify" });

  const handleNewNotification = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return;
    socket.on("notification:new", handleNewNotification);
    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [socket, handleNewNotification]);

  return query;
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await notifications.markRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await notifications.markAllRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
}
