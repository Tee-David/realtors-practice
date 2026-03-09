"use client";

import { useEffect, useRef, useState } from "react";
import io, { type Socket } from "socket.io-client";

interface UseSocketOptions {
  namespace?: string;
  autoConnect?: boolean;
}

export function useSocket({ namespace = "", autoConnect = true }: UseSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    const url = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000";
    const token = localStorage.getItem("rp_session");

    const socket = io(`${url}${namespace}`, {
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

    return () => {
      socket.disconnect();
    };
  }, [namespace, autoConnect]);

  return { socket: socketRef.current, isConnected };
}
