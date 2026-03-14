"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { supabase } from "@/lib/supabase";
type SocketInstance = ReturnType<typeof io>;

interface UseSocketOptions {
  namespace?: string;
  autoConnect?: boolean;
}

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace("/api", "");

export function useSocket({ namespace = "", autoConnect = true }: UseSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<SocketInstance | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    let cancelled = false;

    const connect = async () => {
      // Get Supabase JWT for socket auth (same token the API uses)
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;

      if (cancelled) return;

      const socket = io(`${SOCKET_URL}${namespace}`, {
        auth: { token },
        path: "/ws",
        autoConnect: true,
        reconnection: true,
      });

      socket.on("connect", () => {
        console.log(`Socket connected to ${namespace}`);
        setIsConnected(true);
      });

      socket.on("disconnect", () => {
        console.log(`Socket disconnected from ${namespace}`);
        setIsConnected(false);
      });

      socketRef.current = socket;
    };

    connect();

    return () => {
      cancelled = true;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [namespace, autoConnect]);

  return { socket: socketRef.current, isConnected };
}
