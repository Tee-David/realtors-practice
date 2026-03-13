"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
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

    const url = SOCKET_URL;
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
